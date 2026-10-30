"""
Database-Free Unit Tests for Central Audit Service.
Verifies:
1. Structured audit log entry creation.
2. Mandatory non-empty identifier enforcement.
3. Recursive credential and secret sanitization in audit details.
4. Fail-closed behavior on database errors (raises AuditServiceError).
5. Fail-silent behavior when explicitly requested.
6. log_from_request client IP and User-Agent resolution.
"""

from unittest.mock import MagicMock
import uuid
import pytest

from app.models.audit import AuditLog
from app.services.audit_service import (
    CentralAuditService,
    AuditServiceError,
    sanitize_audit_details,
)


def test_sanitize_audit_details_masks_credentials():
    raw_details = {
        "user_email": "dean.research@csjmu.ac.in",
        "action_note": "Approved annual publication report",
        "password": "SuperSecretPassword123!",
        "api_key": "live_key_99887766",
        "nested": {
            "bearer_token": "eyJhbGciOi...",
            "totp_secret": "JBSWY3DPEHPK3PXP",
            "public_metric": 42,
        },
        "list_items": [
            {"auth_token": "secret_abc", "item_name": "Paper 1"},
            "plain_string",
        ],
    }

    sanitized = sanitize_audit_details(raw_details)

    assert sanitized["user_email"] == "dean.research@csjmu.ac.in"
    assert sanitized["action_note"] == "Approved annual publication report"
    assert sanitized["password"] == "[REDACTED]"
    assert sanitized["api_key"] == "[REDACTED]"
    assert sanitized["nested"]["bearer_token"] == "[REDACTED]"
    assert sanitized["nested"]["totp_secret"] == "[REDACTED]"
    assert sanitized["nested"]["public_metric"] == 42
    assert sanitized["list_items"][0]["auth_token"] == "[REDACTED]"
    assert sanitized["list_items"][0]["item_name"] == "Paper 1"
    assert sanitized["list_items"][1] == "plain_string"


def test_log_creates_audit_entry_with_sanitization():
    mock_db = MagicMock()
    user_id = uuid.uuid4()
    entity_id = uuid.uuid4()

    entry = CentralAuditService.log(
        db=mock_db,
        module="sama_veda",
        action="author.scopus_verified",
        entity_name="ResearchAuthor",
        entity_id=entity_id,
        actor_user_id=user_id,
        details={"scopus_id": "59650228300", "auth_secret": "my-secret"},
        ip_address="192.168.1.100",
        user_agent="Mozilla/5.0 Test",
        commit=False,
    )

    mock_db.add.assert_called_once()
    mock_db.flush.assert_called_once()

    assert isinstance(entry, AuditLog)
    assert entry.module == "sama_veda"
    assert entry.action == "author.scopus_verified"
    assert entry.entity_name == "ResearchAuthor"
    assert entry.entity_id == str(entity_id)
    assert entry.user_id == user_id
    assert entry.details["scopus_id"] == "59650228300"
    assert entry.details["auth_secret"] == "[REDACTED]"
    assert entry.ip_address == "192.168.1.100"
    assert entry.user_agent == "Mozilla/5.0 Test"


@pytest.mark.parametrize("bad_arg", ["", "   ", None])
def test_log_validates_mandatory_non_empty_identifiers(bad_arg):
    mock_db = MagicMock()
    with pytest.raises(ValueError):
        CentralAuditService.log(
            db=mock_db,
            module=bad_arg or "sama_veda",
            action="test.action" if bad_arg == "sama_veda" else bad_arg,
            entity_name="ResearchAuthor",
            entity_id=str(uuid.uuid4()),
        )


def test_log_fail_closed_on_database_error():
    """Verifies audit logging does not silently suppress exceptions during sensitive operations."""
    mock_db = MagicMock()
    mock_db.flush.side_effect = RuntimeError("Database connection broken")

    with pytest.raises(AuditServiceError) as exc_info:
        CentralAuditService.log(
            db=mock_db,
            module="sama_veda",
            action="certificate.revoked",
            entity_name="FelicitationCertificate",
            entity_id=str(uuid.uuid4()),
            fail_silent=False,
        )

    assert "Audit logging failed for sensitive operation" in str(exc_info.value)


def test_log_fail_silent_when_explicitly_requested():
    mock_db = MagicMock()
    mock_db.flush.side_effect = RuntimeError("Database connection broken")

    entry = CentralAuditService.log(
        db=mock_db,
        module="sama_veda",
        action="routine.view",
        entity_name="ResearchPublication",
        entity_id=str(uuid.uuid4()),
        fail_silent=True,
    )

    assert entry is not None
    assert entry.module == "sama_veda"


def test_log_from_request_extracts_headers():
    mock_db = MagicMock()
    mock_request = MagicMock()
    mock_request.client.host = "10.0.0.1"
    mock_request.headers.get.side_effect = lambda h: {
        "x-forwarded-for": "203.0.113.195, 10.0.0.1",
        "user-agent": "CustomBrowser/1.0",
    }.get(h.lower())

    entry = CentralAuditService.log_from_request(
        request=mock_request,
        db=mock_db,
        module="sama_veda",
        action="publication.created",
        entity_name="ResearchPublication",
        entity_id=str(uuid.uuid4()),
    )

    assert entry.ip_address == "203.0.113.195"
    assert entry.user_agent == "CustomBrowser/1.0"
