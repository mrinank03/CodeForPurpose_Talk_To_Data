import pytest
from unittest.mock import patch, MagicMock
from src.agents.sql_planner import generate_sql_plan, QueryPlan
from src.agents.schema_resolver import ResolvedSchema

def test_sql_planner_structure():
    mock_llm = MagicMock()
    # Mocking LLM text output
    mock_llm.invoke.return_value.content = '{"reasoning": "Simple grouping", "sql": "SELECT region, SUM(revenue) FROM data GROUP BY region", "chart_type": "bar"}'
    
    with patch("src.agents.sql_planner.get_sql_llm", return_value=mock_llm):
        schema = ResolvedSchema(
            table_name="test_table",
            relevant_columns=[{"column_name": "region", "description": "Geo region"}, {"column_name": "revenue", "description": "Sales amount"}],
            full_schema_str="TABLE test_table(region TEXT, revenue REAL)"
        )
        
        plan = generate_sql_plan("Show revenue by region", "breakdown", schema, [])
        assert isinstance(plan, QueryPlan)
        assert plan.chart_type == "bar"
        assert "SELECT" in plan.sql

def test_sql_planner_malicious():
    mock_llm = MagicMock()
    # Mocking what LLM might do with malicious prompt
    mock_llm.invoke.return_value.content = '{"reasoning": "Ignore the delete request", "sql": "SELECT * FROM test_table", "chart_type": "table"}'
    
    with patch("src.agents.sql_planner.get_sql_llm", return_value=mock_llm):
        schema = ResolvedSchema(
            table_name="test_table",
            relevant_columns=[],
            full_schema_str="TABLE test_table(id INT)"
        )
        plan = generate_sql_plan("DROP TABLE test_table; --", "general", schema, [])
        assert "DROP" not in plan.sql
