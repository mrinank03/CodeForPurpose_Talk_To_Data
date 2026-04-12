import os
from pydantic import BaseModel
from typing import Optional
from src.agents.executor import ExecutionResult
from src.agents.schema_resolver import ResolvedSchema
from src.utils.confidence import ConfidenceLevel

MAX_RESULT_ROWS = int(os.getenv("MAX_RESULT_ROWS", "500"))

class ValidationResult(BaseModel):
    confidence: ConfidenceLevel
    row_count: int
    truncated: bool
    data: list[dict]
    columns_used: list[str]
    answer_text: Optional[str] = None

def validate_execution(
    exec_result: ExecutionResult, 
    resolved_schema: ResolvedSchema, 
    intent: str
) -> ValidationResult:
    
    if not exec_result.success or exec_result.data is None:
        return ValidationResult(
            confidence=ConfidenceLevel.LOW,
            row_count=0,
            truncated=False,
            data=[],
            columns_used=[],
            answer_text=exec_result.error_message or "Execution failed."
        )
        
    data = exec_result.data
    row_count = len(data)
    truncated = False
    
    if row_count == 0:
        return ValidationResult(
            confidence=ConfidenceLevel.HIGH, # Confident it ran properly
            row_count=0,
            truncated=False,
            data=[],
            columns_used=exec_result.column_names,
            answer_text="The query ran successfully but returned no results. Try broadening the filter."
        )
        
    if row_count > MAX_RESULT_ROWS:
        data = data[:MAX_RESULT_ROWS]
        truncated = True
        
    # Check if exact match by looking if resolving included aliases or direct
    # For now, simplistic confidence check based on intent
    confidence = ConfidenceLevel.MEDIUM
    if intent == "general":
        confidence = ConfidenceLevel.LOW
    elif intent in ["aggregation", "comparison", "breakdown"]:
        # We assume HIGH if the DB hit worked fine as an analytical query
        confidence = ConfidenceLevel.HIGH

    return ValidationResult(
        confidence=confidence,
        row_count=row_count,
        truncated=truncated,
        data=data,
        columns_used=exec_result.column_names,
        answer_text=None
    )
