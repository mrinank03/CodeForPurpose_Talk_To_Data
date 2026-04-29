from pydantic import BaseModel
from typing import Optional, List, Dict

class QueryRequest(BaseModel):
    session_id: str
    question: str

class QueryResponse(BaseModel):
    answer: str
    sql: Optional[str] = None
    chart_type: Optional[str] = None
    chart_data: Optional[list[dict]] = None
    confidence: Optional[str] = None
    columns_used: Optional[list[str]] = None
    intent: Optional[str] = None
    error: Optional[str] = None

class StoryRequest(BaseModel):
    session_id: str

class ReportRequest(BaseModel):
    session_id: str
    prompt: str

class EmailReportRequest(BaseModel):
    session_id: str
    prompt: str
    recipient_email: str

class SessionDetailResponse(BaseModel):
    metadata: dict
    messages: list[dict]
