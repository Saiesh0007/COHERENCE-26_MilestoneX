from fastapi.testclient import TestClient

from backend.api import app


client = TestClient(app)


def test_health_endpoint_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_trials_have_generated_text_when_missing():
    response = client.get("/trials")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0

    first = data[0]
    assert "inclusion_text" in first
    assert "exclusion_text" in first
    assert isinstance(first["inclusion_text"], str)
    assert isinstance(first["exclusion_text"], str)
    assert first["inclusion_text"].strip() != ""
    assert first["exclusion_text"].strip() != ""


def test_reset_demo_endpoint_returns_counts():
    response = client.post("/admin/reset-demo")
    assert response.status_code == 200
    payload = response.json()
    assert "message" in payload
    assert payload["total_patients"] > 0
    assert payload["total_trials"] > 0
