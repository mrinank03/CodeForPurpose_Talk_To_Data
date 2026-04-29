import logging
from typing import Any, Dict

from src.agents.intent_classifier import classify_intent
from src.agents.schema_resolver import resolve_schema
from src.agents.sql_planner import generate_sql_plan
from src.agents.executor import execute_with_retry
from src.agents.validator import validate_execution
from src.agents.narrator import narrate_result

logger = logging.getLogger(__name__)

async def run_prompt_cell(session_id: str, prompt: str) -> Dict[str, Any]:
    try:
        intent = classify_intent(prompt)
        resolved_schema = resolve_schema(prompt, session_id)
        cols = [c["column_name"] for c in resolved_schema.relevant_columns]
        plan = generate_sql_plan(prompt, intent, resolved_schema, []) # Empty history
        
        if not plan.sql:
            return {"result_type": "text", "result": {"answer": "Couldn't figure out the best way to answer that.", "error": None}, "error": None}
            
        exec_result = execute_with_retry(prompt, plan.sql, session_id, resolved_schema.full_schema_str)
        val_result = validate_execution(exec_result, resolved_schema, intent)
        
        if val_result.answer_text: # Empty or error
            return {
                "result_type": "text",
                "result": {
                    "answer": val_result.answer_text,
                    "sql": exec_result.final_sql,
                    "chart_type": "none",
                    "chart_data": None,
                    "columns_used": cols,
                    "intent": intent,
                    "error": exec_result.error_message
                },
                "error": None
            }
            
        ans, final_chart_type = narrate_result(prompt, val_result.data, val_result.columns_used, plan.chart_type)
        
        return {
            "result_type": final_chart_type if final_chart_type != "none" else "table",
            "result": {
                "answer": ans,
                "sql": exec_result.final_sql,
                "chart_type": final_chart_type,
                "chart_data": val_result.data,
                "rows": val_result.data,
                "columns": val_result.columns_used,
                "columns_used": cols,
                "intent": intent,
                "error": None
            },
            "error": None
        }
    except Exception as e:
        logger.error(f"Prompt cell execution failed for session {session_id}: {e}")
        return {"result_type": "text", "result": None, "error": str(e)}

async def run_code_cell(session_id: str, sql: str) -> Dict[str, Any]:
    try:
        resolved_schema = resolve_schema("Raw SQL execution", session_id)
        exec_result = execute_with_retry("Raw SQL", sql, session_id, resolved_schema.full_schema_str)
        if exec_result.success:
            return {
                "result_type": "table",
                "result": {"rows": exec_result.data, "columns": exec_result.column_names},
                "error": None,
            }
        else:
            return {"result_type": "text", "result": None, "error": exec_result.error_message}
    except Exception as e:
        logger.error(f"Code cell SQL execution failed for session {session_id}: {e}")
        return {"result_type": "text", "result": None, "error": str(e)}
