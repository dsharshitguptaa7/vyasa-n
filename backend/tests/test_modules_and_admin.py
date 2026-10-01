"""
Tests for Modular Monolith Veda boundaries, Admin Console, and Watchdog Telemetry.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_rig_veda_status_endpoint():
    res = client.get("/api/modules/rig-veda/status")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["data"]["veda_domain"] == "Research & Knowledge Creation"
    assert data["data"]["status"] == "planned"


def test_yajur_veda_status_endpoint():
    res = client.get("/api/modules/yajur-veda/status")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["data"]["veda_domain"] == "Research Administration & Incentives"
    assert data["data"]["status"] == "planned"


def test_sama_veda_status_endpoint():
    res = client.get("/api/modules/sama-veda/status")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["data"]["veda_domain"] == "Research Recognition & Communication"
    assert data["data"]["status"] == "planned"


def test_atharva_veda_nivaran_status_endpoint():
    res = client.get("/api/modules/atharva-veda/nivaran/status")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["data"]["veda_domain"] == "Grievance Redressal & Institutional Well-Being"
    assert data["data"]["status"] == "active"
    assert data["data"]["is_enabled"] is True


def test_watchdog_metrics_endpoint():
    res = client.get("/api/watchdog/metrics")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "pool_size" in data["data"]
    assert "db_healthy" in data["data"]


def test_admin_modules_requires_auth():
    res = client.get("/api/admin/modules")
    assert res.status_code == 401
