# Data-engineering setup and commands

Use Python 3.9 or later. Ingestion, cleaning, validation and the streaming reader
use only the standard library; no extra packages are required for this scope.
Run these commands from the GeoFlare project root. Other components may have
their own dependencies and setup owned by their maintainers.

## Offline regression checks

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
python -m unittest discover -s data-pipeline/tests -p "test_*.py" -v
git diff --check
```

All observation fixtures are synthetic. Tests create isolated temporary roots;
the production cleaning/validation run is not executed by these commands.

## Existing archive workflow

Place original ZIPs under `data/raw/zips/` and the corresponding extracted CSVs
under `data/raw/extracted/<archive stem>/`. Preserve original bytes and request
evidence. Existing ingestion/extraction tools and archive filenames remain valid.

```powershell
python data-pipeline/cleaning/clean_records.py
```

This creates a NEW `data/processed/run_<UTC timestamp>/` with cleaned CSVs,
rejection and duplicate audits, hashes, counts and processing report. Use only
completed runs. Do not rerun the existing production cleaning as a setup test.

```powershell
python data-pipeline/cleaning/validate_records.py --run data/processed/NEW_RUN --report validation_review_NEW_TIMESTAMP.json
```

Choose a fresh report filename. Explicit `--report` paths refuse overwrite;
relative paths are inside the run. Omitting the option retains the legacy
replacement of `validation_report.json`. See [data-quality-and-handoff.md](data-quality-and-handoff.md)
for the already successful production report; it does not need to be rerun.

## API workflows and downstream reading

Follow [api-ingestion.md](api-ingestion.md) for saved-response manifests and
bounded network fetching. The CLI reads `FIRMS_MAP_KEY` from the process
environment; `.env` is ignored by Git and is not auto-loaded. The committed
`.env.example` contains no credentials. Configure the environment through your
local secret-management mechanism, not a literal key in shell history or source.

Follow [downstream-data-usage.md](downstream-data-usage.md) for typed streaming,
coverage states, flags and owner boundaries. Production raw/processed outputs
are Git-ignored and must be shared separately through an agreed data location.
