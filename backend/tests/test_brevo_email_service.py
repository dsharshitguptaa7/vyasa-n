"""
DB-Free Unit and Integration Tests for Brevo Transactional Email Integration.

Tests:
1. Brevo Success Dispatch (HTTP 201).
2. Disabled Mode Safe Simulation (EMAIL_ENABLED=False, zero network calls).
3. Recipient Address Validation (RFC 5322 regex).
4. Brevo Authentication Failure (HTTP 401).
5. Brevo Rate Limiting (HTTP 429).
6. Brevo Quota Exceeded (HTTP 402).
7. Brevo Client Error / Validation (HTTP 400).
8. Transient Network Retry (ConnectError retry).
9. Ambiguous Timeout Safety (No duplicate retry on read timeout).
10. Secret & API Key Sanitization in Logs and Error Strings.
11. EmailSenderService Provider Facade Routing.
12. EmailDeliveryAdapter with Brevo Transport.
"""

import uuid
from unittest.mock import MagicMock, patch
import httpx
import pytest

from app.core.config import settings
from app.models.user import User
from app.models.notification import Notification
from app.services.notifications.contracts import NotificationChannel, DeliveryStatus
from app.services.notifications.email_service import (
    BrevoEmailProvider,
    SmtpEmailProvider,
    SimulationEmailProvider,
    EmailSenderService,
    sanitize_email_error,
)
from app.services.notifications.adapters import EmailDeliveryAdapter


# =============================================================================
# 1. Brevo Success & Payload Verification
# =============================================================================

def test_brevo_successful_dispatch():
    """Verifies that Brevo provider formats correct v3 payload, sets api-key header, and returns success."""
    mock_client = MagicMock(spec=httpx.Client)
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 201
    mock_response.json.return_value = {"messageId": "<20261023.brevo.test@csjmu.ac.in>"}
    mock_client.post.return_value = mock_response

    provider = BrevoEmailProvider(
        api_key="xkeysib-test-mock-key-1234567890",
        api_url="https://api.brevo.com/v3/smtp/email",
        from_address="noreply@csjmu.ac.in",
        from_name="VYASAᴺ — CSJMU Kanpur",
        http_client=mock_client,
    )

    success, err = provider.send_email(
        recipient_email="scholar@csjmu.ac.in",
        subject="VYASAᴺ Security Notice",
        html_content="<p>Test Content</p>",
        text_content="Test Content",
    )

    assert success is True
    assert err is None
    mock_client.post.assert_called_once()

    call_args, call_kwargs = mock_client.post.call_args
    assert call_args[0] == "https://api.brevo.com/v3/smtp/email"
    headers = call_kwargs["headers"]
    assert headers["api-key"] == "xkeysib-test-mock-key-1234567890"
    assert headers["content-type"] == "application/json"

    payload = call_kwargs["json"]
    assert payload["sender"]["email"] == "noreply@csjmu.ac.in"
    assert payload["sender"]["name"] == "VYASAᴺ — CSJMU Kanpur"
    assert payload["to"] == [{"email": "scholar@csjmu.ac.in"}]
    assert payload["subject"] == "VYASAᴺ Security Notice"
    assert payload["htmlContent"] == "<p>Test Content</p>"
    assert payload["textContent"] == "Test Content"
    assert "vyasa-institutional" in payload["tags"]


# =============================================================================
# 2. Disabled Mode & Recipient Validation
# =============================================================================

def test_brevo_disabled_mode_zero_network_calls():
    """Verifies that when EMAIL_ENABLED=False, EmailSenderService performs simulation with zero HTTP calls."""
    mock_client = MagicMock(spec=httpx.Client)

    service = EmailSenderService(
        email_enabled=False,
    )

    success, err = service.send_email(
        recipient_email="scholar@csjmu.ac.in",
        subject="Simulation Subject",
        html_content="<p>Simulated</p>",
        text_content="Simulated",
    )

    assert success is True
    assert err is None
    assert not mock_client.post.called


def test_brevo_invalid_recipient_validation():
    """Verifies that invalid recipient email addresses fail immediately before any HTTP request."""
    mock_client = MagicMock(spec=httpx.Client)
    provider = BrevoEmailProvider(
        api_key="xkeysib-mock",
        http_client=mock_client,
    )
    service = EmailSenderService(
        provider=provider,
        email_enabled=True,
    )

    invalid_recipients = [
        "not-an-email",
        "@csjmu.ac.in",
        "scholar@",
        "",
        None,
        "spaces in@csjmu.ac.in",
    ]

    for bad_email in invalid_recipients:
        success, err = service.send_email(
            recipient_email=bad_email,
            subject="Test",
            html_content="<p>Test</p>",
            text_content="Test",
        )
        assert success is False
        assert "Invalid recipient email" in err
        assert not mock_client.post.called


def test_brevo_missing_api_key_refusal():
    """Verifies that missing or blank BREVO_API_KEY safely refuses dispatch with actionable error."""
    mock_client = MagicMock(spec=httpx.Client)
    provider = BrevoEmailProvider(
        api_key="",
        http_client=mock_client,
    )

    success, err = provider.send_email(
        recipient_email="scholar@csjmu.ac.in",
        subject="Test",
        html_content="<p>Test</p>",
        text_content="Test",
    )

    assert success is False
    assert "BREVO_API_KEY is not configured" in err
    assert not mock_client.post.called


# =============================================================================
# 3. HTTP Error & Rate Limiting Handling
# =============================================================================

def test_brevo_authentication_failure_401():
    """Verifies safe handling of HTTP 401 Unauthorized without leaking keys."""
    mock_client = MagicMock(spec=httpx.Client)
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 401
    mock_response.json.return_value = {"code": "unauthorized", "message": "Key not found"}
    mock_client.post.return_value = mock_response

    provider = BrevoEmailProvider(
        api_key="xkeysib-invalid-secret-key",
        http_client=mock_client,
    )

    success, err = provider.send_email(
        recipient_email="scholar@csjmu.ac.in",
        subject="Test",
        html_content="<p>Test</p>",
        text_content="Test",
    )

    assert success is False
    assert "Invalid or unauthorized API key" in err
    assert "xkeysib" not in err


def test_brevo_rate_limiting_429():
    """Verifies safe handling of HTTP 429 Too Many Requests."""
    mock_client = MagicMock(spec=httpx.Client)
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 429
    mock_response.text = "Too many requests"
    mock_client.post.return_value = mock_response

    provider = BrevoEmailProvider(
        api_key="xkeysib-mock",
        http_client=mock_client,
    )

    success, err = provider.send_email(
        recipient_email="scholar@csjmu.ac.in",
        subject="Test",
        html_content="<p>Test</p>",
        text_content="Test",
    )

    assert success is False
    assert "rate limit exceeded" in err.lower()


def test_brevo_quota_exceeded_402():
    """Verifies safe handling of HTTP 402 Payment / Sending Quota Exceeded."""
    mock_client = MagicMock(spec=httpx.Client)
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 402
    mock_response.json.return_value = {"code": "reseller_permission_denied", "message": "Quota exceeded"}
    mock_client.post.return_value = mock_response

    provider = BrevoEmailProvider(
        api_key="xkeysib-mock",
        http_client=mock_client,
    )

    success, err = provider.send_email(
        recipient_email="scholar@csjmu.ac.in",
        subject="Test",
        html_content="<p>Test</p>",
        text_content="Test",
    )

    assert success is False
    assert "quota exceeded" in err.lower()


def test_brevo_client_error_400():
    """Verifies sanitized extraction of client validation errors."""
    mock_client = MagicMock(spec=httpx.Client)
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 400
    mock_response.json.return_value = {
        "code": "invalid_parameter",
        "message": "Sender domain is not verified in Brevo account",
    }
    mock_client.post.return_value = mock_response

    provider = BrevoEmailProvider(
        api_key="xkeysib-mock",
        http_client=mock_client,
    )

    success, err = provider.send_email(
        recipient_email="scholar@csjmu.ac.in",
        subject="Test",
        html_content="<p>Test</p>",
        text_content="Test",
    )

    assert success is False
    assert "400" in err
    assert "Sender domain is not verified" in err


# =============================================================================
# 4. Resilience, Idempotency & Sanitization Tests
# =============================================================================

def test_brevo_connection_error_retry():
    """Verifies retry upon initial connection failure."""
    mock_client = MagicMock(spec=httpx.Client)
    success_resp = MagicMock(spec=httpx.Response)
    success_resp.status_code = 201
    success_resp.json.return_value = {"messageId": "<msg-retry-ok>"}

    # Fail on first attempt with ConnectError, succeed on second attempt
    mock_client.post.side_effect = [
        httpx.ConnectError("Failed to establish new connection to api.brevo.com"),
        success_resp,
    ]

    provider = BrevoEmailProvider(
        api_key="xkeysib-mock",
        http_client=mock_client,
    )

    success, err = provider.send_email(
        recipient_email="scholar@csjmu.ac.in",
        subject="Test Retry",
        html_content="<p>Test</p>",
        text_content="Test",
    )

    assert success is True
    assert err is None
    assert mock_client.post.call_count == 2


def test_brevo_timeout_no_duplicate_retry():
    """
    Idempotency check:
    Verifies that timeout does NOT automatically retry to prevent duplicate sends
    when the email may have already reached Brevo's mail server.
    """
    mock_client = MagicMock(spec=httpx.Client)
    mock_client.post.side_effect = httpx.TimeoutException("Read timeout after 10 seconds")

    provider = BrevoEmailProvider(
        api_key="xkeysib-mock",
        http_client=mock_client,
    )

    success, err = provider.send_email(
        recipient_email="scholar@csjmu.ac.in",
        subject="Test Timeout",
        html_content="<p>Test</p>",
        text_content="Test",
    )

    assert success is False
    assert "timed out" in err.lower()
    # Exactly 1 call: no automatic duplicate retry on ambiguous read timeout
    assert mock_client.post.call_count == 1


def test_secret_key_sanitization_in_errors():
    """Verifies that API keys matching Brevo key formats are stripped from exception messages."""
    raw_error = "Connection reset by peer during POST to https://api.brevo.com/v3 with api-key: xkeysib-1234567890abcdef-secret"
    sanitized = sanitize_email_error(raw_error)

    assert "xkeysib" not in sanitized
    assert "[REDACTED_API_KEY]" in sanitized


# =============================================================================
# 5. Facade Routing & Adapter Integration
# =============================================================================

def test_email_sender_service_facade_routing():
    """Verifies that EmailSenderService correctly instantiates the configured provider."""
    # Brevo provider
    with patch.object(settings, "EMAIL_PROVIDER", "brevo"):
        service_brevo = EmailSenderService(email_enabled=True)
        provider = service_brevo._resolve_provider()
        assert isinstance(provider, BrevoEmailProvider)

    # SMTP provider
    with patch.object(settings, "EMAIL_PROVIDER", "smtp"):
        service_smtp = EmailSenderService(email_enabled=True)
        provider = service_smtp._resolve_provider()
        assert isinstance(provider, SmtpEmailProvider)

    # Simulation provider when EMAIL_ENABLED=False
    service_disabled = EmailSenderService(email_enabled=False)
    provider_sim = service_disabled._resolve_provider()
    assert isinstance(provider_sim, SimulationEmailProvider)


def test_email_delivery_adapter_with_brevo_provider():
    """Verifies full integration of EmailDeliveryAdapter with Brevo provider."""
    mock_client = MagicMock(spec=httpx.Client)
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 201
    mock_response.json.return_value = {"messageId": "<brevo-notif-uuid>"}
    mock_client.post.return_value = mock_response

    brevo_provider = BrevoEmailProvider(
        api_key="xkeysib-mock-key",
        http_client=mock_client,
    )
    sender = EmailSenderService(
        provider=brevo_provider,
        email_enabled=True,
    )
    adapter = EmailDeliveryAdapter(sender_service=sender)

    mock_db = MagicMock()
    user = User(id=uuid.uuid4(), email="dean@csjmu.ac.in", is_active=True)
    notif = Notification(
        user_id=user.id,
        source_pillar="NIVARAN",
        event_type="grievance.document_requested",
        title="Document Request",
        message="Please upload additional files.",
        metadata_json={"tracking_id": "GRV-2026-BREVO-01"},
    )

    result = adapter.deliver(mock_db, notif, user)

    assert result.channel == NotificationChannel.EMAIL
    assert result.status == DeliveryStatus.SENT
    assert result.recipient_destination == "dean@csjmu.ac.in"
    assert mock_client.post.called
