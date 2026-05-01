import os
import json
from src.api.routes.notebooks import _load_notebook, _run_code_cell
from src.connectors.db_inspector import test_connection
from src.connectors.mirror_manager import mirror_table
from src.scheduler.crypto import decrypt_value
from src.scheduler.metadata_db import SessionLocal, EncryptedCredentials
from src.story.pdf_report import generate_report_pdf
from src.story.email_service import send_report_email

# We need to run async prompt cells synchronously or await them. 
# Since headless_runner might be called from an async APScheduler job, we'll make it async.
async def run_scheduled_notebook(notebook_id: str, recipient_emails: str):
    """Executes a notebook, builds a report, and emails it."""
    
    nb = _load_notebook(notebook_id)
    session_id = nb.get("session_id")
    
    # 1. Sync data if external DB credentials exist
    if session_id:
        db = SessionLocal()
        try:
            cred = db.query(EncryptedCredentials).filter(EncryptedCredentials.session_id == session_id).first()
            if cred:
                # Decrypt and sync
                raw_json = decrypt_value(cred.encrypted_blob)
                if raw_json:
                    c_data = json.loads(raw_json)
                    # We just mirror tables that might be relevant, or all tables? 
                    # For MVP, we assume the user already mirrored the tables they care about,
                    # so we re-mirror the existing ones in SQLite.
                    # Or we just mirror all tables in the DB? 
                    # Let's mirror what we can, or just re-run mirror on the ones already in the SQLite db.
                    from src.data.ingestor import get_table_name
                    # Alternatively, just use the local SQLite if we don't have explicit mirrored_tables list.
                    # MVP: Skip strict re-mirroring unless we know the tables. 
                    # Actually, let's look at sqlite and find existing tables to refresh.
                    from sqlalchemy import create_engine, inspect
                    DATA_DB_DIR = os.getenv("DATA_DB_DIR", "./data_dbs/")
                    db_path = os.path.join(DATA_DB_DIR, f"{session_id}.db")
                    if os.path.exists(db_path):
                        engine = create_engine(f"sqlite:///{db_path}")
                        inspector = inspect(engine)
                        tables = inspector.get_table_names()
                        for t in tables:
                            # If it starts with data_, it might be a CSV upload. 
                            # If it's a real mirrored table, it has the original name.
                            if not t.startswith("data_"):
                                try:
                                    mirror_table(
                                        session_id, c_data['db_type'], c_data['host'], 
                                        c_data['port'], c_data['database'], 
                                        c_data['username'], c_data['password'], t
                                    )
                                except Exception as e:
                                    print(f"Failed to refresh table {t}: {e}")
        finally:
            db.close()

    # 2. Execute cells
    narrative_parts = []
    insights = []
    
    from src.api.routes.notebooks import _run_prompt_cell
    
    for cell in nb.get("cells", []):
        ctype = cell.get("type")
        content = cell.get("content", "")
        
        if ctype == "text":
            narrative_parts.append(content)
        elif ctype == "prompt":
            res = await _run_prompt_cell(session_id, content)
            if res.get("error"):
                narrative_parts.append(f"**Error in prompt:** {content}\n{res['error']}")
            else:
                r_data = res.get("result", {})
                insights.append({
                    "headline": content[:50] + "..." if len(content) > 50 else content,
                    "explanation": r_data.get("answer", ""),
                    "chart_type": r_data.get("chart_type", "table"),
                    "chart_data": r_data.get("chart_data", r_data.get("rows", []))
                })
        elif ctype == "code":
            res = _run_code_cell(session_id, content)
            if res.get("error"):
                narrative_parts.append(f"**Error in SQL:**\n```sql\n{content}\n```\n{res['error']}")
            else:
                r_data = res.get("result", {})
                insights.append({
                    "headline": "SQL Query Result",
                    "explanation": f"Executed query:\n{content}",
                    "chart_type": "table",
                    "chart_data": r_data.get("rows", [])
                })
                
    # 3. Compile report dict
    report = {
        "metadata": {
            "total_rows": 0, 
            "total_columns": 0
        },
        "narrative": "\n\n".join(narrative_parts),
        "insights": insights
    }
    
    # 4. Generate PDF
    pdf_bytes = generate_report_pdf(report)
    
    # 5. Send Email
    from src.story.email_service import build_report_html
    html = build_report_html(report)
    
    emails = [e.strip() for e in recipient_emails.split(",") if e.strip()]
    for email in emails:
        send_report_email(
            recipient=email,
            subject=f"Scheduled Report: {nb.get('title', 'Notebook')}",
            html_body=html,
            pdf_bytes=pdf_bytes
        )
