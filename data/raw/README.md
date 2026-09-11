# Raw Data Directory

This directory contains the raw material master datasets from CPSEs.

## Structure

- `CPSE_Material_Master_cleaned.csv` - The main cleaned dataset from CPSEs

## Important Notes

- **DO NOT** modify the raw CSV files directly
- **DO NOT** delete or rename the raw files
- Raw files serve as the source of truth for data processing
- Any changes should be made through the data pipeline

## File Format

The CSV files should follow this structure:

```csv
material_code,cpse_id,description,category,material_type,unit,manufacturer,attributes
CPSE-A-001,CPSE-A,Steel Plate 10mm,Raw Materials,Steel,KG,Tata Steel,"{""thickness"":""10mm"",""grade"":""IS 2062""}"
```

## Adding New Data

To add new CPSE data:

1. Place the new CSV file in this directory
2. Run the ingestion pipeline: `python scripts/import_dataset.py <file_path>`
3. The pipeline will validate and process the data

## Data Privacy

- Ensure all uploaded data complies with data privacy regulations
- Remove any sensitive information before uploading
- Follow organizational data governance policies
