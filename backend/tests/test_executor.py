import os
import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
import sqlite3

# Mock out os.getenv for tests if needed, but since DATA_DB_DIR is used, we'll patch OS mapping
from src.agents.executor import execute_with_retry

@pytest.fixture
def mock_db_env(tmp_path):
    with patch("src.agents.executor.DATA_DB_DIR", str(tmp_path)):
        # Create a dummy session DB
        session_id = "test_session"
        db_path = str(tmp_path / f"{session_id}.db")
        conn = sqlite3.connect(db_path)
        conn.execute("CREATE TABLE test_data (id INTEGER, val TEXT)")
        conn.execute("INSERT INTO test_data VALUES (1, 'A'), (2, 'B')")
        conn.commit()
        conn.close()
        yield session_id

def test_executor_success(mock_db_env):
    res = execute_with_retry("Show everything", "SELECT * FROM test_data", mock_db_env, "TABLE test_data (id INTEGER, val TEXT)")
    assert res.success is True
    assert len(res.data) == 2
    assert res.data[0]["val"] == "A"

def test_executor_retry_logic(mock_db_env):
    # Trigger syntax error, mock LLM to fix it
    mock_llm = MagicMock()
    mock_llm.invoke.return_value.content = '{"sql": "SELECT * FROM test_data"}'
    
    with patch("src.agents.executor.get_sql_llm", return_value=mock_llm):
        res = execute_with_retry("fix me", "SELET * FROM test_data", mock_db_env, "TABLE test_data (id INTEGER, val TEXT)")
        assert res.success is True
        assert res.final_sql == "SELECT * FROM test_data"
