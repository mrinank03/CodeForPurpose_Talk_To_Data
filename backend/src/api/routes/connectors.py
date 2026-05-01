# REST endpoints for the database connector feature.
# In production this service must run behind HTTPS since credentials travel in the request body.

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List

from src.connectors.db_inspector import test_connection, list_tables
from src.connectors.mirror_manager import mirror_table, delete_mirror
from src.connectors.connector_registry import (
    register, get, remove, ConnectorSession
)
from src.connectors.sync_scheduler import register_sync_job, cancel_sync_job
import json
from src.scheduler.crypto import encrypt_value
from src.scheduler.metadata_db import SessionLocal, EncryptedCredentials

logger = logging.getLogger(__name__)
router = APIRouter()


# --- Pydantic models for request/response validation ---

class ConnectionCredentials(BaseModel):
    session_id: str
    connection_name: str
    db_type: str = Field(..., pattern="^(postgresql|mysql)$")
    host: str
    port: int
    database: str
    username: str
    password: str


class MirrorRequest(BaseModel):
    session_id: str
    tables: List[str]


class ConnectionTestRequest(BaseModel):
    db_type: str = Field(..., pattern="^(postgresql|mysql)$")
    host: str
    port: int
    database: str
    username: str
    password: str


# --- Endpoints ---

@router.post("/connectors/test")
async def test_db_connection(req: ConnectionTestRequest):
    # Quick connectivity check — does not store credentials.
    success, error_msg = test_connection(req.db_type, req.host, req.port,
                                          req.database, req.username, req.password)
    if not success:
        raise HTTPException(status_code=400, detail=f"Connection failed: {error_msg}")
    return {"status": "ok", "message": "Connection successful."}


@router.post("/connectors/connect")
async def connect_database(req: ConnectionCredentials):
    # Validates connection, stores credentials in memory, and returns the table list.
    success, error_msg = test_connection(req.db_type, req.host, req.port,
                                          req.database, req.username, req.password)
    if not success:
        raise HTTPException(status_code=400, detail=f"Connection failed: {error_msg}")

    tables = list_tables(req.db_type, req.host, req.port,
                          req.database, req.username, req.password)

    # Store in memory — credentials never hit disk
    connector = ConnectorSession(
        connection_name=req.connection_name,
        db_type=req.db_type,
        host=req.host,
        port=req.port,
        database=req.database,
        username=req.username,
        password=req.password,
    )
    register(req.session_id, connector)
    
    # Store encrypted credentials for scheduled tasks
    try:
        db = SessionLocal()
        # Remove any existing credentials for this session
        db.query(EncryptedCredentials).filter(EncryptedCredentials.session_id == req.session_id).delete()
        
        c_dict = {
            "db_type": req.db_type,
            "host": req.host,
            "port": req.port,
            "database": req.database,
            "username": req.username,
            "password": req.password
        }
        enc_blob = encrypt_value(json.dumps(c_dict))
        
        new_cred = EncryptedCredentials(
            connection_id=req.session_id,
            session_id=req.session_id,
            db_type=req.db_type,
            encrypted_blob=enc_blob
        )
        db.add(new_cred)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to store encrypted credentials for {req.session_id}: {e}")
    finally:
        db.close()

    return {
        "status": "connected",
        "connection_name": req.connection_name,
        "db_type": req.db_type,
        "tables": tables,
        "table_count": len(tables),
    }


@router.post("/connectors/mirror")
async def mirror_tables(req: MirrorRequest):
    # Mirrors the user-selected tables into the session SQLite and starts sync job.
    connector = get(req.session_id)
    if connector is None:
        raise HTTPException(status_code=404, detail="No active connection for this session. Please connect first.")

    results = []
    for table in req.tables:
        try:
            row_count = mirror_table(
                req.session_id,
                connector.db_type,
                connector.host,
                connector.port,
                connector.database,
                connector.username,
                connector.password,
                table,
            )
            results.append({"table": table, "rows_mirrored": row_count, "status": "ok"})
        except Exception as e:
            logger.error(f"Failed to mirror table {table}: {e}")
            results.append({"table": table, "rows_mirrored": 0, "status": "error", "error": str(e)})

    # Update registry with mirrored table list and start the background sync
    connector.mirrored_tables = [r["table"] for r in results if r["status"] == "ok"]
    job_id = register_sync_job(req.session_id)
    connector.sync_job_id = job_id

    return {"session_id": req.session_id, "tables": results}


@router.get("/connectors/status")
async def get_connection_status(session_id: str):
    connector = get(session_id)
    if connector is None:
        return {"connected": False}
    return {
        "connected": True,
        "connection_name": connector.connection_name,
        "db_type": connector.db_type,
        "database": connector.database,
        "mirrored_tables": connector.mirrored_tables,
        "last_synced_at": connector.last_synced_at,
    }


@router.delete("/connectors/disconnect")
async def disconnect(session_id: str):
    cancel_sync_job(session_id)
    delete_mirror(session_id)
    remove(session_id)
    return {"status": "disconnected"}
