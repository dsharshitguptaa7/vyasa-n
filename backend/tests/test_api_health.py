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


def test_openapi_schema_generation_includes_dean_dashboard(client):
    """
    Regression test for FastAPI /openapi.json schema generation.
    Ensures Pydantic TypeAdapter resolves datetime parameters in get_dean_dashboard
    without raising ForwardRef('datetime') errors.
    """
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert "paths" in schema

    # Dean dashboard endpoint presence
    dean_path = "/api/modules/atharva-veda/nivaran/dean/dashboard"
    assert dean_path in schema["paths"], f"Expected {dean_path} in openapi paths"
    get_op = schema["paths"][dean_path]["get"]

    # Parameter resolution
    params = {p["name"]: p for p in get_op.get("parameters", [])}
    assert "start_date" in params
    assert "end_date" in params

    # Date-time format validation
    start_date_schema_str = str(params["start_date"].get("schema", {}))
    assert "date-time" in start_date_schema_str

    end_date_schema_str = str(params["end_date"].get("schema", {}))
    assert "date-time" in end_date_schema_str

    # Dean dashboard cases ledger presence
    ledger_path = "/api/modules/atharva-veda/nivaran/dean/dashboard/cases"
    assert ledger_path in schema["paths"], f"Expected {ledger_path} in openapi paths"

