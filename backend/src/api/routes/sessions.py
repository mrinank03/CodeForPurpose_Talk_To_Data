from fastapi import APIRouter, Depends
from pydantic import BaseModel
from src.data.session_store import list_sessions, get_session, get_messages, delete_session, update_session_flags
from src.api.dependencies import get_current_user

router = APIRouter()

@router.get("/sessions")
def get_all_sessions(current_user: dict = Depends(get_current_user)):
    return list_sessions(user_id=current_user["id"])

@router.get("/sessions/{session_id}")
def get_session_detail(session_id: str, current_user: dict = Depends(get_current_user)):
    sess = get_session(session_id)
    if not sess or sess.get("user_id") != current_user["id"]:
        return {"error": "Not found or unauthorized"}
    msgs = get_messages(session_id)
    
    # Build dataset_meta from the session info
    dataset_meta = {
        "row_count": sess.get("row_count", 0),
        "col_count": sess.get("col_count", 0),
        "columns": [],
        "column_types": {},
        "head": [],
        "original_names_map": {},
    }
    
    # Try to read actual column info from the data DB
    import os
    from sqlalchemy import create_engine, inspect as sa_inspect
    DATA_DB_DIR = os.getenv("DATA_DB_DIR", "./data_dbs/")
    db_path = os.path.join(DATA_DB_DIR, f"{session_id}.db")
    if os.path.exists(db_path) and os.path.getsize(db_path) > 0:
        try:
            engine = create_engine(f"sqlite:///{db_path}")
            insp = sa_inspect(engine)
            all_tables = insp.get_table_names()
            all_columns = []
            all_types = {}
            for tbl in all_tables:
                cols = insp.get_columns(tbl)
                for c in cols:
                    col_name = c["name"]
                    if col_name not in all_types:
                        all_columns.append(col_name)
                        all_types[col_name] = str(c["type"])
            dataset_meta["columns"] = all_columns
            dataset_meta["column_types"] = all_types
        except Exception:
            pass
    
    return {
        "metadata": sess,
        "messages": msgs,
        "dataset_meta": dataset_meta,
    }

@router.delete("/sessions/{session_id}")
def remove_session(session_id: str, current_user: dict = Depends(get_current_user)):
    sess = get_session(session_id)
    if sess and sess.get("user_id") == current_user["id"]:
        delete_session(session_id)
        return {"status": "deleted"}
    return {"error": "Unauthorized"}

class SessionUpdate(BaseModel):
    is_starred: bool = None
    is_archived: bool = None

@router.patch("/sessions/{session_id}")
def update_session(session_id: str, update: SessionUpdate, current_user: dict = Depends(get_current_user)):
    sess = get_session(session_id)
    if sess and sess.get("user_id") == current_user["id"]:
        update_session_flags(session_id, is_starred=update.is_starred, is_archived=update.is_archived)
        return {"status": "updated"}
    return {"error": "Unauthorized"}
