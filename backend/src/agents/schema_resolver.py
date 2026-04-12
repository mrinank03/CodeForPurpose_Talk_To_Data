import sqlite3
import os
from pydantic import BaseModel
from sqlalchemy import create_engine, inspect
from src.semantic.embedder import search_relevant_columns
from dotenv import load_dotenv

load_dotenv()
DATA_DB_DIR = os.getenv("DATA_DB_DIR", "./data_dbs/")

class ResolvedSchema(BaseModel):
    table_name: str
    relevant_columns: list[dict]
    full_schema_str: str

def resolve_schema(question: str, session_id: str) -> ResolvedSchema:
    table_name = f"data_{session_id.replace('-', '_')}"
    db_path = os.path.join(DATA_DB_DIR, f"{session_id}.db")
    
    # 1. Semantic search for columns
    relevant_cols = search_relevant_columns(question, session_id, top_k=5)
    
    # 2. Extract full schema from SQLite
    schema_str = ""
    try:
        engine = create_engine(f"sqlite:///{db_path}")
        inspector = inspect(engine)
        columns = inspector.get_columns(table_name)
        schema_parts = []
        for col in columns:
            schema_parts.append(f"{col['name']} ({col['type']})")
        schema_str = f"TABLE {table_name} (" + ", ".join(schema_parts) + ")"
    except Exception as e:
        schema_str = f"TABLE {table_name} (Error loading schema)"

    return ResolvedSchema(
        table_name=table_name,
        relevant_columns=relevant_cols,
        full_schema_str=schema_str
    )
