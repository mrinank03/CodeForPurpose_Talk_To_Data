import os
from pydantic import BaseModel
from typing import Optional
from src.agents.executor import ExecutionResult
from src.agents.schema_resolver import ResolvedSchema
from src.utils.confidence import ConfidenceLevel

MAX_RESULT_ROWS = int(os.getenv("MAX_RESULT_ROWS", "500"))

class ValidationResult(BaseModel):
    confidence: ConfidenceLevel
    confidence_score: float
    confidence_breakdown: dict
    row_count: int
    truncated: bool
    data: list[dict]
    columns_used: list[str]
    answer_text: Optional[str] = None

def score_row_reasonableness(intent: str, row_count: int) -> float:
    if row_count == 0:
        return 0.5  # Neutral, wait for other signals
    if intent == "aggregation":
        return 1.0 if row_count <= 5 else max(0.0, 1.0 - (row_count / 100.0))
    if intent == "comparison":
        return 1.0 if row_count <= 20 else 0.5
    if intent == "breakdown":
        return 1.0 if row_count <= 50 else 0.8
    if intent == "trend":
        return 1.0 if row_count <= 50 else 0.8
    if intent == "anomaly":
        return 1.0 if row_count <= 20 else 0.7
    if intent == "follow_up":
        return 0.9  # Follow-ups typically return reasonable results
    if intent == "general":
        return 0.2
    return 0.8  # listing/search


def validate_execution(
    exec_result: ExecutionResult, 
    resolved_schema: ResolvedSchema, 
    intent: str,
    grounding_score: float = 1.0
) -> ValidationResult:
    
    if not exec_result.success or exec_result.data is None:
        return ValidationResult(
            confidence=ConfidenceLevel.LOW,
            confidence_score=0.0,
            confidence_breakdown={"schema_score": resolved_schema.schema_score, "execution_score": 0.0, "row_reasonableness": 0.0, "grounding_score": 0.0},
            row_count=0,
            truncated=False,
            data=[],
            columns_used=[],
            answer_text=exec_result.error_message or "Execution failed."
        )
        
    data = exec_result.data
    row_count = len(data)
    truncated = row_count > MAX_RESULT_ROWS
    if truncated:
        data = data[:MAX_RESULT_ROWS]
        
    raw_schema_score = resolved_schema.schema_score
    
    # Normalize TF-IDF schema score: TF-IDF cosine similarity for short docs
    # inherently compresses into the 0.1–0.5 range. A raw score of 0.3+ from
    # TF-IDF is actually a strong match. We remap to a 0–1 scale so it doesn't
    # unfairly penalize queries that the SQL Planner handled correctly.
    schema_score = min(1.0, raw_schema_score / 0.5)
    
    # Execution score
    execution_score = 1.0
    if exec_result.was_corrected:
        execution_score -= 0.25
    if exec_result.attempts_used > 1:
        execution_score -= 0.1 * (exec_result.attempts_used - 1)
    execution_score = max(0.0, execution_score)
        
    row_reasonableness = score_row_reasonableness(intent, row_count)
    
    # Calculate weighted score
    # Execution correctness is the strongest signal (did SQL actually work?).
    # Schema matching is weakest because TF-IDF is approximate by nature.
    confidence_score = (
        0.20 * schema_score +
        0.35 * execution_score +
        0.20 * row_reasonableness +
        0.25 * grounding_score
    )
    
    # Map to label
    if confidence_score >= 0.85:
        confidence = ConfidenceLevel.HIGH
    elif confidence_score >= 0.65:
        confidence = ConfidenceLevel.MEDIUM
    else:
        confidence = ConfidenceLevel.LOW
        
    # CRITICAL RULE: Zero rows capping at Medium unless it's a very specific check.
    # We will enforce Medium cap for 0 rows unless score is perfect.
    if row_count == 0 and confidence == ConfidenceLevel.HIGH:
        confidence = ConfidenceLevel.MEDIUM
        
    breakdown = {
        "schema_score": schema_score,
        "schema_score_raw": raw_schema_score,
        "execution_score": execution_score,
        "row_reasonableness": row_reasonableness,
        "grounding_score": grounding_score
    }

    return ValidationResult(
        confidence=confidence,
        confidence_score=confidence_score,
        confidence_breakdown=breakdown,
        row_count=row_count,
        truncated=truncated,
        data=data,
        columns_used=exec_result.column_names,
        answer_text=None
    )
