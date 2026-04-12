import os
import json
from typing import Optional
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from langchain_core.prompts import PromptTemplate
from src.utils.llm_factory import get_sql_llm

DATA_DB_DIR = os.getenv("DATA_DB_DIR", "./data_dbs/")
MAX_RETRY = int(os.getenv("MAX_RETRY_ATTEMPTS", "2"))

class ExecutionResult(BaseModel):
    success: bool
    error_message: Optional[str] = None
    data: Optional[list[dict]] = None
    column_names: Optional[list[str]] = None
    final_sql: Optional[str] = None

def execute_with_retry(question: str, initial_sql: str, session_id: str, schema_str: str) -> ExecutionResult:
    db_path = os.path.join(DATA_DB_DIR, f"{session_id}.db")
    engine = create_engine(f"sqlite:///{db_path}")
    
    current_sql = initial_sql
    llm = get_sql_llm()
    
    for attempt in range(MAX_RETRY + 1):
        try:
            with engine.connect() as conn:
                result = conn.execute(text(current_sql))
                keys = list(result.keys())
                
                # Sanitize out any NaN/inf for JSON safety
                import math
                rows = []
                for row in result.fetchall():
                    clean_row = {}
                    for k, v in zip(keys, row):
                        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                            clean_row[k] = None
                        else:
                            clean_row[k] = v
                    rows.append(clean_row)
                
                return ExecutionResult(
                    success=True,
                    data=rows,
                    column_names=keys,
                    final_sql=current_sql
                )
        except Exception as e:
            error_msg = str(e)
            if attempt == MAX_RETRY:
                return ExecutionResult(success=False, error_message=error_msg)
            
            # Classify and correct error
            prompt = PromptTemplate.from_template(
                "You are an SQLite expert. The following SQL query failed.\n"
                "Schema: {schema}\n"
                "User Question: {question}\n"
                "Failed SQL:\n{sql}\n"
                "Error Message:\n{error}\n\n"
                "Instructions:\n"
                "Fix the SQL query to resolve the error. ONLY output a JSON object with 'sql' key containing the fixed query."
            )
            res = prompt.format(schema=schema_str, question=question, sql=current_sql, error=error_msg)
            llm_res = llm.invoke(res)
            content = llm_res.content.strip()
            
            if content.startswith("```json"):
                content = content[7:-3].strip()
            elif content.startswith("```"):
                content = content[3:-3].strip()
                
            try:
                parsed = json.loads(content)
                current_sql = parsed.get("sql", current_sql)
            except:
                return ExecutionResult(success=False, error_message="Self-correction Failed. " + error_msg)

    return ExecutionResult(success=False, error_message="Max retries reached")
