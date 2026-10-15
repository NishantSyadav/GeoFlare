"""Convert one FIRMS source row into GeoFlare's common format."""

from pathlib import Path
from datetime import date
import csv
import hashlib
import json
import math
import re


PIPELINE_VERSION = "pipeline-v1"

# File location: GeoFlare/data-pipeline/schemas/hotspot_schema.py
# parents[0] = schemas
# parents[1] = data-pipeline
# parents[2] = GeoFlare
PROJECT_ROOT = Path(__file__).resolve().parents[2]

EXTRACTED_DIR = PROJECT_ROOT / "data" / "raw" / "extracted"


PRODUCTS = {
    "M-C61": ("MODIS", {"Terra", "Aqua"}),
    "J1V-C2": ("VIIRS", {"NOAA-20"}),
    "J2V-C2": ("VIIRS", {"NOAA-21"}),
}

SATELLITES = {
    "T": "Terra",
    "Terra": "Terra",
    "A": "Aqua",
    "Aqua": "Aqua",
    "N20": "NOAA-20",
    "NOAA-20": "NOAA-20",
    "N21": "NOAA-21",
    "NOAA-21": "NOAA-21",
}

VIIRS_CONFIDENCE = {
    "l": "low",
    "low": "low",
    "n": "nominal",
    "nominal": "nominal",
    "h": "high",
    "high": "high",
}

MISSING = {"", "na", "n/a", "nan", "null", "none"}


def text_value(value):
    """Convert missing values to None; otherwise return stripped text."""
    if value is None:
        return None

    text = str(value).strip()

    return None if text.lower() in MISSING else text


def number(value, field, minimum, maximum=math.inf, required=False):
    """Convert a numeric value and validate its permitted range."""
    text = text_value(value)

    if text is None:
        if required:
            raise ValueError(f"{field}: missing value")
        return None

    try:
        result = float(text)
    except ValueError:
        raise ValueError(f"{field}: not numeric") from None

    if not math.isfinite(result) or not minimum <= result <= maximum:
        raise ValueError(f"{field}: outside permitted range")

    return 0.0 if result == 0 else result


def acquisition_time(raw):
    """Combine the source acquisition date and time into UTC format."""
    day = text_value(raw.get("acq_date")) or ""
    clock = text_value(raw.get("acq_time")) or ""

    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", day):
        raise ValueError("acq_date: expected YYYY-MM-DD")

    try:
        date.fromisoformat(day)
    except ValueError:
        raise ValueError("acq_date: invalid calendar date") from None

    if not re.fullmatch(r"[0-9]{1,4}", clock):
        raise ValueError("acq_time: expected HHMM")

    # Example: "35" becomes "0035".
    clock = clock.zfill(4)

    if int(clock[:2]) > 23 or int(clock[2:]) > 59:
        raise ValueError("acq_time: invalid hour or minute")

    return f"{day}T{clock[:2]}:{clock[2:]}:00Z"


def normalize_record(raw, source_product):
    """Validate and normalize one source record without modifying it."""
    if source_product not in PRODUCTS:
        raise ValueError(f"Unknown source product: {source_product}")

    sensor, allowed_satellites = PRODUCTS[source_product]

    instrument = (text_value(raw.get("instrument")) or "").upper()
    satellite_raw = text_value(raw.get("satellite"))
    satellite = SATELLITES.get(satellite_raw)

    if instrument != sensor:
        raise ValueError("instrument: does not match source product")

    if satellite not in allowed_satellites:
        raise ValueError("satellite: does not match source product")

    # Preserve each sensor's confidence meaning.
    confidence_raw = text_value(raw.get("confidence"))

    if confidence_raw is None:
        confidence = None

    elif sensor == "MODIS":
        confidence = number(confidence_raw, "confidence", 0, 100)

        if confidence.is_integer():
            confidence = int(confidence)

    else:
        confidence = VIIRS_CONFIDENCE.get(confidence_raw.lower())

        if confidence is None:
            raise ValueError("confidence: unknown VIIRS category")

    hotspot_type = number(raw.get("type"), "type", 0, 3)

    if hotspot_type is not None:
        if not hotspot_type.is_integer():
            raise ValueError("type: expected integer 0, 1, 2 or 3")

        hotspot_type = int(hotspot_type)

    daynight = text_value(raw.get("daynight"))

    if daynight is not None:
        daynight = daynight.upper()

        if daynight not in {"D", "N"}:
            raise ValueError("daynight: expected D or N")

    record = {
        "latitude": number(
            raw.get("latitude"),
            "latitude",
            -90,
            90,
            required=True,
        ),
        "longitude": number(
            raw.get("longitude"),
            "longitude",
            -180,
            180,
            required=True,
        ),
        "acq_datetime_utc": acquisition_time(raw),
        "sensor": sensor,
        "satellite": satellite,
        "satellite_raw": satellite_raw,
        "confidence": confidence,
        "confidence_raw": confidence_raw,
        "confidence_scale": (
            "modis_0_100" if sensor == "MODIS" else "viirs_category"
        ),
        "frp_mw": number(raw.get("frp"), "frp", 0),
        "brightness": number(raw.get("brightness"), "brightness", 0),
        "bright_t31": number(raw.get("bright_t31"), "bright_t31", 0),
        "scan": number(raw.get("scan"), "scan", 0),
        "track": number(raw.get("track"), "track", 0),
        "daynight": daynight,
        "hotspot_type": hotspot_type,
        "source_product": source_product,
        "source_version": text_value(raw.get("version")),
    }

    # These physical quantities must be positive when supplied.
    for field in ("brightness", "bright_t31", "scan", "track"):
        if record[field] is not None and record[field] <= 0:
            raise ValueError(f"{field}: expected a positive value")

    flags = []

    # Missing optional fields remain None and receive a quality flag.
    for field in (
        "confidence",
        "frp_mw",
        "brightness",
        "bright_t31",
        "scan",
        "track",
        "daynight",
        "hotspot_type",
        "source_version",
    ):
        if record[field] is None:
            flags.append(f"missing_{field}")

    version = record["source_version"]

    if source_product == "M-C61" and version == "6.03":
        flags.append("source_collection_requires_verification")

    elif version is not None:
        recognized = (
            {"61.03", "6.1", "6.1NRT", "6.1RT", "6.1URT"}
            if sensor == "MODIS"
            else {"2", "2.0", "2.0NRT", "2.0RT", "2.0URT"}
        )

        if version not in recognized:
            flags.append("unrecognized_source_version")

    # Include all normalized source fields in the record identity.
    # File paths and row numbers are excluded.
    payload = json.dumps(
        record,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )

    record_id = hashlib.sha256(payload.encode("utf-8")).hexdigest()

    return {
        "record_id": f"gf1_{record_id}",
        **record,
        "processing_version": PIPELINE_VERSION,
        "quality_flags": flags,
    }


def preview_samples():
    """Print one normalized sample from each selected dataset."""
    examples = [
        ("DL_FIRE_M-C61_42739", "M-C61"),
        ("DL_FIRE_J1V-C2_42746", "J1V-C2"),
        ("DL_FIRE_J2V-C2_42747", "J2V-C2"),
    ]

    for folder_name, product in examples:
        dataset_folder = EXTRACTED_DIR / folder_name

        if not dataset_folder.is_dir():
            raise FileNotFoundError(
                f"Dataset folder not found: {dataset_folder}"
            )

        csv_files = sorted(dataset_folder.rglob("*.csv"))

        if len(csv_files) != 1:
            raise ValueError(
                f"{folder_name}: expected 1 CSV, found {len(csv_files)}"
            )

        with csv_files[0].open(
            "r",
            encoding="utf-8-sig",
            newline="",
        ) as file:
            reader = csv.DictReader(file)
            raw = next(reader, None)

        if raw is None:
            raise ValueError(
                f"{folder_name}: CSV contains no data rows"
            )

        normalized = normalize_record(raw, product)

        print(f"\nDataset: {folder_name}")
        print(json.dumps(normalized, indent=2, allow_nan=False))


if __name__ == "__main__":
    preview_samples()