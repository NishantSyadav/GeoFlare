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
- Commit/push: pending this checkpoint; record resulting hashes in the next checkpoint.

## Remaining phases

2. Implement explicit offline API source descriptors and registered adapters using the shared canonical normalizer/record identity/deduplication path. Preserve archive behavior and legacy implementation provenance.
3. Check official FIRMS docs, implement bounded fetch/availability/retries/raw-byte provenance, offline tests, and a live smoke test only if an environment key exists.
4. Finish instructions and handoff, run relevant small tests, commit explicit paths and push logical checkpoints. Do not merge main or send messages.

The optional `GeoFlare_API_Ingestion_Plan.md` was not found in Downloads; proceed from the user's requirements. No applicable `AGENTS.md` was found in the repository or ancestors.

## Resume safely

1. Read this file and `git status --short`; inspect current branch and recent commits.
2. Reuse the successful report named above. Do not rerun production validation or cleaning merely to resume.
3. Original baseline is already preserved; never replace it with an after-the-fact baseline.
4. Finish any pending review ZIP/commit/push, then continue the remaining phase. Stage explicit paths only; exclude production data, generated reports, ZIPs, caches and secrets.
5. Preserve the unresolved MODIS `6.03` interpretation, J2 2023 January-February absence and archive-availability discrepancy. Missing records do not establish zero actual fires.
