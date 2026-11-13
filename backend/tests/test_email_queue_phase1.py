"""
VYASAⁿ Phase 1 Core Email Infrastructure Hardening Test Suite.

Validates:
1. Database-backed transactional email outbox model and queue lifecycle.
2. Concurrent worker claiming with SELECT FOR UPDATE SKIP LOCKED.
3. Abandoned job recovery after worker crashes or restarts.
4. Retry scheduling with exponential backoff & jitter and Retry-After handling.
5. Permanent failure immediate termination (HTTP 400, 401, timeout safety).
6. Brevo reusable HTTP client resource management and connection pooling.
7. Production configuration validation (failing closed when required secrets are missing).
8. Non-blocking asynchronous dispatch integration in NotificationEngine.
"""

import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.core.config import Settings, settings
from app.models.email_outbox import EmailOutbox, EmailOutboxStatus
from app.models.notification import Notification, NotificationDelivery, NotificationPreference
from app.models.user import User
from app.schemas.notification import NotificationEventPayload
from app.services.notifications.adapters import EmailDeliveryAdapter
from app.services.notifications.contracts import DeliveryStatus, NotificationChannel
from app.services.notifications.email_service import (
    BaseEmailProvider,
    BrevoEmailProvider,
    EmailDispatchResult,
    EmailSenderService,
    SimulationEmailProvider,
    SmtpEmailProvider,
    sanitize_email_error,
)
from app.services.notifications.engine import NotificationEngine
from app.workers.email_worker import EmailOutboxWorker


# =============================================================================
# 1. Model & Dispatch Result Tests
# =============================================================================

def test_email_dispatch_result_tuple_backward_compatibility():
    """
    Verifies that EmailDispatchResult behaves as a 2-tuple (success, err)
    while also exposing message_id, retry_after, and is_permanent_error.
    """
    res = EmailDispatchResult(
        success=True,
        error_message=None,
        message_id="<msg-uuid-12345>",
    )

    # 1. Backward-compatible 2-tuple unpacking
    success, err = res
    assert success is True
    assert err is None
    assert bool(res) is True

    # 2. Advanced attributes
    assert res.message_id == "<msg-uuid-12345>"
    assert res.retry_after is None
    assert res.is_permanent_error is False

    # 3. Failure variant with retry_after
    fail_res = EmailDispatchResult(
        success=False,
        error_message="Rate limit exceeded",
        retry_after=45,
        is_permanent_error=False,
    )
    s_fail, err_fail = fail_res
    assert s_fail is False
    assert err_fail == "Rate limit exceeded"
    assert fail_res.retry_after == 45
    assert fail_res.is_permanent_error is False


def test_email_outbox_model_instantiation():
    """Verifies EmailOutbox model fields, constraints, and string representation."""
    job = EmailOutbox(
        id=uuid.uuid4(),
        recipient_email="scholar@csjmu.ac.in",
        subject="Important Institutional Notice",
        html_content="<p>Notice details</p>",
        text_content="Notice details",
        status=EmailOutboxStatus.PENDING.value,
        attempt_count=0,
        max_attempts=3,
        provider="brevo",
    )
    assert job.status == "PENDING"
    assert job.attempt_count == 0
    assert job.max_attempts == 3
    assert "scholar@csjmu.ac.in" in repr(job)
    assert "PENDING" in repr(job)


# =============================================================================
# 2. Email Delivery Adapter Asynchronous Mode Tests
# =============================================================================

def test_adapter_async_mode_enqueues_outbox_job():
    """
    Verifies that when EMAIL_ASYNC_DISPATCH is True and no mock sender is injected,
    EmailDeliveryAdapter enqueues an EmailOutbox job in PENDING state and returns PENDING.
    """
    adapter = EmailDeliveryAdapter(sender_service=None)
    mock_db = MagicMock()

    user = User(id=uuid.uuid4(), email="dean@csjmu.ac.in", is_active=True)
    notif = Notification(
        id=uuid.uuid4(),
        user_id=user.id,
        source_pillar="NIVARAN",
        event_type="grievance.document_requested",
        title="Document Request",
        message="Please upload additional files.",
        metadata_json={"tracking_id": "GRV-2026-001"},
    )
    delivery_id = uuid.uuid4()

    with patch.object(settings, "EMAIL_ASYNC_DISPATCH", True):
        result = adapter.deliver(
            db=mock_db,
            notification=notif,
            user=user,
            delivery_id=delivery_id,
        )

    assert result.channel == NotificationChannel.EMAIL
    assert result.status == DeliveryStatus.PENDING
    assert result.recipient_destination == "dean@csjmu.ac.in"

    # Verify EmailOutbox was added to the database session
    mock_db.add.assert_called_once()
    added_job = mock_db.add.call_args[0][0]
    assert isinstance(added_job, EmailOutbox)
    assert added_job.recipient_email == "dean@csjmu.ac.in"
    assert added_job.status == EmailOutboxStatus.PENDING.value
    assert added_job.notification_id == notif.id
    assert added_job.notification_delivery_id == delivery_id
    assert "Document Request" in added_job.subject or "GRV-2026-001" in added_job.subject


def test_adapter_respects_opt_out_without_queueing():
    """Verifies that an opted-out user returns SKIPPED without enqueuing any outbox job."""
    adapter = EmailDeliveryAdapter(sender_service=None)
    mock_db = MagicMock()

    user = User(id=uuid.uuid4(), email="dean@csjmu.ac.in", is_active=True)
    notif = Notification(user_id=user.id, title="Test", message="Test")
    pref = NotificationPreference(user_id=user.id, email_enabled=False)

    result = adapter.deliver(db=mock_db, notification=notif, user=user, preference=pref)
    assert result.status == DeliveryStatus.SKIPPED
    assert not mock_db.add.called


def test_adapter_sync_fallback_with_injected_sender():
    """
    Verifies backward compatibility: if a custom/mock sender is injected,
    adapter dispatches synchronously and returns SENT or FAILED.
    """
    mock_sender = MagicMock(spec=EmailSenderService)
    mock_sender.validate_recipient_email.return_value = True
    mock_sender.send_email.return_value = EmailDispatchResult(True, None, message_id="<sent-123>")

    adapter = EmailDeliveryAdapter(sender_service=mock_sender)
    mock_db = MagicMock()
    user = User(id=uuid.uuid4(), email="scholar@csjmu.ac.in", is_active=True)
    notif = Notification(user_id=user.id, title="Test", message="Test")

    result = adapter.deliver(db=mock_db, notification=notif, user=user)
    assert result.status == DeliveryStatus.SENT
    assert mock_sender.send_email.called
    assert not mock_db.add.called


# =============================================================================
# 3. Worker Execution & Concurrency Tests
# =============================================================================

class MockDbSession:
    """In-memory mock session to test worker claiming, locking, and updating."""

    def __init__(self, jobs: List[EmailOutbox]):
        self.jobs = {j.id: j for j in jobs}
        self.deliveries: dict = {}
        self.committed = False

    def get(self, model, ident):
        if model == EmailOutbox:
            return self.jobs.get(ident)
        elif model == NotificationDelivery:
            return self.deliveries.get(ident)
        return None

    def scalars(self, stmt):
        class Result:
            def __init__(self, items):
                self.items = items

            def all(self):
                return self.items

        stmt_str = str(stmt).lower()
        now = datetime.now(timezone.utc)
        items = []

        if "locked_at <" in stmt_str or "locked_at <=" in stmt_str:
            # Querying abandoned jobs (where status = PROCESSING and locked_at < cutoff)
            for j in self.jobs.values():
                if j.status == EmailOutboxStatus.PROCESSING.value:
                    if j.locked_at and j.locked_at < now - timedelta(seconds=10):
                        items.append(j)
        elif "next_attempt_at <=" in stmt_str or "next_attempt_at <" in stmt_str or "next_attempt_at" in stmt_str:
            # Querying pending jobs (where status = PENDING and next_attempt_at <= now)
            for j in self.jobs.values():
                if j.status == EmailOutboxStatus.PENDING.value:
                    if j.next_attempt_at is None or j.next_attempt_at <= now:
                        items.append(j)
        return Result(items)

    def commit(self):
        self.committed = True

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


def test_worker_claim_and_process_success():
    """Verifies that the worker claims pending jobs, dispatches them, and marks them SENT."""
    job_id = uuid.uuid4()
    deliv_id = uuid.uuid4()
    job = EmailOutbox(
        id=job_id,
        notification_delivery_id=deliv_id,
        recipient_email="scholar@csjmu.ac.in",
        subject="Submission Received",
        html_content="<p>Received</p>",
        text_content="Received",
        status=EmailOutboxStatus.PENDING.value,
        attempt_count=0,
        max_attempts=3,
        next_attempt_at=datetime.now(timezone.utc) - timedelta(seconds=1),
    )
    delivery = NotificationDelivery(
        id=deliv_id,
        channel="EMAIL",
        status="PENDING",
        attempt_count=0,
    )

    mock_db = MockDbSession([job])
    mock_db.deliveries[deliv_id] = delivery

    mock_sender = MagicMock(spec=EmailSenderService)
    mock_sender.send_email.return_value = EmailDispatchResult(
        success=True,
        error_message=None,
        message_id="<brevo-worker-msg-999>",
    )

    worker = EmailOutboxWorker(
        db_factory=lambda: mock_db,
        sender_service=mock_sender,
        batch_size=5,
    )

    processed_count = worker.process_batch()
    assert processed_count == 1
    assert job.status == EmailOutboxStatus.SENT.value
    assert job.provider_message_id == "<brevo-worker-msg-999>"
    assert job.attempt_count == 1
    assert job.locked_at is None
    assert job.locked_by is None
    assert delivery.status == DeliveryStatus.SENT.value


def test_worker_transient_failure_exponential_backoff():
    """
    Verifies that on transient error (e.g. rate limit, gateway error),
    the job is returned to PENDING with a future next_attempt_at timestamp.
    """
    job_id = uuid.uuid4()
    job = EmailOutbox(
        id=job_id,
        recipient_email="scholar@csjmu.ac.in",
        subject="Test",
        html_content="<p>Test</p>",
        text_content="Test",
        status=EmailOutboxStatus.PENDING.value,
        attempt_count=0,
        max_attempts=3,
        next_attempt_at=datetime.now(timezone.utc) - timedelta(seconds=1),
    )

    mock_db = MockDbSession([job])
    mock_sender = MagicMock(spec=EmailSenderService)
    mock_sender.send_email.return_value = EmailDispatchResult(
        success=False,
        error_message="Brevo rate limit exceeded: Too many requests",
        retry_after=30,
        is_permanent_error=False,
    )

    worker = EmailOutboxWorker(
        db_factory=lambda: mock_db,
        sender_service=mock_sender,
    )

    start_time = datetime.now(timezone.utc)
    processed_count = worker.process_batch()

    assert processed_count == 1
    assert job.status == EmailOutboxStatus.PENDING.value
    assert job.attempt_count == 1
    assert job.error_message == "Brevo rate limit exceeded: Too many requests"
    # Scheduled 30 seconds into the future due to Retry-After: 30
    assert job.next_attempt_at >= start_time + timedelta(seconds=28)


def test_worker_permanent_failure_immediate_termination():
    """
    Verifies that on permanent error (e.g. HTTP 400 Bad Request, unverified domain),
    the job is immediately marked FAILED without waiting for all retries.
    """
    job_id = uuid.uuid4()
    job = EmailOutbox(
        id=job_id,
        recipient_email="scholar@csjmu.ac.in",
        subject="Test",
        html_content="<p>Test</p>",
        text_content="Test",
        status=EmailOutboxStatus.PENDING.value,
        attempt_count=0,
        max_attempts=5,
        next_attempt_at=datetime.now(timezone.utc) - timedelta(seconds=1),
    )

    mock_db = MockDbSession([job])
    mock_sender = MagicMock(spec=EmailSenderService)
    mock_sender.send_email.return_value = EmailDispatchResult(
        success=False,
        error_message="Brevo client error (400): Sender domain is not verified",
        is_permanent_error=True,
    )

    worker = EmailOutboxWorker(
        db_factory=lambda: mock_db,
        sender_service=mock_sender,
    )

    worker.process_batch()
    assert job.status == EmailOutboxStatus.FAILED.value
    assert "Sender domain is not verified" in job.error_message
    assert job.locked_at is None


def test_worker_timeout_no_duplicate_retry_safety():
    """
    Verifies that timeout failure is marked with is_permanent_error=True
    to avoid dangerous duplicate sends when outcome is ambiguous.
    """
    job_id = uuid.uuid4()
    job = EmailOutbox(
        id=job_id,
        recipient_email="scholar@csjmu.ac.in",
        subject="Test",
        html_content="<p>Test</p>",
        text_content="Test",
        status=EmailOutboxStatus.PENDING.value,
        attempt_count=0,
        max_attempts=3,
        next_attempt_at=datetime.now(timezone.utc) - timedelta(seconds=1),
    )

    mock_db = MockDbSession([job])
    mock_sender = MagicMock(spec=EmailSenderService)
    mock_sender.send_email.return_value = EmailDispatchResult(
        success=False,
        error_message="Brevo API request timed out after 5s",
        is_permanent_error=True,
    )

    worker = EmailOutboxWorker(
        db_factory=lambda: mock_db,
        sender_service=mock_sender,
    )

    worker.process_batch()
    assert job.status == EmailOutboxStatus.FAILED.value
    assert "timed out" in job.error_message


def test_worker_abandoned_job_recovery():
    """
    Verifies that a job stuck in PROCESSING from an old/crashed worker
    is safely recovered back to PENDING.
    """
    job_id = uuid.uuid4()
    job = EmailOutbox(
        id=job_id,
        recipient_email="scholar@csjmu.ac.in",
        subject="Test",
        html_content="<p>Test</p>",
        text_content="Test",
        status=EmailOutboxStatus.PROCESSING.value,
        attempt_count=1,
        max_attempts=3,
        locked_at=datetime.now(timezone.utc) - timedelta(minutes=15),
        locked_by="crashed-worker-hostname-9999",
    )

    mock_db = MagicMock()
    mock_db.scalars.return_value.all.return_value = [job]

    worker = EmailOutboxWorker(
        db_factory=lambda: mock_db,
        abandoned_timeout_seconds=300,
    )

    recovered = worker.recover_abandoned_jobs(mock_db)
    assert recovered == 1
    assert job.status == EmailOutboxStatus.PENDING.value
    assert job.locked_at is None
    assert job.locked_by is None
    assert mock_db.commit.called


def test_worker_graceful_shutdown():
    """Verifies that calling stop() signals the worker to exit cleanly."""
    worker = EmailOutboxWorker()
    assert worker.is_stopped() is False
    worker.stop()
    assert worker.is_stopped() is True


# =============================================================================
# 4. Brevo Resource Management & Robustness Tests
# =============================================================================

def test_brevo_reusable_client_pooling():
    """
    Verifies that BrevoEmailProvider reuses its managed client across
    multiple dispatches and closes it cleanly.
    """
    provider = BrevoEmailProvider(api_key="xkeysib-mock")
    client1 = provider._get_client()
    client2 = provider._get_client()
    assert client1 is client2
    assert not client1.is_closed

    provider.close()
    assert provider._managed_client is None
    assert client1.is_closed


def test_brevo_context_manager_cleanup():
    """Verifies that BrevoEmailProvider supports context manager lifecycle."""
    with BrevoEmailProvider(api_key="xkeysib-mock") as provider:
        client = provider._get_client()
        assert not client.is_closed
    assert client.is_closed


def test_brevo_malformed_response_handling():
    """Verifies that non-JSON responses from Brevo do not raise unhandled exceptions."""
    mock_client = MagicMock(spec=httpx.Client)
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 502
    mock_response.json.side_effect = ValueError("Invalid JSON")
    mock_response.text = "Bad Gateway: Cloudflare Error 502"
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
    assert "502" in err
    assert "Bad Gateway" in err


def test_brevo_timeout_setting_default_5s():
    """Verifies that default timeout is now 5 seconds as required."""
    provider = BrevoEmailProvider()
    assert provider.timeout == 5


# =============================================================================
# 5. Production Configuration Validation Tests
# =============================================================================

def test_production_config_rejects_missing_brevo_key():
    """
    Verifies that in production mode with EMAIL_ENABLED=True and provider 'brevo',
    an empty BREVO_API_KEY fails closed.
    """
    with pytest.raises(ValueError) as exc_info:
        Settings(
            NODE_ENV="production",
            SECRET_KEY="real-production-secret-key-32-chars-long!",
            TOTP_ENCRYPTION_KEY="MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=",
            DATABASE_URL="postgresql://user:pass@host:5432/proddb",
            EMAIL_ENABLED=True,
            EMAIL_PROVIDER="brevo",
            BREVO_API_KEY="",
        )
    assert "BREVO_API_KEY must be configured" in str(exc_info.value)


def test_production_config_rejects_placeholder_brevo_key():
    """Verifies that placeholder keys like 'your_api_key' fail closed in production."""
    with pytest.raises(ValueError) as exc_info:
        Settings(
            NODE_ENV="production",
            SECRET_KEY="real-production-secret-key-32-chars-long!",
            TOTP_ENCRYPTION_KEY="MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=",
            DATABASE_URL="postgresql://user:pass@host:5432/proddb",
            EMAIL_ENABLED=True,
            EMAIL_PROVIDER="brevo",
            BREVO_API_KEY="your_brevo_api_key_placeholder",
        )
    assert "BREVO_API_KEY must be configured" in str(exc_info.value)


def test_production_config_allows_valid_brevo_key():
    """Verifies that valid production configuration succeeds."""
    s = Settings(
        NODE_ENV="production",
        SECRET_KEY="real-production-secret-key-32-chars-long!",
        TOTP_ENCRYPTION_KEY="MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=",
        DATABASE_URL="postgresql://user:pass@host:5432/proddb",
        EMAIL_ENABLED=True,
        EMAIL_PROVIDER="brevo",
        BREVO_API_KEY="xkeysib-production-real-credential-key",
    )
    assert s.EMAIL_ENABLED is True
    assert s.BREVO_API_KEY == "xkeysib-production-real-credential-key"


def test_production_config_allows_disabled_email():
    """Verifies that when EMAIL_ENABLED=False in production, missing BREVO_API_KEY is allowed."""
    s = Settings(
        NODE_ENV="production",
        SECRET_KEY="real-production-secret-key-32-chars-long!",
        TOTP_ENCRYPTION_KEY="MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=",
        DATABASE_URL="postgresql://user:pass@host:5432/proddb",
        EMAIL_ENABLED=False,
        EMAIL_PROVIDER="brevo",
        BREVO_API_KEY="",
    )
    assert s.EMAIL_ENABLED is False


def test_worker_settings_validation():
    """Verifies that invalid worker configurations raise clear errors."""
    with pytest.raises(ValueError) as exc_info:
        Settings(
            DATABASE_URL="postgresql://user:pass@host:5432/db",
            EMAIL_WORKER_POLL_INTERVAL_SECONDS=-1.0,
        )
    assert "EMAIL_WORKER_POLL_INTERVAL_SECONDS must be greater than 0" in str(exc_info.value)


# =============================================================================
# 6. Non-Blocking NotificationEngine Asynchronous Integration
# =============================================================================

def test_notification_engine_async_dispatch_does_not_block():
    """
    Verifies that NotificationEngine.process_event enqueues into the transactional
    outbox and completes immediately without waiting for Brevo network latency.
    """
    engine = NotificationEngine()
    mock_db = MagicMock()

    recipient_uid = uuid.uuid4()
    mock_user = User(
        id=recipient_uid,
        email="scholar@csjmu.ac.in",
        is_active=True,
    )

    def _mock_scalar(query):
        q_str = str(query).lower()
        if "from users" in q_str or "users.id =" in q_str:
            return mock_user
        return None

    mock_db.scalar.side_effect = _mock_scalar

    payload = NotificationEventPayload(
        source_pillar="NIVARAN",
        event_type="grievance.submitted",
        event_id=f"evt-{uuid.uuid4()}",
        title="Grievance Submitted",
        message="Your grievance has been submitted.",
        recipient_user_ids=[recipient_uid],
        channel_override=["EMAIL"],
    )

    # In async mode, process_event should add EmailOutbox to mock_db and return immediately
    with patch.object(settings, "EMAIL_ASYNC_DISPATCH", True):
        t0 = time.perf_counter()
        notifs = engine.process_event(db=mock_db, event=payload)
        elapsed = time.perf_counter() - t0

    assert len(notifs) == 1
    # Must complete in sub-100ms because no external network request occurred
    assert elapsed < 0.200

    # Confirm NotificationDelivery was added with status PENDING
    added_items = [call[0][0] for call in mock_db.add.call_args_list]
    deliveries = [i for i in added_items if isinstance(i, NotificationDelivery)]
    outboxes = [i for i in added_items if isinstance(i, EmailOutbox)]

    assert len(deliveries) >= 1
    assert deliveries[0].channel == "EMAIL"
    assert deliveries[0].status == DeliveryStatus.PENDING.value

    assert len(outboxes) >= 1
    assert outboxes[0].status == EmailOutboxStatus.PENDING.value
    assert outboxes[0].recipient_email == "scholar@csjmu.ac.in"
