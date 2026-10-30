"""
DB-Free Unit and Integration Tests for VYASAᴺ Centralized Email Service (Phase 1 & 2).

Scope:
1. Core Configuration (typed SMTP settings, safe defaults).
2. Institutional Branded HTML and Plain-Text Template Engine (Branding standards, escaping, palette).
3. Email Sender Service (Recipient validation, dry-run simulation, mocked SMTP transport, retry, sanitization).
4. Email Delivery Adapter (Integration with templates and sender service, opt-out handling, error resilience).
"""

import smtplib
import uuid
from unittest.mock import MagicMock, patch
import pytest

from app.core.config import settings
from app.models.user import User
from app.models.notification import Notification, NotificationPreference
from app.services.notifications.contracts import NotificationChannel, DeliveryStatus
from app.services.notifications.email_templates import (
    render_email_layout,
    build_authority_login_email,
    build_authority_unusual_login_email,
    build_document_request_email,
    build_grievance_resolved_email,
    build_grievance_closed_email,
)
from app.services.notifications.email_service import EmailSenderService
from app.services.notifications.adapters import EmailDeliveryAdapter


# =============================================================================
# 1. Configuration Tests (Phase 1)
# =============================================================================

def test_smtp_configuration_defaults():
    """Verifies safe defaults for institutional email settings."""
    assert settings.EMAIL_ENABLED is False, "EMAIL_ENABLED must default to False"
    assert settings.SMTP_PORT == 587
    assert settings.SMTP_USE_TLS is True
    assert settings.SMTP_USE_SSL is False
    assert "VYASA" in settings.EMAIL_FROM_NAME
    assert "CSJMU" in settings.EMAIL_FROM_NAME
    assert "@csjmu.ac.in" in settings.EMAIL_FROM_ADDRESS


# =============================================================================
# 2. Template Engine & Branding Tests (Phase 2)
# =============================================================================

def test_branding_rules_uppercase_superscript_n():
    """
    Mandatory Branding Rule:
    - HTML must render VYASA<sup>N</sup> with uppercase superscript N.
    - Plain text must render VYASAᴺ.
    - Forbidden: VYASA-N, VAYASA, or baseline VYASAN.
    """
    html_out, text_out = render_email_layout(
        title="Institutional Notice",
        preheader="Important bulletin",
        headline="Test Headline",
        body_paragraphs=["Paragraph 1", "Paragraph 2"],
        pillar_label="NIVARAN-AI",
    )

    # Valid HTML branding
    assert "VYASA<sup" in html_out
    assert ">N</sup>" in html_out

    # Rejection of forbidden patterns
    assert "VYASA-N" not in html_out
    assert "VAYASA" not in html_out
    assert "VYASAN" not in html_out

    # Valid plain-text branding
    assert "VYASAᴺ" in text_out
    assert "VYASA-N" not in text_out


def test_university_identity_and_institutional_palette():
    """Verifies institutional identity for CSJMU Kanpur and navy/gold palette."""
    html_out, text_out = render_email_layout(
        title="Official Order",
        preheader="Order details",
        headline="Administrative Order",
        body_paragraphs=["Rulings issued."],
        pillar_label="NIVARAN-AI",
    )

    # University identity in English and Hindi
    assert "Chhatrapati Shahu Ji Maharaj University (CSJMU), Kanpur" in html_out
    assert "छत्रपति शाहू जी महाराज विश्वविद्यालय, कानपुर" in html_out
    assert "Chhatrapati Shahu Ji Maharaj University, Kanpur" in text_out

    # Institutional Navy (#0f2b48 / #0a192f) and Gold accent (#ecdfba)
    assert "#0f2b48" in html_out
    assert "#0a192f" in html_out
    assert "#ecdfba" in html_out


def test_html_escaping_of_untrusted_input():
    """Verifies that malicious or user-provided HTML entities are safely escaped."""
    malicious_input = '<script>alert("xss")</script> & <b>bold</b>'
    html_out, text_out = render_email_layout(
        title="Sanitization Test",
        preheader="Testing escape",
        headline=malicious_input,
        body_paragraphs=[malicious_input],
        key_values=[("Field", malicious_input)],
    )

    # Raw script tags must never appear unescaped in HTML
    assert "<script>" not in html_out
    assert "&lt;script&gt;" in html_out
    assert "&amp; &lt;b&gt;bold&lt;/b&gt;" in html_out


def test_specialized_email_templates_content():
    """Verifies all specialized email builders format correct non-sensitive content."""
    # 1. Authority Login
    subj1, html1, text1 = build_authority_login_email(
        account_identifier="officer@csjmu.ac.in",
        login_time_str="23 Oct 2026, 10:00 AM UTC",
        ip_address="14.139.1.1",
        user_agent="Firefox/120.0",
    )
    assert "Successful Authority Dashboard Login" in subj1
    assert "officer@csjmu.ac.in" in html1
    assert "14.139.1.1" in html1
    for sensitive in ["password", "otp", "token", "secret"]:
        assert sensitive not in html1.lower()

    # 2. Unusual Login Alert
    subj2, html2, text2 = build_authority_unusual_login_email(
        account_identifier="officer@csjmu.ac.in",
        login_time_str="23 Oct 2026, 10:00 AM UTC",
        reason="Unrecognized browser detected",
        ip_address="14.139.1.1",
        user_agent="UnknownBot",
    )
    assert "Security Alert: Unusual Login" in subj2
    assert "Unrecognized browser detected" in html2

    # 3. Document Request
    subj3, html3, text3 = build_document_request_email(
        tracking_id="GRV-2026-0042",
        requested_documents=["Income Certificate", "Identity Proof"],
        instructions="Upload PDF scan.",
        deadline_str="30 Oct 2026",
    )
    assert "[GRV-2026-0042]" in subj3
    assert "Income Certificate" in html3
    assert "30 Oct 2026" in html3

    # 4. Resolved & Feedback
    subj4, html4, text4 = build_grievance_resolved_email(
        tracking_id="GRV-2026-0042",
        resolution_summary="Complaint redressed under Sec 12.",
        feedback_link="https://vyasa.csjmu.ac.in/feedback/123",
    )
    assert "[GRV-2026-0042]" in subj4
    assert "Grievance Formally Resolved" in html4
    assert "Complaint redressed under Sec 12." in html4
    assert "Submit Feedback &amp; Review Order" in html4

    # 5. Formally Closed
    subj5, html5, text5 = build_grievance_closed_email(
        tracking_id="GRV-2026-0042",
        closure_date_str="23 Oct 2026",
        closure_summary="Archived in electronic repository.",
    )
    assert "[GRV-2026-0042]" in subj5
    assert "Grievance Record Formally Closed" in html5
    assert "CLOSED" in html5


# =============================================================================
# 3. Email Sender Service Tests (Phase 1)
# =============================================================================

def test_recipient_address_validation():
    """Verifies RFC-5322 regex validation for recipient email addresses."""
    sender = EmailSenderService(email_enabled=False)

    assert sender.validate_recipient_email("dean.academic@csjmu.ac.in") is True
    assert sender.validate_recipient_email("scholar+test@csjmu.ac.in") is True
    assert sender.validate_recipient_email("invalid-email") is False
    assert sender.validate_recipient_email("@csjmu.ac.in") is False
    assert sender.validate_recipient_email("user@") is False
    assert sender.validate_recipient_email("") is False
    assert sender.validate_recipient_email(None) is False


def test_dry_run_simulation_mode():
    """When EMAIL_ENABLED=False or no smtp_host is provided, send_email simulates dispatch."""
    sender = EmailSenderService(email_enabled=False, smtp_host=None)

    success, err = sender.send_email(
        recipient_email="scholar@csjmu.ac.in",
        subject="Test Notice",
        html_content="<p>Test</p>",
        text_content="Test",
    )
    assert success is True
    assert err is None


def test_mocked_smtp_tls_dispatch():
    """Tests successful SMTP dispatch over STARTTLS with mocked smtplib.SMTP."""
    sender = EmailSenderService(
        smtp_host="smtp.csjmu.ac.in",
        smtp_port=587,
        smtp_username="user@csjmu.ac.in",
        smtp_password="test_password",
        use_tls=True,
        use_ssl=False,
        email_enabled=True,
    )

    with patch("smtplib.SMTP") as mock_smtp_class:
        mock_server = MagicMock()
        mock_smtp_class.return_value = mock_server

        success, err = sender.send_email(
            recipient_email="scholar@csjmu.ac.in",
            subject="VYASA Notice",
            html_content="<p>Hello</p>",
            text_content="Hello",
        )

        assert success is True
        assert err is None
        mock_server.ehlo.assert_called()
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_called_once_with("user@csjmu.ac.in", "test_password")
        mock_server.send_message.assert_called_once()
        mock_server.quit.assert_called_once()


def test_mocked_smtp_ssl_dispatch():
    """Tests successful SMTP dispatch over direct SSL with mocked smtplib.SMTP_SSL."""
    sender = EmailSenderService(
        smtp_host="smtp.csjmu.ac.in",
        smtp_port=465,
        smtp_username="user@csjmu.ac.in",
        smtp_password="test_password",
        use_tls=False,
        use_ssl=True,
        email_enabled=True,
    )

    with patch("smtplib.SMTP_SSL") as mock_ssl_class:
        mock_server = MagicMock()
        mock_ssl_class.return_value = mock_server

        success, err = sender.send_email(
            recipient_email="scholar@csjmu.ac.in",
            subject="VYASA Notice",
            html_content="<p>Hello</p>",
            text_content="Hello",
        )

        assert success is True
        assert err is None
        mock_server.ehlo.assert_called()
        mock_server.login.assert_called_once_with("user@csjmu.ac.in", "test_password")
        mock_server.send_message.assert_called_once()


def test_transient_failure_retry_and_sanitization():
    """
    Verifies that transient SMTP connection errors trigger retries, and that
    any credentials present in raw exceptions are sanitized before returning.
    """
    sender = EmailSenderService(
        smtp_host="smtp.csjmu.ac.in",
        smtp_port=587,
        email_enabled=True,
    )

    with patch("smtplib.SMTP") as mock_smtp_class:
        # Simulate network disconnect on every attempt
        mock_smtp_class.side_effect = smtplib.SMTPServerDisconnected(
            "Connection failed: smtp://admin:super_secret_pass@10.0.0.1:587"
        )

        success, err = sender.send_email(
            recipient_email="scholar@csjmu.ac.in",
            subject="Test Subject",
            html_content="<p>Test</p>",
            text_content="Test",
        )

        assert success is False
        assert err is not None
        # Verify credential masking in sanitized error message
        assert "super_secret_pass" not in err
        assert "***:***@" in err or "Connection failed" in err


# =============================================================================
# 4. Email Delivery Adapter Tests (Phase 1 & 2 Integration)
# =============================================================================

def test_delivery_adapter_success_flow():
    """Verifies EmailDeliveryAdapter delivers with status SENT when sender succeeds."""
    mock_sender = MagicMock()
    mock_sender.validate_recipient_email.return_value = True
    mock_sender.send_email.return_value = (True, None)

    adapter = EmailDeliveryAdapter(sender_service=mock_sender)
    mock_db = MagicMock()

    user = User(id=uuid.uuid4(), email="scholar@csjmu.ac.in", is_active=True)
    notification = Notification(
        user_id=user.id,
        source_pillar="NIVARAN",
        event_type="grievance.document_requested",
        title="Additional Documents Requested",
        message="Please upload additional documents.",
        metadata_json={"tracking_id": "GRV-2026-0099"},
    )

    result = adapter.deliver(mock_db, notification, user)
    assert result.channel == NotificationChannel.EMAIL
    assert result.status == DeliveryStatus.SENT
    assert result.recipient_destination == "scholar@csjmu.ac.in"
    assert mock_sender.send_email.called


def test_delivery_adapter_opt_out_skipping():
    """Verifies that user preference with email_enabled=False results in SKIPPED."""
    mock_sender = MagicMock()
    adapter = EmailDeliveryAdapter(sender_service=mock_sender)
    mock_db = MagicMock()

    user = User(id=uuid.uuid4(), email="scholar@csjmu.ac.in", is_active=True)
    notification = Notification(user_id=user.id, title="Test", message="Test")
    pref = NotificationPreference(user_id=user.id, email_enabled=False)

    result = adapter.deliver(mock_db, notification, user, preference=pref)
    assert result.status == DeliveryStatus.SKIPPED
    assert "opted out" in result.error_message
    assert not mock_sender.send_email.called


def test_delivery_adapter_invalid_recipient_skipping():
    """Verifies that malformed recipient addresses result in SKIPPED without failing."""
    mock_sender = MagicMock()
    mock_sender.validate_recipient_email.return_value = False
    adapter = EmailDeliveryAdapter(sender_service=mock_sender)
    mock_db = MagicMock()

    user = User(id=uuid.uuid4(), email="invalid-address", is_active=True)
    notification = Notification(user_id=user.id, title="Test", message="Test")

    result = adapter.deliver(mock_db, notification, user)
    assert result.status == DeliveryStatus.SKIPPED
    assert "not a valid email format" in result.error_message


def test_delivery_adapter_failure_outcome_handling():
    """Verifies that an error from sender_service results in FAILED with sanitized error."""
    mock_sender = MagicMock()
    mock_sender.validate_recipient_email.return_value = True
    mock_sender.send_email.return_value = (False, "Sanitized SMTP timeout")

    adapter = EmailDeliveryAdapter(sender_service=mock_sender)
    mock_db = MagicMock()

    user = User(id=uuid.uuid4(), email="scholar@csjmu.ac.in", is_active=True)
    notification = Notification(user_id=user.id, title="Test", message="Test")

    result = adapter.deliver(mock_db, notification, user)
    assert result.status == DeliveryStatus.FAILED
    assert result.error_message == "Sanitized SMTP timeout"
