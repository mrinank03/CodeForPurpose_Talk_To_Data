import requests
from src.api.dependencies import create_access_token

token = create_access_token({"sub": "e0af5e1d-dc06-444b-9f2e-72b50fee46b1", "email": "vishnu@g.com", "name": "Vishnu"})
headers = {"Authorization": f"Bearer {token}"}

res = requests.post("http://127.0.0.1:8000/api/query", headers=headers, json={
    "session_id": "05a06b8d-9d81-48bc-8c13-9b1e571273ee",
    "question": "Tell me the names of the students"
})
print(res.status_code, res.text)
