# Connects to an external PostgreSQL or MySQL database and inspects its schema.
# Returns table names and column metadata. Does not read row data at this stage.
# SSL is enabled by default for all connections to support cloud-hosted databases.

import ssl
from typing import List, Dict, Any
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import OperationalError


def _get_ssl_args(db_type: str) -> dict:
    # Build driver-specific SSL connect_args.
    # Most cloud databases (RDS, Supabase, PlanetScale, Neon) require SSL.
    if db_type == "postgresql":
        return {"sslmode": "require", "connect_timeout": 10}
    elif db_type == "mysql":
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return {"ssl": ctx, "connect_timeout": 10}
    return {"connect_timeout": 10}


def build_connection_url(db_type: str, host: str, port: int, database: str,
                          username: str, password: str) -> str:
    # Build a SQLAlchemy connection URL for the given db type.
    if db_type == "postgresql":
        return f"postgresql+psycopg2://{username}:{password}@{host}:{port}/{database}"
    elif db_type == "mysql":
        return f"mysql+pymysql://{username}:{password}@{host}:{port}/{database}"
    else:
        raise ValueError(f"Unsupported db_type: {db_type}")


def _create_engine(db_type: str, host: str, port: int, database: str,
                    username: str, password: str):
    # Centralized engine factory with SSL enabled.
    url = build_connection_url(db_type, host, port, database, username, password)
    return create_engine(url, connect_args=_get_ssl_args(db_type))


def test_connection(db_type: str, host: str, port: int, database: str,
                    username: str, password: str) -> bool:
    # Attempts a lightweight connection test. Returns True if successful.
    try:
        engine = _create_engine(db_type, host, port, database, username, password)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        return True
    except OperationalError:
        return False


def list_tables(db_type: str, host: str, port: int, database: str,
                username: str, password: str) -> List[str]:
    # Returns a list of all user-accessible table names in the target database.
    engine = _create_engine(db_type, host, port, database, username, password)
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        return tables
    finally:
        engine.dispose()


def get_table_schema(db_type: str, host: str, port: int, database: str,
                     username: str, password: str, table_name: str) -> List[Dict[str, Any]]:
    # Returns column-level metadata for a single table.
    engine = _create_engine(db_type, host, port, database, username, password)
    try:
        inspector = inspect(engine)
        columns = inspector.get_columns(table_name)
        return [{"name": col["name"], "type": str(col["type"])} for col in columns]
    finally:
        engine.dispose()
