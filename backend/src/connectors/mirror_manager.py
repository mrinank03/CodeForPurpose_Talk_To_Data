# Handles copying tables from an external DB into a session-local SQLite mirror.
# Mirrors are stored in DATA_DB_DIR (same as uploaded CSVs) so the existing
# query pipeline works without modification.

import os
import logging
from typing import List
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from src.connectors.db_inspector import build_connection_url

load_dotenv()
logger = logging.getLogger(__name__)

DATA_DB_DIR = os.getenv("DATA_DB_DIR", "./data_dbs/")
os.makedirs(DATA_DB_DIR, exist_ok=True)


def get_mirror_path(session_id: str) -> str:
    return os.path.join(DATA_DB_DIR, f"{session_id}.db")


def mirror_table(session_id: str, db_type: str, host: str, port: int,
                  database: str, username: str, password: str, table_name: str) -> int:
    # Copies a single table from the source DB into the session mirror.
    # Uses pandas read_sql for simplicity and broad compatibility.
    # Returns the number of rows mirrored.

    source_url = build_connection_url(db_type, host, port, database, username, password)
    mirror_path = get_mirror_path(session_id)
    mirror_url = f"sqlite:///{mirror_path}"

    source_engine = create_engine(source_url)
    mirror_engine = create_engine(mirror_url)

    try:
        # Read from source — limit to 50k rows to keep demo snappy
        query = f"SELECT * FROM {table_name} LIMIT 50000"
        df = pd.read_sql(query, source_engine)

        # Write to mirror using the standard table naming convention
        mirror_table_name = f"data_{session_id.replace('-', '_')}"
        df.to_sql(mirror_table_name, mirror_engine, if_exists="replace", index=False)

        logger.info(f"Mirrored {len(df)} rows from {table_name} into session {session_id}")
        return len(df)
    finally:
        source_engine.dispose()
        mirror_engine.dispose()


def sync_table_if_changed(session_id: str, db_type: str, host: str, port: int,
                           database: str, username: str, password: str, table_name: str) -> bool:
    # Checks if the source table row count differs from the mirror.
    # If different, re-mirrors the table. Returns True if a sync happened.

    source_url = build_connection_url(db_type, host, port, database, username, password)
    mirror_path = get_mirror_path(session_id)
    mirror_url = f"sqlite:///{mirror_path}"
    mirror_table_name = f"data_{session_id.replace('-', '_')}"

    source_engine = create_engine(source_url)
    mirror_engine = create_engine(mirror_url)

    try:
        with source_engine.connect() as conn:
            source_count = conn.execute(
                text(f"SELECT COUNT(*) FROM {table_name}")
            ).scalar()

        with mirror_engine.connect() as conn:
            try:
                mirror_count = conn.execute(
                    text(f"SELECT COUNT(*) FROM {mirror_table_name}")
                ).scalar()
            except Exception:
                # Table doesn't exist in mirror yet
                mirror_count = -1

        if source_count != mirror_count:
            logger.info(f"Sync needed for {table_name}: source={source_count}, mirror={mirror_count}")
            mirror_table(session_id, db_type, host, port, database, username, password, table_name)
            return True

        return False
    except Exception as e:
        logger.error(f"Sync check failed for {table_name}: {e}")
        return False
    finally:
        source_engine.dispose()
        mirror_engine.dispose()


def delete_mirror(session_id: str) -> None:
    path = get_mirror_path(session_id)
    if os.path.exists(path):
        os.remove(path)
        logger.info(f"Deleted mirror for session {session_id}")
