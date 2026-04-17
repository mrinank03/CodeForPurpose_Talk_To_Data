# Connects to an external PostgreSQL or MySQL database and inspects its schema.
# Returns table names and column metadata. Does not read row data at this stage.

from typing import List, Dict, Any
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import OperationalError


def build_connection_url(db_type: str, host: str, port: int, database: str,
                          username: str, password: str) -> str:
    # Build a SQLAlchemy connection URL for the given db type.
    if db_type == "postgresql":
        return f"postgresql+psycopg2://{username}:{password}@{host}:{port}/{database}"
    elif db_type == "mysql":
        return f"mysql+pymysql://{username}:{password}@{host}:{port}/{database}"
    else:
        raise ValueError(f"Unsupported db_type: {db_type}")


def test_connection(db_type: str, host: str, port: int, database: str,
                    username: str, password: str) -> bool:
    # Attempts a lightweight connection test. Returns True if successful.
    url = build_connection_url(db_type, host, port, database, username, password)
    try:
        engine = create_engine(url, connect_args={"connect_timeout": 10})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        return True
    except OperationalError:
        return False


def list_tables(db_type: str, host: str, port: int, database: str,
                username: str, password: str) -> List[str]:
    # Returns a list of all user-accessible table names in the target database.
    url = build_connection_url(db_type, host, port, database, username, password)
    engine = create_engine(url)
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        return tables
    finally:
        engine.dispose()


def get_table_schema(db_type: str, host: str, port: int, database: str,
                     username: str, password: str, table_name: str) -> List[Dict[str, Any]]:
    # Returns column-level metadata for a single table.
    url = build_connection_url(db_type, host, port, database, username, password)
    engine = create_engine(url)
    try:
        inspector = inspect(engine)
        columns = inspector.get_columns(table_name)
        return [{"name": col["name"], "type": str(col["type"])} for col in columns]
    finally:
        engine.dispose()
