import requests
from src.api.dependencies import create_access_token
import uuid

token = create_access_token({"sub": "94a39d9b-5c32-42fc-a333-ab4ec7ce9d48", "email": "mrinank.2003@gmail.com", "name": "Mrinank"})
headers = {"Authorization": f"Bearer {token}"}
session_id = str(uuid.uuid4())

print("Testing with session:", session_id)

# 1. connect_database
res = requests.post("http://127.0.0.1:8000/api/connectors/connect", headers=headers, json={
    "session_id": session_id,
    "connection_name": "Test DB",
    "db_type": "postgresql",
    "host": "localhost",
    "port": 5432,
    "database": "postgres",
    "username": "postgres",
    "password": "password"
})
print("Connect:", res.status_code)

# 2. mirror_tables
res = requests.post("http://127.0.0.1:8000/api/connectors/mirror", headers=headers, json={
    "session_id": session_id,
    "tables": ["public.test"]
})
print("Mirror:", res.status_code, res.text)
