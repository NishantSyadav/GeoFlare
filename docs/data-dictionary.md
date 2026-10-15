# GeoFlare data dictionary

Applies to `pipeline-v1` in `feature/sayem-data-pipeline`, based on the schema and cleaner at commit `53a274b`.

The output contains normalized satellite observations. Harmonization, fire-event matching, spatial aggregation, and anomaly detection are later stages. A row is not necessarily one distinct fire.

## File contract

- One UTF-8 gzip CSV per source: `<dataset>_clean.csv.gz`.
- The header has the 23 columns below, in this order.
- CSV cells are text. Consumers must parse the logical types explicitly.
- An empty optional cell means null, not numeric zero.
- `quality_flags` is a JSON array encoded in a CSV cell; parse it using a CSV reader followed by a JSON parser.
- Retain source identifiers, source versions, and quality flags in downstream outputs.
- Use a cleaning run only when its `processing_report.json` has `status: complete`. Review its separate `validation_report.json` and unresolved quality notes before analysis.

## Columns

| Column | Logical type | Meaning and validation rule |
|---|---|---|
| `record_id` | string, required | `gf1_` followed by a SHA-256 digest of the normalized source-field payload. It excludes file/row provenance, processing version, and quality flags. It identifies an exact normalized record, not a fire event. |
| `latitude` | float, required | Latitude in degrees, from -90 to 90 inclusive. |
| `longitude` | float, required | Longitude in degrees, from -180 to 180 inclusive. |
| `acq_datetime_utc` | UTC datetime, required | Acquisition date and time formatted as `YYYY-MM-DDTHH:MM:00Z`. The input time is padded to HHMM and checked; this schema has minute precision. |
| `sensor` | enum, required | `MODIS` or `VIIRS`; must agree with the source product and input instrument. |
| `satellite` | enum, required | Canonical satellite name: `Terra`, `Aqua`, `NOAA-20`, or `NOAA-21`. |
| `satellite_raw` | string, required | Source satellite label after text cleanup, before alias mapping. |
| `confidence` | number or enum, nullable | MODIS: numeric 0-100. VIIRS: `low`, `nominal`, or `high`. Never treat the two representations as the same numerical scale. |
| `confidence_raw` | string, nullable | Source confidence text after whitespace and missing-value handling. |
| `confidence_scale` | enum, required | `modis_0_100` or `viirs_category`. |
| `frp_mw` | float, nullable | Source fire radiative power in MW; finite and >= 0. Zero is allowed; blank is null. |
| `brightness` | float, nullable | Positive source brightness-temperature value. This pipeline retains the source column name; sensor-specific band interpretation must be verified before comparison. |
| `bright_t31` | float, nullable | Positive source value retained under its input column name. Do not assume that a VIIRS column with this name represents MODIS band 31. |
| `scan` | float, nullable | Positive source along-scan pixel size, in km under the FIRMS convention. |
| `track` | float, nullable | Positive source along-track pixel size, in km under the FIRMS convention. |
| `daynight` | enum, nullable | `D` or `N`; source labels are uppercased. |
| `hotspot_type` | integer, nullable | 0-3 inclusive. All valid source types are retained; downstream analysis must declare any type filter. |
| `source_product` | enum, required | Product inferred from the input archive name: `M-C61`, `J1V-C2`, or `J2V-C2`. This label does not independently resolve collection/version discrepancies. |
| `source_version` | string, nullable | Source `version` after text cleanup. Preserve as text, including values such as `6.03`; do not silently relabel it. |
| `processing_version` | string, required | Normalizer version, currently `pipeline-v1`. |
| `quality_flags` | JSON array of strings | `[]` when no implemented rule flags the record. A flag does not automatically reject the row. No flag is not a guarantee of scientific accuracy. |
| `source_file` | string, required | Original CSV path relative to the project root, using `/` separators. |
| `source_row` | integer, required | Ending physical line number of the source CSV record. It starts at 2 or later and is not necessarily a simple row index if a quoted field spans lines. |

## Product and satellite mapping

| Source product | Sensor | Accepted canonical satellites |
|---|---|---|
| `M-C61` | MODIS | Terra, Aqua |
| `J1V-C2` | VIIRS | NOAA-20 |
| `J2V-C2` | VIIRS | NOAA-21 |

Accepted source aliases are `T`/`Terra`, `A`/`Aqua`, `N20`/`NOAA-20`, and `N21`/`NOAA-21`.

VIIRS confidence aliases are `l`/`low`, `n`/`nominal`, and `h`/`high` (case-insensitive).

## Hotspot types

| Value | FIRMS description |
|---|---|
| 0 | Presumed vegetation fire |
| 1 | Active volcano |
| 2 | Other static land source |
| 3 | Offshore |

Counts of all retained hotspots must not be presented as counts of vegetation fires unless the appropriate filter has been applied and documented.

## Implemented quality flags

`missing_<field>` is added when one of these optional fields is null:

`confidence`, `frp_mw`, `brightness`, `bright_t31`, `scan`, `track`, `daynight`, `hotspot_type`, `source_version`.

| Flag | Exact current trigger | Consumer action |
|---|---|---|
| `source_collection_requires_verification` | `source_product == "M-C61"` and `source_version == "6.03"` | Keep the raw value and review collection provenance. This is a GeoFlare rule, not a NASA rejection label. |
| `unrecognized_source_version` | A non-null version outside the normalizer's recognized values, except the special case above | Keep the value and verify its interpretation before collection-sensitive comparison. |

Recognized MODIS strings: `61.03`, `6.1`, `6.1NRT`, `6.1RT`, `6.1URT`.

Recognized VIIRS strings: `2`, `2.0`, `2.0NRT`, `2.0RT`, `2.0URT`.

These lists describe implemented code, not an exhaustive authoritative list of valid NASA versions. Missing text markers are blank, `na`, `n/a`, `nan`, `null`, and `none`, case-insensitive.

## Duplicate and provenance contract

The cleaner removes repeated complete normalized-record IDs within and across all supplied files. The first occurrence in sorted dataset order is retained. Different satellite observations of the same fire are not merged. Differing source metadata may produce different IDs even at the same location and time.

`rejected_rows.csv.gz` stores source path, ending source line, rejection reason, and the raw row as a JSON array. `duplicate_rows.csv.gz` also records the retained record's source path and line.

The processing report records SHA-256 hashes for source CSVs and compressed outputs. Compressed hashes identify the saved bytes of that run; gzip metadata can make a rerun's compressed hash differ.

## Date coverage and future ingestion

The present report's absent-date list covers whole calendar years represented by each source. It is not checked against the original requested date interval, footprint, sensor availability, or cloud/observation coverage. An absent date must not be interpreted as zero fires.

Future API ingestion should first adapt incoming names and product metadata to the current input contract, then call the same `normalize_record` logic. API field names and supported product identifiers must be mapped explicitly; support is not complete merely because the normalizer is reusable.

## References

- Project implementation: `data-pipeline/schemas/hotspot_schema.py` and `data-pipeline/cleaning/clean_records.py`, commit `53a274b`.
- FIRMS MODIS attributes: https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_MODIS_Firehotspots.html
- FIRMS archive README: https://firms.modaps.eosdis.nasa.gov/download/Readme.txt

See `data-quality-and-handoff.md` for this run's observed date ranges and pending provenance checks.
