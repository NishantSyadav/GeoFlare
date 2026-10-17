"""Small request-coverage tests; no raw data, fixtures, or cleaning runs needed."""

import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cleaning.validate_records import (
    REQUEST_MANIFEST, build_request_coverage, calendar_days, coverage_warnings,
    load_requests, request_coverage,
)


class RequestCoverageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.requests = load_requests(REQUEST_MANIFEST)

    def coverage(self, name, days):
        return request_coverage(name, days, self.requests[name])

    def test_verified_manifest(self):
        self.assertEqual(len(self.requests), 12)
        products = [("M-C61", "MODIS C6.1"), ("J1V-C2", "J1 VIIRS C2"),
                    ("J2V-C2", "J2 VIIRS C2")]
        for offset in range(12):
            identifier = str(42739 + offset)
            year = 2022 + offset // 3
            code, product = products[offset % 3]
            item = self.requests[f"DL_FIRE_{code}_{identifier}"]
            self.assertEqual(item["request_id"], identifier)
            self.assertEqual(item["product"], product)
            self.assertEqual(item["area"], "India")
            self.assertEqual(item["format"], "CSV")
            self.assertEqual(item["requested_start"], f"{year}-01-01")
            self.assertEqual(item["requested_end"],
                             f"{year}-12-01" if year == 2025 else f"{year}-12-31")
            self.assertIn("screenshots", item["evidence"])
            self.assertEqual(item["response_status"], "no_matching_fires_no_dataset"
                             if identifier == "42741" else "dataset_supplied")

    def test_inclusive_boundaries_and_outside_observations(self):
        result = self.coverage("DL_FIRE_M-C61_42748", {
            "2024-12-31": 2, "2025-01-01": 3, "2025-12-01": 4, "2025-12-02": 5,
        })
        self.assertEqual(result["observations_outside_request_by_date"],
                         {"2024-12-31": 2, "2025-12-02": 5})
        gaps = result["dates_inside_request_without_supplied_records"]
        self.assertNotIn("2025-01-01", gaps)
        self.assertNotIn("2025-12-01", gaps)
        self.assertNotIn("2025-12-02", gaps)
        self.assertIn("2025-12-02", result["dates_outside_request"])
        self.assertTrue(result["investigation_required"])
        self.assertTrue(any("7 input observations" in warning and "investigation required" in warning
                            for warning in coverage_warnings(result)))

    def test_2025_december_is_outside_request(self):
        days = dict.fromkeys(calendar_days("2025-01-01", "2025-12-01"), 1)
        internal_gaps = ["2025-07-26", "2025-07-28", "2025-07-31", "2025-09-15"]
        for day in internal_gaps:
            del days[day]
        result = self.coverage("DL_FIRE_M-C61_42748", days)
        self.assertEqual(result["dates_inside_request_without_supplied_records"], internal_gaps)
        self.assertEqual(result["dates_outside_request"],
                         list(calendar_days("2025-12-02", "2025-12-31")))
        self.assertFalse(result["investigation_required"])
        for name in ("DL_FIRE_J1V-C2_42749", "DL_FIRE_J2V-C2_42750"):
            complete = self.coverage(name, dict.fromkeys(calendar_days("2025-01-01", "2025-12-01"), 1))
            self.assertEqual(complete["dates_inside_request_without_supplied_records"], [])
            self.assertEqual(coverage_warnings(complete), [])

    def test_j2_2023_january_february_remain_inside_request(self):
        result = self.coverage("DL_FIRE_J2V-C2_42744",
                               dict.fromkeys(calendar_days("2023-03-01", "2023-12-31"), 1))
        gaps = result["dates_inside_request_without_supplied_records"]
        self.assertEqual(gaps, list(calendar_days("2023-01-01", "2023-02-28")))
        self.assertEqual(len(gaps), 59)
        self.assertEqual(result["dates_outside_request"], [])

    def test_leap_year_and_empty_input(self):
        result = self.coverage("DL_FIRE_M-C61_42745", {})
        self.assertEqual(len(result["dates_inside_request_without_supplied_records"]), 366)
        self.assertIn("2024-02-29", result["dates_inside_request_without_supplied_records"])
        self.assertEqual(result["dates_outside_request"], [])

    def test_unknown_metadata_does_not_use_observed_bounds(self):
        for dates in ({"2025-03-02": 10, "2025-03-03": 1}, {}):
            result = request_coverage("unknown", dates, None)
            self.assertEqual(result["metadata_status"], "unknown")
            for key in ("request", "calendar_context_start", "calendar_context_end",
                        "dates_outside_request", "dates_inside_request_without_supplied_records",
                        "observations_outside_request_by_date", "investigation_required"):
                self.assertIsNone(result[key])
            self.assertIn("request metadata unknown", coverage_warnings(result)[0])

    def test_missing_manifest_is_unknown(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(load_requests(Path(directory) / "missing.json"), {})

    def test_no_dataset_response_and_unincluded_datasets_are_distinct(self):
        results = {item["dataset"]: item for item in build_request_coverage([], self.requests)}
        empty = results["DL_FIRE_J2V-C2_42741"]
        self.assertEqual(empty["records_status"], "no_dataset_supplied")
        self.assertEqual(len(empty["dates_inside_request_without_supplied_records"]), 365)
        self.assertEqual(empty["observations_outside_request_by_date"], {})
        self.assertIn("not evidence of zero fires", coverage_warnings(empty)[0])
        absent = results["DL_FIRE_M-C61_42739"]
        self.assertEqual(absent["records_status"], "not_in_run")
        self.assertIsNone(absent["dates_inside_request_without_supplied_records"])
        self.assertIsNone(absent["observations_outside_request_by_date"])

    def test_input_dates_used_without_mutating_metadata_or_counts(self):
        dataset = {"dataset": "DL_FIRE_J2V-C2_42744", "source_product": "J2V-C2",
                   "input_rows_by_date": {"2023-01-01": 1}, "accepted_rows_by_date": {}}
        original = copy.deepcopy((dataset, self.requests))
        results = build_request_coverage([dataset], self.requests)
        self.assertNotIn("2023-01-01", results[0]["dates_inside_request_without_supplied_records"])
        self.assertEqual((dataset, self.requests), original)
        self.assertEqual(len(results), 12)
        dataset["source_product"] = "M-C61"
        with self.assertRaisesRegex(ValueError, "source product differs"):
            build_request_coverage([dataset], self.requests)

    def test_no_dataset_evidence_conflict_requires_review(self):
        result = self.coverage("DL_FIRE_J2V-C2_42741", {"2022-01-01": 1})
        self.assertTrue(result["investigation_required"])
        self.assertTrue(any("despite documented no-dataset" in w for w in coverage_warnings(result)))

    def test_malformed_metadata_is_not_silently_unknown(self):
        manifest = json.loads(REQUEST_MANIFEST.read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "requests.json"
            for mutation in ("duplicate", "reversed", "bad_date", "wrong_product", "exclusive"):
                changed = copy.deepcopy(manifest)
                first = changed["requests"][0]
                if mutation == "duplicate":
                    changed["requests"].append(copy.deepcopy(first))
                elif mutation == "reversed":
                    first["requested_end"] = "2021-12-31"
                elif mutation == "bad_date":
                    first["requested_start"] = "2022-02-30"
                elif mutation == "wrong_product":
                    first["source_product"] = "J2V-C2"
                else:
                    changed["date_bounds"] = "exclusive"
                path.write_text(json.dumps(changed), encoding="utf-8")
                with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                    load_requests(path)


if __name__ == "__main__":
    unittest.main()
