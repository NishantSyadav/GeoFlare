# Offline FIRMS API ingestion

Python 3.9+ and the standard library are sufficient. The canonical schema remains
`pipeline-v1` with the same 23 columns; the normalizer and identity algorithm are
unchanged. This work does not perform GIS, harmonization, analytics or API-service
work owned by the other teammates.

## Saved responses

Keep the original CSV bytes inside the project, normally under ignored
`data/raw/api/`. Create a source manifest with `schema_version: 1` and a nonempty
`sources` list. Each descriptor contains:

```json
{
  "dataset": "api-j1-saved-example",
  "source_file": "data/raw/api/response.csv",
  "source_product": "J1V-C2",
  "api_source": "VIIRS_NOAA20_SP",
  "adapter_id": "firms-area-csv",
  "adapter_version": 1,
  "sha256": "REPLACE_WITH_SHA256_OF_ORIGINAL_RESPONSE_BYTES",
  "request": {"start": "2024-02-29", "end": "2024-02-29", "bbox": [70, 10, 90, 35]}
}
```

The `request` field is optional when the actual request is unknown. Never infer
it from observation dates. Paths resolve from the project root and must remain
inside it. Use a new descriptive dataset name, not an invented FIRMS request ID
or a `DL_FIRE_` name. Hashes are mandatory. Manifest and response bytes are
fingerprinted, read-only inputs. The fetcher produces this manifest automatically.

```powershell
(Get-FileHash data/raw/api/response.csv -Algorithm SHA256).Hash.ToLowerInvariant()
python data-pipeline/cleaning/clean_records.py --source-manifest data/raw/api/sources.json
python data-pipeline/cleaning/validate_records.py --run data/processed/NEW_RUN --report validation_api_review.json
```

New output folders are created under `data/processed/run_<UTC timestamp>/`.
Calling the cleaner without arguments retains archive discovery and the existing
archive CLI. Never rerun production cleaning merely to test API ingestion.

## Registered mappings and source semantics

`firms-area-csv` version 1 supports `MODIS_NRT`, `MODIS_SP`,
`VIIRS_NOAA20_NRT`, `VIIRS_NOAA20_SP`, and `VIIRS_NOAA21_NRT`. Their canonical
families are respectively `M-C61`, `M-C61`, `J1V-C2`, `J1V-C2`, and `J2V-C2`.
The exact API identifier stays in the descriptor and processing report; NRT/SP
is never inferred solely from the family label. Row versions remain unchanged.
SNPP, Landsat and unspecified NOAA-21 SP are unsupported by this schema/registry.

For VIIRS, `bright_ti4` maps to `brightness`; `bright_ti5` maps to the compatibility
column `bright_t31`. That latter value remains **VIIRS I-5**, not MODIS band 31.
No spectral harmonization is performed. The adapter accepts the existing canonical
brightness column names too. Both aliases may appear only when their trimmed
text values agree; differing representations are conservatively rejected for
review, even if someone could interpret them as numerically equivalent.
Missing `type` becomes null and receives the existing `missing_hotspot_type` flag.
Missing optional values, measured zeros, confidence semantics and versions remain
governed by the unchanged normalizer.

`firms-archive-csv` version 1 accepts the existing exact archive schema and can
also be selected in an explicit source manifest, without an `api_source` field.
Unknown/duplicate headers and missing required API columns fail the source.
Row-level value, field-count and alias conflicts go to the existing rejection
audit with the original values. No adapter rewrites raw files or creates ZIPs.
`source_row` still identifies the ending physical line of the original CSV row.

## Implementation provenance and validation

The cleaner now records `implementation_version: cleaning-v2` separately from
the unchanged canonical `processing_version: pipeline-v1`. New manifest runs
include source descriptors, manifest path/hash and adapter implementation hash,
as well as the existing processor/normalizer and data hashes.

Reports without an implementation version retain `cleaning-v1` interpretation.
Their processor fingerprint is checked against the immutable original source
snapshot `data-pipeline/cleaning/legacy/clean_records_v1.py`, not waived because
the active cleaner changed. LF/CRLF-only differences retain the existing handling.
The snapshot is provenance evidence, not a second supported ingestion CLI.
Unknown implementations or changed fingerprints fail validation.

Manifest-based runs replay each registered adapter and the shared processor in
a temporary directory. Their decompressed outputs, input/date/flag/type counts,
rejection reasons, global duplicate decisions and complete audit bytes must agree
with the saved run. Recompression hashes can differ; the original saved-byte
hashes are still checked. This is consistency verification using shared code,
not independent scientific validation.

API `request_coverage` entries use the explicit descriptor request when present.
Their `request` object has `dataset`, `source_product`, `api_source` (null for
explicit archive descriptors), `requested_start`, `requested_end`, `bbox`,
`area: bounding_box`, `format: CSV`, `response_status: dataset_supplied`, and
`evidence: Saved source descriptor`. It has no fabricated `request_id` or email
evidence. The remaining coverage fields keep the contract in
[downstream-data-usage.md](downstream-data-usage.md). An API header-only CSV is a
supplied zero-row response, not the historical 42741 no-dataset event.

India archive requests and bounding-box API requests have different footprints.
Bounding-box results are not an exact India country selection or proof of
observing coverage. MODIS `6.03`, J2 2023 availability and missing-date questions
remain unresolved; this ingestion path does not settle them.

## Bounded network fetcher

Official documentation reviewed on 17 October 2026:
[area endpoint](https://firms.modaps.eosdis.nasa.gov/api/area/),
[availability endpoint](https://firms.modaps.eosdis.nasa.gov/api/data_availability/),
and [NASA Python tutorial](https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html).
The area endpoint specifies 1-5 days per request, starting on the explicit date;
the availability CSV uses `data_id,min_date,max_date`. NRT may include RT/URT;
SP is a separate source. NASA documents a 5,000-transaction/10-minute MAP-key
limit, and one HTTP request can cost multiple transactions. Our window bound
does not guarantee staying under that provider transaction limit.

First inspect a plan; no key, network or writes are used:

```powershell
python data-pipeline/ingestion/firms_client.py --source VIIRS_NOAA20_SP --start 2024-02-29 --end 2024-03-06 --bbox 70,10,90,35 --dry-run
```

For an actual fetch, configure `FIRMS_MAP_KEY` in the process environment and
omit `--dry-run`. Use a new output directory, or omit `--output` to get a unique
`data/raw/api/fetch_<UTC timestamp>/`. The CLI supports only the sources listed
above. Explicit dates and a finite west,south,east,north box are mandatory;
antimeridian-crossing boxes are rejected. This is a bounding box, not an exact
India footprint. Maximum requested duration is 366 inclusive days. Availability
is fetched before any area query, and windows are split at availability bounds
without overlap. Unavailable windows are recorded without querying area data.

Defaults: five-day windows, 30-second timeout, two retries after the first
attempt, and 16 MiB maximum per response. `--window-days` accepts 1-5,
`--timeout` 1-120 seconds, and `--retries` 0-3. Transport failures and HTTP
408/429/500/502/503/504 retry with bounded exponential delays (1, 2, 4 seconds
for at most three retries). Other HTTP statuses fail immediately. Redirects are
not followed because the key is in the request path. No key or key-bearing URL
is printed or stored in request metadata; exceptions are reduced to safe codes.

Each request attempt saves immutable raw bytes and metadata with HTTP status,
byte count, SHA-256, timestamp and completeness. An oversized body is retained
only as a bounded `.partial` prefix and is never ingested. A body echoing the
credential is deliberately not saved; the metadata records that redaction.
These cases are errors, not empty results. `request.json` and per-attempt files
survive interruption; resume with a new directory, preserving the incomplete
attempt for review rather than silently overwriting or replaying it.

`fetch_report.json` distinguishes window outcomes:

| Outcome | Meaning |
|---|---|
| `data` | Recognized CSV header and one or more structurally valid rows; cleaning still validates values |
| `empty` | Recognized header-only CSV; no returned rows, not proof of zero actual fires |
| `unavailable` | Requested dates outside the provider's reported interval; no area request sent |
| `error` | HTTP, transport, schema, byte-limit or credential-echo failure |

The overall status is `complete` when all windows have known outcomes without
errors (including unavailable windows), `partial` when errors coexist with
usable responses, or `failed` when no usable response survives errors. CLI exit
status is nonzero for `partial`/`failed`. A missing or malformed availability
response fails the fetch without interpreting dates as unavailable.

`sources.json` includes only usable data/empty responses, retaining exact API
source IDs, request bounds, bounding box, response path and hash. It connects
directly to the shared cleaning and validation path:

```powershell
python data-pipeline/cleaning/clean_records.py --source-manifest data/raw/api/NEW_FETCH/sources.json
python data-pipeline/cleaning/validate_records.py --run data/processed/NEW_RUN --report validation_api_NEW_TIMESTAMP.json
```

Review `fetch_report.json` first; a successful clean run cannot fill failed or
unavailable windows. An all-unavailable/error fetch has an empty source list and
cannot start a cleaning run. Request coverage in the cleaned run describes only
the supplied response descriptors; keep the fetch report to retain the full
selection and unavailable/error windows.

## Remaining live verification

No live call has been made. The key was unavailable during implementation; a
later USER-environment launch on 17 October 2026 stopped at the local credential
format check before any HTTP request or output creation. It did not test an
empty or nonempty NASA response. See [data-pipeline-progress.md](data-pipeline-progress.md)
for the redacted diagnosis and exact attempted command. After correcting the
USER value locally, run this single-day, small-box smoke test in a new directory:

```powershell
$env:FIRMS_MAP_KEY = [Environment]::GetEnvironmentVariable("FIRMS_MAP_KEY", "User")
$firmsSmokeOutput = 'data/raw/api/live_smoke_' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmss_fffffffZ')
python data-pipeline/ingestion/firms_client.py --source VIIRS_NOAA20_SP --start 2024-02-29 --end 2024-02-29 --bbox 80,25,80.1,25.1 --window-days 1 --timeout 30 --retries 1 --output $firmsSmokeOutput
```

This makes one availability query plus at most one area query, excluding a
bounded retry. A valid empty response is an acceptable fetch smoke-test outcome;
it says nothing about actual fires. No key is supplied as a command-line argument.
Inspect the report before running the manifest through cleaning and validation.
