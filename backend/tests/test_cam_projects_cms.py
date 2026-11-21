"""
Regression Tests for CAM-AI Grants CMS:
1. Audit service Decimal JSON serialization safety.
2. Pydantic request/response schema aliases and bidirectional normalization.
3. Investigator format preservation (strings, dicts, mixed formats).
4. Transactional update safety and rollback behavior.
5. Listing filters for category and status aliases.
"""

from decimal import Decimal
import json
from unittest.mock import MagicMock
import uuid
import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.services.audit_service import audit_service
from app.modules.sama_veda.models.cam_project import CamAiProject
from app.modules.sama_veda.schemas.cms import (
    CamProjectCreate,
    CamProjectUpdate,
    CamProjectOut,
)
from app.modules.sama_veda.services.cms_service import sama_cms_service


def test_audit_service_decimal_sanitization():
    """Verify Decimal instances are converted to float to prevent JSON serialization errors."""
    details = {
        "title": "Autonomous Drone Surveillance",
        "funding_amount_inr": Decimal("750000.00"),
        "nested": {
            "tranche_1": Decimal("250000.50"),
            "notes": "Approved",
        },
        "co_investigators": [
            {"name": "Dr. Sharma", "allocation": Decimal("300000.00")},
        ],
    }

    sanitized = audit_service.sanitize_audit_details(details)

    # 1. Check types
    assert isinstance(sanitized["funding_amount_inr"], float)
    assert sanitized["funding_amount_inr"] == 750000.0
    assert isinstance(sanitized["nested"]["tranche_1"], float)
    assert sanitized["nested"]["tranche_1"] == 250000.50
    assert isinstance(sanitized["co_investigators"][0]["allocation"], float)

    # 2. psycopg / standard json.dumps must serialize without TypeError
    dumped = json.dumps(sanitized)
    assert "750000.0" in dumped
    assert "250000.5" in dumped


def test_cam_project_create_schema_normalization():
    """Verify frontend aliases and formats are normalized on project creation."""
    payload = {
        "project_title": "AI-Powered Smart Irrigation Systems",
        "category": "minor",  # Lowercase from frontend
        "status": "in_progress",  # Lowercase alias
        "funding_amount": 350000,  # Frontend alias
        "funding_amount_display": "₹3.5 Lakhs",
        "domain": "Agritech AI",
        "principal_investigator": "Dr. Rajesh Verma",  # Frontend string
        "co_investigators": ["Dr. Ananya Roy", "Dr. B. K. Singh"],  # String list
        "sanction_year": 2026,
    }

    create_obj = CamProjectCreate.model_validate(payload)

    # 1. Canonical titles
    assert create_obj.title == "AI-Powered Smart Irrigation Systems"
    assert create_obj.project_title == "AI-Powered Smart Irrigation Systems"

    # 2. Canonical category and status
    assert create_obj.category == "Minor"
    assert create_obj.status == "Ongoing"

    # 3. Canonical funding
    assert create_obj.funding_amount_inr == Decimal("350000")
    assert create_obj.funding_display == "₹3.5 Lakhs"

    # 4. Canonical investigators
    assert create_obj.principal_investigators == [{"name": "Dr. Rajesh Verma"}]
    assert create_obj.co_investigators == [
        {"name": "Dr. Ananya Roy"},
        {"name": "Dr. B. K. Singh"},
    ]


def test_cam_project_update_schema_normalization():
    """Verify update schema normalizes aliases and keeps omitted fields unset."""
    payload = {
        "funding_amount": 500000.0,
        "funding_amount_display": "₹5,00,000",
        "status": "awarded",
        "co_investigators": [
            {"name": "Dr. Ananya Roy", "department": "UIET"},
        ],
    }

    update_obj = CamProjectUpdate.model_validate(payload)

    assert update_obj.funding_amount_inr == Decimal("500000.0")
    assert update_obj.funding_display == "₹5,00,000"
    assert update_obj.status == "Sanctioned"
    assert update_obj.title is None  # Omitted fields are not overwritten
    assert update_obj.category is None
    assert update_obj.co_investigators == [
        {"name": "Dr. Ananya Roy", "department": "UIET"},
    ]


def test_cam_project_out_computed_aliases():
    """Verify response model returns canonical fields and backwards-compatible aliases."""
    project_db = CamAiProject(
        id=uuid.uuid4(),
        title="Federated Learning in Edge Networks",
        category="Major",
        domain="Edge Computing",
        principal_investigators=[{"name": "Dr. Deepa Sen", "department": "CSE"}],
        co_investigators=[{"name": "Dr. Amit Shah", "department": "ECE"}],
        funding_amount_inr=Decimal("1200000"),
        funding_display="₹12.0 Lakhs",
        status="Ongoing",
    )

    out = CamProjectOut.model_validate(project_db)

    # Canonical
    assert out.title == "Federated Learning in Edge Networks"
    assert out.funding_amount_inr == Decimal("1200000")
    assert out.funding_display == "₹12.0 Lakhs"

    # Convenience aliases
    assert out.project_title == "Federated Learning in Edge Networks"
    assert out.principal_investigator == "Dr. Deepa Sen"
    assert out.funding_amount == 1200000.0
    assert out.funding_amount_display == "₹12.0 Lakhs"


def test_update_cam_project_service_success_and_preservation():
    """Verify cms_service.update_cam_project updates fields, maps aliases, and commits."""
    mock_db = MagicMock()

    existing_project = CamAiProject(
        id=uuid.uuid4(),
        title="Original Title",
        category="Minor",
        domain="Healthcare AI",
        principal_investigators=[{"name": "Dr. Original PI", "department": "Bio"}],
        co_investigators=[{"name": "Dr. Original CoPI", "department": "ECE"}],
        funding_amount_inr=Decimal("200000"),
        funding_display="₹2.0 Lakhs",
        status="Ongoing",
    )

    payload = CamProjectUpdate.model_validate({
        "project_title": "Updated Healthcare AI Platform",
        "funding_amount": 400000,
        "funding_amount_display": "₹4.0 Lakhs",
        "principal_investigator": "Dr. Updated PI",
        "co_investigators": ["Dr. New CoPI"],
    })

    updated = sama_cms_service.update_cam_project(mock_db, existing_project, payload)

    # 1. Changes applied
    assert updated.title == "Updated Healthcare AI Platform"
    assert updated.funding_amount_inr == Decimal("400000")
    assert updated.funding_display == "₹4.0 Lakhs"
    assert updated.principal_investigators == [{"name": "Dr. Updated PI"}]
    assert updated.co_investigators == [{"name": "Dr. New CoPI"}]

    # 2. Unchanged fields preserved
    assert updated.category == "Minor"
    assert updated.domain == "Healthcare AI"

    # 3. DB commit and refresh called
    mock_db.commit.assert_called_once()
    mock_db.refresh.assert_called_once_with(existing_project)


def test_update_cam_project_service_rollback_on_failure():
    """Verify cms_service.update_cam_project rolls back transaction on error."""
    mock_db = MagicMock()
    mock_db.commit.side_effect = SQLAlchemyError("DB lock failure")

    existing_project = CamAiProject(
        id=uuid.uuid4(),
        title="Title",
        category="Major",
    )

    payload = CamProjectUpdate.model_validate({"title": "Failing Title"})

    with pytest.raises(SQLAlchemyError):
        sama_cms_service.update_cam_project(mock_db, existing_project, payload)

    mock_db.rollback.assert_called_once()
