from pathlib import Path
import csv

PROJECT_ROOT = Path(__file__).resolve().parent.parent

ZIP_DIR = PROJECT_ROOT / "data" / "raw" / "zips"
EXTRACTED_DIR = PROJECT_ROOT / "data" / "raw" / "extracted"

zip_files = sorted(ZIP_DIR.glob("*.zip"))

if not zip_files:
    raise FileNotFoundError(f"No ZIP files found in {ZIP_DIR}")

total_rows = 0
inspected_files = 0

for zip_path in zip_files:
    # Example: DL_FIRE_M-C61_42739.zip → DL_FIRE_M-C61_42739
    dataset_folder = EXTRACTED_DIR / zip_path.stem

    csv_files = sorted(dataset_folder.rglob("*.csv"))

    if len(csv_files) != 1:
        print(
            f"\nCHECK: {zip_path.name} — "
            f"expected 1 CSV, found {len(csv_files)}"
        )
        continue

    csv_path = csv_files[0]

    with csv_path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)

        columns = reader.fieldnames
        row_count = sum(1 for _ in reader)

    print("\nDataset:", zip_path.stem)
    print("CSV:", csv_path.name)
    print("Columns:", columns)
    print(f"Data rows: {row_count:,}")

    total_rows += row_count
    inspected_files += 1

print(f"\nZIP files found: {len(zip_files)}")
print(f"CSV files inspected: {inspected_files}")
print(f"Total counted data rows: {total_rows:,}")