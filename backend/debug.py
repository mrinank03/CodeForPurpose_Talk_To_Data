import sqlite3
import json

DB_PATH = "/Users/mrinankjitsingh/Desktop/DATALENS/backend/sessions.db"

def get_session(session_id: str) -> dict:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM sessions WHERE id = ?', (session_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

print(get_session("6442709f-cf86-4250-b860-25a320e12ac3"))
