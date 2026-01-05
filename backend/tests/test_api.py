from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

def test_calc_and_history():
    r = client.delete("/api/history")
    assert r.status_code == 200

    r = client.post("/api/calc", json={"a": 2, "b": 3, "op": "+"})
    assert r.status_code == 200
    data = r.json()
    assert data["result"] == 5

    r = client.get("/api/history?limit=10")
    assert r.status_code == 200
    hist = r.json()
    assert len(hist) >= 1
    assert hist[0]["op"] == "+"
    assert hist[0]["result"] == 5

def test_division_by_zero():
    r = client.post("/api/calc", json={"a": 1, "b": 0, "op": "/"})
    assert r.status_code == 400
    assert "Division by zero" in r.text
