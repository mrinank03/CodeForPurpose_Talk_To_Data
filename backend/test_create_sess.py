import sqlite3
from datetime import datetime

DB_PATH = "/Users/mrinankjitsingh/Desktop/DATALENS/backend/sessions.db"

def create_session(session_id: str, filename: str, row_count: int, col_count: int, user_id: str = None) -> str:
    timestamp = datetime.utcnow().isoformat()
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO sessions (id, user_id, filename, upload_timestamp, row_count, col_count, status, is_starred, is_archived)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
        ''', (session_id, user_id, filename, timestamp, row_count, col_count, "active"))
        conn.commit()
    return session_id

create_session("fake-session-123", "Test DB", 0, 0, "94a39d9b-5c32-42fc-a333-ab4ec7ce9d48")
print("Inserted!")

def get_session(session_id: str) -> dict:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM sessions WHERE id = ?', (session_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

print(get_session("fake-session-123"))
