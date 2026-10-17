# GeoFlare synthetic cleaning fixture

These 18 source rows are invented test inputs. They are not NASA observations,
are not drawn from the production archive and must not be used for fire analysis.
The 990001-990004 suffixes are synthetic test identifiers, not FIRMS request IDs.
The fixture covers MODIS/Terra, MODIS/Aqua, VIIRS/NOAA-20 and VIIRS/NOAA-21.

## Install and run

Copy the ZIP's `tests` contents into the repository's `tests` folder without
replacing unrelated files. The package only adds the uniquely named
`test_sayem_cleaning_contract.py` and `fixtures/sayem_cleaning_v1/` paths.
Inspect any existing files at these exact paths before replacing them.

From the GeoFlare repository root, run:

```powershell
python -m unittest discover -s tests -p "test_sayem_cleaning_contract.py" -v
```

Use Python 3.9 or newer; there are no extra dependencies. The tests copy the
current cleaning script and schema into a temporary directory, build tiny valid
ZIP containers and extracted CSVs there, and run cleaning twice on the 18-row
sample. They do not read or modify production datasets or reports. Temporary
outputs are removed automatically. This does not run the coverage validator.

## Fixed expectations

| Dataset suffix | Input | Accepted | Rejected | Duplicates |
| --- | ---: | ---: | ---: | ---: |
| MODIS 990001 | 9 | 3 | 5 | 1 |
| MODIS 990002 | 2 | 1 | 0 | 1 |
| J1 990003 | 5 | 3 | 2 | 0 |
| J2 990004 | 2 | 2 | 0 | 0 |
| Total | 18 | 9 | 7 | 2 |

`expected.json` contains the exact 23-column values for the nine accepted
records, including fixed IDs, types, nulls, source rows and quality flags.
These values were specified independently of the production normalizer;
tests load them as fixed expectations and do not regenerate them from the
implementation. Review intentional schema changes before updating this file.

The nine clean records can also serve as a tiny JSON development fixture via
the `records` list. Retain this synthetic label when passing them downstream.

## Behavior covered

- Numeric MODIS confidence and categorical VIIRS confidence remain distinct.
- Blank/missing optional values remain null; measured zero FRP remains zero.
- Leap-day timestamps and short HHMM values produce UTC timestamps.
- Invalid coordinates, times, dates, field counts and sensor/product pairs
  are rejected with traceable source values.
- The MODIS `6.03` version and collection-verification flag are preserved;
  an unknown version is retained and flagged. These tests do not resolve provenance.
- Exact duplicates within/across source files retain the first record and an audit.
- Different observations with identical coordinates/time but different FRP
  remain distinct, consistent with the current full-record identity contract.
- Raw inputs remain unchanged; report counts and hashes reconcile.
- Repeated runs retain the same decompressed output and IDs. Gzip byte hashes
  and run timestamps need not match between runs.

## Integration boundary

This package changes no production Python, metadata, coverage logic or handoff
documentation. It targets `pipeline-v1` and the 23-column cleaning contract
checked against `feature/sayem-data-pipeline` on 17 October 2026.
Coverage tests and request metadata are a separate concurrent task.
