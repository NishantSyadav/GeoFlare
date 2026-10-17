# Reading Sayem's cleaned hotspot outputs

This handoff applies to the 23-column `pipeline-v1` contract. These files contain
normalized satellite detections; they are not harmonized estimates or unique
fire-event counts. Use `docs/data-dictionary.md` for the complete field contract.

## Select a run

1. Confirm `processing_report.json` has `status: complete`.
2. Use the validation report produced for these exact saved outputs. After the
   request-coverage update, record the actual filename of the new report; the
   older `validation_report.json` may describe the previous calendar-year check.
3. Require a successful validation result and review its remaining warnings.
   A passed integrity check does not resolve scientific provenance questions.
4. Obtain cleaned paths from the processing report's dataset `output_file`
   fields. Keep each path relative to the selected run folder. Use the run's
   recorded hashes when identifying the input version for downstream work.

The updated validator confirmed 11 datasets and 4,260,572 accepted/unique rows,
with no rejected rows or duplicates, on 17 October 2026. Use
`validation_report_request_coverage_20261017T104938_182418Z.json` inside
`data/processed/run_20261013T175448_392548Z`. Its 10 warnings comprise eight
inside-request absence summaries, one no-dataset response summary and one
retained-quality-flag summary. All 55 original source/run files, including
historical reports, matched the pre-validation hash baseline. See
[data-quality-and-handoff.md](data-quality-and-handoff.md) for counts and evidence.

## Stream records without loading every row

`examples/read_clean_hotspots.py` converts saved CSV cell types and yields one
row at a time. It uses only the Python standard library. It is a consumer example,
not an ingestion adapter, provenance check or replacement for validation.

From the GeoFlare project root:

```powershell
python examples/read_clean_hotspots.py --file "data/processed/run_20261013T175448_392548Z/DL_FIRE_M-C61_42739_clean.csv.gz" --limit 5
```

The command prints up to five records as JSON lines; it writes no project files.
It checks only the records it reads and does not scan the rest of the file.

In Python, process the iterator directly:

```python
from examples.read_clean_hotspots import iter_hotspots

for record in iter_hotspots(cleaned_path):
    latitude = record['latitude']
    longitude = record['longitude']
    # Pass this observation to your own processing function.
```

The reader preserves acquisition timestamps as UTC ISO text, source versions as
strings, and quality flags as lists. Optional missing values become `None`;
measured zero remains `0.0`. MODIS confidence remains numeric and VIIRS confidence
remains categorical. It never drops flagged records or silently applies an
analysis filter. Decide and document any exclusions in the consuming module.

## Consumer handoff

| Consumer | Inputs to retain | Decision owned downstream |
| --- | --- | --- |
| Mahi: spatial processing | Latitude, longitude, UTC time, record ID, sensor, satellite, source product/version, flags | Grid/CRS/boundary specification and aggregation rules |
| Sajid: harmonization | Sensor/satellite, source metadata, confidence scale, quality and coverage notes | Comparison periods, source exclusions, calibration and uncertainty |
| OM: analytics | Date coverage, quality notes and agreed downstream activity metric | Valid-day rules, baselines and anomaly handling |
| Nishant: backend | Canonical names/types, provenance, sample records and run identification | Service/API schema, filters, pagination and export serialization |

Coordinates are stored as latitude then longitude columns. GeoJSON coordinates
must be constructed as `[longitude, latitude]`. These raw coordinates are not
grid-cell IDs or geometries.

Do not compare or merge confidence scales without an agreed method. For an FRP
summary, track non-null counts alongside any numeric sum so an all-missing group
is distinguishable from a group of measured zeros. Document hotspot-type and
quality filters rather than assuming every retained detection is vegetation fire.

## Request coverage

`validation-v2` provides a top-level `request_coverage` **array**, separate from
the `datasets` array of integrity results. Match entries by `dataset`, not array
position: documented requests without a dataset also appear here. The production
run has 11 integrity results and 12 request-coverage entries. Dates are ISO
`YYYY-MM-DD` strings and request bounds are inclusive.

| Entry field | JSON type | Meaning |
| --- | --- | --- |
| `dataset` | string | Dataset identifier, including the identifier reserved for an unsupplied request |
| `metadata_status` | string | `documented` or `unknown` |
| `records_status` | string | `in_run`, `not_in_run`, or `no_dataset_supplied` |
| `request` | object or null | Documented request and evidence; null if metadata is unknown |
| `calendar_context_start`, `calendar_context_end` | string or null | Inclusive full-calendar-year context spanning the request and any observed input dates; null for unknown metadata |
| `dates_outside_request` | array of strings or null | Dates within that calendar context but outside the request, whether or not observations were supplied |
| `dates_inside_request_without_supplied_records` | array of strings or null | Requested dates absent from supplied **input** dates; null if metadata or supplied records are unknown |
| `observations_outside_request_by_date` | object or null | Date keys mapped to positive input-row counts outside the request; null if metadata or supplied records are unknown |
| `investigation_required` | boolean or null | True for outside-request observations or a dataset conflicting with a documented no-dataset response; null when the relevant evidence is unknown |

Each non-null `request` contains string fields `request_id`, `dataset`, `product`
(display label), `source_product` (pipeline code), `area`, `format`,
`requested_start`, `requested_end`, `response_status`, and `evidence`.
`response_status` is `dataset_supplied` or `no_matching_fires_no_dataset`.
The 42741 entry additionally contains `response_message` and `interpretation`.
The manifest's top-level `date_bounds: inclusive` is enforced when loaded; the
loader copies its evidence text into each report request object.

Top-level `request_manifest` contains `path` (string), `sha256` (string or null),
and `status` (`loaded` or `unknown`). It identifies the manifest used for the
report, independently of `processing_report_sha256`. A missing manifest leaves
request metadata unknown; a malformed manifest fails validation.

Do not coerce null to an empty array or zero. `[]` and `{}` mean the category is
known and empty. `not_in_run` does not prove the provider supplied no records;
its record-dependent fields stay null. For 42741 the explicit no-dataset evidence
allows all 365 requested dates to be listed as lacking supplied records, with
`records_status: no_dataset_supplied`. This creates no cleaned file or records.
`investigation_required: false` only means these automated conflict checks did
not trigger; it does not resolve the MODIS version or J2 provenance questions.

Coverage uses processing-report `input_rows_by_date`, including rows later
rejected or deduplicated, rather than accepted-output dates. Records without
usable input dates cannot establish a supplied calendar date. The legacy
`datasets[].dates_without_supplied_records` remains a represented-calendar-year
gap list; it includes dates outside the request and is not interchangeable with
`request_coverage`.

For example, join coverage by dataset and preserve unknown values explicitly:

```python
coverage_by_dataset = {item['dataset']: item for item in report['request_coverage']}
coverage = coverage_by_dataset['DL_FIRE_M-C61_42748']
missing_dates = coverage['dates_inside_request_without_supplied_records']
missing_date_count = None if missing_dates is None else len(missing_dates)
# These are dates without supplied records, not a count of actual fires.
```

- All 12 documented requests selected India and CSV. Eleven returned datasets.
- MODIS, J1 and J2 requests for 2025 end on **2025-12-01**, inclusively.
  December 2-31 is outside these requests and is not evidence of pipeline loss.
- J2 request 42744 covers **2023-01-01 to 2023-12-31**. Supplied observations
  begin March 1; January-February has no supplied records. Cause remains pending.
- J2 request 42741 for 2022 returned no matching records and no dataset. Do not
  manufacture an empty production dataset or label the year as zero actual fires.
- For other days without supplied records inside a request, preserve the unknown
  coverage/cause distinction. Having at least one detection on a day does not
  establish complete observing coverage for that day or region.
- Observations outside documented request dates require investigation. Missing
  metadata must remain unknown; observed minimum/maximum dates are not proof of
  what was requested.

India is the requested region label. The screenshots do not establish an exact
polygon, boundary version, bounding box or achieved spatial coverage. Those
details must be specified separately if required for spatial comparisons.

## Open provenance items

MODIS request 42739 was for C6.1, while its 83,425 saved rows retain `6.03` and
`source_collection_requires_verification`. The screenshot establishes the request;
it does not independently explain the version string. Preserve both.

The J2 2023 request and download are evidenced by the email. The January-February
absence and the previously noted archive-availability discrepancy are still open.
Document any provisional inclusion/exclusion choice with the analysis owner.

## Small development fixture

The integrated sample package uses `tests/fixtures/sayem_cleaning_v1/` with 18
synthetic source rows. Its `expected.json` contains nine accepted canonical
records and fixed rejection/duplicate expectations. These are invented test
observations, not NASA detections or evidence for resolving production warnings.

The cleaning-contract suite also streams the generated synthetic outputs through
the consumer reader and compares all nine records and every field's Python type
against the fixed `expected.json`. Expectations are not regenerated from the
implementation. All supplied fixture files remain unchanged.

## Saving a separate validation report

Use `--report NEW_FILENAME.json` to save a new report inside the selected run.
An absolute path is also accepted. An explicit destination must not exist;
the CLI checks before scanning data and uses exclusive creation at write time,
so a file appearing during validation is not overwritten. The parent directory
must already exist. Without `--report`, the legacy behavior replaces
`validation_report.json`; use the explicit option to preserve historical reports.
`--request-manifest` defaults to `data/metadata/firms_requests.json`; relative
manifest paths resolve from the project root, unlike relative report paths.
