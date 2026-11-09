from fastapi.testclient import TestClient

from backend import main


client = TestClient(main.app)


def test_health_check_reports_missing_groq_configuration(monkeypatch):
    monkeypatch.setattr(main, "GROQ_API_KEY", "")

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "groqConfigured": False,
        "model": main.GROQ_MODEL,
    }


def test_topic_request_rejects_short_query():
    response = client.post(
        "/api/groq/explain-topic", json={"query": "hi", "language": "en"}
    )

    assert response.status_code == 400
    assert "too short" in response.json()["error"].lower()


def test_topic_request_returns_emergency_guidance_without_calling_groq(monkeypatch):
    monkeypatch.setattr(main, "GROQ_API_KEY", "")

    response = client.post(
        "/api/groq/explain-topic",
        json={"query": "I have severe chest pain", "language": "en"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "emergency"
    assert "112" in response.json()["content"]


def test_chat_alias_uses_the_same_safety_checks(monkeypatch):
    monkeypatch.setattr(main, "GROQ_API_KEY", "")

    response = client.post(
        "/api/groq/chat",
        json={"message": "What dose of amoxicillin should I take?", "language": "en"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "prescription_blocked"
    assert "cannot prescribe" in response.json()["content"].lower()


def test_report_request_returns_clear_error_when_groq_is_not_configured(monkeypatch):
    monkeypatch.setattr(main, "GROQ_API_KEY", "")

    response = client.post(
        "/api/groq/explain-report",
        json={
            "reportText": "Hemoglobin is 11.5 g/dL, reference range 12-16",
            "language": "en",
        },
    )

    assert response.status_code == 503
    assert "GROQ_API_KEY" in response.json()["error"]


def test_image_endpoint_rejects_data_that_does_not_match_its_mime_type():
    response = client.post(
        "/api/groq/image-to-text",
        json={"image": "data:image/jpeg;base64,SGVsbG8="},
    )

    assert response.status_code == 400
    assert "does not match" in response.json()["error"]


def test_image_endpoint_reports_missing_groq_configuration(monkeypatch):
    monkeypatch.setattr(main, "GROQ_API_KEY", "")

    response = client.post(
        "/api/groq/image-to-text",
        json={"image": "data:image/jpeg;base64,/9j/AAE="},
    )

    assert response.status_code == 503
    assert "GROQ_API_KEY" in response.json()["error"]


def test_image_endpoint_rejects_oversized_images():
    response = client.post(
        "/api/groq/image-to-text",
        json={"image": "x" * (main.MAX_IMAGE_DATA_URL_LENGTH + 1)},
    )

    assert response.status_code == 413
    assert "too large" in response.json()["error"].lower()
