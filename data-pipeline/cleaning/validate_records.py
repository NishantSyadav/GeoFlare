"""Validate a completed GeoFlare cleaning run without changing its data.

Run from the project root:
    python data-pipeline/cleaning/validate_records.py --run data/processed/RUN

Uses only Python's standard library and the existing pipeline modules.
Checks saved bytes, schema, normalized values/IDs, global uniqueness, counts,
dates, flags, types, and audit files. This checks consistency with pipeline-v1;
it does not independently establish sensor accuracy or observation coverage.
"""

import argparse
from collections import Counter
from datetime import date, datetime, timezone
import csv
import gzip
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import tempfile

PIPELINE_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = PIPELINE_DIR.parent
sys.path.insert(0, str(PIPELINE_DIR))

from cleaning.clean_records import (
    DUPLICATE_COLUMNS, OUTPUT_COLUMNS, REJECT_COLUMNS,
    absent_calendar_dates, sha256_file,
)
from schemas.hotspot_schema import PIPELINE_VERSION, normalize_record

COUNT_FIELDS = ("input_rows", "accepted_rows", "rejected_rows", "duplicate_rows")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def count(value, label):
    require(type(value) is int and value >= 0, f"{label}: invalid count")
    return value


def within(base, relative):
    """Resolve a report path while keeping it inside its expected directory."""
    require(isinstance(relative, str) and relative, "Missing report path")
    path = Path(relative)
    require(not path.is_absolute(), f"Expected relative path: {relative}")
    resolved = (base / path).resolve()
    require(resolved.is_relative_to(base.resolve()), f"Path outside directory: {relative}")
    return resolved


def rows(path, columns):
    """Read through gzip EOF so truncated data and CRC errors are detected."""
    with gzip.open(path, "rt", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle, strict=True)
        require(next(reader, None) == columns, f"{path.name}: unexpected header")
        for values in reader:
            require(len(values) == len(columns),
                    f"{path.name}:{reader.line_num}: wrong field count")
            yield reader.line_num, dict(zip(columns, values))


def check_code(path, expected_hash, warnings):
    raw = path.read_bytes()
    actual = hashlib.sha256(raw).hexdigest()
    if actual == expected_hash:
        return
    # A Windows checkout can change LF to CRLF without changing the code.
    lf = raw.replace(b"\r\n", b"\n")
    variants = (lf, lf.replace(b"\n", b"\r\n"))
    require(any(hashlib.sha256(v).hexdigest() == expected_hash for v in variants),
            f"{path.name}: code differs from the cleaning run")
    warnings.append(f"{path.name}: fingerprint differs only in LF/CRLF line endings")


def check_date_counts(values, label):
    require(isinstance(values, dict), f"{label}: expected date counts")
    for day, total in values.items():
        require(date.fromisoformat(day).isoformat() == day, f"{label}: invalid date")
        require(count(total, label) > 0, f"{label}: non-positive daily count")


def check_metadata(report):
    require(report["status"] == "complete", "Processing report is not complete")
    require(report["processing_version"] == PIPELINE_VERSION,
            "Processing version does not match this validator's schema")
    require(report["output_columns"] == OUTPUT_COLUMNS, "Report schema differs from code")
    datasets = report["datasets"]
    require(isinstance(datasets, list) and datasets, "Report has no datasets")
    require(count(report["source_files_found"], "source_files_found") == len(datasets),
            "Dataset count differs from source_files_found")
    for key in ("dataset", "source_file", "output_file"):
        require(len({d[key] for d in datasets}) == len(datasets), f"Repeated {key} in report")
    for d in datasets:
        name = d["dataset"]
        for key in COUNT_FIELDS:
            count(d[key], f"{name}.{key}")
        require(d["input_rows"] == sum(d[k] for k in COUNT_FIELDS[1:]),
                f"{name}: input rows do not reconcile")
        for key in ("input_rows_by_date", "accepted_rows_by_date"):
            check_date_counts(d[key], f"{name}.{key}")
        require(sum(d["accepted_rows_by_date"].values()) == d["accepted_rows"],
                f"{name}: accepted daily totals do not reconcile")
        missing_dates = count(d["rows_without_usable_input_date"], "unusable input dates")
        require(sum(d["input_rows_by_date"].values()) + missing_dates == d["input_rows"],
                f"{name}: input daily totals do not reconcile")
        for prefix, dates in (("observed_input", d["input_rows_by_date"]),
                              ("accepted", d["accepted_rows_by_date"])):
            require(d[prefix + "_start"] == (min(dates) if dates else None)
                    and d[prefix + "_end"] == (max(dates) if dates else None),
                    f"{name}: {prefix} date range does not reconcile")
        require(d["dates_without_input_records_in_calendar_years"] ==
                absent_calendar_dates(d["input_rows_by_date"]),
                f"{name}: absent-date list does not match supplied dates")
    for key in COUNT_FIELDS:
        require(count(report["totals"][key], key) == sum(d[key] for d in datasets),
                f"Report total {key} does not match dataset totals")


def check_record(row):
    """Round-trip saved fields through the same reusable normalizer.

    The computed record_id also verifies the normalized record payload.
    Exact CSV serialization is compared; optional blanks stay null, not zero.
    """
    stamp = row["acq_datetime_utc"]
    raw = {k: row[k] for k in ("latitude", "longitude", "brightness", "bright_t31",
                               "scan", "track", "daynight")}
    raw.update(acq_date=stamp[:10], acq_time=stamp[11:13] + stamp[14:16],
               instrument=row["sensor"], satellite=row["satellite_raw"],
               confidence=row["confidence_raw"], frp=row["frp_mw"],
               type=row["hotspot_type"], version=row["source_version"])
    expected = normalize_record(raw, row["source_product"])
    for key, value in expected.items():
        if key == "quality_flags":
            require(json.loads(row[key]) == value, "quality_flags differ from schema")
        else:
            text = "" if value is None else str(value)
            require(row[key] == text, f"{key} differs from schema or record identity")
    return expected


def check_dataset(d, run, connection, source_id):
    name = d["dataset"]
    path = within(run, d["output_file"])
    require(path.name == f"{name}_clean.csv.gz", f"{name}: unexpected output filename")
    require(sha256_file(path) == d["output_sha256"], f"{name}: output SHA-256 mismatch")
    raw_path = within(PROJECT_ROOT, d["source_file"])
    require(sha256_file(raw_path) == d["source_sha256"], f"{name}: source SHA-256 mismatch")
    days, flags, types = Counter(), Counter(), Counter()
    n, previous_source_row = 0, 1
    for physical_line, row in rows(path, OUTPUT_COLUMNS):
        n += 1
        try:
            require(row["source_file"] == d["source_file"], "wrong source_file")
            require(row["source_product"] == d["source_product"], "wrong source_product")
            source_row = int(row["source_row"])
            require(str(source_row) == row["source_row"] and source_row > previous_source_row,
                    "source_row must be increasing physical line numbers >= 2")
            previous_source_row = source_row
            expected = check_record(row)
            key = bytes.fromhex(expected["record_id"][4:])
            cursor = connection.execute("INSERT OR IGNORE INTO seen VALUES (?, ?, ?)",
                                        (key, source_id, source_row))
            require(cursor.rowcount == 1, "duplicate record_id across saved outputs")
            days[row["acq_datetime_utc"][:10]] += 1
            flags.update(expected["quality_flags"])
            types[str(expected["hotspot_type"])] += 1
        except (ValueError, TypeError, KeyError) as error:
            raise ValueError(f"{name}, CSV line {physical_line}: {error}") from error
        if n % 100000 == 0:
            connection.commit()
            print(f"  Checked {n:,} rows...", flush=True)
    connection.commit()
    for actual, expected, label in (
        (n, d["accepted_rows"], "accepted row count"),
        (dict(days), d["accepted_rows_by_date"], "accepted daily counts"),
        (dict(flags), d["accepted_quality_flags"], "quality flag counts"),
        (dict(types), d["accepted_hotspot_types"], "hotspot type counts"),
    ):
        require(actual == expected, f"{name}: {label} mismatch")
    require(sha256_file(path) == d["output_sha256"], f"{name}: output changed during validation")
    start, end = (min(days), max(days)) if days else (None, None)
    absent = d["dates_without_input_records_in_calendar_years"]
    print(f"  PASS: {n:,} rows | {start} to {end}", flush=True)
    return {"dataset": name, "status": "passed", "rows_checked": n,
            "accepted_start": start, "accepted_end": end,
            "output_sha256": d["output_sha256"], "source_sha256": d["source_sha256"],
            "quality_flags": dict(flags), "hotspot_types": dict(types),
            "dates_without_supplied_records": absent}


def check_audits(report, run, connection):
    sources = {d["source_file"]: (i, d) for i, d in enumerate(report["datasets"])}
    audit_counts = {}
    for filename, columns, key in (
        ("rejected_rows.csv.gz", REJECT_COLUMNS, "rejected_rows"),
        ("duplicate_rows.csv.gz", DUPLICATE_COLUMNS, "duplicate_rows"),
    ):
        totals, reasons = Counter(), {s: Counter() for s in sources}
        for line, row in rows(run / filename, columns):
            source = row["source_file"]
            require(source in sources, f"{filename}:{line}: unknown source")
            require(int(row["source_row"]) >= 2, f"{filename}:{line}: invalid source_row")
            require(isinstance(json.loads(row["raw_values_json"]), list),
                    f"{filename}:{line}: raw_values_json is not an array")
            totals[source] += 1
            if key == "rejected_rows":
                reasons[source][row["reason"]] += 1
            else:
                identifier = row["record_id"]
                require(identifier.startswith("gf1_") and len(identifier) == 68,
                        f"{filename}:{line}: invalid record_id")
                kept = connection.execute("SELECT source_id, source_row FROM seen WHERE id=?",
                                          (bytes.fromhex(identifier[4:]),)).fetchone()
                kept_source = sources.get(row["kept_source_file"])
                require(kept_source is not None and
                        kept == (kept_source[0], int(row["kept_source_row"])),
                        f"{filename}:{line}: retained record does not match")
        for source, (_, d) in sources.items():
            require(totals[source] == d[key], f"{filename}: count mismatch for {source}")
            if key == "rejected_rows":
                require(dict(reasons[source]) == d["rejection_reasons"],
                        f"{filename}: rejection reasons mismatch for {source}")
        audit_counts[key] = sum(totals.values())
    return audit_counts


def validate(run, result):
    report_path = run / "processing_report.json"
    report_hash = sha256_file(report_path)
    report = json.loads(report_path.read_text(encoding="utf-8-sig"))
    result["processing_report_sha256"] = report_hash
    check_metadata(report)
    for filename, key in (("schemas/hotspot_schema.py", "normalizer_sha256"),
                          ("cleaning/clean_records.py", "processor_sha256")):
        check_code(PIPELINE_DIR / filename, report[key], result["warnings"])
    expected = {within(run, d["output_file"]) for d in report["datasets"]}
    actual = {p.resolve() for p in run.rglob("*_clean.csv.gz")}
    require(actual == expected, "Missing or unreported cleaned files in the run directory")
    # A disk-backed index avoids loading millions of IDs into a Python set.
    with tempfile.TemporaryDirectory(prefix="geoflare_validation_") as temporary:
        connection = sqlite3.connect(str(Path(temporary) / "ids.sqlite3"))
        try:
            connection.execute("PRAGMA cache_size=-32768")
            connection.execute("PRAGMA journal_mode=OFF")
            connection.execute("PRAGMA synchronous=OFF")
            connection.execute("CREATE TABLE seen (id BLOB PRIMARY KEY, source_id INTEGER, "
                               "source_row INTEGER) WITHOUT ROWID")
            for i, d in enumerate(report["datasets"]):
                print(f"\nValidating {i + 1}/{len(report['datasets'])}: {d['dataset']}", flush=True)
                item = check_dataset(d, run, connection, i)
                result["datasets"].append(item)
                if item["dates_without_supplied_records"]:
                    result["warnings"].append(
                        f"{d['dataset']}: {len(item['dates_without_supplied_records'])} "
                        "calendar dates have no supplied records; coverage/cause unknown")
                if item["quality_flags"]:
                    result["warnings"].append(f"{d['dataset']}: retained quality flags need review")
            unique = connection.execute("SELECT COUNT(*) FROM seen").fetchone()[0]
            require(unique == report["totals"]["accepted_rows"], "Unique ID total mismatch")
            result["audit_counts"] = check_audits(report, run, connection)
            result["unique_record_ids"] = unique
        finally:
            connection.close()
    require(sha256_file(report_path) == report_hash, "Processing report changed during validation")
    result["totals"] = report["totals"]
    result["status"] = "passed"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", required=True, type=Path, help="Completed run folder")
    args = parser.parse_args()
    run = args.run if args.run.is_absolute() else PROJECT_ROOT / args.run
    run = run.resolve()
    if not run.is_dir():
        parser.error(f"Run directory not found: {run}")
    result = {
        "status": "running", "validator_version": "validation-v1",
        "run_directory": str(run),
        "started_at_utc": datetime.now(timezone.utc).isoformat(),
        "datasets": [], "warnings": [],
        "notes": [
            "Passed means saved outputs are consistent with the processing report and current schema.",
            "This reuses normalize_record; it is not independent scientific validation of that function.",
            "Absent dates do not establish zero fires or a sensor outage; coverage is unknown.",
            "Normalized observations are not harmonized fire-activity estimates.",
            "Source CSVs and saved outputs are opened read-only. Only this validation report is saved.",
        ],
    }
    try:
        validate(run, result)
    except (OSError, EOFError, ValueError, KeyError, TypeError, AttributeError, sqlite3.Error) as error:
        result["status"] = "failed"
        result["error"] = str(error)
    result["finished_at_utc"] = datetime.now(timezone.utc).isoformat()
    # One small report replaces terminal dumps of thousands of date counts.
    report_path = run / "validation_report.json"
    temporary_path = run / ".validation_report.json.tmp"
    try:
        temporary_path.write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
        temporary_path.replace(report_path)
    except OSError as error:
        print(f"FAILED to save validation report: {error}", file=sys.stderr)
        return 1
    print(f"\nValidation: {result['status'].upper()}")
    if result["status"] == "passed":
        print(f"Datasets: {len(result['datasets'])} | Rows checked: {result['unique_record_ids']:,}")
    else:
        print(f"Reason: {result['error']}")
    print(f"Warnings: {len(result['warnings'])} (details in report)")
    print(f"Report: {report_path}")
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
