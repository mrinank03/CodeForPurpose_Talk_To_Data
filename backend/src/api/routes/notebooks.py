"""
Notebook API routes — CRUD for notebooks + cell execution.
Notebooks are stored as JSON files in ./notebooks/ directory.
"""
import os
import json
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

NOTEBOOKS_DIR = os.getenv("NOTEBOOKS_DIR", "./notebooks/")
os.makedirs(NOTEBOOKS_DIR, exist_ok=True)


# ── Models ────────────────────────────────────────────────────────────────────

class NotebookCell(BaseModel):
    id: str
    type: str  # 'text' | 'prompt' | 'code'
    content: str
    result: Optional[dict] = None
    result_type: Optional[str] = None


class CreateNotebookRequest(BaseModel):
    title: str = "Untitled Notebook"
    session_id: Optional[str] = None


class SaveNotebookRequest(BaseModel):
    title: str
    cells: List[NotebookCell]
    session_id: Optional[str] = None


class RunCellRequest(BaseModel):
    cell_id: str
    cell_type: str
    content: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _nb_path(notebook_id: str) -> str:
    return os.path.join(NOTEBOOKS_DIR, f"{notebook_id}.json")


def _load_notebook(notebook_id: str) -> dict:
    path = _nb_path(notebook_id)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Notebook not found")
    with open(path, "r") as f:
        return json.load(f)


def _save_notebook(data: dict):
    path = _nb_path(data["id"])
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/notebooks/create")
def create_notebook(req: CreateNotebookRequest):
    """Create a new empty notebook."""
    now = datetime.utcnow().isoformat()
    nb = {
        "id": str(uuid.uuid4()),
        "title": req.title,
        "session_id": req.session_id,
        "created_at": now,
        "updated_at": now,
        "cells": [],
    }
    _save_notebook(nb)
    return nb


@router.get("/notebooks/list")
def list_notebooks():
    """List all notebooks (summary only)."""
    notebooks = []
    for fname in sorted(os.listdir(NOTEBOOKS_DIR), reverse=True):
        if not fname.endswith(".json"):
            continue
        try:
            path = os.path.join(NOTEBOOKS_DIR, fname)
            with open(path, "r") as f:
                data = json.load(f)
            notebooks.append({
                "id": data["id"],
                "title": data.get("title", "Untitled"),
                "created_at": data.get("created_at", ""),
                "updated_at": data.get("updated_at", ""),
                "cell_count": len(data.get("cells", [])),
            })
        except Exception:
            continue
    # Sort by updated_at descending
    notebooks.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    return notebooks


@router.get("/notebooks/{notebook_id}")
def get_notebook(notebook_id: str):
    """Get a single notebook with all cells."""
    return _load_notebook(notebook_id)


@router.put("/notebooks/{notebook_id}")
def save_notebook(notebook_id: str, req: SaveNotebookRequest):
    """Save/update a notebook."""
    nb = _load_notebook(notebook_id)
    nb["title"] = req.title
    nb["cells"] = [c.dict() for c in req.cells]
    nb["updated_at"] = datetime.utcnow().isoformat()
    if req.session_id:
        nb["session_id"] = req.session_id
    _save_notebook(nb)
    return nb


@router.delete("/notebooks/{notebook_id}")
def delete_notebook(notebook_id: str):
    """Delete a notebook."""
    path = _nb_path(notebook_id)
    if os.path.exists(path):
        os.remove(path)
    return {"ok": True}


@router.post("/notebooks/{notebook_id}/run-cell")
async def run_cell(notebook_id: str, req: RunCellRequest):
    """Execute a single cell (prompt or code/SQL)."""
    nb = _load_notebook(notebook_id)
    session_id = nb.get("session_id")

    if not session_id:
        return {"result": {"error": "No data source connected to this notebook. Upload a file or connect a database first."}, "result_type": "text", "error": "No data source connected"}

    if req.cell_type == "prompt":
        return await _run_prompt_cell(session_id, req.content)
    elif req.cell_type == "code":
        return _run_code_cell(session_id, req.content)
    else:
        return {"result": None, "result_type": "text", "error": "Text cells cannot be executed"}


# ── Cell Executors ────────────────────────────────────────────────────────────

async def _run_prompt_cell(session_id: str, prompt: str) -> dict:
    """Run a natural-language prompt through the AI pipeline."""
    try:
        from src.agents.intent_classifier import classify_intent
        from src.agents.schema_resolver import resolve_schema
        from src.agents.sql_planner import generate_sql_plan
        from src.agents.executor import execute_with_retry
        from src.agents.narrator import narrate_result

        intent = classify_intent(prompt)
        schema = resolve_schema(prompt, session_id)
        plan_obj = generate_sql_plan(prompt, intent, schema, [])
        sql = plan_obj.sql
        chart_type = plan_obj.chart_type

        exec_result = execute_with_retry(prompt, sql, session_id, schema.full_schema_str)

        if not exec_result.success:
            return {"result": {"error": exec_result.error_message}, "result_type": "text", "error": exec_result.error_message}

        data = exec_result.data or []
        columns = exec_result.column_names or []

        narration, final_chart_type = narrate_result(prompt, data, columns, chart_type)

        if final_chart_type in ("bar", "line", "pie"):
            return {
                "result": {
                    "chart_type": final_chart_type,
                    "chart_data": data[:50],
                    "answer": narration,
                },
                "result_type": "chart",
                "error": None,
            }
        else:
            return {
                "result": {
                    "columns": columns,
                    "rows": data[:100],
                    "answer": narration,
                },
                "result_type": "table",
                "error": None,
            }

    except Exception as e:
        return {"result": {"error": str(e)}, "result_type": "text", "error": str(e)}


def _run_code_cell(session_id: str, sql: str) -> dict:
    """Execute raw SQL against the session's database."""
    try:
        from sqlalchemy import create_engine, text
        import math

        DATA_DB_DIR = os.getenv("DATA_DB_DIR", "./data_dbs/")
        db_path = os.path.join(DATA_DB_DIR, f"{session_id}.db")
        if not os.path.exists(db_path):
            return {"result": {"error": f"Database not found for session {session_id}"}, "result_type": "text", "error": "DB not found"}

        engine = create_engine(f"sqlite:///{db_path}")
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            keys = list(result.keys())
            rows = []
            for row in result.fetchall():
                clean_row = {}
                for k, v in zip(keys, row):
                    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                        clean_row[k] = None
                    else:
                        clean_row[k] = v
                rows.append(clean_row)

        return {
            "result": {
                "columns": keys,
                "rows": rows[:500],
            },
            "result_type": "table",
            "error": None,
        }

    except Exception as e:
        return {"result": {"error": str(e)}, "result_type": "text", "error": str(e)}
