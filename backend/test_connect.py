import requests

token = "NOT_NEEDED_FOR_DEBUG_SCRIPT" # I need a valid token to bypass auth

import os
from src.api.dependencies import create_access_token

token = create_access_token({"sub": "test@example.com", "id": "94a39d9b-5c32-42fc-a333-ab4ec7ce9d48"})

res = requests.post("http://127.0.0.1:8000/api/connectors/connect", headers={"Authorization": f"Bearer {token}"}, json={
    "session_id": "test-session-id-123",
    "connection_name": "Test DB",
    "db_type": "postgresql",
    "host": "localhost",
    "port": 5432,
    "database": "postgres",
    "username": "postgres",
    "password": "password"
})
print(res.status_code, res.text)
