"""
Story mode: generates insight cards from a session's database.
Uses the smart precompute logic — reads from SQLite into pandas, no LLM needed.
"""
import os
import pandas as pd
from sqlalchemy import create_engine
from src.data.ingestor import get_table_name
from src.story.precompute import precompute_insights

DATA_DB_DIR = os.getenv("DATA_DB_DIR", "./data_dbs/")


async def run_story_mode(session_id: str) -> list:
    table_name = get_table_name(session_id)
    db_path = os.path.join(DATA_DB_DIR, f"{session_id}.db")

    if not os.path.exists(db_path):
        print(f"[StoryMode] DB not found: {db_path}")
        return []

    if os.path.getsize(db_path) == 0:
        print(f"[StoryMode] DB is empty (0 bytes): {db_path}")
        return []

    try:
        engine = create_engine(f"sqlite:///{db_path}")
        df = pd.read_sql_table(table_name, engine)
        print(f"[StoryMode] Read {len(df)} rows from {table_name}")
    except Exception as e:
        print(f"[StoryMode] Failed to read table '{table_name}': {e}")
        return []

    if df.empty:
        print(f"[StoryMode] DataFrame is empty for {table_name}")
        return []

    cards = precompute_insights(df)
    print(f"[StoryMode] Generated {len(cards)} insight cards")
    return cards
