import sqlite3
import uuid
import os
import shutil
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.getenv("SESSIONS_DB_PATH", "./sessions.db")
DATA_DB_DIR = os.getenv("DATA_DB_DIR", "./data_dbs/")
CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_store/")

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    os.makedirs(DATA_DB_DIR, exist_ok=True)
    
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                filename TEXT,
                upload_timestamp TEXT,
                row_count INTEGER,
                col_count INTEGER,
                status TEXT,
                is_starred INTEGER DEFAULT 0,
                is_archived INTEGER DEFAULT 0
            )
        ''')
        
        # Add columns if they don't exist (for existing databases)
        try:
            cursor.execute('ALTER TABLE sessions ADD COLUMN is_starred INTEGER DEFAULT 0')
        except sqlite3.OperationalError:
            pass # Column already exists
            
        try:
            cursor.execute('ALTER TABLE sessions ADD COLUMN is_archived INTEGER DEFAULT 0')
        except sqlite3.OperationalError:
            pass # Column already exists
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                role TEXT,
                content TEXT,
                sql TEXT,
                chart_type TEXT,
                chart_data TEXT,
                confidence TEXT,
                timestamp TEXT,
                columns_used TEXT,
                intent TEXT,
                FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
            )
        ''')
        conn.commit()

# Call init_db on module import safely
init_db()

def create_session(session_id: str, filename: str, row_count: int, col_count: int) -> str:
    timestamp = datetime.utcnow().isoformat()
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO sessions (id, filename, upload_timestamp, row_count, col_count, status, is_starred, is_archived)
            VALUES (?, ?, ?, ?, ?, ?, 0, 0)
        ''', (session_id, filename, timestamp, row_count, col_count, "active"))
        conn.commit()
    return session_id

def update_session_flags(session_id: str, is_starred: bool = None, is_archived: bool = None):
    updates = []
    params = []
    if is_starred is not None:
        updates.append("is_starred = ?")
        params.append(1 if is_starred else 0)
    if is_archived is not None:
        updates.append("is_archived = ?")
        params.append(1 if is_archived else 0)
        
    if not updates:
        return
        
    params.append(session_id)
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(f"UPDATE sessions SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()

def get_session(session_id: str) -> dict:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM sessions WHERE id = ?', (session_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def list_sessions() -> list[dict]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM sessions ORDER BY upload_timestamp DESC')
        return [dict(row) for row in cursor.fetchall()]

def save_message(session_id: str, role: str, content: str, sql: str = None, 
                 chart_type: str = None, chart_data: list = None, confidence: str = None,
                 columns_used: list = None, intent: str = None) -> str:
    msg_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat()
    chart_data_str = json.dumps(chart_data) if chart_data else None
    cols_used_str = json.dumps(columns_used) if columns_used else None
    
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO messages (id, session_id, role, content, sql, chart_type, chart_data, confidence, timestamp, columns_used, intent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (msg_id, session_id, role, content, sql, chart_type, chart_data_str, confidence, timestamp, cols_used_str, intent))
        conn.commit()
    return msg_id

def get_messages(session_id: str) -> list[dict]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC', (session_id,))
        rows = []
        for row in cursor.fetchall():
            d = dict(row)
            d["chart_data"] = json.loads(d["chart_data"]) if d["chart_data"] else None
            d["columns_used"] = json.loads(d["columns_used"]) if d["columns_used"] else None
            rows.append(d)
        return rows

def delete_session(session_id: str):
    # 1. Delete from SQLite SESSIONS_DB_PATH
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM messages WHERE session_id = ?', (session_id,))
        cursor.execute('DELETE FROM sessions WHERE id = ?', (session_id,))
        conn.commit()
        
    # 2. Delete actual DB file
    data_db_path = os.path.join(DATA_DB_DIR, f"{session_id}.db")
    if os.path.exists(data_db_path):
        os.remove(data_db_path)
        
    # 3. Delete ChromaDB Collection (Chroma handles this via collection removal, handled in embedder.py if needed, 
    # but since chroma client is persistent we can request embedder to delete it)
    from src.semantic.embedder import delete_collection
    delete_collection(session_id)
