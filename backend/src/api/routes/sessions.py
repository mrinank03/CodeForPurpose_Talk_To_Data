from fastapi import APIRouter
from src.data.session_store import list_sessions, get_session, get_messages, delete_session

router = APIRouter()

@router.get("/sessions")
def get_all_sessions():
    return list_sessions()

@router.get("/sessions/{session_id}")
def get_session_detail(session_id: str):
    sess = get_session(session_id)
    if not sess:
        return {"error": "Not found"}
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
            table_name = f"data_{session_id.replace('-', '_')}"
            engine = create_engine(f"sqlite:///{db_path}")
            insp = sa_inspect(engine)
            cols = insp.get_columns(table_name)
            dataset_meta["columns"] = [c["name"] for c in cols]
            dataset_meta["column_types"] = {c["name"]: str(c["type"]) for c in cols}
        except Exception:
            pass
    
    return {
        "metadata": sess,
        "messages": msgs,
        "dataset_meta": dataset_meta,
    }

@router.delete("/sessions/{session_id}")
def remove_session(session_id: str):
    delete_session(session_id)
    return {"status": "deleted"}
