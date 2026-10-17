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
Get-FileHash data/raw/api/response.csv -Algorithm SHA256
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
