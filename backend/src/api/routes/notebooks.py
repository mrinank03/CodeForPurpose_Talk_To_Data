import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.notebooks.storage import (
    save_notebook, load_notebook, list_notebooks, delete_notebook
)
from src.notebooks.runner import run_prompt_cell, run_code_cell

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/notebooks", tags=["notebooks"])


# --- Pydantic models ---

class Cell(BaseModel):
    id: str
    type: str                    # "text" | "prompt" | "code"
    content: str
    result: Optional[Any] = None
    result_type: Optional[str] = None


class NotebookCreateRequest(BaseModel):
    session_id: str
    title: str = "Untitled Notebook"


class NotebookSaveRequest(BaseModel):
    session_id: str
    title: str
    cells: List[Cell]


class RunCellRequest(BaseModel):
    session_id: str
    cell_id: str
    cell_type: str
    content: str


# --- Helpers ---

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- Endpoints ---

@router.post("/create")
async def create_notebook(req: NotebookCreateRequest):
    notebook = {
        "id": str(uuid.uuid4()),
        "session_id": req.session_id,
        "title": req.title,
        "created_at": _now(),
        "updated_at": _now(),
        "cells": [],
    }
    save_notebook(req.session_id, notebook)
    return notebook


@router.get("/list")
async def list_session_notebooks(session_id: str):
    return list_notebooks(session_id)


@router.get("/{notebook_id}")
async def get_notebook(notebook_id: str, session_id: str):
    notebook = load_notebook(session_id, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found.")
    return notebook


@router.put("/{notebook_id}")
async def save_notebook_route(notebook_id: str, req: NotebookSaveRequest):
    existing = load_notebook(req.session_id, notebook_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Notebook not found.")

    existing["title"] = req.title
    existing["cells"] = [cell.model_dump() for cell in req.cells]
    existing["updated_at"] = _now()

    save_notebook(req.session_id, existing)
    return existing


@router.delete("/{notebook_id}")
async def delete_notebook_route(notebook_id: str, session_id: str):
    deleted = delete_notebook(session_id, notebook_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Notebook not found.")
    return {"status": "deleted"}


@router.post("/{notebook_id}/run-cell")
async def run_cell(notebook_id: str, req: RunCellRequest):
    # Text cells are never run server-side — reject them here.
    if req.cell_type == "text":
        raise HTTPException(status_code=400, detail="Text cells do not run server-side.")

    if req.cell_type == "prompt":
        output = await run_prompt_cell(req.session_id, req.content)
    elif req.cell_type == "code":
        output = await run_code_cell(req.session_id, req.content)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown cell type: {req.cell_type}")

    # Persist the result back into the notebook so reopening shows previous output.
    notebook = load_notebook(req.session_id, notebook_id)
    if notebook:
        for cell in notebook["cells"]:
            if cell["id"] == req.cell_id:
                cell["result"] = output.get("result")
                cell["result_type"] = output.get("result_type")
                break
        notebook["updated_at"] = _now()
        save_notebook(req.session_id, notebook)

    return output
