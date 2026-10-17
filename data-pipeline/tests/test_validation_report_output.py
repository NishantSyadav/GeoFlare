"""Report destination safety tests; never run production validation."""

from contextlib import redirect_stderr, redirect_stdout
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cleaning import validate_records as validator


class ReportOutputTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="geoflare-report-test-")
        self.addCleanup(temporary.cleanup)
        self.run = Path(temporary.name)
        self.historical = self.run / "validation_report.json"
        self.historical.write_bytes(b"historical report bytes")

    def invoke(self, report=None, effect=None):
        args = ["validate_records.py", "--run", str(self.run)]
        if report is not None:
            args.extend(["--report", str(report)])

        def success(run, result, manifest):
            result.update(status="passed", unique_record_ids=0)

        with patch.object(sys, "argv", args), patch.object(
                validator, "validate", side_effect=effect or success) as validate, \
                redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            try:
                code = validator.main()
            except SystemExit as error:
                code = error.code
        return code, validate.call_count

    def test_relative_report_is_new_file_inside_run(self):
        code, calls = self.invoke("new-report.json")
        self.assertEqual((code, calls), (0, 1))
        self.assertEqual(json.loads((self.run / "new-report.json").read_text())["status"], "passed")
        self.assertEqual(self.historical.read_bytes(), b"historical report bytes")

    def test_absolute_report_destination(self):
        destination = self.run / "absolute-report.json"
        self.assertEqual(self.invoke(destination), (0, 1))
        self.assertTrue(destination.is_file())
        self.assertEqual(self.historical.read_bytes(), b"historical report bytes")

    def test_existing_explicit_destination_refused_before_validation(self):
        for destination in ("validation_report.json", self.historical):
            with self.subTest(destination=str(destination)):
                self.assertEqual(self.invoke(destination), (2, 0))
                self.assertEqual(self.historical.read_bytes(), b"historical report bytes")

    def test_missing_parent_refused_before_validation(self):
        self.assertEqual(self.invoke("missing/report.json"), (2, 0))

    def test_file_created_during_validation_cannot_be_overwritten(self):
        destination = self.run / "raced.json"

        def race(run, result, manifest):
            destination.write_bytes(b"other writer")
            result.update(status="passed", unique_record_ids=0)

        self.assertEqual(self.invoke(destination, race), (1, 1))
        self.assertEqual(destination.read_bytes(), b"other writer")
        self.assertEqual(self.historical.read_bytes(), b"historical report bytes")

    def test_failed_validation_saved_to_new_report(self):
        self.assertEqual(self.invoke("failed.json", ValueError("integrity check failed")), (1, 1))
        report = json.loads((self.run / "failed.json").read_text())
        self.assertEqual(report["status"], "failed")
        self.assertEqual(report["error"], "integrity check failed")
        self.assertEqual(self.historical.read_bytes(), b"historical report bytes")

    def test_default_preserves_legacy_report_destination(self):
        self.assertEqual(self.invoke(), (0, 1))
        self.assertEqual(json.loads(self.historical.read_text())["status"], "passed")


if __name__ == "__main__":
    unittest.main()
