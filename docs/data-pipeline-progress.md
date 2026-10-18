# Data pipeline checkpoint and resume instructions

Updated 18 October 2026. Branch: `feature/sayem-data-pipeline`.

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
- At this implementation checkpoint, no `FIRMS_MAP_KEY` was present in the process/user/machine environments and no live call was attempted. The subsequent 18 October live empty-result verification below completes that pending smoke test.
- Final regression checks passed: 36 tests under `tests/` (12 archive/reader, 9 offline API, 15 fetcher) and 18 under `data-pipeline/tests/` (11 coverage, 7 report-output), **54 total**. `git diff --check` passed. The dry-run CLI produced the expected nonoverlapping 5-day/2-day plan without network or writes.
- A synthetic legacy run passed the new validator after processor refactoring, with unchanged original run files. Historical production implementation fingerprints also verified without rerunning production validation.
- Phase-3 commit `59f5c62` committed and pushed to origin/feature/sayem-data-pipeline. No additional full production validation or production cleaning has been run.
- After API implementation, all 55 original files were checked again against the same original baseline and still matched. The phase-1 production report hash is unchanged.

## Phase 4: final handoff

- Setup, dependencies, output paths, adapter provenance, exact coverage variants, streaming use and live commands are documented in `docs/setup-guide.md`, `docs/api-ingestion.md` and `docs/downstream-data-usage.md`.
- All 54 tests and `git diff --check` passed. Documentation-only final checkpoint records these results; its hash is available with `git log -1 --format=%H` after checkout.
- No code blocker was identified. The 17 October local launch failed before HTTP; after the USER value was corrected, the 18 October **live empty-result fetch, cleaning and validation passed**. Nonempty live observations remain unverified.
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

## Live empty-result verification, 18 October 2026

The USER-scoped key was reloaded without displaying it. The repository was clean
on `feature/sayem-data-pipeline` at `d116efd` before this check. No key cleanup or
source-code changes were needed after the user corrected the local value.

Exact commands executed, from the project root:

```powershell
$env:FIRMS_MAP_KEY = [Environment]::GetEnvironmentVariable("FIRMS_MAP_KEY", "User")
python data-pipeline/ingestion/firms_client.py --source VIIRS_NOAA20_SP --start 2024-02-29 --end 2024-02-29 --bbox 80,25,80.1,25.1 --window-days 1 --timeout 30 --retries 1 --output data/raw/api/live_smoke_20261018T071334_9784738Z
python data-pipeline/cleaning/clean_records.py --source-manifest data/raw/api/live_smoke_20261018T071334_9784738Z/sources.json
python data-pipeline/cleaning/validate_records.py --run data/processed/run_20261018T071346_085632Z --report validation_report_live_smoke_20261018T071346_085632Z.json
```

- **Fetch: complete, one valid empty outcome.** Availability and area requests both returned HTTP 200 on attempt 1, without retries. The availability response reported `2018-04-01` through `2026-06-30` for `VIIRS_NOAA20_SP`, covering the requested date. No unavailable or error outcome occurred.
- The area response was received at `2026-10-18T07:13:38.756262+00:00` (12:43 IST): 127 bytes, a recognized 15-column header, **0 data rows**. Raw response SHA-256: `3505bc30679b4672e35048d886860827f74a34968ca654b30a18b6ab231990fd`.
- **Cleaning: complete.** One source dataset; input 0, accepted 0, rejected 0, duplicates 0. Only the new small run `data/processed/run_20261018T071346_085632Z` was created.
- **Validation: passed**, including registered-adapter replay and saved-byte/schema/audit checks. One dataset, 0 rows checked, 0 unique IDs, zero rejected/duplicate audit totals. A fresh explicit report filename preserved all earlier reports.
- Actual warning count: **13**. One concerns the live request's single date without supplied records; 11 say documented archive datasets are not in this small run; one retains the documented 42741 no-dataset response (365 requested dates). The latter 12 are context from the default archive-request manifest, not validation of historical datasets or evidence of live-fetch loss. There are no outside-request observations in the live response.
- All 55 original files again matched the ORIGINAL hash baseline preserved in the phase-1 review ZIP. Historical production cleaning/validation was not rerun. Source versions and unresolved provenance flags were not edited.
- The live raw responses and generated reports remain Git-ignored. This checkpoint changes documentation only; `git diff --check` passed. Existing unit suites were not rerun for a documentation-only update; the live fetch, isolated cleaning and isolated validation are the checks performed here.

Evidence files (paths relative to the project root):

| File | SHA-256 |
|---|---|
| `data/raw/api/live_smoke_20261018T071334_9784738Z/fetch_report.json` | `1e6eacf1376bafd2545f35b21ceeb8ff9696858e6881ad3879c035c10e95461d` |
| `data/raw/api/live_smoke_20261018T071334_9784738Z/sources.json` | `d40cbbbf1d8fb93102f5c53d8c98e46236620c4e61323f180a10efc55e4b6cff` |
| `data/processed/run_20261018T071346_085632Z/processing_report.json` | `1084e853a25416a373f775eb17b4934e95aced8cb953e58a628194715643fb3b` |
| `data/processed/run_20261018T071346_085632Z/validation_report_live_smoke_20261018T071346_085632Z.json` | `5b0e399aed5ffd0dacb140b1769dd0199309c507828fb3178cffffe23cb2c4d9` |

**Scope of the result:** the live empty-result path is verified end to end.
No nonempty live records were verified, and an empty response does not establish
zero actual fires or complete observation coverage. No additional live query is
required for the requested small smoke test. A nonempty live check would be a
separate follow-up with an explicitly selected date/box. MODIS `6.03` and the J2
2023 absence/availability discrepancy remain unresolved.

## Commands for optional future live verification

The requested smoke test is complete. If another check is needed, reload the USER value into the launching PowerShell process and choose a fresh output directory:

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
4. Reuse the successful 18 October live empty-result reports above; do not repeat the request just to resume. Nonempty live records remain unverified and would need a separately selected follow-up. Review new provenance evidence when available. The review ZIP is the original phase-1 snapshot; API code is delivered in subsequent Git commits. Stage explicit paths only; exclude production data, generated reports, ZIPs, caches and secrets.
5. Preserve the unresolved MODIS `6.03` interpretation, J2 2023 January-February absence and archive-availability discrepancy. Missing records do not establish zero actual fires.
