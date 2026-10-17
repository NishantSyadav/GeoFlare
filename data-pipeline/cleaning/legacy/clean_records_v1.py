"""Normalize all supplied FIRMS CSVs and write traceable outputs."""

from pathlib import Path
from collections import Counter
from datetime import date, datetime, timedelta, timezone
import csv
import gzip
import hashlib
import json
import re
import sqlite3
import sys


PIPELINE_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = PIPELINE_DIR.parent
sys.path.insert(0, str(PIPELINE_DIR))

from schemas.hotspot_schema import PIPELINE_VERSION, normalize_record


SOURCE_COLUMNS = [
    "latitude", "longitude", "brightness", "scan", "track",
    "acq_date", "acq_time", "satellite", "instrument", "confidence",
    "version", "bright_t31", "frp", "daynight", "type",
]

OUTPUT_COLUMNS = [
    "record_id", "latitude", "longitude", "acq_datetime_utc",
    "sensor", "satellite", "satellite_raw", "confidence", "confidence_raw",
    "confidence_scale", "frp_mw", "brightness", "bright_t31", "scan",
    "track", "daynight", "hotspot_type", "source_product", "source_version",
    "processing_version", "quality_flags", "source_file", "source_row",
]

REJECT_COLUMNS = [
    "source_file", "source_row", "reason", "raw_values_json",
]

DUPLICATE_COLUMNS = [
    "record_id", "source_file", "source_row",
    "kept_source_file", "kept_source_row", "raw_values_json",
]


def write_json(path, value):
    with path.open("w", encoding="utf-8") as handle:
        json.dump(
            value,
            handle,
            indent=2,
            ensure_ascii=False,
            allow_nan=False,
        )


def sha256_file(path):
    digest = hashlib.sha256()

    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)

    return digest.hexdigest()


def discover_sources():
    zip_dir = PROJECT_ROOT / "data" / "raw" / "zips"
    extracted = PROJECT_ROOT / "data" / "raw" / "extracted"

    archives = sorted(zip_dir.glob("*.zip"))

    if not archives:
        raise FileNotFoundError(f"No ZIPs found in {zip_dir}")

    sources = []

    for archive in archives:
        match = re.fullmatch(
            r"DL_FIRE_(M-C61|J1V-C2|J2V-C2)_[0-9]+",
            archive.stem,
        )

        if not match:
            raise ValueError(f"Unrecognized dataset: {archive.name}")

        candidates = sorted(
            (extracted / archive.stem).rglob("*.csv")
        )

        if len(candidates) != 1:
            raise ValueError(
                f"{archive.stem}: expected 1 CSV, "
                f"found {len(candidates)}"
            )

        sources.append(
            (archive.stem, match.group(1), candidates[0])
        )

    return sources


def source_date(value):
    text = value.strip()

    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", text):
        return None

    try:
        return date.fromisoformat(text).isoformat()
    except ValueError:
        return None


def absent_calendar_dates(day_counts):
    if not day_counts:
        return []

    first = date.fromisoformat(min(day_counts))
    last = date.fromisoformat(max(day_counts))

    current = date(first.year, 1, 1)
    end = date(last.year, 12, 31)
    absent = []

    while current <= end:
        text = current.isoformat()

        if text not in day_counts:
            absent.append(text)

        current += timedelta(days=1)

    return absent


def process_source(
    source,
    output_dir,
    connection,
    rejected,
    duplicates,
):
    dataset, product, csv_path = source

    source_file = csv_path.relative_to(PROJECT_ROOT).as_posix()
    output_name = f"{dataset}_clean.csv.gz"

    counts = Counter(
        input_rows=0,
        accepted_rows=0,
        rejected_rows=0,
        duplicate_rows=0,
    )

    input_dates = Counter()
    accepted_dates = Counter()
    flag_counts = Counter()
    type_counts = Counter()
    reasons = Counter()

    date_cache = {}
    input_hash = sha256_file(csv_path)
    blank_rows = 0

    source_id = connection.execute(
        "INSERT INTO sources (path) VALUES (?)",
        (source_file,),
    ).lastrowid

    with csv_path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as input_file:
        reader = csv.reader(input_file, strict=True)
        header = next(reader, [])

        if (
            len(header) != len(set(header))
            or set(header) != set(SOURCE_COLUMNS)
        ):
            raise ValueError(
                f"{dataset}: unexpected or repeated column names"
            )

        with gzip.open(
            output_dir / output_name,
            "wt",
            encoding="utf-8",
            newline="",
            compresslevel=5,
        ) as output_file:
            writer = csv.DictWriter(
                output_file,
                fieldnames=OUTPUT_COLUMNS,
                lineterminator="\n",
            )
            writer.writeheader()

            for values in reader:
                if not values:
                    blank_rows += 1
                    continue

                counts["input_rows"] += 1
                source_row = reader.line_num

                if len(values) != len(header):
                    reason = "wrong_field_count"

                    counts["rejected_rows"] += 1
                    reasons[reason] += 1

                    rejected.writerow([
                        source_file,
                        source_row,
                        reason,
                        json.dumps(values, ensure_ascii=False),
                    ])
                    continue

                raw = dict(zip(header, values))
                date_text = raw["acq_date"]

                if date_text not in date_cache:
                    date_cache[date_text] = source_date(date_text)

                observed_day = date_cache[date_text]

                if observed_day is not None:
                    input_dates[observed_day] += 1

                try:
                    record = normalize_record(raw, product)

                except ValueError as error:
                    reason = str(error)

                    counts["rejected_rows"] += 1
                    reasons[reason] += 1

                    rejected.writerow([
                        source_file,
                        source_row,
                        reason,
                        json.dumps(values, ensure_ascii=False),
                    ])

                else:
                    identifier = record["record_id"]
                    key = bytes.fromhex(
                        identifier.removeprefix("gf1_")
                    )

                    inserted = connection.execute(
                        "INSERT OR IGNORE INTO seen VALUES (?, ?, ?)",
                        (key, source_id, source_row),
                    )

                    if inserted.rowcount == 0:
                        counts["duplicate_rows"] += 1

                        kept_file, kept_row = connection.execute(
                            "SELECT sources.path, seen.source_row "
                            "FROM seen "
                            "JOIN sources "
                            "ON sources.id = seen.source_id "
                            "WHERE seen.id = ?",
                            (key,),
                        ).fetchone()

                        duplicates.writerow([
                            identifier,
                            source_file,
                            source_row,
                            kept_file,
                            kept_row,
                            json.dumps(values, ensure_ascii=False),
                        ])

                    else:
                        counts["accepted_rows"] += 1

                        accepted_dates[
                            record["acq_datetime_utc"][:10]
                        ] += 1

                        flag_counts.update(
                            record["quality_flags"]
                        )

                        type_counts[
                            str(record["hotspot_type"])
                        ] += 1

                        writer.writerow({
                            **record,
                            "quality_flags": json.dumps(
                                record["quality_flags"],
                                separators=(",", ":"),
                            ),
                            "source_file": source_file,
                            "source_row": source_row,
                        })

                if counts["input_rows"] % 100000 == 0:
                    connection.commit()

                    print(
                        f"  Read {counts['input_rows']:,} rows...",
                        flush=True,
                    )

    connection.commit()

    accounted_rows = sum(
        counts[name]
        for name in (
            "accepted_rows",
            "rejected_rows",
            "duplicate_rows",
        )
    )

    if counts["input_rows"] != accounted_rows:
        raise RuntimeError(
            f"{dataset}: row totals do not reconcile"
        )

    if sha256_file(csv_path) != input_hash:
        raise RuntimeError(
            f"{dataset}: input changed during processing"
        )

    return {
        "dataset": dataset,
        "source_product": product,
        "source_file": source_file,
        "source_columns": header,
        "source_sha256": input_hash,
        "output_file": output_name,
        "output_sha256": sha256_file(output_dir / output_name),
        **dict(counts),
        "blank_rows_skipped": blank_rows,
        "rows_without_usable_input_date": (
            counts["input_rows"] - sum(input_dates.values())
        ),
        "observed_input_start": (
            min(input_dates) if input_dates else None
        ),
        "observed_input_end": (
            max(input_dates) if input_dates else None
        ),
        "accepted_start": (
            min(accepted_dates) if accepted_dates else None
        ),
        "accepted_end": (
            max(accepted_dates) if accepted_dates else None
        ),
        "input_rows_by_date": dict(sorted(input_dates.items())),
        "accepted_rows_by_date": dict(
            sorted(accepted_dates.items())
        ),
        "dates_without_input_records_in_calendar_years": (
            absent_calendar_dates(input_dates)
        ),
        "accepted_quality_flags": dict(flag_counts),
        "accepted_hotspot_types": dict(type_counts),
        "rejection_reasons": dict(reasons),
    }


def main():
    sources = discover_sources()

    run_id = datetime.now(timezone.utc).strftime(
        "run_%Y%m%dT%H%M%S_%fZ"
    )

    output_dir = PROJECT_ROOT / "data" / "processed" / run_id
    output_dir.mkdir(parents=True, exist_ok=False)

    report_path = output_dir / "processing_report.json"

    report = {
        "status": "running",
        "processing_version": PIPELINE_VERSION,
        "source_files_found": len(sources),
        "normalizer_sha256": sha256_file(
            PIPELINE_DIR / "schemas" / "hotspot_schema.py"
        ),
        "processor_sha256": sha256_file(Path(__file__)),
        "output_columns": OUTPUT_COLUMNS,
        "notes": [
            "Outputs are normalized observations, not harmonized "
            "activity estimates.",

            "All valid hotspot types and confidence levels are retained.",

            "Confidence is MODIS numeric or VIIRS categorical; "
            "read confidence_scale.",

            "Blank CSV cells represent null, not zero.",

            "quality_flags is a JSON array encoded inside a CSV cell.",

            "source_row is the ending physical line number "
            "of the source CSV record.",

            "Duplicate removal uses the complete normalized-record ID "
            "within and across all supplied files. First occurrence "
            "in sorted dataset order is retained.",

            "This does not merge different satellite observations "
            "of the same fire.",

            "Input date counts include rejected and duplicate rows "
            "with usable dates.",

            "Absent dates are listed across the calendar years "
            "represented by each source. They indicate no supplied "
            "records; observation coverage and cause are unknown.",

            "Do not fill absent dates with zero fires.",

            "brightness and bright_t31 retain source column names "
            "and require sensor-specific interpretation; "
            "they are not harmonized bands.",

            "Source versions and collection-verification flags "
            "are preserved.",

            "Compressed-file hashes identify this run; "
            "gzip metadata can differ on reruns.",

            "Use outputs only when report status is complete.",
        ],
        "datasets": [],
    }

    write_json(report_path, report)

    database_path = output_dir / "_dedup.sqlite3"
    connection = None

    try:
        connection = sqlite3.connect(database_path)

        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA cache_size=-65536")

        connection.execute(
            "CREATE TABLE sources ("
            "id INTEGER PRIMARY KEY, "
            "path TEXT NOT NULL)"
        )

        connection.execute(
            "CREATE TABLE seen ("
            "id BLOB PRIMARY KEY, "
            "source_id INTEGER NOT NULL, "
            "source_row INTEGER NOT NULL"
            ") WITHOUT ROWID"
        )

        with gzip.open(
            output_dir / "rejected_rows.csv.gz",
            "wt",
            encoding="utf-8",
            newline="",
        ) as reject_file, gzip.open(
            output_dir / "duplicate_rows.csv.gz",
            "wt",
            encoding="utf-8",
            newline="",
        ) as duplicate_file:
            rejected = csv.writer(
                reject_file,
                lineterminator="\n",
            )

            duplicates = csv.writer(
                duplicate_file,
                lineterminator="\n",
            )

            rejected.writerow(REJECT_COLUMNS)
            duplicates.writerow(DUPLICATE_COLUMNS)

            for source in sources:
                print(
                    f"\nProcessing: {source[0]}",
                    flush=True,
                )

                result = process_source(
                    source,
                    output_dir,
                    connection,
                    rejected,
                    duplicates,
                )

                report["datasets"].append(result)
                write_json(report_path, report)

                print(
                    f"  Accepted: {result['accepted_rows']:,} | "
                    f"Rejected: {result['rejected_rows']:,} | "
                    f"Duplicates: {result['duplicate_rows']:,}",
                    flush=True,
                )

        totals = {
            name: sum(
                item[name]
                for item in report["datasets"]
            )
            for name in (
                "input_rows",
                "accepted_rows",
                "rejected_rows",
                "duplicate_rows",
            )
        }

        unique_ids = connection.execute(
            "SELECT COUNT(*) FROM seen"
        ).fetchone()[0]

        if unique_ids != totals["accepted_rows"]:
            raise RuntimeError(
                "Unique record IDs do not match accepted rows"
            )

        connection.close()
        connection = None
        database_path.unlink()

        report["totals"] = totals
        report["status"] = "complete"
        report["completed_at_utc"] = (
            datetime.now(timezone.utc).isoformat()
        )

        write_json(report_path, report)

        print("\nProcessing complete.")

        for name, value in totals.items():
            print(f"{name}: {value:,}")

        print(f"Output folder: {output_dir}")

    except Exception as error:
        report["status"] = "failed"
        report["error"] = str(error)

        write_json(report_path, report)
        raise

    finally:
        if connection is not None:
            connection.close()


if __name__ == "__main__":
    main()