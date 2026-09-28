def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["service"] == "vyasa-core-backend"
    assert body["data"]["status"] == "healthy"
    assert "uptimeSeconds" in body["data"]


def test_database_health_endpoint(client):
    response = client.get("/api/health/db")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "connected"
    assert body["data"]["database"] == "postgresql"
    assert body["data"]["latency_ms"] is not None
    assert body["data"]["latency_ms"] >= 0


def test_root_status_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
