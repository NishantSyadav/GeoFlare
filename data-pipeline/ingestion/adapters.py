"""Versioned, offline FIRMS CSV adapters. No downloads or invented request IDs."""
import csv
from datetime import date
import json
import math
from pathlib import Path
import re

API_SOURCES = {
    "MODIS_NRT": "M-C61", "MODIS_SP": "M-C61",
    "VIIRS_NOAA20_NRT": "J1V-C2", "VIIRS_NOAA20_SP": "J1V-C2",
    "VIIRS_NOAA21_NRT": "J2V-C2",
}
ARCHIVE_COLUMNS = set("latitude longitude brightness scan track acq_date acq_time "
                      "satellite instrument confidence version bright_t31 frp daynight type".split())
REQUIRED = ARCHIVE_COLUMNS - {"type", "brightness", "bright_t31"}


def iso_date(value):
    if not isinstance(value, str) or date.fromisoformat(value).isoformat() != value:
        raise ValueError("Expected ISO YYYY-MM-DD date")
    return date.fromisoformat(value)


def check_bbox(value):
    if (not isinstance(value, list) or len(value) != 4 or
            any(type(v) not in (int, float) or not math.isfinite(v) for v in value)):
        raise ValueError("bbox must contain four finite numbers")
    west, south, east, north = value
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise ValueError("bbox must be west,south,east,north without antimeridian crossing")
    return value


class CsvAdapter:
    def __init__(self, identifier, version, product):
        if (not isinstance(identifier, str) or type(version) is not int or
                (identifier, version) not in {("firms-archive-csv", 1), ("firms-area-csv", 1)}):
            raise ValueError("Unregistered adapter ID/version")
        if not isinstance(product, str) or product not in {"M-C61", "J1V-C2", "J2V-C2"}:
            raise ValueError("Unsupported canonical product family")
        self.identifier, self.version, self.product = identifier, version, product

    def check_header(self, header):
        fields = set(header)
        if len(fields) != len(header):
            raise ValueError("Repeated source column names")
        if self.identifier == "firms-archive-csv":
            if fields != ARCHIVE_COLUMNS:
                raise ValueError("Unexpected archive schema")
            return
        aliases = {"bright_ti4", "bright_ti5"} if self.product != "M-C61" else set()
        if not REQUIRED <= fields or not fields <= ARCHIVE_COLUMNS | aliases:
            raise ValueError("Unsupported/malformed FIRMS area CSV schema")
        for canonical, alternate in (("brightness", "bright_ti4"), ("bright_t31", "bright_ti5")):
            if canonical not in fields and alternate not in fields:
                raise ValueError("Missing brightness column: " + canonical)

    def adapt(self, raw):
        result = dict(raw)
        if self.identifier == "firms-area-csv" and self.product != "M-C61":
            for alias, canonical in (("bright_ti4", "brightness"), ("bright_ti5", "bright_t31")):
                if alias in raw:
                    if canonical in raw and raw[canonical].strip() != raw[alias].strip():
                        raise ValueError("Conflicting aliases: " + canonical + "/" + alias)
                    result[canonical] = raw[alias]
                    del result[alias]
        result.setdefault("type", "")
        return result


def descriptor_adapter(descriptor):
    return CsvAdapter(descriptor["adapter_id"], descriptor["adapter_version"], descriptor["source_product"])


def check_descriptor(descriptor, root):
    required = {"dataset", "source_file", "source_product", "adapter_id", "adapter_version", "sha256"}
    allowed = required | {"api_source", "request"}
    if not isinstance(descriptor, dict) or not required <= descriptor.keys() or descriptor.keys() - allowed:
        raise ValueError("Unsupported source descriptor fields")
    if any(not isinstance(descriptor[key], str) or not descriptor[key]
           for key in ("dataset", "source_file", "source_product", "adapter_id", "sha256")):
        raise ValueError("Source descriptor text fields must be nonempty strings")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,119}", descriptor["dataset"]):
        raise ValueError("Unsafe dataset identifier")
    if not re.fullmatch(r"[a-f0-9]{64}", descriptor["sha256"]):
        raise ValueError("Source descriptor requires SHA-256")
    path = Path(descriptor["source_file"])
    resolved = (root / path).resolve()
    if path.is_absolute() or not resolved.is_relative_to(root.resolve()):
        raise ValueError("Source file must be relative and inside project root")
    adapter = descriptor_adapter(descriptor)
    if adapter.identifier == "firms-area-csv":
        if descriptor["dataset"].startswith("DL_FIRE_"):
            raise ValueError("API datasets must not impersonate archive request identifiers")
        if (not isinstance(descriptor.get("api_source"), str) or
                API_SOURCES.get(descriptor.get("api_source")) != descriptor["source_product"]):
            raise ValueError("API source does not match canonical product family")
    elif "api_source" in descriptor:
        raise ValueError("Archive descriptor cannot claim an API source")
    request = descriptor.get("request")
    if request is not None:
        if not isinstance(request, dict) or set(request) != {"start", "end", "bbox"}:
            raise ValueError("Request needs start, end and bbox only")
        if iso_date(request["start"]) > iso_date(request["end"]):
            raise ValueError("Reversed request dates")
        check_bbox(request["bbox"])
    return resolved, adapter


def load_sources(path, root):
    manifest = json.loads(path.read_text(encoding="utf-8-sig"))
    if (not isinstance(manifest, dict) or set(manifest) != {"schema_version", "sources"} or
            type(manifest["schema_version"]) is not int or manifest["schema_version"] != 1):
        raise ValueError("Unsupported source manifest")
    if not isinstance(manifest["sources"], list) or not manifest["sources"]:
        raise ValueError("Source manifest has no sources")
    names, paths, sources = set(), set(), []
    for descriptor in manifest["sources"]:
        source, adapter = check_descriptor(descriptor, root)
        name = descriptor["dataset"]
        if name in names or source in paths:
            raise ValueError("Repeated dataset or source path")
        names.add(name)
        paths.add(source)
        sources.append((name, descriptor["source_product"], source, adapter, descriptor))
    return sorted(sources, key=lambda source: source[0])


def inspect_response(raw_bytes, source):
    """Strictly recognize area CSV, including valid header-only empty responses."""
    import io
    if source not in API_SOURCES:
        raise ValueError("Unsupported API source")
    adapter = CsvAdapter("firms-area-csv", 1, API_SOURCES[source])
    reader = csv.reader(io.StringIO(raw_bytes.decode("utf-8-sig"), newline=""), strict=True)
    header = next(reader, [])
    adapter.check_header(header)
    total = 0
    for values in reader:
        if not values:
            continue
        if len(values) != len(header):
            raise ValueError("Malformed API CSV row")
        adapter.adapt(dict(zip(header, values)))
        total += 1
    return total
