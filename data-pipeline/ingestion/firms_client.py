"""Bounded NASA FIRMS area CSV fetcher; credentials are never logged or saved."""
import argparse
from collections import Counter
import csv
from datetime import datetime, timedelta, timezone
import hashlib
from http.client import HTTPException
import io
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

PIPELINE_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = PIPELINE_DIR.parent
sys.path.insert(0, str(PIPELINE_DIR))
from ingestion.adapters import API_SOURCES, check_bbox, inspect_response, iso_date

BASE = "https://firms.modaps.eosdis.nasa.gov"
MAX_DAYS = 366
MAX_BYTES = 16 * 1024 * 1024
TRANSIENT = {408, 429, 500, 502, 503, 504}


def write_new(path, payload):
    with path.open("xb") as handle:
        handle.write(payload)


def write_json_new(path, value):
    write_new(path, json.dumps(value, indent=2, allow_nan=False).encode("utf-8"))


def plan_windows(start, end, window_days=5, available=None):
    first, last = iso_date(start), iso_date(end)
    if first > last or (last - first).days + 1 > MAX_DAYS:
        raise ValueError("Date range must be ordered and contain at most 366 inclusive days")
    if type(window_days) is not int or not 1 <= window_days <= 5:
        raise ValueError("FIRMS area windows must contain 1 to 5 days")
    lower, upper = available if available is not None else (first, last)
    windows = []
    current = first
    while current <= last:
        available_now = lower <= current <= upper
        boundary = last
        if current < lower:
            boundary = min(boundary, lower - timedelta(days=1))
        elif available_now:
            boundary = min(boundary, upper)
        finish = current + timedelta(days=min(window_days - 1, (boundary - current).days))
        windows.append({"start": current.isoformat(), "end": finish.isoformat(),
                        "days": (finish - current).days + 1,
                        "availability": ("unchecked" if available is None else
                                         "available" if available_now else "unavailable")})
        if finish == last:
            break
        current = finish + timedelta(days=1)
    return windows


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # A MAP key is in the path; never forward it through a redirect.
        return None


def http_transport(url, timeout, byte_limit):
    request = Request(url, headers={"Accept": "text/csv", "User-Agent": "GeoFlare/1"})
    opener = build_opener(NoRedirect())
    try:
        response = opener.open(request, timeout=timeout)
    except HTTPError as error:
        response = error
    with response:
        body = response.read(byte_limit + 1)
        return response.code, body[:byte_limit], len(body) <= byte_limit


def request_bytes(url, key, output, label, timeout, retries, transport, sleep):
    """Save bounded attempt evidence; never serialize exceptions or secret URLs."""
    attempts = []
    for index in range(retries + 1):
        status, body, complete = None, None, True
        error = None
        try:
            status, body, complete = transport(url, timeout, MAX_BYTES)
        except (OSError, URLError, TimeoutError, HTTPException):
            error = "transport_error"
        # Error bodies may echo a key. Do not persist such bytes, even in raw logs.
        secret_echo = body is not None and key.lower().encode("utf-8") in body.lower()
        evidence = {"attempt": index + 1, "http_status": status, "complete": complete,
                    "received_at_utc": datetime.now(timezone.utc).isoformat(),
                    "body_sha256": hashlib.sha256(body).hexdigest() if body is not None else None,
                    "body_bytes": len(body) if body is not None else None, "raw_file": None}
        if secret_echo:
            error = "credential_echo_body_not_saved"
        elif body is not None:
            filename = f"{label}_attempt_{index + 1}." + ("csv" if complete else "partial")
            write_new(output / filename, body)
            evidence["raw_file"] = filename
        if not complete:
            error = "response_exceeds_byte_limit"
        if status is not None and status != 200 and error is None:
            error = f"http_{status}"
        evidence["error"] = error
        write_json_new(output / f"{label}_attempt_{index + 1}.json", evidence)
        attempts.append(evidence)
        if error is None:
            return body, attempts, None
        retryable = complete and not secret_echo and (status in TRANSIENT or error == "transport_error")
        if not retryable or index == retries:
            return None, attempts, error
        sleep(min(2 ** index, 8))


def parse_availability(body, source):
    reader = csv.DictReader(io.StringIO(body.decode("utf-8-sig"), newline=""), strict=True)
    if reader.fieldnames != ["data_id", "min_date", "max_date"]:
        raise ValueError("Unsupported availability CSV schema")
    matching = []
    for row in reader:
        if None in row or any(value is None for value in row.values()):
            raise ValueError("Malformed availability row")
        if row["data_id"] == source:
            start, end = iso_date(row["min_date"]), iso_date(row["max_date"])
            if start > end:
                raise ValueError("Reversed availability interval")
            matching.append((start, end))
    if len(matching) != 1:
        raise ValueError("Availability must identify the selected source exactly once")
    return matching[0]


def fetch(source, start, end, bbox, output, key, window_days=5, timeout=30,
          retries=2, root=PROJECT_ROOT, transport=http_transport, sleep=time.sleep):
    if source not in API_SOURCES:
        raise ValueError("Unsupported API source")
    check_bbox(bbox)
    plan_windows(start, end, window_days)
    if not 1 <= timeout <= 120 or type(retries) is not int or not 0 <= retries <= 3:
        raise ValueError("Timeout must be 1-120 seconds and retries 0-3")
    if not key or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", key):
        raise ValueError("FIRMS_MAP_KEY is absent or malformed")
    output = output.resolve()
    if not output.is_relative_to(root.resolve()):
        raise ValueError("Output directory must be inside the project root")
    output.mkdir(parents=True, exist_ok=False)
    report = {"schema_version": 1, "fetcher_version": "firms-fetch-v1", "status": "running",
              "fetcher_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              "area_endpoint": BASE + "/api/area/csv/",
              "availability_endpoint": BASE + "/api/data_availability/csv/",
              "source": source, "source_product": API_SOURCES[source], "start": start, "end": end,
              "bbox": bbox, "spatial_selection": "bounding_box_not_country_polygon",
              "window_days": window_days, "timeout_seconds": timeout, "max_retries": retries,
              "max_response_bytes": MAX_BYTES, "windows": [], "sources_manifest": "sources.json"}
    # This immutable request checkpoint survives an interrupted fetch.
    write_json_new(output / "request.json", report)
    sources = []
    availability_url = f"{BASE}/api/data_availability/csv/{key}/{source}"
    body, attempts, error = request_bytes(availability_url, key, output, "availability",
                                          timeout, retries, transport, sleep)
    report["availability_attempts"] = attempts
    available = None
    if error is None:
        try:
            available = parse_availability(body, source)
        except (ValueError, UnicodeError, csv.Error):
            error = "invalid_availability_response"
    if error:
        report.update(status="failed", error=error)
    else:
        report["availability"] = {"start": available[0].isoformat(), "end": available[1].isoformat()}
        coordinates = ",".join(str(v) for v in bbox)
        for index, window in enumerate(plan_windows(start, end, window_days, available), 1):
            item = dict(window)
            if item["availability"] == "unavailable":
                item["outcome"] = "unavailable"
                report["windows"].append(item)
                continue
            label = f"window_{index:03d}"
            url = f"{BASE}/api/area/csv/{key}/{source}/{coordinates}/{item['days']}/{item['start']}"
            body, attempts, error = request_bytes(url, key, output, label, timeout, retries, transport, sleep)
            item["attempts"] = attempts
            row_count = None
            if error is None:
                try:
                    row_count = inspect_response(body, source)
                except (ValueError, UnicodeError, csv.Error):
                    error = "invalid_area_csv_response"
            if error:
                item.update(outcome="error", error=error)
            else:
                item.update(outcome="data" if row_count else "empty", response_rows=row_count)
                raw_path = output / attempts[-1]["raw_file"]
                descriptor = {
                    "dataset": f"api-{source.lower()}-{item['start']}-{item['end']}",
                    "source_file": raw_path.relative_to(root.resolve()).as_posix(),
                    "source_product": API_SOURCES[source], "api_source": source,
                    "adapter_id": "firms-area-csv", "adapter_version": 1,
                    "sha256": hashlib.sha256(body).hexdigest(),
                    "request": {"start": item["start"], "end": item["end"], "bbox": bbox},
                }
                sources.append(descriptor)
                item["dataset"] = descriptor["dataset"]
            write_json_new(output / (label + "_outcome.json"), item)
            report["windows"].append(item)
        failures = sum(item["outcome"] == "error" for item in report["windows"])
        report["status"] = "partial" if failures and sources else "failed" if failures else "complete"
    report["outcome_counts"] = dict(Counter(item["outcome"] for item in report["windows"]))
    report["finished_at_utc"] = datetime.now(timezone.utc).isoformat()
    write_json_new(output / "sources.json", {"schema_version": 1, "sources": sources})
    write_json_new(output / "fetch_report.json", report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, choices=sorted(API_SOURCES))
    parser.add_argument("--start", required=True)
    parser.add_argument("--end", required=True)
    parser.add_argument("--bbox", required=True, help="west,south,east,north; use --bbox=-... for negatives")
    parser.add_argument("--window-days", type=int, default=5)
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--output", type=Path, help="New project-relative or absolute directory")
    parser.add_argument("--dry-run", action="store_true", help="Plan without credentials, network or writes")
    args = parser.parse_args()
    try:
        bbox = [float(value) for value in args.bbox.split(",")]
        check_bbox(bbox)
        windows = plan_windows(args.start, args.end, args.window_days)
        if not 1 <= args.timeout <= 120 or not 0 <= args.retries <= 3:
            raise ValueError("Timeout must be 1-120 seconds and retries 0-3")
        if args.dry_run:
            print(json.dumps({"source": args.source, "bbox": bbox, "windows": windows,
                              "availability": "unchecked; live availability required before fetching"}, indent=2))
            return 0
        output = args.output or Path("data/raw/api") / datetime.now(timezone.utc).strftime("fetch_%Y%m%dT%H%M%S_%fZ")
        if not output.is_absolute():
            output = PROJECT_ROOT / output
        report = fetch(args.source, args.start, args.end, bbox, output,
                       os.environ.get("FIRMS_MAP_KEY"), args.window_days, args.timeout, args.retries)
        print(json.dumps({"status": report["status"], "outcome_counts": report["outcome_counts"],
                          "output": str(output)}, indent=2))
        return 1 if report["status"] in {"partial", "failed"} else 0
    except (ValueError, OSError, csv.Error):
        # Do not print exception messages: transport exceptions can contain key-bearing URLs.
        print("Fetch failed: check parameters, FIRMS_MAP_KEY, output path and saved attempt metadata.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
