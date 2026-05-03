import os
from fastapi import APIRouter, Request, HTTPException, Depends
from slowapi import Limiter
from slowapi.util import get_remote_address
from src.api.models import QueryRequest, QueryResponse
from src.data.session_store import save_message, get_messages, get_session
from src.api.dependencies import get_current_user

from src.agents.intent_classifier import classify_intent
from src.agents.contextualizer import contextualize_question
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
async def process_query(request: Request, body: QueryRequest, current_user: dict = Depends(get_current_user)):
    session_id = body.session_id
    question = body.question
    
    sess = get_session(session_id)
    if not sess or sess.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized session")
    
    # 1. Save user question
    save_message(session_id, role="user", content=question)
    
    # Load history
    history = get_messages(session_id)
    
    # 2. Intent
    intent = classify_intent(question)
    
    # Contextualize for follow-ups
    contextualized_question = question
    if intent in ["follow_up", "general"] and history:
        contextualized_question = contextualize_question(question, history)
    
    # 3. Resolve Schema using contextualized question
    resolved_schema = resolve_schema(contextualized_question, session_id)
    cols = [c["column_name"] for c in resolved_schema.relevant_columns]
    
    # GATE 1: Schema Rejection
    MIN_SCHEMA_SCORE = 0.10
    if resolved_schema.schema_score < MIN_SCHEMA_SCORE:
        # Extract available column names from schema string for a helpful message
        available_cols = [c["column_name"] for c in resolved_schema.relevant_columns] if resolved_schema.relevant_columns else []
        col_hint = ""
        if available_cols:
            col_hint = f" Available columns include: {', '.join(available_cols)}."
        elif resolved_schema.full_schema_str:
            col_hint = f" Schema: {resolved_schema.full_schema_str}"
        
        ans = f"I couldn't confidently match your question to the uploaded dataset. Try rephrasing using column names from your data.{col_hint}"
        save_message(session_id, role="assistant", content=ans, intent=intent)
        return QueryResponse(
            answer=ans, sql=None, chart_type="none", chart_data=None, 
            confidence="Low", confidence_score=0.0,
            confidence_breakdown={"schema_score": resolved_schema.schema_score},
            abstained=True, warning="Schema match score too low.",
            columns_used=[], intent=intent, error=None
        )
        
    # GATE 2: Intent Sanity
    if intent == "general" and resolved_schema.schema_score < 0.3:
        ans = "I'm not sure how to answer that from the data. Could you clarify your question?"
        save_message(session_id, role="assistant", content=ans, intent=intent)
        return QueryResponse(
            answer=ans, sql=None, chart_type="none", chart_data=None, 
            confidence="Low", confidence_score=0.0,
            confidence_breakdown={"schema_score": resolved_schema.schema_score},
            abstained=True, warning="General intent with weak schema match.",
            columns_used=[], intent=intent, error=None
        )
    
    # 4. Plan SQL
    plan = generate_sql_plan(contextualized_question, intent, resolved_schema, history)
    
    # 5. Execute
    if not plan.sql:
        ans = "I couldn't figure out the best way to answer that. Could you rephrase your question?"
        save_message(session_id, role="assistant", content=ans, intent=intent)
        return QueryResponse(
            answer=ans, sql=None, chart_type="none", chart_data=None, 
            confidence="Low", confidence_score=0.0,
            abstained=True, warning="SQL Planning failed.",
            columns_used=[], intent=intent, error=None
        )
        
    exec_result = execute_with_retry(contextualized_question, plan.sql, session_id, resolved_schema.full_schema_str)
    
    # 6. Validate (first pass to get row counts and early confidence, assume grounding=1.0 for now)
    val_result = validate_execution(exec_result, resolved_schema, intent, grounding_score=1.0)
    
    if val_result.answer_text: # Empty or error
        ans = val_result.answer_text
        save_message(session_id, role="assistant", content=ans, sql=exec_result.final_sql, confidence=val_result.confidence.value, columns_used=cols, intent=intent)
        return QueryResponse(
            answer=ans,
            sql=exec_result.final_sql,
            chart_type="none",
            chart_data=None,
            confidence=val_result.confidence.value,
            confidence_score=val_result.confidence_score,
            confidence_breakdown=val_result.confidence_breakdown,
            retry_count=exec_result.attempts_used - 1,
            columns_used=cols,
            intent=intent,
            error=exec_result.error_message
        )
        
    # 7. Narrate and verify Grounding
    ans, final_chart_type, grounding_score = narrate_result(contextualized_question, val_result.data, val_result.columns_used, plan.chart_type)
    
    # 8. Re-validate with actual grounding score
    val_result = validate_execution(exec_result, resolved_schema, intent, grounding_score=grounding_score)
    
    chart_data = val_result.data
    
    # Save Assistant msg
    save_message(session_id, role="assistant", content=ans, sql=exec_result.final_sql, chart_type=final_chart_type, chart_data=chart_data, confidence=val_result.confidence.value, columns_used=cols, intent=intent)
    
    warning_msg = None
    if val_result.confidence.value == "Low":
        warning_msg = "This result has low confidence. Please verify the logic."
        
    return QueryResponse(
        answer=ans,
        sql=exec_result.final_sql,
        chart_type=final_chart_type,
        chart_data=chart_data,
        confidence=val_result.confidence.value,
        confidence_score=val_result.confidence_score,
        confidence_breakdown=val_result.confidence_breakdown,
        retry_count=exec_result.attempts_used - 1,
        warning=warning_msg,
        columns_used=cols,
        intent=intent,
        error=None
    )
