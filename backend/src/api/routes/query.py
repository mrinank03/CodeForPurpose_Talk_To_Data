import os
from fastapi import APIRouter, Request, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address
from src.api.models import QueryRequest, QueryResponse
from src.data.session_store import save_message, get_messages

from src.agents.intent_classifier import classify_intent
from src.agents.schema_resolver import resolve_schema
from src.agents.sql_planner import generate_sql_plan
from src.agents.executor import execute_with_retry
from src.agents.validator import validate_execution
from src.agents.narrator import narrate_result

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)
rpm = os.getenv("RATE_LIMIT_PER_MINUTE", "30")

@router.post("/query", response_model=QueryResponse)
@limiter.limit(f"{rpm}/minute")
async def process_query(request: Request, body: QueryRequest):
    session_id = body.session_id
    question = body.question
    
    # 1. Save user question
    save_message(session_id, role="user", content=question)
    
    # Load history
    history = get_messages(session_id)
    
    # 2. Intent
    intent = classify_intent(question)
    
    # 3. Resolve Schema
    resolved_schema = resolve_schema(question, session_id)
    cols = [c["column_name"] for c in resolved_schema.relevant_columns]
    
    # 4. Plan SQL
    plan = generate_sql_plan(question, intent, resolved_schema, history)
    
    # 5. Execute
    if not plan.sql:
        ans = "I couldn't figure out the best way to answer that. Could you rephrase your question?"
        save_message(session_id, role="assistant", content=ans, intent=intent)
        return QueryResponse(answer=ans, sql=None, chart_type="none", chart_data=None, confidence="Low", columns_used=[], intent=intent, error=None)
        
    exec_result = execute_with_retry(question, plan.sql, session_id, resolved_schema.full_schema_str)
    
    # 6. Validate
    val_result = validate_execution(exec_result, resolved_schema, intent)
    
    if val_result.answer_text: # Empty or error
        ans = val_result.answer_text
        save_message(session_id, role="assistant", content=ans, sql=exec_result.final_sql, confidence=val_result.confidence.value, columns_used=cols, intent=intent)
        return QueryResponse(
            answer=ans,
            sql=exec_result.final_sql,
            chart_type="none",
            chart_data=None,
            confidence=val_result.confidence.value,
            columns_used=cols,
            intent=intent,
            error=exec_result.error_message
        )
        
    # 7. Narrate
    ans, final_chart_type = narrate_result(question, val_result.data, val_result.columns_used, plan.chart_type)
    
    chart_data = val_result.data
    
    # Save Assistant msg
    save_message(session_id, role="assistant", content=ans, sql=exec_result.final_sql, chart_type=final_chart_type, chart_data=chart_data, confidence=val_result.confidence.value, columns_used=cols, intent=intent)
    
    return QueryResponse(
        answer=ans,
        sql=exec_result.final_sql,
        chart_type=final_chart_type,
        chart_data=chart_data,
        confidence=val_result.confidence.value,
        columns_used=cols,
        intent=intent,
        error=None
    )
