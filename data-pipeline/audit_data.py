from pathlib import Path
from collections import Counter
from datetime import date
import csv
import hashlib
import json
import math
import re


PROJECT_ROOT = Path(__file__).resolve().parent.parent

ZIP_DIR = PROJECT_ROOT / "data" / "raw" / "zips"
EXTRACTED_DIR = PROJECT_ROOT / "data" / "raw" / "extracted"
REPORT_PATH = PROJECT_ROOT / "data" / "processed" / "audit_report.json"

EXPECTED_COLUMNS = [
    "latitude", "longitude", "brightness", "scan", "track",
    "acq_date", "acq_time", "satellite", "instrument",
    "confidence", "version", "bright_t31", "frp", "daynight", "type",
]

PROFILE_COLUMNS = [
    "instrument", "satellite", "version",
    "confidence", "daynight", "type",
]

MISSING_MARKERS = {"", "na", "n/a", "nan", "null", "none"}


def is_missing(value):
    return value.strip().lower() in MISSING_MARKERS


def valid_number(value, minimum, maximum=math.inf):
    try:
        number = float(value)
        return math.isfinite(number) and minimum <= number <= maximum
    except ValueError:
        return False


def valid_date(value):
    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        return False

    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def valid_time(value):
    # Allow omitted leading zeros: 35 means 0035.
    if not re.fullmatch(r"[0-9]{1,4}", value):
        return False

    padded = value.zfill(4)

    hour = int(padded[:2])
    minute = int(padded[2:])

    return hour < 24 and minute < 60


def expected_sensor(zip_name):
    if zip_name.startswith("DL_FIRE_M-C61_"):
        return "MODIS"

    if zip_name.startswith(("DL_FIRE_J1V-C2_", "DL_FIRE_J2V-C2_")):
        return "VIIRS"

    raise ValueError(f"Unrecognized source product: {zip_name}")


def audit_csv(csv_path, sensor):
    missing_counts = Counter({column: 0 for column in EXPECTED_COLUMNS})
    invalid_counts = Counter()
    profiles = {column: Counter() for column in PROFILE_COLUMNS}

    seen_hashes = set()
    date_counts = Counter()
    monthly_counts = Counter()
    date_checks = {}

    total_rows = 0
    malformed_rows = 0
    duplicate_rows = 0
    rows_with_missing = 0
    rows_with_invalid = 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.reader(file, strict=True)
        header = next(reader, [])

        if len(header) != len(set(header)):
            raise ValueError("Repeated column names in CSV header.")

        if set(header) != set(EXPECTED_COLUMNS):
            raise ValueError(f"Unexpected CSV columns: {header}")

        for raw_row in reader:
            # Match DictReader's treatment of completely empty lines.
            if not raw_row:
                continue

            total_rows += 1

            # Fingerprint all original field values before any stripping.
            encoded_row = json.dumps(
                raw_row, ensure_ascii=False, separators=(",", ":")
            ).encode("utf-8")

            fingerprint = hashlib.sha256(encoded_row).digest()

            if fingerprint in seen_hashes:
                duplicate_rows += 1
            else:
                seen_hashes.add(fingerprint)

            if len(raw_row) != len(header):
                malformed_rows += 1
                continue

            original = dict(zip(header, raw_row))

            # Stripping is only for checks; the CSV is never rewritten.
            row = {column: value.strip() for column, value in original.items()}

            missing_fields = {
                column for column, value in row.items()
                if is_missing(value)
            }

            for column in missing_fields:
                missing_counts[column] += 1

            if missing_fields:
                rows_with_missing += 1

            for column in PROFILE_COLUMNS:
                # Preserve the original spelling/value in the report.
                profiles[column][original[column]] += 1

            failed = set()

            numeric_rules = {
                "latitude": (-90, 90),
                "longitude": (-180, 180),
                "frp": (0, math.inf),
            }

            for column, limits in numeric_rules.items():
                if column not in missing_fields:
                    if not valid_number(row[column], *limits):
                        failed.add(column)

            if "acq_date" not in missing_fields:
                value = row["acq_date"]

                if value not in date_checks:
                    date_checks[value] = valid_date(value)

                if date_checks[value]:
                    date_counts[value] += 1
                    monthly_counts[value[:7]] += 1
                else:
                    failed.add("acq_date")

            if "acq_time" not in missing_fields:
                if not valid_time(row["acq_time"]):
                    failed.add("acq_time")

            if "instrument" not in missing_fields:
                if row["instrument"].upper() != sensor:
                    failed.add("instrument")

            if "confidence" not in missing_fields:
                confidence = row["confidence"]

                if sensor == "MODIS":
                    if not valid_number(confidence, 0, 100):
                        failed.add("confidence")
                else:
                    if confidence.lower() not in {"l", "n", "h"}:
                        failed.add("confidence")

            if "daynight" not in missing_fields:
                if row["daynight"].upper() not in {"D", "N"}:
                    failed.add("daynight")

            invalid_counts.update(failed)

            if failed:
                rows_with_invalid += 1

    return {
        "csv": str(csv_path.relative_to(PROJECT_ROOT)),
        "expected_sensor": sensor,
        "total_rows": total_rows,
        "malformed_rows": malformed_rows,
        "rows_with_missing_values": rows_with_missing,
        "rows_with_invalid_checked_values": rows_with_invalid,
        "exact_duplicate_rows_within_file": duplicate_rows,
        "missing_values_by_column": dict(missing_counts),
        "invalid_nonmissing_values_by_column": dict(invalid_counts),
        "observed_start_date": min(date_counts) if date_counts else None,
        "observed_end_date": max(date_counts) if date_counts else None,
        "days_with_records": len(date_counts),
        "monthly_input_row_counts": dict(sorted(monthly_counts.items())),
        "source_value_counts": {
            column: dict(sorted(counts.items()))
            for column, counts in profiles.items()
        },
    }


def main():
    zip_files = sorted(ZIP_DIR.glob("*.zip"))

    if not zip_files:
        raise FileNotFoundError(f"No ZIP files found in {ZIP_DIR}")

    results = []
    errors = []

    for zip_path in zip_files:
        print(f"\nAuditing: {zip_path.stem}", flush=True)

        folder = EXTRACTED_DIR / zip_path.stem
        csv_files = sorted(folder.rglob("*.csv"))

        try:
            if len(csv_files) != 1:
                raise ValueError(f"Expected 1 CSV, found {len(csv_files)}")

            sensor = expected_sensor(zip_path.name)
            result = audit_csv(csv_files[0], sensor)
            result["dataset"] = zip_path.stem
            results.append(result)

            print(f"Rows: {result['total_rows']:,}")
            print("Malformed rows:", result["malformed_rows"])
            print("Rows with missing values:", result["rows_with_missing_values"])
            print(
                "Rows with invalid checked values:",
                result["rows_with_invalid_checked_values"],
            )
            print(
                "Exact duplicate rows:",
                result["exact_duplicate_rows_within_file"],
            )
            print(
                "Observed dates:",
                result["observed_start_date"],
                "to",
                result["observed_end_date"],
            )
            print("Versions:", result["source_value_counts"]["version"])

        except (OSError, UnicodeError, csv.Error, ValueError) as error:
            errors.append({"dataset": zip_path.stem, "error": str(error)})
            print("AUDIT FAILED:", error)

    report = {
        "audit_version": "audit-v1",
        "zip_files_found": len(zip_files),
        "files_audited": len(results),
        "total_audited_rows": sum(item["total_rows"] for item in results),
        "notes": [
            "This audit does not modify source files.",
            "Duplicates are extra occurrences of identical parsed field values, "
            "detected by SHA-256 within each CSV. Cross-file duplicates are not checked.",
            "Missing, invalid, and duplicate row counts can overlap.",
            "Missing-value counts exclude malformed rows.",
            "Observed dates do not establish complete observation coverage.",
            "Monthly counts include duplicates and rows with other invalid fields.",
            "Version values are recorded without conversion or correction.",
            "Numeric validation covers latitude, longitude, FRP and MODIS confidence. "
            "Other numeric fields are not yet range-validated.",
        ],
        "datasets": results,
        "errors": errors,
    }

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with REPORT_PATH.open("w", encoding="utf-8") as file:
        json.dump(report, file, indent=2, ensure_ascii=False)

    print(f"\nSuccessfully audited: {len(results)}/{len(zip_files)}")
    print(f"Total audited rows: {report['total_audited_rows']:,}")
    print("Report:", REPORT_PATH)

    if errors:
        raise SystemExit("Audit incomplete. See errors in the report.")


if __name__ == "__main__":
    main()