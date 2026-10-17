# GeoFlare data pipeline

The pipeline normalizes satellite hotspot observations into the unchanged
23-column `pipeline-v1` contract. It does not harmonize detections into fire events.
Python 3.9+ and the standard library are sufficient for this scope.

- [Setup and regression commands](../docs/setup-guide.md)
- [Saved API ingestion and bounded FIRMS fetching](../docs/api-ingestion.md)
- [Consumer reader and request-coverage structure](../docs/downstream-data-usage.md)
- [Canonical field dictionary](../docs/data-dictionary.md)
- [Production validation and unresolved provenance](../docs/data-quality-and-handoff.md)
- [Checkpoint history and exact resume instructions](../docs/data-pipeline-progress.md)

`cleaning/clean_records.py` retains archive discovery by default and accepts
`--source-manifest` for registered offline adapters. `ingestion/firms_client.py`
fetches availability-checked area CSVs into immutable new output directories and
emits a source manifest for that same cleaner. `cleaning/validate_records.py`
checks saved outputs and replays manifest adapters; `--report` refuses to replace
an explicit existing destination. `cleaning/legacy/clean_records_v1.py` is a frozen
fingerprint reference for legacy runs, not the active CLI.

Do not rerun production cleaning to test setup. Use the small synthetic suites.
Live fetching requires an environment `FIRMS_MAP_KEY`; the key is never a CLI
argument. Dry runs and regression tests need no credentials or network access.
