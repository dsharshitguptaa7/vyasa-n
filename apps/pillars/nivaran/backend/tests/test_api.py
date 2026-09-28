"""Tests for API health endpoints and application routes."""

from fastapi.testclient import TestClient


def test_root_endpoint(client: TestClient) -> None:
    """Verify root / returns 200 and correct status payload."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "operational"
    assert data["pillar"] == "nivaran"
    assert data["ecosystem"] == "VYASA"


def test_root_health_check(client: TestClient) -> None:
    """Verify /health returns ok status and connected database."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"
    assert data["service"] == "vyasa-nivaran-backend"


def test_api_v1_health_check(client: TestClient) -> None:
    """Verify /api/v1/health returns ok status and connected database."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"
    assert data["service"] == "vyasa-nivaran-backend"


def test_openapi_docs(client: TestClient) -> None:
    """Verify Swagger UI and OpenAPI JSON endpoints are available."""
    response = client.get("/docs")
    assert response.status_code == 200

    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert "openapi" in schema
    assert schema["info"]["title"] == "VYASA NIVARAN Pillar API"
