# Connects to an external PostgreSQL or MySQL database and inspects its schema.
# Returns table names and column metadata. Does not read row data at this stage.
# SSL is enabled by default for all connections to support cloud-hosted databases.

import ssl
import logging
from typing import List, Dict, Any
from sqlalchemy import create_engine, inspect, text

logger = logging.getLogger(__name__)


def _get_connect_args(db_type: str) -> dict:
    # Build driver-specific connect_args with SSL enabled.
    # Supabase, Neon, RDS, PlanetScale all require SSL.
    # Longer timeout (30s) for cloud-hosted DBs in distant regions.
    if db_type == "postgresql":
        # For psycopg2: sslmode goes into connect_args
        return {"sslmode": "require", "connect_timeout": 30}
    elif db_type == "mysql":
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return {"ssl": ctx, "connect_timeout": 30}
    return {"connect_timeout": 30}


def build_connection_url(db_type: str, host: str, port: int, database: str,
                          username: str, password: str) -> str:
    # Build a SQLAlchemy connection URL for the given db type.
    # Special characters in password are URL-encoded by SQLAlchemy when using
    # create_engine with URL, but for f-string we need to handle them.
    from urllib.parse import quote_plus
    safe_password = quote_plus(password)

    if db_type == "postgresql":
        return f"postgresql+psycopg2://{username}:{safe_password}@{host}:{port}/{database}"
    elif db_type == "mysql":
        return f"mysql+pymysql://{username}:{safe_password}@{host}:{port}/{database}"
    else:
        raise ValueError(f"Unsupported db_type: {db_type}")


def _create_engine(db_type: str, host: str, port: int, database: str,
                    username: str, password: str):
    # Centralized engine factory with SSL enabled.
    url = build_connection_url(db_type, host, port, database, username, password)
    return create_engine(url, connect_args=_get_connect_args(db_type))


def test_connection(db_type: str, host: str, port: int, database: str,
                    username: str, password: str) -> tuple[bool, str]:
    # Attempts a lightweight connection test.
    # Returns (True, "ok") on success, (False, "error message") on failure.
    try:
        engine = _create_engine(db_type, host, port, database, username, password)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        return True, "ok"
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Connection test failed: {error_msg}")
        return False, error_msg


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
