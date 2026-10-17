# Data pipeline checkpoint and resume instructions

Updated 17 October 2026. Branch: `feature/sayem-data-pipeline`.

## Phase 1: integration and production validation

- Nine package files integrated; no existing files were replaced. Fixtures remain synthetic and unchanged.
- Tests: 12 cleaning/reader, 11 request coverage, 7 report-output safety tests passed.
- `--report` accepts a new relative-to-run or absolute path and refuses overwrite before validation and at write time.
- Full production validation completed once, successfully: 11 datasets, 4,260,572 accepted/unique rows, zero rejections/duplicates.
- Exact command: `python data-pipeline/cleaning/validate_records.py --run data/processed/run_20261013T175448_392548Z --report validation_report_request_coverage_20261017T104938_182418Z.json`.
- New report SHA-256: `67f4bbf8a18f3a9a11bb3056820c70c8d0778608503c7688af9788b63921ef24`.
- Ten warnings: eight supplied-dataset inside-request absence summaries (78 request-date instances), one no-dataset response (42741, 365 dates), one retained MODIS flag summary (83,425 rows).
- All 55 original files matched the ORIGINAL saved baseline after validation. No production cleaning was rerun.
- Original baseline and verification summary: `C:/Users/2k25a/AppData/Local/Temp/geoflare-review-38iahrab/`. The review ZIP also carries these evidence files.
- Review ZIP target: `C:/Users/2k25a/Downloads/GeoFlare_Review_Bundle.zip`.
- Commit/push: `87608ba` committed and pushed to origin/feature/sayem-data-pipeline.
- Review ZIP delivered and hash verified: `e26aab2c851674cefe2ee0c3d382384ad92b9585c55280baab7e096949f12662`. This is the phase-1 pre-commit review snapshot; later API work is in subsequent commits.

## Phase 2: saved-response ingestion

- Implemented versioned source descriptors and CSV adapter registry. API inputs use the shared processor, normalizer, IDs, deduplication and original-row audits; no fake request IDs or ZIPs.
- Added manifest CLI, adapter replay validation and explicit `cleaning-v2` implementation provenance. The original cleaner snapshot preserves strict legacy fingerprint verification.
- Eight new API regression tests passed, plus 12 cleaning/reader and 18 coverage/report-output tests (38 total). Canonical expectations and six original fixture files remain unchanged.
- Documented descriptor shape, band aliases, exact API source IDs, NRT/SP distinctions, missing type and request-coverage variants in `docs/api-ingestion.md`.
- Phase-2 commit/push pending; record hash in the next checkpoint.
- NASA area, availability and tutorial pages reviewed 17 October 2026. `FIRMS_MAP_KEY` absent from the current environment; no live API request attempted.

## Remaining phases

2. Saved-response implementation complete; checkpoint commit/push next.
3. Check official FIRMS docs, implement bounded fetch/availability/retries/raw-byte provenance, offline tests, and a live smoke test only if an environment key exists.
4. Finish instructions and handoff, run relevant small tests, commit explicit paths and push logical checkpoints. Do not merge main or send messages.

The optional `GeoFlare_API_Ingestion_Plan.md` was not found in Downloads; proceed from the user's requirements. No applicable `AGENTS.md` was found in the repository or ancestors.

## Resume safely

1. Read this file and `git status --short`; inspect current branch and recent commits.
2. Reuse the successful report named above. Do not rerun production validation or cleaning merely to resume.
3. Original baseline is already preserved; never replace it with an after-the-fact baseline.
4. Finish any pending review ZIP/commit/push, then continue the remaining phase. Stage explicit paths only; exclude production data, generated reports, ZIPs, caches and secrets.
5. Preserve the unresolved MODIS `6.03` interpretation, J2 2023 January-February absence and archive-availability discrepancy. Missing records do not establish zero actual fires.
