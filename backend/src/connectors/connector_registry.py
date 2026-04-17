# In-memory registry that maps session_id -> ConnectorSession.
# Credentials are never persisted to disk.
# When the server restarts, users must reconnect. This is intentional for security.

from dataclasses import dataclass, field
from typing import Dict, List, Optional
import threading


@dataclass
class ConnectorSession:
    connection_name: str
    db_type: str              # "postgresql" or "mysql"
    host: str
    port: int
    database: str
    username: str
    password: str             # Held in memory only, never written to disk
    mirrored_tables: List[str] = field(default_factory=list)
    sync_job_id: Optional[str] = None
    last_synced_at: Optional[str] = None


# Thread-safe in-memory store: session_id -> ConnectorSession
_registry: Dict[str, ConnectorSession] = {}
_lock = threading.Lock()


def register(session_id: str, connector: ConnectorSession) -> None:
    with _lock:
        _registry[session_id] = connector


def get(session_id: str) -> Optional[ConnectorSession]:
    with _lock:
        return _registry.get(session_id)


def remove(session_id: str) -> None:
    with _lock:
        _registry.pop(session_id, None)


def list_all() -> Dict[str, ConnectorSession]:
    with _lock:
        return dict(_registry)
