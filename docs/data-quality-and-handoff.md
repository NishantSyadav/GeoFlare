# GeoFlare validated-data handoff

Prepared: 15 October 2026. Working branch: `feature/sayem-data-pipeline`.

Request-metadata and integration update: 17 October 2026. The historical reports remain unchanged. Updated full validation ran once, without rerunning production cleaning; its separate result is recorded below.

**Technical validation passed. Scientific harmonization and the provenance checks listed below remain pending.**

## Run and evidence

- Run: `data/processed/run_20261013T175448_392548Z`.
- Normalizer: `pipeline-v1`; inspected source commit: `53a274b`.
- The saved `validation_report.json` has `status: passed`: 11 datasets, 4,260,572 rows checked, and 4,260,572 unique record IDs. Validation ran from `2026-10-15T16:14:51.688577+00:00` to `2026-10-15T16:19:37.252120+00:00` (UTC).
- The saved `processing_report.json` has `status: complete`, completed at `2026-10-13T18:00:29.761832+00:00` (UTC). It reports 4,260,572 input/accepted rows, zero rejected rows, and zero duplicate rows; the validation totals and audit counts agree.
- The historical report has 11 validation warnings: 10 absent-calendar-date summaries and one retained-quality-flag summary. The flagged dataset contains 83,425 flagged rows.
- This documentation checkpoint checked both saved reports, their dataset counts, dates, flags, and hashes, and all 23 output columns against the local code. The validation report's processing-report SHA-256 matches the saved report, and the cleaner/normalizer fingerprints match the processing report. The two local source ZIP inventories and extracted CSVs listed below also corroborate the handoff's archive details, source hashes, and instrument/satellite/version counts. Cleaning and full output validation were not rerun for this checkpoint.

The validator checks file hashes, saved schema and normalizer round-trips, record identities, global ID uniqueness, row/date/flag/type totals, and audit files. It reuses the same normalizer as the cleaner, so passing does not independently prove that every scientific interpretation in the normalizer is correct.

### Request-aware production validation, 17 October 2026

- New report: `data/processed/run_20261013T175448_392548Z/validation_report_request_coverage_20261017T104938_182418Z.json`.
- Status: **passed**, `validation-v2`; started `2026-10-17T10:49:42.562328+00:00`, finished `2026-10-17T10:55:09.166602+00:00` (16:19-16:25 IST).
- Confirmed 11 datasets; 4,260,572 input, accepted and unique records; zero rejected and duplicate records, including audit totals.
- Report SHA-256: `67f4bbf8a18f3a9a11bb3056820c70c8d0778608503c7688af9788b63921ef24`.
- All 55 pre-existing files match the original pre-validation SHA-256/size baseline: 40 raw/archive/support files and 15 production-run files, including both historical reports. The only new file in those locations is the new validation report.
- Actual warnings: **10**. Eight summaries concern 78 absent request-date instances across supplied datasets; one concerns request 42741's 365 requested dates without a supplied dataset; one concerns MODIS 2022's 83,425 retained `source_collection_requires_verification` flags. These are request-date instances, not distinct regional dates or actual-fire counts.
- No observations outside documented requests, unknown request metadata, code-line-ending warnings, or other warning categories were reported. All 12 requests are represented in `request_coverage`.

| Request | Inside-request dates without supplied records | Outside-request calendar dates |
|---|---:|---:|
| 42739 | 3 | 0 |
| 42740 | 0 | 0 |
| 42741 (no dataset supplied) | 365 | 0 |
| 42742 | 3 | 0 |
| 42743 | 5 | 0 |
| 42744 | 59 (January-February; cause unknown) | 0 |
| 42745 | 1 | 0 |
| 42746 | 1 | 0 |
| 42747 | 2 | 0 |
| 42748 | 4 (26, 28, 31 July and 15 September) | 30 (2-31 December) |
| 42749 | 0 | 30 (2-31 December) |
| 42750 | 0 | 30 (2-31 December) |

Small integration tests passed: 12 cleaning/consumer tests, 11 coverage tests and 7 report-output tests. The reader matched all nine fixed synthetic canonical records and field types. The six supplied fixture files are byte-for-byte unchanged. Historical reports were not edited, and no expected outputs were regenerated. The review bundle contains the original baseline, verification summary, exact validation command and new report, but no production datasets.

## Dataset inventory

Start and end are the minimum and maximum dates with accepted observations. They are not proof of complete temporal observation coverage or the original requested interval.

| Dataset | Rows | Observed start | Observed end | Dates with no supplied records in represented calendar years | Retained quality flags |
|---|---:|---|---|---:|---|
| DL_FIRE_J1V-C2_42740 | 618,547 | 2022-01-01 | 2022-12-31 | 0 | None reported |
| DL_FIRE_J1V-C2_42743 | 591,145 | 2023-01-01 | 2023-12-31 | 5 | None reported |
| DL_FIRE_J1V-C2_42746 | 578,062 | 2024-01-01 | 2024-12-31 | 1 | None reported |
| DL_FIRE_J1V-C2_42749 | 595,832 | 2025-01-01 | 2025-12-01 | 30 | None reported |
| DL_FIRE_J2V-C2_42744 | 447,875 | 2023-03-01 | 2023-12-31 | 59 | None reported by implemented row rules; see provenance review below |
| DL_FIRE_J2V-C2_42747 | 542,859 | 2024-01-01 | 2024-12-31 | 2 | None reported |
| DL_FIRE_J2V-C2_42750 | 563,181 | 2025-01-01 | 2025-12-01 | 30 | None reported |
| DL_FIRE_M-C61_42739 | 83,425 | 2022-01-01 | 2022-12-31 | 3 | Collection verification: 83,425 rows |
| DL_FIRE_M-C61_42742 | 78,494 | 2023-01-01 | 2023-12-31 | 3 | None reported |
| DL_FIRE_M-C61_42745 | 74,029 | 2024-01-01 | 2024-12-31 | 1 | None reported |
| DL_FIRE_M-C61_42748 | 87,123 | 2025-01-01 | 2025-12-01 | 34 | None reported |
| **Total** | **4,260,572** | | | | |

## Original archive inspection

### Verified request metadata

Evidence: user-provided FIRMS email screenshots reviewed in ChatGPT, as transcribed in the user's verified request table. All requests selected **India** and **CSV**. Requested start and end dates are **inclusive**. The machine-readable manifest is [`data/metadata/firms_requests.json`](../data/metadata/firms_requests.json); its dataset names and product codes follow the existing source-discovery convention. This documents the requested selection, not independently verified geographic or temporal observation coverage.

| Request ID | Product | Requested start | Requested end | Response |
|---|---|---|---|---|
| 42739 | MODIS C6.1 | 2022-01-01 | 2022-12-31 | Dataset supplied |
| 42740 | J1 VIIRS C2 | 2022-01-01 | 2022-12-31 | Dataset supplied |
| 42741 | J2 VIIRS C2 | 2022-01-01 | 2022-12-31 | No dataset supplied |
| 42742 | MODIS C6.1 | 2023-01-01 | 2023-12-31 | Dataset supplied |
| 42743 | J1 VIIRS C2 | 2023-01-01 | 2023-12-31 | Dataset supplied |
| 42744 | J2 VIIRS C2 | 2023-01-01 | 2023-12-31 | Dataset supplied |
| 42745 | MODIS C6.1 | 2024-01-01 | 2024-12-31 | Dataset supplied |
| 42746 | J1 VIIRS C2 | 2024-01-01 | 2024-12-31 | Dataset supplied |
| 42747 | J2 VIIRS C2 | 2024-01-01 | 2024-12-31 | Dataset supplied |
| 42748 | MODIS C6.1 | 2025-01-01 | 2025-12-01 | Dataset supplied |
| 42749 | J1 VIIRS C2 | 2025-01-01 | 2025-12-01 | Dataset supplied |
| 42750 | J2 VIIRS C2 | 2025-01-01 | 2025-12-01 | Dataset supplied |

Request **42741** returned **"could not find any matching fires"**. No dataset was supplied, so there is no twelfth cleaned dataset to validate. This response does **not** establish zero actual fires, sensor availability, or complete observation coverage. The manifest retains the request and response without inventing records.

Each inspected ZIP contains one CSV and an 89-byte `Readme.txt` pointing to the common online FIRMS README. Neither ZIP includes a separate request-specific date-range, area-of-interest, or collection-verification document. A common README is not sufficient to resolve a specific request's metadata conflict.

### MODIS 2022: DL_FIRE_M-C61_42739

- Member: `fire_archive_M-C61_42739.csv`.
- Source CSV SHA-256: `6d31a461c1cc8b6044f74aaa45d05c0a79989127b4ab0f7787495aa4bc3caa05`.
- All 83,425 rows have `instrument=MODIS` and `version=6.03`.
- Satellite values: Terra 27,806 rows; Aqua 55,619 rows.
- Observations span 2022-01-01 through 2022-12-31, on 362 distinct dates.
- The archive name uses `M-C61`, which the FIRMS README describes as Collection 6.1. The filename and the raw version value therefore need a documented interpretation; the name alone does not settle the meaning of `6.03`.

**Status: unresolved.** The current custom flag is retained. It is one dataset-wide metadata concern, not 83,425 independently established bad observations.

Request 42739 now confirms that MODIS C6.1 was requested for India for the full 2022 calendar year. It does not explain the supplied `version=6.03`. Resolution still requires a clearly applicable product-version reference or a response from the provider explaining this export. Record that evidence before changing the flag rule. If a different collection is confirmed, obtain the intended collection for the same date interval and footprint. Do not rewrite `6.03` to `6.1` in the source or cleaned rows.

### J2 2023: DL_FIRE_J2V-C2_42744

- Member: `fire_archive_J2V-C2_42744.csv`.
- Source CSV SHA-256: `6f05ba19571ed7d863d6ba6abb81209738b5a6a17dd56734011c9a8e4c89b036`.
- All 447,875 rows have `instrument=VIIRS`, `satellite=N21`, and `version=2`.
- Observations span 2023-03-01 through 2023-12-31, on all 306 dates in that interval.
- Thus the reported 59 absent calendar dates are January and February, not internal missing dates within March-December.
- The FIRMS archive landing page inspected on 15 October 2026 lists NOAA-21 temporal availability beginning 17 January 2024. This does not match the supplied archive's 2023 observations.
- The common README also says standard NOAA-20/NOAA-21 data are not yet available, while the official API tutorial shows a NOAA-20 standard-processing dataset. These documentation differences mean the general pages cannot be treated as a definitive explanation of this individual export.

**Status: unresolved documentation/provenance discrepancy.** Request 42744 confirms J2 VIIRS C2 for India from 1 January through 31 December 2023. January-February therefore falls inside the documented request, with no supplied records on those 59 dates; its absence remains unexplained. The original CSV confirms the labels and dates existed before cleaning. Neither the CSV nor the email independently certifies the observations or resolves the previously noted archive-availability discrepancy. Verify applicable availability and standard-versus-NRT provenance before treating this dataset as an established cross-sensor baseline. Do not relabel or delete the observations on the basis of a landing-page date alone.

## Coverage handling

1. Retain the existing data and reports unchanged while the source review is open.
2. Use the verified request manifest for exact product, inclusive start/end dates, and requested geographic footprint. All three 2025 requests ended on 1 December; 2-31 December is outside those requests.
3. If complete 2025 data is required, check/archive-request 2-31 December 2025 using the same region and products. Run any additional source data through the reusable cleaning and validation pipeline in a new run.
4. For isolated absent dates, inspect the same region/product/date in the source service and available outage/observation information. Retain unknown coverage when the cause cannot be established.
5. New validator reports distinguish dates outside the documented request, dates inside it with no supplied records, and supplied observations outside it that require investigation. Product availability is not inferred from these categories; applicable availability remains unresolved where noted above.
6. Never add synthetic hotspot rows or equate an absent record with zero actual fires. Even a zero returned-detection count does not establish the absence of fire.

The 2025 MODIS file lacks observations on 26 July, 28 July, 31 July, and 15 September. Updated validation confirms those four inside-request gaps. The other 30 dates in its historical 34-date warning (2-31 December) are outside the request. The 30-date historical warnings for each 2025 VIIRS file are entirely outside the request. Historical reports retain their original interpretation; the new report records the request-aware categories.

### Validator report integration

`validation-v2` adds top-level `request_manifest` (path, SHA-256, load status) and `request_coverage` entries. Existing integrity, schema, hash, normalization, duplicate, audit, and count checks remain. Coverage uses `input_rows_by_date`, including dates with rows later rejected or deduplicated, so removal during cleaning is not misrepresented as absent source records.

- `metadata_status` is `documented` or `unknown`. Unknown requests have null request bounds and null coverage categories; observed minimum/maximum dates never substitute for request metadata. A missing manifest also yields unknown metadata; malformed metadata fails validation.
- `dates_outside_request` lists dates outside the inclusive request within the explicit `calendar_context_start`/`calendar_context_end`. This bounded calendar context spans the full calendar years containing the request and any supplied input dates; it is not a claim about product availability.
- `dates_inside_request_without_supplied_records` lists requested dates absent from supplied input dates. A missing record does not establish zero fires or an outage.
- `observations_outside_request_by_date` gives supplied input row counts outside the request. These dates also belong to `dates_outside_request`; the counts identify an evidence conflict requiring investigation. `investigation_required` and warnings flag this without removing records or changing quality flags. A passed integrity status can coexist with this warning.
- `records_status` is `in_run`, `not_in_run`, or `no_dataset_supplied`. Request 42741 is represented even though no dataset exists, with all 365 requested dates lacking supplied records. Other documented requests absent from a selected run get `not_in_run` and null record-dependent categories, since exclusion from a run does not prove that the provider supplied no records. A later dataset for 42741 triggers an evidence-review warning.
- The existing per-dataset `dates_without_supplied_records` remains the legacy represented-calendar-year gap list for compatibility. Consumers should use `request_coverage` for request-aware interpretation. The old generic calendar-gap warnings are replaced by request-aware warnings; outside-request dates alone do not trigger a missing-record warning.

The manifest covers selection and response evidence only. It does not change source versions, quality flags, or confirm product availability. Manifest changes are fingerprinted and checked for changes during validation, separately from cleaner/normalizer fingerprints.

## Downstream use

- The team can implement loaders, schema checks, UI states, and report plumbing with the validated normalized files while retaining provenance warnings.
- Keep collection-sensitive conclusions involving MODIS 2022 provisional until its version interpretation is resolved. Apply the same provenance review to J2 2023 before using it as an established comparison baseline.
- Compare equivalent geographic footprints and declared time windows. Raw totals over different windows are not directly comparable; a shared window still does not eliminate sensor-detection differences or unknown coverage.
- Keep missing/unknown coverage visibly separate from observed counts.
- Preserve sensor, satellite, confidence scale, hotspot type, source version, and quality flags during aggregation.
- Use the field definitions in `data-dictionary.md`. These are observations, not harmonized event counts or burned-area estimates.

## Remaining handoff items

| Item | State | Needed evidence/action |
|---|---|---|
| Saved-output consistency | Passed again in the separate request-aware report | Retain both historical reports and the new timestamped report with the run |
| MODIS 2022 collection interpretation | Open; C6.1 request confirmed | Applicable explanation of the supplied `6.03` version; preserve flags |
| J2 2023 product/time provenance | Open; full-year request confirmed | Explain January-February absence and archive-availability discrepancy |
| Original date and area selection | Verified from user-provided email screenshots reviewed in ChatGPT | Machine-readable manifest records all 12 requests, India, CSV, and inclusive dates |
| J2 2022 request 42741 | No dataset supplied | Retain no-matching-fires response; actual fire occurrence and coverage remain unknown |
| Full 2025 coverage, if required | 2-31 December outside all three requests | Obtain matching remaining dates if required |
| Validator version control | Implementation included in this checkpoint | `data-pipeline/cleaning/validate_records.py` is included with these documents on `feature/sayem-data-pipeline`; use Git history and the remote branch to verify commit/push state |
| Team access to the data | Not established here | Agree a transfer location; raw/processed files are intentionally Git-ignored |

Do not publish this handoff as a statement that all scientific/provenance questions are resolved. No source-contact message, dataset replacement, branch merge, or data transfer to teammates has been performed by these documentation steps.

## Reproduction

From the project root, with the raw source CSVs and the completed run present:

```powershell
python data-pipeline/cleaning/validate_records.py --run data/processed/run_20261013T175448_392548Z --report validation_report_request_coverage_20261017T104938_182418Z.json
```

This is the exact command executed once for the integration checkpoint. The report now exists, so repeating it refuses overwrite before validation. Use a new filename only when another validation is needed. Relative `--report` paths resolve within the run; absolute paths are accepted, and explicit paths use exclusive creation. Omitting `--report` retains the legacy replacement of `validation_report.json`. Raw and cleaned data are read without rewriting them. The default request manifest is `data/metadata/firms_requests.json`; relative `--request-manifest` paths resolve from the project root.

Small regression commands:

```powershell
python -m unittest discover -s data-pipeline/tests -p test_request_coverage.py -v
python -m unittest discover -s data-pipeline/tests -p test_validation_report_output.py -v
python -m unittest discover -s tests -p test_sayem_cleaning_contract.py -v
```

Coverage/report-output tests do not run production validation. Cleaning-contract tests run the cleaner only on synthetic copies in temporary directories. None modify production data, fixtures or historical reports. See [downstream-data-usage.md](downstream-data-usage.md) for the exact JSON coverage contract and streaming-reader use.

## Provider references reviewed

- FIRMS archive README: https://firms.modaps.eosdis.nasa.gov/download/Readme.txt
- FIRMS archive landing page: https://firms.modaps.eosdis.nasa.gov/download/
- FIRMS MODIS attributes: https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_MODIS_Firehotspots.html
- FIRMS API tutorial: https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html

The supplied handoff documents record a provider-reference review on 15 October 2026. These external-page observations are retained from that review and were not rechecked during this local repository checkpoint. They provide context and unresolved discrepancies; they do not authenticate the individual exports.
