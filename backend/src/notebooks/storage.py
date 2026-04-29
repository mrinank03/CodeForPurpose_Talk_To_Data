# File-based storage for notebooks.
# Each notebook is a JSON file at data/notebooks/{notebook_id}.json
# Simple, portable, zero dependencies beyond stdlib.

import json
import os
from pathlib import Path
from typing import List, Optional

NOTEBOOKS_DIR = Path(__file__).parent.parent.parent / "data" / "notebooks"
NOTEBOOKS_DIR.mkdir(parents=True, exist_ok=True)


def save_notebook(notebook: dict) -> None:
    path = NOTEBOOKS_DIR / f"{notebook['id']}.json"
    with open(path, "w") as f:
        json.dump(notebook, f, indent=2)


def load_notebook(notebook_id: str) -> Optional[dict]:
    path = NOTEBOOKS_DIR / f"{notebook_id}.json"
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


def list_notebooks() -> List[dict]:
    # Returns lightweight summaries (id, title, updated_at) — not full cell content.
    # Keeps the list endpoint fast even when notebooks have large results cached.
    summaries = []
    # Use glob to find all json files, exclude directories or hidden files if any
    for file in sorted(NOTEBOOKS_DIR.glob("*.json"), key=os.path.getmtime, reverse=True):
        try:
            with open(file) as f:
                data = json.load(f)
            summaries.append({
                "id": data.get("id"),
                "title": data.get("title", "Untitled"),
                "created_at": data.get("created_at"),
                "updated_at": data.get("updated_at"),
                "cell_count": len(data.get("cells", [])),
                "session_id": data.get("session_id")
            })
        except Exception:
            pass # Skip invalid files
    return summaries


def delete_notebook(notebook_id: str) -> bool:
    path = NOTEBOOKS_DIR / f"{notebook_id}.json"
    if not path.exists():
        return False
    path.unlink()
    return True
