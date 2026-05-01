import pytest
from src.agents.validator import validate_execution, score_row_reasonableness
from src.agents.executor import ExecutionResult
from src.agents.schema_resolver import ResolvedSchema
from src.utils.confidence import ConfidenceLevel

def test_score_row_reasonableness():
    assert score_row_reasonableness("aggregation", 1) == 1.0
    assert score_row_reasonableness("aggregation", 100) == 0.0 # 1.0 - 100/100
    assert score_row_reasonableness("comparison", 5) == 1.0
    assert score_row_reasonableness("comparison", 50) == 0.5
    assert score_row_reasonableness("breakdown", 10) == 1.0
    assert score_row_reasonableness("breakdown", 100) == 0.8
    assert score_row_reasonableness("general", 5) == 0.2
    assert score_row_reasonableness("search", 100) == 0.8
    assert score_row_reasonableness("search", 0) == 0.5

def test_validate_execution_valid_aggregate():
    exec_res = ExecutionResult(success=True, data=[{"SUM(Amount)": 500}], column_names=["SUM(Amount)"], attempts_used=1, was_corrected=False)
    schema = ResolvedSchema(table_name="data_123", relevant_columns=[], full_schema_str="", schema_score=1.0)
    
    # schema=1.0 (0.3), exec=1.0 (0.3), reason=1.0 (0.2), ground=1.0 (0.2) -> 1.0 -> HIGH
    res = validate_execution(exec_res, schema, "aggregation", grounding_score=1.0)
    assert res.confidence == ConfidenceLevel.HIGH
    assert res.confidence_score >= 0.85

def test_validate_execution_zero_rows_not_high():
    exec_res = ExecutionResult(success=True, data=[], column_names=["ID"], attempts_used=1, was_corrected=False)
    schema = ResolvedSchema(table_name="data_123", relevant_columns=[], full_schema_str="", schema_score=1.0)
    
    # 0 rows reasonableness=0.5
    # schema=1.0 (0.3), exec=1.0 (0.3), reason=0.5 (0.1), ground=1.0 (0.2) -> 0.9.
    # Score 0.9 is HIGH, but 0-row cap applies, forcing it to MEDIUM.
    res = validate_execution(exec_res, schema, "search", grounding_score=1.0)
    assert res.confidence == ConfidenceLevel.MEDIUM
    assert res.answer_text is None

def test_validate_execution_failed_query():
    exec_res = ExecutionResult(success=False, error_message="Syntax Error", attempts_used=3)
    schema = ResolvedSchema(table_name="data_123", relevant_columns=[], full_schema_str="", schema_score=0.5)
    
    res = validate_execution(exec_res, schema, "aggregation", grounding_score=0.0)
    assert res.confidence == ConfidenceLevel.LOW
    assert res.confidence_score == 0.0

def test_validate_execution_grounding_failure():
    exec_res = ExecutionResult(success=True, data=[{"Amount": 50}], column_names=["Amount"], attempts_used=1, was_corrected=False)
    schema = ResolvedSchema(table_name="data_123", relevant_columns=[], full_schema_str="", schema_score=1.0)
    
    # Grounding fails (0.0). Schema=1.0 (0.3), Exec=1.0 (0.3), Reasonableness=1.0 (0.2), Ground=0.0 (0) -> 0.8 -> MEDIUM
    res = validate_execution(exec_res, schema, "aggregation", grounding_score=0.0)
    assert res.confidence == ConfidenceLevel.MEDIUM
    assert res.confidence_score < 0.85
