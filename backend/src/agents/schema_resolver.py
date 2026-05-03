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
    schema_score: float

def resolve_schema(question: str, session_id: str) -> ResolvedSchema:
    db_path = os.path.join(DATA_DB_DIR, f"{session_id}.db")
    
    # 1. Semantic search for columns
    relevant_cols, max_score = search_relevant_columns(question, session_id, top_k=10)
    
    # 2. Discover ALL tables in the session SQLite DB and build full schema
    schema_str = ""
    table_name = f"data_{session_id.replace('-', '_')}"  # default fallback
    try:
        engine = create_engine(f"sqlite:///{db_path}")
        inspector = inspect(engine)
        all_tables = inspector.get_table_names()
        
        schema_parts_all = []
        for tbl in all_tables:
            columns = inspector.get_columns(tbl)
            col_parts = [f"{col['name']} ({col['type']})" for col in columns]
            schema_parts_all.append(f"TABLE {tbl} ({', '.join(col_parts)})")
        
        schema_str = "\n".join(schema_parts_all)
        
        # Use the first table name as the primary reference for single-table sessions
        if len(all_tables) == 1:
            table_name = all_tables[0]
        elif len(all_tables) > 1:
            # For multi-table sessions, keep table_name as a marker 
            # but the schema_str has all tables for the SQL planner
            table_name = all_tables[0]
    except Exception as e:
        schema_str = f"TABLE {table_name} (Error loading schema: {e})"

    return ResolvedSchema(
        table_name=table_name,
        relevant_columns=relevant_cols,
        full_schema_str=schema_str,
        schema_score=max_score
    )
