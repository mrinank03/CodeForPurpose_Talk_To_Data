import os
import json
from fastapi import APIRouter, UploadFile, File, Request, HTTPException, Depends
from langchain_core.prompts import PromptTemplate
from src.api.dependencies import get_current_user
from src.data.session_store import create_session
from src.data.ingestor import ingest_file
from src.semantic.profiler import profile_dataset
from src.story.precompute import precompute_insights
from src.utils.llm_factory import get_narrator_llm
import pandas as pd
from io import BytesIO

router = APIRouter()
MAX_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "20")) * 1024 * 1024

def generate_suggested_questions(profile: dict, metric_dict: dict) -> list[str]:
    # Build a clean column summary instead of raw-truncating JSON
    col_summary = "\n".join([f"- {col} ({info.get('type', 'unknown')}): {metric_dict.get(col, 'N/A')}" for col, info in profile.items()])
    
    prompt = PromptTemplate.from_template(
        "You are an expert data analyst. Based on the following dataset columns and their descriptions, "
        "suggest 5 SHORT business questions a user could ask about this data. "
        "Each question should be under 12 words.\n\n"
        "Dataset Columns:\n{col_summary}\n\n"
        "Output ONLY a JSON array of 5 strings. No markdown. No explanation."
    )
    llm = get_narrator_llm()
    res = (prompt | llm).invoke({
        "col_summary": col_summary
    })
    
    content = res.content.strip()
    if content.startswith("```json"):
        content = content[7:-3].strip()
    elif content.startswith("```"):
        content = content[3:-3].strip()
    
    try:
        q_list = json.loads(content)
        if isinstance(q_list, list) and len(q_list) > 0:
            return q_list[:5]
    except Exception:
        pass
    
    return [
        "What is the total overall number?",
        "Break down the main measure by category?",
        "What is the trend over time?",
        "Are there any outliers?",
        "Show me a summary of the data."
    ]

@router.post("/upload")
async def upload_file(request: Request, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".csv", ".xlsx", ".xls", ".pdf", ".png", ".jpg", ".jpeg"]:
        raise HTTPException(status_code=400, detail="Only CSV, Excel, PDF, and Image files are allowed.")
        
    file_bytes = await file.read()
    if len(file_bytes) > MAX_MB:
        raise HTTPException(status_code=400, detail=f"File exceeds maximum size of {MAX_MB/1024/1024} MB.")
        
    import uuid
    dummy_session = str(uuid.uuid4())
    
    # 1. Ingest (parse + store in SQLite)
    try:
        meta = ingest_file(file_bytes, file.filename, dummy_session)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))
    
    # 2. Re-read from the SQLite DB we just created (single source of truth)
    try:
        import sqlite3
        import numpy as np
        DATA_DB_DIR = os.getenv("DATA_DB_DIR", "./data_dbs/")
        db_path = os.path.join(DATA_DB_DIR, f"{dummy_session}.db")
        table_name = f"data_{dummy_session.replace('-', '_')}"
        conn = sqlite3.connect(db_path)
        df = pd.read_sql(f"SELECT * FROM {table_name}", conn)
        conn.close()
        # Replace NaN/inf with None for JSON safety
        df = df.replace([np.inf, -np.inf], np.nan)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to read ingested data: {e}")
    
    # 3. Profile & Embed
    try:
        profile, metric_dict = profile_dataset(df, dummy_session)
    except Exception as e:
        print(f"[Upload] Profiling failed: {e}")
        profile = {}
        metric_dict = {col: "Data column" for col in df.columns}
    
    # 4. Generate Questions
    try:
        suggested = generate_suggested_questions(profile, metric_dict)
    except Exception as e:
        print(f"[Upload] Failed to generate questions via LLM: {e}")
        suggested = [
            "What is the total overall number?",
            "Break down the main measure by category?",
            "What is the trend over time?",
            "Are there any outliers?",
            "Show me a summary of the data."
        ]
    
    # 5. Precompute Insight Cards (pure pandas — no LLM, instant)
    try:
        precomputed_cards = precompute_insights(df)
    except Exception as e:
        print(f"[Upload] Precompute insights failed: {e}")
        precomputed_cards = []
    
    # 6. Create session
    session_id = dummy_session 
    create_session(session_id, file.filename, meta.row_count, meta.col_count, current_user["id"])
    
    return {
        "session_id": session_id,
        "dataset_meta": meta.dict(),
        "metric_dictionary": metric_dict,
        "suggested_questions": suggested,
        "profile": profile,
        "precomputed_insights": precomputed_cards,
    }
