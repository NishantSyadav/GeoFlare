"""Stream typed records from a previously validated GeoFlare gzip CSV.

This reader does not establish source provenance or replace run validation.
"""
import argparse
import csv
import gzip
from itertools import islice
import json
import math
from pathlib import Path


COLUMNS = (
    'record_id latitude longitude acq_datetime_utc sensor satellite satellite_raw '
    'confidence confidence_raw confidence_scale frp_mw brightness bright_t31 scan '
    'track daynight hotspot_type source_product source_version processing_version '
    'quality_flags source_file source_row'
).split()
OPTIONAL_FLOATS = ('frp_mw', 'brightness', 'bright_t31', 'scan', 'track')
OPTIONAL_TEXT = ('confidence_raw', 'daynight', 'source_version')


def finite_float(value):
    number = float(value)
    if not math.isfinite(number):
        raise ValueError('Expected a finite number')
    return number


def parse_row(raw):
    """Parse saved CSV types; preserve versions, flags and UTC time text."""
    if set(raw) != set(COLUMNS) or any(value is None for value in raw.values()):
        raise ValueError('Unexpected number of CSV fields')
    record = dict(raw)
    for field in ('latitude', 'longitude'):
        record[field] = finite_float(raw[field])
    for field in OPTIONAL_FLOATS:
        record[field] = None if raw[field] == '' else finite_float(raw[field])
    for field in OPTIONAL_TEXT:
        record[field] = None if raw[field] == '' else raw[field]
    record['hotspot_type'] = None if raw['hotspot_type'] == '' else int(raw['hotspot_type'])
    record['source_row'] = int(raw['source_row'])
    if raw['sensor'] == 'MODIS' and raw['confidence_scale'] == 'modis_0_100':
        confidence = None if raw['confidence'] == '' else finite_float(raw['confidence'])
        record['confidence'] = (int(confidence) if confidence is not None
                                and confidence.is_integer() else confidence)
    elif raw['sensor'] == 'VIIRS' and raw['confidence_scale'] == 'viirs_category':
        confidence = None if raw['confidence'] == '' else raw['confidence']
        if confidence not in (None, 'low', 'nominal', 'high'):
            raise ValueError('Unknown VIIRS confidence category')
        record['confidence'] = confidence
    else:
        raise ValueError('Unsupported sensor/confidence-scale pair')
    flags = json.loads(raw['quality_flags'])
    if not isinstance(flags, list) or any(not isinstance(flag, str) for flag in flags):
        raise ValueError('quality_flags must be a JSON array of strings')
    record['quality_flags'] = flags
    return record


def iter_hotspots(path):
    """Yield one typed record at a time; do not load the whole file."""
    with gzip.open(path, 'rt', encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != COLUMNS:
            raise ValueError('Expected the documented 23-column pipeline-v1 header')
        for raw in reader:
            try:
                yield parse_row(raw)
            except (TypeError, ValueError) as error:
                raise ValueError(f'{Path(path).name}: CSV line {reader.line_num}: {error}') from error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file', required=True, type=Path, help='A validated *_clean.csv.gz')
    parser.add_argument('--limit', type=int, default=5, help='Maximum records to print (default: 5)')
    args = parser.parse_args()
    if args.limit < 0:
        parser.error('--limit must be nonnegative')
    records = iter_hotspots(args.file)
    try:
        for record in islice(records, args.limit):
            print(json.dumps(record, ensure_ascii=False, allow_nan=False))
    finally:
        records.close()


if __name__ == '__main__':
    main()
