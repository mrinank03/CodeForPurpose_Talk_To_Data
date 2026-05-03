import requests
import os
from src.api.dependencies import create_access_token

token = create_access_token({"sub": "94a39d9b-5c32-42fc-a333-ab4ec7ce9d48", "email": "test@test.com", "name": "Test"})

# Just pass a fake session that is definitely in the DB
res = requests.post("http://127.0.0.1:8000/api/connectors/mirror", headers={"Authorization": f"Bearer {token}"}, json={
    "session_id": "6442709f-cf86-4250-b860-25a320e12ac3",
    "tables": ["test_table"]
})
print(res.status_code, res.text)
