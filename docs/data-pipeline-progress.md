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
- Phase-2 commit `8ae738f` committed and pushed to origin/feature/sayem-data-pipeline.
- NASA area, availability and tutorial pages reviewed 17 October 2026. `FIRMS_MAP_KEY` absent from the current environment; no live API request attempted.

## Phase 3: bounded fetching and final handoff

- Implemented availability-first area fetching, inclusive 1-5-day windows, 366-day total bound, finite bounding boxes, timeouts, bounded transient retries, redirect refusal and response-size limits.
- New outputs exclusively created; response attempts, hashes, metadata and request checkpoints preserved. Valid empty, unavailable, data and error outcomes remain distinct. Key-bearing URLs and exceptions are not logged; credential-echo bodies are not saved.
- Fetch manifests connect to the shared cleaner and adapter-replay validator. An end-to-end mocked fetch/clean/validate test passes; source versions, confidence, flags and all 23 columns remain unchanged.
- Current process, Windows user and machine environments have no `FIRMS_MAP_KEY`. Live smoke test remains pending; no live call was attempted. Exact command is in `docs/api-ingestion.md`.
- Final regression checks passed: 36 tests under `tests/` (12 archive/reader, 9 offline API, 15 fetcher) and 18 under `data-pipeline/tests/` (11 coverage, 7 report-output), **54 total**. `git diff --check` passed. The dry-run CLI produced the expected nonoverlapping 5-day/2-day plan without network or writes.
- A synthetic legacy run passed the new validator after processor refactoring, with unchanged original run files. Historical production implementation fingerprints also verified without rerunning production validation.
- Phase-3 commit `59f5c62` committed and pushed to origin/feature/sayem-data-pipeline. No additional full production validation or production cleaning has been run.
- After API implementation, all 55 original files were checked again against the same original baseline and still matched. The phase-1 production report hash is unchanged.

## Phase 4: final handoff

- Setup, dependencies, output paths, adapter provenance, exact coverage variants, streaming use and live commands are documented in `docs/setup-guide.md`, `docs/api-ingestion.md` and `docs/downstream-data-usage.md`.
- All 54 tests and `git diff --check` passed. Documentation-only final checkpoint records these results; its hash is available with `git log -1 --format=%H` after checkout.
- No code blocker was identified in offline verification. The live smoke test remains **pending**; the later USER-environment attempt below was blocked by the local credential-format check. Do not report it as passed.
- External scientific clarification remains necessary for MODIS 2022 `6.03`, J2 2023 January-February absence and the archive-availability discrepancy. Neither code nor missing records resolves those questions.
- Changes were staged with explicit paths. No main merge, force-push, production cleaning rerun, source-contact message or data transfer to teammates was performed. Production data/reports, ZIPs, caches and secrets remain outside Git.

## Live verification attempt, 17 October 2026

- Loaded `FIRMS_MAP_KEY` from the Windows USER environment into the PowerShell process launching Python, without displaying its value. The repository was clean on `feature/sayem-data-pipeline` at `40a636d` before this attempt.
- Exact fetch command attempted after loading the variable:

```powershell
$env:FIRMS_MAP_KEY = [Environment]::GetEnvironmentVariable("FIRMS_MAP_KEY", "User")
python data-pipeline/ingestion/firms_client.py --source VIIRS_NOAA20_SP --start 2024-02-29 --end 2024-02-29 --bbox 80,25,80.1,25.1 --window-days 1 --timeout 30 --retries 1 --output data/raw/api/live_smoke_20261017T174941_9872167Z
```

- Result: CLI exit 1, before output-directory creation or any HTTP request. The USER value is present but does not match the fetcher's accepted character/length format. Safe boolean diagnostics ruled out surrounding whitespace, ordinary quotes, or a recognized bracket/typographic-quote wrapper around a NASA-example-format key. The USER value was not modified, and no credential value or key-bearing URL was printed or saved.
- No `fetch_report.json`, CSV or source manifest was created. This is a **local launch failure**, not a NASA error response, unavailable interval or valid empty result. Downloaded rows: 0; response row count: unknown because no response was received.
- Cleaning and validation: **not run**; no usable response exists. Accepted/rejected/duplicate/validated counts are not applicable. Neither the live empty-result path nor nonempty live observations have been verified.
- All 55 original files still matched the ORIGINAL hash baseline preserved in the phase-1 review ZIP after this attempt. No historical production cleaning or validation was rerun; source versions and provenance flags were not changed.
- No code change or weakened check is justified by the evidence. Correct the USER environment value locally to the bare NASA MAP key, without pasting it into chat, then retry in a new output directory. The documentation-only checkpoint records the limitation; implementation regression tests were not rerun for a documentation-only change.

## Commands for remaining live verification

After correcting the USER value locally, load it into the launching PowerShell process and choose a fresh output directory:

```powershell
$env:FIRMS_MAP_KEY = [Environment]::GetEnvironmentVariable("FIRMS_MAP_KEY", "User")
$firmsSmokeOutput = 'data/raw/api/live_smoke_' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmss_fffffffZ')
python data-pipeline/ingestion/firms_client.py --source VIIRS_NOAA20_SP --start 2024-02-29 --end 2024-02-29 --bbox 80,25,80.1,25.1 --window-days 1 --timeout 30 --retries 1 --output $firmsSmokeOutput
```

Inspect `fetch_report.json` in the printed output directory. A valid empty CSV is not proof of zero actual fires. Only when a usable response exists, ingestion can be checked in the same PowerShell session with:

```powershell
python data-pipeline/cleaning/clean_records.py --source-manifest "$firmsSmokeOutput/sources.json"
```

The cleaner prints the new run directory; validate that new directory with a fresh `--report` filename as documented in the setup guide. Do not run these commands against the historical production run.

The optional `GeoFlare_API_Ingestion_Plan.md` was not found in Downloads; proceed from the user's requirements. No applicable `AGENTS.md` was found in the repository or ancestors.

## Resume safely

1. Read this file and `git status --short`; inspect current branch and recent commits.
2. Reuse the successful report named above. Do not rerun production validation or cleaning merely to resume.
3. Original baseline is already preserved; never replace it with an after-the-fact baseline.
4. Resume the live smoke test after the USER key configuration is corrected; the recorded attempt never reached NASA. Alternatively, review newly supplied provenance evidence. The review ZIP is the original phase-1 snapshot; API code is delivered in subsequent Git commits. Stage explicit paths only; exclude production data, generated reports, ZIPs, caches and secrets.
5. Preserve the unresolved MODIS `6.03` interpretation, J2 2023 January-February absence and archive-availability discrepancy. Missing records do not establish zero actual fires.
