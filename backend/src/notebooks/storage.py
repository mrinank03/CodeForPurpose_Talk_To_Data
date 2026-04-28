# File-based storage for notebooks.
# Each notebook is a JSON file at data/notebooks/{session_id}/{notebook_id}.json
# Simple, portable, zero dependencies beyond stdlib.

import json
import os
from pathlib import Path
from typing import List, Optional

NOTEBOOKS_DIR = Path(__file__).parent.parent.parent / "data" / "notebooks"
NOTEBOOKS_DIR.mkdir(parents=True, exist_ok=True)


def _session_dir(session_id: str) -> Path:
    path = NOTEBOOKS_DIR / session_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_notebook(session_id: str, notebook: dict) -> None:
    path = _session_dir(session_id) / f"{notebook['id']}.json"
    with open(path, "w") as f:
        json.dump(notebook, f, indent=2)


def load_notebook(session_id: str, notebook_id: str) -> Optional[dict]:
    path = _session_dir(session_id) / f"{notebook_id}.json"
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


def list_notebooks(session_id: str) -> List[dict]:
    # Returns lightweight summaries (id, title, updated_at) — not full cell content.
    # Keeps the list endpoint fast even when notebooks have large results cached.
    session_path = _session_dir(session_id)
    summaries = []
    for file in sorted(session_path.glob("*.json"), key=os.path.getmtime, reverse=True):
        with open(file) as f:
            data = json.load(f)
        summaries.append({
            "id": data["id"],
            "title": data["title"],
            "created_at": data["created_at"],
            "updated_at": data["updated_at"],
            "cell_count": len(data.get("cells", [])),
        })
    return summaries


def delete_notebook(session_id: str, notebook_id: str) -> bool:
    path = _session_dir(session_id) / f"{notebook_id}.json"
    if not path.exists():
        return False
    path.unlink()
    return True
