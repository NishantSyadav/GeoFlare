# GeoFlare validated-data handoff

Prepared: 15 October 2026. Working branch: `feature/sayem-data-pipeline`.

**Technical validation passed. Scientific harmonization and the provenance checks listed below remain pending.**

## Run and evidence

- Run: `data/processed/run_20261013T175448_392548Z`.
- Normalizer: `pipeline-v1`; inspected source commit: `53a274b`.
- The saved `validation_report.json` has `status: passed`: 11 datasets, 4,260,572 rows checked, and 4,260,572 unique record IDs. Validation ran from `2026-10-15T16:14:51.688577+00:00` to `2026-10-15T16:19:37.252120+00:00` (UTC).
- The saved `processing_report.json` has `status: complete`, completed at `2026-10-13T18:00:29.761832+00:00` (UTC). It reports 4,260,572 input/accepted rows, zero rejected rows, and zero duplicate rows; the validation totals and audit counts agree.
- There are 11 validation warnings: 10 absent-calendar-date summaries and one retained-quality-flag summary. The flagged dataset contains 83,425 flagged rows.
- This documentation checkpoint checked both saved reports, their dataset counts, dates, flags, and hashes, and all 23 output columns against the local code. The validation report's processing-report SHA-256 matches the saved report, and the cleaner/normalizer fingerprints match the processing report. The two local source ZIP inventories and extracted CSVs listed below also corroborate the handoff's archive details, source hashes, and instrument/satellite/version counts. Cleaning and full output validation were not rerun for this checkpoint.

The validator checks file hashes, saved schema and normalizer round-trips, record identities, global ID uniqueness, row/date/flag/type totals, and audit files. It reuses the same normalizer as the cleaner, so passing does not independently prove that every scientific interpretation in the normalizer is correct.

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

Each inspected ZIP contains one CSV and an 89-byte `Readme.txt` pointing to the common online FIRMS README. Neither ZIP includes a separate request-specific date-range, area-of-interest, or collection-verification document. A common README is not sufficient to resolve a specific request's metadata conflict.

### MODIS 2022: DL_FIRE_M-C61_42739

- Member: `fire_archive_M-C61_42739.csv`.
- Source CSV SHA-256: `6d31a461c1cc8b6044f74aaa45d05c0a79989127b4ab0f7787495aa4bc3caa05`.
- All 83,425 rows have `instrument=MODIS` and `version=6.03`.
- Satellite values: Terra 27,806 rows; Aqua 55,619 rows.
- Observations span 2022-01-01 through 2022-12-31, on 362 distinct dates.
- The archive name uses `M-C61`, which the FIRMS README describes as Collection 6.1. The filename and the raw version value therefore need a documented interpretation; the name alone does not settle the meaning of `6.03`.

**Status: unresolved.** The current custom flag is retained. It is one dataset-wide metadata concern, not 83,425 independently established bad observations.

Resolution requires the original FIRMS request metadata, a clearly applicable product-version reference, or a response from the provider explaining this export. If the collection is confirmed, record the evidence before changing the flag rule. If a different collection is confirmed, obtain the intended collection for the same date interval and footprint. Do not rewrite `6.03` to `6.1` in the source or cleaned rows.

### J2 2023: DL_FIRE_J2V-C2_42744

- Member: `fire_archive_J2V-C2_42744.csv`.
- Source CSV SHA-256: `6f05ba19571ed7d863d6ba6abb81209738b5a6a17dd56734011c9a8e4c89b036`.
- All 447,875 rows have `instrument=VIIRS`, `satellite=N21`, and `version=2`.
- Observations span 2023-03-01 through 2023-12-31, on all 306 dates in that interval.
- Thus the reported 59 absent calendar dates are January and February, not internal missing dates within March-December.
- The FIRMS archive landing page inspected on 15 October 2026 lists NOAA-21 temporal availability beginning 17 January 2024. This does not match the supplied archive's 2023 observations.
- The common README also says standard NOAA-20/NOAA-21 data are not yet available, while the official API tutorial shows a NOAA-20 standard-processing dataset. These documentation differences mean the general pages cannot be treated as a definitive explanation of this individual export.

**Status: unresolved documentation/provenance discrepancy.** The original CSV confirms the labels and dates existed before cleaning. This does not independently certify the observations, nor prove that the archive is wrong. Verify the request/product metadata and standard-versus-NRT provenance before treating this dataset as an established cross-sensor baseline. Do not relabel or delete the observations on the basis of a landing-page date alone.

## Coverage handling

1. Retain the existing data and reports unchanged while the source review is open.
2. Record each request's exact product, start date, end date, and geographic footprint. The currently observed end dates do not reveal whether the original requests ended on 1 December or returned no later records.
3. If complete 2025 data is required, check/archive-request 2-31 December 2025 using the same region and products. Run any additional source data through the reusable cleaning and validation pipeline in a new run.
4. For isolated absent dates, inspect the same region/product/date in the source service and available outage/observation information. Retain unknown coverage when the cause cannot be established.
5. In future reports, distinguish dates outside the requested interval, dates outside confirmed product availability, and dates with no supplied detections inside the request. Changing a reporting category requires evidence for the requested interval or availability.
6. Never add synthetic hotspot rows or equate an absent record with zero actual fires. Even a zero returned-detection count does not establish the absence of fire.

The 2025 MODIS file also lacks observations on 26 July, 28 July, 31 July, and 15 September in the saved processing report. These four internal dates, plus 2-31 December, account for its 34-date warning.

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
| Saved-output consistency | Passed on user's computer | Retain `processing_report.json` and `validation_report.json` with the run |
| MODIS 2022 collection interpretation | Open | Request 42739 metadata and applicable version explanation |
| J2 2023 product/time provenance | Open | Request 42744 metadata and applicable product-availability explanation |
| Original date and area selection | Not present inside inspected ZIPs | Original FIRMS request/download emails or request-page exports |
| Full 2025 coverage, if required | Not supplied after 1 December | Verify request range; obtain matching remaining dates if required |
| Validator version control | Implementation included in this checkpoint | `data-pipeline/cleaning/validate_records.py` is included with these documents on `feature/sayem-data-pipeline`; use Git history and the remote branch to verify commit/push state |
| Team access to the data | Not established here | Agree a transfer location; raw/processed files are intentionally Git-ignored |

Do not publish this handoff as a statement that all scientific/provenance questions are resolved. No source-contact message, dataset replacement, branch merge, or data transfer to teammates has been performed by these documentation steps.

## Reproduction

From the project root, with the raw source CSVs and the completed run present:

```powershell
python data-pipeline/cleaning/validate_records.py --run data/processed/run_20261013T175448_392548Z
```

The validation report is written inside that run directory. The raw and cleaned data are read without rewriting them. No cleaning rerun is required just to save this documentation.

## Provider references reviewed

- FIRMS archive README: https://firms.modaps.eosdis.nasa.gov/download/Readme.txt
- FIRMS archive landing page: https://firms.modaps.eosdis.nasa.gov/download/
- FIRMS MODIS attributes: https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_MODIS_Firehotspots.html
- FIRMS API tutorial: https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html

The supplied handoff documents record a provider-reference review on 15 October 2026. These external-page observations are retained from that review and were not rechecked during this local repository checkpoint. They provide context and unresolved discrepancies; they do not authenticate the individual exports.
