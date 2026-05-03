import os
import pandas as pd
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import create_engine
from src.api.models import StoryRequest, ReportRequest, EmailReportRequest
from src.story.analyst_mode import run_story_mode
from src.story.report_engine import generate_full_report
from src.story.email_service import send_report_email, build_report_html
from src.data.ingestor import get_table_name
from src.data.session_store import get_session
from src.api.dependencies import get_current_user

router = APIRouter()
DATA_DB_DIR = os.getenv("DATA_DB_DIR", "./data_dbs/")


def _verify_session(session_id: str, current_user: dict):
    sess = get_session(session_id)
    if not sess or sess.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized session")


@router.post("/story")
async def get_stories(req: StoryRequest, current_user: dict = Depends(get_current_user)):
    _verify_session(req.session_id, current_user)
    cards = await run_story_mode(req.session_id)
    return cards


def _load_session_df(session_id: str) -> pd.DataFrame:
    """Load a session's data from its SQLite file into a DataFrame."""
    table_name = get_table_name(session_id)
    db_path = os.path.join(DATA_DB_DIR, f"{session_id}.db")

    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Session data not found")

    engine = create_engine(f"sqlite:///{db_path}")
    try:
        df = pd.read_sql_table(table_name, engine)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read session data: {e}")

    if df.empty:
        raise HTTPException(status_code=400, detail="Session data is empty")

    return df


@router.get("/report/columns/{session_id}")
async def get_available_columns(session_id: str, current_user: dict = Depends(get_current_user)):
    """Return the list of columns available for report generation."""
    _verify_session(session_id, current_user)
    df = _load_session_df(session_id)
    columns = []
    for col in df.columns:
        col_type = "numeric" if pd.api.types.is_numeric_dtype(df[col]) else "categorical"
        columns.append({
            "name": col,
            "type": col_type,
            "unique_count": int(df[col].nunique()),
            "null_pct": round(df[col].isna().mean() * 100, 1),
        })
    return {"columns": columns, "total_rows": len(df)}


@router.post("/report")
async def generate_report(req: ReportRequest, current_user: dict = Depends(get_current_user)):
    """Generate a full AI report based on user prompt."""
    _verify_session(req.session_id, current_user)
    df = _load_session_df(req.session_id)
    report = await generate_full_report(req.session_id, df, req.prompt)
    return report


@router.post("/report/email")
async def email_report(req: EmailReportRequest, current_user: dict = Depends(get_current_user)):
    """Generate a report, build PDF with charts, and email it to the recipient."""
    _verify_session(req.session_id, current_user)
    from src.story.pdf_report import generate_report_pdf

    df = _load_session_df(req.session_id)
    report = await generate_full_report(req.session_id, df, req.prompt)

    # Generate PDF with embedded charts
    pdf_bytes = generate_report_pdf(report)

    # Build email HTML (summary only — charts are in the PDF)
    html = build_report_html(report)
    result = send_report_email(
        recipient=req.recipient_email,
        subject="📊 DataLens AI Report",
        html_body=html,
        pdf_bytes=pdf_bytes,
    )

    if not result["success"]:
        msg = result["message"]
        is_user_error = any(kw in msg.lower() for kw in [
            "not configured", "authentication failed", "email sending failed",
            "smtp", "testing emails", "verify a domain", "resend"
        ])
        status_code = 400 if is_user_error else 500
        raise HTTPException(status_code=status_code, detail=msg)

    return result

