import os
import csv
import pandas as pd
import sqlite3
import re
import io
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
DATA_DB_DIR = os.getenv("DATA_DB_DIR", "./data_dbs/")

class DatasetMeta(BaseModel):
    row_count: int
    col_count: int
    columns: list[str]
    column_types: dict[str, str]
    head: list[dict]
    original_names_map: dict[str, str]

def clean_column_name(name: str) -> str:
    s = str(name).strip()
    s = re.sub(r'[^a-zA-Z0-9_\s]', '', s)
    s = re.sub(r'\s+', '_', s)
    return s.lower()

def detect_separator(file_bytes: bytes) -> str:
    """Auto-detect CSV delimiter by sniffing the first 8KB."""
    sample = file_bytes[:8192].decode('utf-8', errors='ignore')
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=',;\t|')
        return dialect.delimiter
    except csv.Error:
        return ','

def read_csv_auto(file_bytes: bytes) -> pd.DataFrame:
    """Read a CSV with auto-detected delimiter."""
    sep = detect_separator(file_bytes)
    print(f"[Ingestor] Detected CSV separator: '{sep}'")
    return pd.read_csv(io.BytesIO(file_bytes), sep=sep)

def ingest_file(file_bytes: bytes, filename: str, session_id: str) -> DatasetMeta:
    # Check extension
    ext = os.path.splitext(filename)[1].lower()
    if ext == '.csv':
        df = read_csv_auto(file_bytes)
    elif ext in ['.xlsx', '.xls']:
        df = pd.read_excel(io.BytesIO(file_bytes))
    elif ext == '.pdf':
        from src.data.document_parser import parse_pdf_to_df
        df = parse_pdf_to_df(file_bytes)
    elif ext in ['.png', '.jpg', '.jpeg']:
        from src.data.document_parser import parse_image_to_df
        df = parse_image_to_df(file_bytes)
    else:
        raise ValueError(f"Unsupported file extension: {ext}")
    
    if df.empty:
        raise ValueError("Could not extract tabular data from the document.")
    
    # Extra cleaning for PDF/image-extracted data
    if ext in ['.pdf', '.png', '.jpg', '.jpeg']:
        from src.data.document_parser import _clean_dataframe
        df = _clean_dataframe(df)
        if df.empty:
            raise ValueError("Extracted data contained no meaningful columns after cleaning.")
    # Safety: if only 1 column was parsed, likely wrong delimiter — retry with ;
    if len(df.columns) == 1 and ext == '.csv':
        print("[Ingestor] Only 1 column detected, retrying with ';' separator")
        df = pd.read_csv(io.BytesIO(file_bytes), sep=';')
    
    print(f"[Ingestor] Parsed {len(df)} rows x {len(df.columns)} cols")
    
    # Mapping original to cleaned names
    original_names = list(df.columns)
    cleaned_names = [clean_column_name(c) for c in original_names]
    
    # Handle duplicates in cleaned names
    seen = {}
    final_names = []
    for c in cleaned_names:
        if c in seen:
            seen[c] += 1
            final_names.append(f"{c}_{seen[c]}")
        else:
            seen[c] = 0
            final_names.append(c)
            
    df.columns = final_names
    original_map = dict(zip(final_names, original_names))
    
    # Create SQLite engine and upload
    os.makedirs(DATA_DB_DIR, exist_ok=True)
    db_path = os.path.join(DATA_DB_DIR, f"{session_id}.db")
    
    conn = sqlite3.connect(db_path)
    # the prompt specifies table name: data_{session_id} or data table inside the session db
    table_name = f"data_{session_id.replace('-', '_')}"
    df.to_sql(table_name, conn, if_exists="replace", index=False)
    conn.close()
    
    # Prepare metadata
    col_types = {col: str(df[col].dtype) for col in final_names}
    
    # Fill NAs with None for JSON serialization
    import numpy as np
    head_df = df.head(5).replace([np.inf, -np.inf], np.nan)
    # Convert to records and manually replace NaN with None
    head_list = []
    for record in head_df.to_dict('records'):
        clean_record = {}
        for k, v in record.items():
            if isinstance(v, float) and (pd.isna(v) or np.isinf(v)):
                clean_record[k] = None
            else:
                clean_record[k] = v
        head_list.append(clean_record)
    
    return DatasetMeta(
        row_count=len(df),
        col_count=len(final_names),
        columns=final_names,
        column_types=col_types,
        head=head_list,
        original_names_map=original_map
    )
    
def get_table_name(session_id: str) -> str:
    return f"data_{session_id.replace('-', '_')}"
