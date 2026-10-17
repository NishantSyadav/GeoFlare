"""Bounded, offline FIRMS HTTP tests. No credentials or live network needed."""
from contextlib import redirect_stderr, redirect_stdout
from datetime import date
import io
from http.client import IncompleteRead
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import URLError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'data-pipeline'))
from ingestion import firms_client as client
from ingestion.adapters import load_sources

SOURCE = 'VIIRS_NOAA20_SP'
KEY = 'synthetic_test_credential_not_a_real_key'
AREA = (ROOT / 'tests/fixtures/api_ingestion_v1/j1_area.csv').read_bytes()
HEADER = AREA.splitlines(keepends=True)[0]


def availability(start='2024-02-29', end='2024-03-02'):
    return f'data_id,min_date,max_date\n{SOURCE},{start},{end}\n'.encode()


class FetchTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory(prefix='geoflare-fetch-test-')
        self.addCleanup(folder.cleanup)
        self.root = Path(folder.name)
        self.output = self.root / 'data/raw/api/test'
        self.calls, self.sleeps = [], []

    def fetch(self, replies, **kwargs):
        replies = iter(replies)

        def transport(url, timeout, limit):
            self.calls.append((url, timeout, limit))
            reply = next(replies)
            if isinstance(reply, Exception):
                raise reply
            return reply

        options = dict(source=SOURCE, start='2024-02-29', end='2024-02-29', bbox=[70, 10, 90, 35],
                       output=self.output, key=KEY, root=self.root, transport=transport, sleep=self.sleeps.append)
        options.update(kwargs)
        return client.fetch(**options)

    def assert_no_key_saved(self):
        for path in self.output.rglob('*'):
            if path.is_file():
                self.assertNotIn(KEY.encode(), path.read_bytes(), str(path))

    def test_windows_are_inclusive_nonoverlapping_and_bounded(self):
        windows = client.plan_windows('2024-02-27', '2024-03-08', 5)
        self.assertEqual([(w['start'], w['end'], w['days']) for w in windows], [
            ('2024-02-27', '2024-03-02', 5), ('2024-03-03', '2024-03-07', 5), ('2024-03-08', '2024-03-08', 1)])
        self.assertEqual(client.plan_windows('9999-12-31', '9999-12-31')[0]['days'], 1)
        for start, end, length in [('2024-02-30', '2024-03-01', 1), ('2024-03-02', '2024-03-01', 1),
                                   ('2023-01-01', '2024-12-31', 5), ('2024-01-01', '2024-01-02', 6)]:
            with self.subTest(start=start, end=end, length=length), self.assertRaises(ValueError):
                client.plan_windows(start, end, length)

    def test_data_empty_and_unavailable_are_distinct_and_manifest_loads(self):
        report = self.fetch([(200, availability(), True), (200, AREA, True), (200, HEADER, True)],
                            start='2024-02-28', end='2024-03-03', window_days=2)
        self.assertEqual(report['status'], 'complete')
        self.assertEqual(report['outcome_counts'], {'unavailable': 2, 'data': 1, 'empty': 1})
        self.assertEqual(len(self.calls), 3)
        self.assertIn('/2/2024-02-29', self.calls[1][0])
        self.assertIn('/1/2024-03-02', self.calls[2][0])
        sources = load_sources(self.output / 'sources.json', self.root)
        self.assertEqual(len(sources), 2)
        self.assertEqual(sources[0][4]['api_source'], SOURCE)
        self.assertEqual(sources[0][2].read_bytes(), AREA)
        self.assertEqual(sources[1][2].read_bytes(), HEADER)
        self.assert_no_key_saved()

    def test_transient_retries_are_bounded_and_saved(self):
        report = self.fetch([(503, b'transient', True), (200, availability(), True),
                             (429, b'rate limited', True), (200, HEADER, True)])
        self.assertEqual(report['status'], 'complete')
        self.assertEqual(self.sleeps, [1, 1])
        self.assertEqual(len(list(self.output.glob('*_attempt_*.csv'))), 4)
        self.assert_no_key_saved()

    def test_retry_exhaustion_and_permanent_error(self):
        report = self.fetch([URLError('secret URL ' + KEY)] * 3)
        self.assertEqual(report['status'], 'failed')
        self.assertEqual(report['error'], 'transport_error')
        self.assertEqual(len(self.calls), 3)
        self.assertEqual(self.sleeps, [1, 2])
        self.assert_no_key_saved()
        other = self.root / 'permanent'
        report = self.fetch([(401, b'unauthorized', True)], output=other)
        self.assertEqual(report['error'], 'http_401')
        self.assertEqual(len(report['availability_attempts']), 1)

    def test_incomplete_http_body_retries_without_exception_leak(self):
        report = self.fetch([IncompleteRead(b'partial ' + KEY.encode()),
                             (200, availability(), True), (200, HEADER, True)])
        self.assertEqual(report['status'], 'complete')
        self.assertEqual(self.sleeps, [1])
        self.assert_no_key_saved()

    def test_error_responses_are_not_empty_datasets(self):
        for index, body in enumerate((b'', b'<html>error</html>', b'Invalid MAP_KEY', b'No data')):
            with self.subTest(body=body):
                report = self.fetch([(200, availability(), True), (200, body, True)],
                                    output=self.root / f'error{index}')
                self.assertEqual(report['status'], 'failed')
                self.assertEqual(report['outcome_counts'], {'error': 1})
                self.assertEqual(report['windows'][0]['error'], 'invalid_area_csv_response')

    def test_credential_echo_is_not_saved_or_retried(self):
        report = self.fetch([(503, ('URL contains ' + KEY).encode(), True)])
        self.assertEqual(report['error'], 'credential_echo_body_not_saved')
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(list(self.output.glob('*.csv')), [])
        self.assert_no_key_saved()

    def test_oversized_response_is_marked_partial_not_usable(self):
        report = self.fetch([(200, b'partial bytes', False)])
        self.assertEqual(report['error'], 'response_exceeds_byte_limit')
        self.assertEqual(len(list(self.output.glob('*.partial'))), 1)
        self.assertEqual(len(self.calls), 1)

    def test_existing_output_refused_without_network_or_replacement(self):
        self.output.mkdir(parents=True)
        sentinel = self.output / 'keep'
        sentinel.write_bytes(b'preserve')
        with self.assertRaises(FileExistsError):
            self.fetch([])
        self.assertEqual(self.calls, [])
        self.assertEqual(sentinel.read_bytes(), b'preserve')

    def test_unavailable_range_does_not_query_area(self):
        report = self.fetch([(200, availability(), True)], start='2022-01-01', end='2022-01-05')
        self.assertEqual(report['outcome_counts'], {'unavailable': 1})
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(json.loads((self.output / 'sources.json').read_text())['sources'], [])

    def test_availability_and_bbox_validation(self):
        for body in (b'', availability() + availability().splitlines(keepends=True)[1],
                     availability('2024-03-02', '2024-02-29'), b'data_id,min_date,max_date\nOTHER,2024-01-01,2024-02-01\n'):
            with self.subTest(body=body), self.assertRaises(ValueError):
                client.parse_availability(body, SOURCE)
        for bbox in ([90, 10, 70, 35], [70, 91, 90, 95], [70, 10, float('nan'), 35]):
            with self.subTest(bbox=bbox), self.assertRaises(ValueError):
                self.fetch([], bbox=bbox)
        self.assertEqual(self.calls, [])

    def test_dry_run_no_credentials_network_or_writes(self):
        stdout = io.StringIO()
        with patch.object(sys, 'argv', ['firms_client.py', '--source', SOURCE, '--start', '2024-02-29',
                                       '--end', '2024-02-29', '--bbox', '70,10,90,35', '--dry-run']), \
                patch.dict('os.environ', {}, clear=True), patch.object(client, 'fetch') as fetch, redirect_stdout(stdout):
            self.assertEqual(client.main(), 0)
        fetch.assert_not_called()
        self.assertEqual(json.loads(stdout.getvalue())['windows'][0]['availability'], 'unchecked')
        self.assertFalse(self.output.exists())

    def test_missing_key_fails_without_creating_output(self):
        with self.assertRaisesRegex(ValueError, 'FIRMS_MAP_KEY'):
            self.fetch([], key=None)
        self.assertFalse(self.output.exists())
        self.assertEqual(self.calls, [])

    def test_redirect_is_not_followed(self):
        self.assertIsNone(client.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://example.org'))

    def test_mocked_fetch_connects_to_cleaner_and_validator(self):
        self.fetch([(200, availability(), True), (200, AREA, True)])
        for name in ('ingestion/adapters.py', 'schemas/hotspot_schema.py',
                     'cleaning/clean_records.py', 'cleaning/validate_records.py'):
            destination = self.root / 'data-pipeline' / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / 'data-pipeline' / name, destination)
        result = subprocess.run([sys.executable, 'data-pipeline/cleaning/clean_records.py',
                                 '--source-manifest', str(self.output / 'sources.json')],
                                cwd=self.root, text=True, capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        run = next((self.root / 'data/processed').iterdir())
        report = json.loads((run / 'processing_report.json').read_text())
        self.assertEqual(report['totals'], {'input_rows': 4, 'accepted_rows': 2,
                                          'rejected_rows': 1, 'duplicate_rows': 1})
        result = subprocess.run([sys.executable, 'data-pipeline/cleaning/validate_records.py',
                                 '--run', str(run), '--report', 'fetch-validation.json'],
                                cwd=self.root, text=True, capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        result = json.loads((run / 'fetch-validation.json').read_text())
        self.assertEqual(result['request_coverage'][0]['request']['api_source'], SOURCE)
        self.assertEqual(result['status'], 'passed')


if __name__ == '__main__':
    unittest.main()
