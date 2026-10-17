"""Offline adapter and shared-cleaner regression tests on synthetic data."""
import csv
import gzip
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'data-pipeline'))
from ingestion.adapters import CsvAdapter, check_descriptor, inspect_response
from schemas.hotspot_schema import normalize_record
from cleaning import clean_records, validate_records

FIXTURE = ROOT / 'tests/fixtures/api_ingestion_v1/j1_area.csv'


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.raw = next(csv.DictReader(io.StringIO(FIXTURE.read_text())))
        self.adapter = CsvAdapter('firms-area-csv', 1, 'J1V-C2')

    def test_equivalent_identity_fields_produce_same_record_and_id(self):
        original = dict(self.raw)
        archive = dict(self.raw)
        archive['brightness'] = archive.pop('bright_ti4')
        archive['bright_t31'] = archive.pop('bright_ti5')
        archive['type'] = ''
        actual = normalize_record(self.adapter.adapt(self.raw), 'J1V-C2')
        self.assertEqual(actual, normalize_record(archive, 'J1V-C2'))
        self.assertEqual(self.raw, original)
        self.assertEqual(actual['bright_t31'], 299.0)
        self.assertIsNone(actual['hotspot_type'])
        self.assertEqual(actual['quality_flags'], ['missing_hotspot_type'])

    def test_versions_and_confidence_preserved(self):
        for version in ('2', '2.0NRT', 'unexpected'):
            record = normalize_record(self.adapter.adapt(dict(self.raw, version=version)), 'J1V-C2')
            self.assertEqual(record['source_version'], version)
            self.assertEqual(record['confidence'], 'nominal')
            self.assertEqual(record['confidence_raw'], 'n')
            self.assertEqual('unrecognized_source_version' in record['quality_flags'], version == 'unexpected')
        normal = normalize_record(self.adapter.adapt(self.raw), 'J1V-C2')
        nrt = normalize_record(self.adapter.adapt(dict(self.raw, version='2.0NRT')), 'J1V-C2')
        self.assertNotEqual(normal['record_id'], nrt['record_id'])

    def test_conflicting_aliases_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Conflicting aliases'):
            self.adapter.adapt(dict(self.raw, brightness='999'))
        self.assertEqual(self.adapter.adapt(dict(self.raw, brightness='310'))['brightness'], '310')

    def test_schema_rejection_and_header_only_empty(self):
        header = list(self.raw)
        self.adapter.check_header(header)
        for invalid in (header + ['extra'], header + ['latitude'], header[1:], ['Error: invalid key']):
            with self.subTest(header=invalid), self.assertRaises(ValueError):
                self.adapter.check_header(invalid)
        self.assertEqual(inspect_response((','.join(header) + '\n').encode(), 'VIIRS_NOAA20_SP'), 0)
        for raw in (b'', b'<html>Error</html>', b'No data available'):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                inspect_response(raw, 'VIIRS_NOAA20_SP')

    def test_unsupported_adapter_and_api_source(self):
        with self.assertRaises(ValueError):
            CsvAdapter('firms-area-csv', 2, 'J1V-C2')
        descriptor = {'dataset': 'api-test', 'source_file': 'data/raw/response.csv',
                      'source_product': 'J1V-C2', 'adapter_id': 'firms-area-csv',
                      'adapter_version': 1, 'sha256': '0' * 64, 'api_source': 'VIIRS_NOAA20_SP'}
        check_descriptor(descriptor, ROOT)
        for update in ({'api_source': 'VIIRS_NOAA21_NRT'}, {'source_file': '../outside.csv'},
                       {'dataset': 'DL_FIRE_J1V-C2_1234'}, {'adapter_version': 99}, {'secret': 'forbidden'}):
            with self.subTest(update=update), self.assertRaises(ValueError):
                check_descriptor(dict(descriptor, **update), ROOT)

    def test_legacy_fingerprint_is_still_strict(self):
        legacy = ROOT / 'data-pipeline/cleaning/legacy/clean_records_v1.py'
        report = {'datasets': [], 'processor_sha256': hashlib.sha256(legacy.read_bytes()).hexdigest(),
                  'normalizer_sha256': clean_records.sha256_file(ROOT / 'data-pipeline/schemas/hotspot_schema.py')}
        validate_records.check_implementation(report, [])
        with self.assertRaisesRegex(ValueError, 'code differs'):
            validate_records.check_implementation(dict(report, processor_sha256='0' * 64), [])


class SavedIngestionTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix='geoflare-api-test-')
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        for name in ('cleaning/clean_records.py', 'cleaning/validate_records.py',
                     'cleaning/legacy/clean_records_v1.py', 'schemas/hotspot_schema.py', 'ingestion/adapters.py'):
            target = self.root / 'data-pipeline' / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / 'data-pipeline' / name, target)
        sources = []
        for name in ('api-a', 'api-b', 'api-empty'):
            path = self.root / 'data/raw' / (name + '.csv')
            path.parent.mkdir(parents=True, exist_ok=True)
            data = FIXTURE.read_bytes()
            if name == 'api-empty':
                data = data.splitlines(keepends=True)[0]
            path.write_bytes(data)
            sources.append({'dataset': name, 'source_file': path.relative_to(self.root).as_posix(),
                            'source_product': 'J1V-C2', 'api_source': 'VIIRS_NOAA20_SP',
                            'adapter_id': 'firms-area-csv', 'adapter_version': 1,
                            'sha256': hashlib.sha256(data).hexdigest(),
                            'request': {'start': '2024-02-29', 'end': '2024-02-29', 'bbox': [70, 10, 90, 35]}})
        self.manifest = self.root / 'data/raw/sources.json'
        self.manifest.write_text(json.dumps({'schema_version': 1, 'sources': sources}))
        self.before = {p: p.read_bytes() for p in (self.root / 'data/raw').iterdir()}

    def clean(self):
        result = subprocess.run([sys.executable, 'data-pipeline/cleaning/clean_records.py',
                                 '--source-manifest', str(self.manifest)], cwd=self.root,
                                text=True, capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return next((self.root / 'data/processed').iterdir())

    def test_saved_ingestion_dedup_audits_and_adapter_validation(self):
        run = self.clean()
        report = json.loads((run / 'processing_report.json').read_text())
        self.assertEqual(report['totals'], {'input_rows': 8, 'accepted_rows': 2,
                                          'rejected_rows': 2, 'duplicate_rows': 4})
        self.assertEqual(report['output_columns'], clean_records.OUTPUT_COLUMNS)
        self.assertEqual(report['implementation_version'], 'cleaning-v2')
        with gzip.open(run / 'api-a_clean.csv.gz', 'rt') as handle:
            records = list(csv.DictReader(handle))
        self.assertEqual([r['source_row'] for r in records], ['2', '4'])
        self.assertTrue(all(r['hotspot_type'] == '' for r in records))
        self.assertTrue(all(json.loads(r['quality_flags']) == ['missing_hotspot_type'] for r in records))
        self.assertEqual(records[1]['frp_mw'], '0.0')
        result = subprocess.run([sys.executable, 'data-pipeline/cleaning/validate_records.py',
                                 '--run', str(run), '--report', 'adapter-validation.json'],
                                cwd=self.root, text=True, capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        validated = json.loads((run / 'adapter-validation.json').read_text())
        self.assertEqual(validated['status'], 'passed')
        self.assertEqual(validated['request_coverage'][2]['dates_inside_request_without_supplied_records'], ['2024-02-29'])
        for path, raw in self.before.items():
            self.assertEqual(path.read_bytes(), raw)
        with gzip.open(run / 'duplicate_rows.csv.gz', 'rt') as handle:
            audit = handle.read()
        with gzip.open(run / 'duplicate_rows.csv.gz', 'wt') as handle:
            handle.write(audit.replace('12.5', '99.9'))
        with patch.object(validate_records, 'PROJECT_ROOT', self.root), patch.object(clean_records, 'PROJECT_ROOT', self.root):
            with self.assertRaisesRegex(ValueError, 'Adapter replay differs'):
                validate_records.check_adapter_replay(report, run)

    def test_tampered_source_hash_fails_without_modifying_raw(self):
        source = self.root / 'data/raw/api-a.csv'
        source.write_bytes(source.read_bytes() + b'\n')
        result = subprocess.run([sys.executable, 'data-pipeline/cleaning/clean_records.py',
                                 '--source-manifest', str(self.manifest)], cwd=self.root,
                                text=True, capture_output=True, timeout=30)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('descriptor source SHA-256 mismatch', result.stderr)


if __name__ == '__main__':
    unittest.main()
