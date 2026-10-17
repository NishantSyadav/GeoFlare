"""Small offline cleaning contract tests. All input observations are synthetic."""
import csv
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = Path(__file__).parent / 'fixtures' / 'sayem_cleaning_v1'
EXPECTED = json.loads((FIXTURES / 'expected.json').read_text(encoding='utf-8'))
SCHEMA = ROOT / 'data-pipeline' / 'schemas' / 'hotspot_schema.py'
SPEC = importlib.util.spec_from_file_location('sayem_fixture_schema', SCHEMA)
schema = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(schema)


def raw_path(root, dataset):
    return root / 'data' / 'raw' / 'extracted' / dataset / 'input.csv'


def fixture_row(dataset, source_row=2):
    with (FIXTURES / (dataset + '.csv')).open(newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))[source_row - 2]


def csv_expected(record):
    # Expected CSV serialization of the fixed, independently specified values.
    return {key: json.dumps(value, separators=(',', ':')) if key == 'quality_flags'
            else '' if value is None else str(value)
            for key, value in record.items()}


def read_gzip_csv(path):
    with gzip.open(path, 'rt', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return reader.fieldnames, list(reader)


class NormalizeContractTests(unittest.TestCase):
    def test_expected_records_preserve_values_types_flags_and_input(self):
        for record in EXPECTED['records']:
            with self.subTest(source=record['source_file'], row=record['source_row']):
                dataset = Path(record['source_file']).parent.name
                raw = fixture_row(dataset, record['source_row'])
                before = raw.copy()
                expected = {k: v for k, v in record.items()
                            if k not in ('source_file', 'source_row')}
                actual = schema.normalize_record(raw, record['source_product'])
                self.assertEqual(actual, expected)
                self.assertEqual(raw, before)
                self.assertIs(type(actual['confidence']), type(expected['confidence']))

    def test_bad_coordinates_and_negative_or_nonfinite_frp_are_rejected(self):
        raw = fixture_row('DL_FIRE_M-C61_990001')
        for field, value in [('latitude', '-90.1'), ('latitude', 'inf'),
                             ('longitude', '-180.1'), ('longitude', ''),
                             ('frp', '-1'), ('frp', 'Infinity')]:
            with self.subTest(field=field, value=value):
                with self.assertRaisesRegex(ValueError, '^' + field + ':'):
                    schema.normalize_record(dict(raw, **{field: value}), 'M-C61')

    def test_coordinate_endpoints_are_allowed(self):
        raw = fixture_row('DL_FIRE_M-C61_990001')
        for latitude, longitude in [('-90', '-180'), ('90', '180')]:
            with self.subTest(latitude=latitude, longitude=longitude):
                record = schema.normalize_record(dict(raw, latitude=latitude,
                                                       longitude=longitude), 'M-C61')
                self.assertEqual((record['latitude'], record['longitude']),
                                 (float(latitude), float(longitude)))

    def test_missing_frp_is_distinct_from_measured_zero(self):
        raw = fixture_row('DL_FIRE_J1V-C2_990003')
        zero = schema.normalize_record(dict(raw, frp='0'), 'J1V-C2')
        self.assertEqual(zero['frp_mw'], 0.0)
        self.assertNotIn('missing_frp_mw', zero['quality_flags'])
        for marker in ['', 'NA', 'NaN', 'null']:
            with self.subTest(marker=marker):
                missing = schema.normalize_record(dict(raw, frp=marker), 'J1V-C2')
                self.assertIsNone(missing['frp_mw'])
                self.assertIn('missing_frp_mw', missing['quality_flags'])
                self.assertNotEqual(missing['record_id'], zero['record_id'])

    def test_unknown_versions_are_retained_and_flagged(self):
        raw = fixture_row('DL_FIRE_M-C61_990001')
        record = schema.normalize_record(dict(raw, version='unexpected-version'), 'M-C61')
        self.assertEqual(record['source_version'], 'unexpected-version')
        self.assertIn('unrecognized_source_version', record['quality_flags'])

    def test_rejects_instrument_product_mismatch(self):
        raw = fixture_row('DL_FIRE_M-C61_990001')
        with self.assertRaisesRegex(ValueError, 'instrument: does not match'):
            schema.normalize_record(dict(raw, instrument='VIIRS'), 'M-C61')


class CleaningFileContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='geoflare-synthetic-')
        cls.addClassCleanup(cls.temp.cleanup)
        cls.root = Path(cls.temp.name)
        # Copy only the implementation under test. Real project data is never read.
        for relative in ['data-pipeline/cleaning/clean_records.py',
                         'data-pipeline/schemas/hotspot_schema.py']:
            destination = cls.root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, destination)
        for source in sorted(FIXTURES.glob('*.csv')):
            destination = raw_path(cls.root, source.stem)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
            archive = cls.root / 'data' / 'raw' / 'zips' / (source.stem + '.zip')
            archive.parent.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(archive, 'w') as zf:
                zf.write(destination, 'input.csv')
        cls.raw_bytes_before = {p: p.read_bytes() for p in (cls.root / 'data/raw').rglob('*')
                                if p.is_file()}
        cls.first_run = cls.run_cleaner()
        cls.report = json.loads((cls.first_run / 'processing_report.json').read_text())

    @classmethod
    def run_cleaner(cls):
        processed = cls.root / 'data' / 'processed'
        previous = set(processed.iterdir()) if processed.exists() else set()
        result = subprocess.run([sys.executable, str(cls.root / 'data-pipeline/cleaning/clean_records.py')],
                                cwd=cls.root, text=True, capture_output=True, timeout=30)
        if result.returncode:
            raise AssertionError(result.stdout + '\n' + result.stderr)
        created = set(processed.iterdir()) - previous
        if len(created) != 1:
            raise AssertionError('Expected exactly one new synthetic run')
        return created.pop()

    def test_report_counts_and_all_23_saved_columns(self):
        self.assertEqual(self.report['status'], 'complete')
        self.assertEqual(self.report['totals'], EXPECTED['totals'])
        self.assertEqual(self.report['output_columns'], EXPECTED['output_columns'])
        actual = []
        for path in sorted(self.first_run.glob('*_clean.csv.gz')):
            columns, rows = read_gzip_csv(path)
            self.assertEqual(columns, EXPECTED['output_columns'])
            actual.extend(rows)
        self.assertEqual(actual, [csv_expected(record) for record in EXPECTED['records']])
        self.assertEqual(len({row['record_id'] for row in actual}), 9)

    def test_consumer_reader_matches_nine_canonical_records_and_types(self):
        spec = importlib.util.spec_from_file_location(
            'sayem_consumer_reader', ROOT / 'examples/read_clean_hotspots.py')
        reader = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(reader)
        actual = []
        for path in sorted(self.first_run.glob('*_clean.csv.gz')):
            actual.extend(reader.iter_hotspots(path))
        self.assertEqual(len(actual), 9)
        self.assertEqual(actual, EXPECTED['records'])
        for record, expected in zip(actual, EXPECTED['records']):
            for key in expected:
                with self.subTest(record=record['record_id'], field=key):
                    self.assertIs(type(record[key]), type(expected[key]))

    def test_rejection_audit_identifies_each_invalid_source_row(self):
        _, rows = read_gzip_csv(self.first_run / 'rejected_rows.csv.gz')
        actual = [[Path(row['source_file']).parent.name, int(row['source_row']), row['reason']]
                  for row in rows]
        self.assertEqual(actual, EXPECTED['rejections'])
        for row in rows:
            source = self.root / row['source_file']
            with source.open(newline='', encoding='utf-8') as f:
                original = list(csv.reader(f))[int(row['source_row']) - 1]
            self.assertEqual(json.loads(row['raw_values_json']), original)

    def test_duplicate_audit_within_and_across_files_retains_first_record(self):
        _, rows = read_gzip_csv(self.first_run / 'duplicate_rows.csv.gz')
        self.assertEqual(len(rows), 2)
        self.assertEqual([(Path(row['source_file']).parent.name, row['source_row']) for row in rows],
                         [('DL_FIRE_M-C61_990001', '3'), ('DL_FIRE_M-C61_990002', '2')])
        original = next(record for record in EXPECTED['records']
                        if record['source_file'].endswith('DL_FIRE_M-C61_990001/input.csv')
                        and record['source_row'] == 2)
        for row in rows:
            self.assertEqual(row['kept_source_file'], original['source_file'])
            self.assertEqual(row['kept_source_row'], '2')
            self.assertEqual(row['record_id'], original['record_id'])
            self.assertEqual(json.loads(row['raw_values_json']),
                             list(fixture_row('DL_FIRE_M-C61_990001').values()))

    def test_raw_inputs_unchanged_and_report_hashes_match(self):
        for path, original_bytes in self.raw_bytes_before.items():
            self.assertEqual(path.read_bytes(), original_bytes)
        for dataset in self.report['datasets']:
            for path, field in [(self.root / dataset['source_file'], 'source_sha256'),
                                (self.first_run / dataset['output_file'], 'output_sha256')]:
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), dataset[field])

    def test_rerun_preserves_decompressed_records_and_ids(self):
        second = self.run_cleaner()
        second_report = json.loads((second / 'processing_report.json').read_text())
        self.assertEqual(second_report['totals'], EXPECTED['totals'])
        for path in sorted(self.first_run.glob('*.csv.gz')):
            with gzip.open(path, 'rb') as first, gzip.open(second / path.name, 'rb') as again:
                self.assertEqual(first.read(), again.read())
        for path, original_bytes in self.raw_bytes_before.items():
            self.assertEqual(path.read_bytes(), original_bytes)


if __name__ == '__main__':
    unittest.main(verbosity=2)
