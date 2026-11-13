"""
VYASAⁿ Persistent Asynchronous Email Outbox Worker.

Responsibilities:
1. Claims pending email jobs using PostgreSQL SELECT FOR UPDATE SKIP LOCKED.
2. Dispatches emails through configured provider (Brevo / SMTP / Simulation).
3. Records delivery outcomes, retry timestamps, and sanitized error messages.
4. Recovers abandoned PROCESSING jobs after worker crashes or restarts.
5. Manages a worker-scoped HTTP client lifecycle with connection pooling.
6. Handles graceful shutdown on SIGINT / SIGTERM signals.
"""

import logging
import os
import random
import signal
import socket
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Callable, List, Optional

import httpx
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.email_outbox import EmailOutbox, EmailOutboxStatus
from app.models.notification import NotificationDelivery
from app.services.notifications.contracts import DeliveryStatus
from app.services.notifications.email_service import (
    BaseEmailProvider,
    BrevoEmailProvider,
    EmailSenderService,
    EmailDispatchResult,
    SimulationEmailProvider,
    SmtpEmailProvider,
    sanitize_email_error,
)

logger = logging.getLogger("vyasa.email.worker")


class EmailOutboxWorker:
    """
    Dedicated worker process for continuous, asynchronous email queue processing.
    Runs independently of FastAPI request-response threads.
    """

    def __init__(
        self,
        db_factory: Optional[Callable[[], Session]] = None,
        sender_service: Optional[EmailSenderService] = None,
        poll_interval_seconds: Optional[float] = None,
        batch_size: Optional[int] = None,
        max_retries: Optional[int] = None,
        abandoned_timeout_seconds: Optional[int] = None,
        backoff_base_seconds: Optional[float] = None,
        max_backoff_seconds: Optional[float] = None,
    ):
        self.db_factory = db_factory or SessionLocal
        self.poll_interval = (
            poll_interval_seconds
            if poll_interval_seconds is not None
            else settings.EMAIL_WORKER_POLL_INTERVAL_SECONDS
        )
        self.batch_size = (
            batch_size if batch_size is not None else settings.EMAIL_WORKER_BATCH_SIZE
        )
        self.max_retries = (
            max_retries if max_retries is not None else settings.EMAIL_WORKER_MAX_RETRIES
        )
        self.abandoned_timeout = (
            abandoned_timeout_seconds
            if abandoned_timeout_seconds is not None
            else settings.EMAIL_WORKER_ABANDONED_TIMEOUT_SECONDS
        )
        self.backoff_base = (
            backoff_base_seconds
            if backoff_base_seconds is not None
            else settings.EMAIL_WORKER_BACKOFF_BASE_SECONDS
        )
        self.max_backoff = (
            max_backoff_seconds
            if max_backoff_seconds is not None
            else settings.EMAIL_WORKER_MAX_BACKOFF_SECONDS
        )

        hostname = socket.gethostname() or "worker"
        pid = os.getpid()
        self.worker_id = f"worker-{hostname}-{pid}-{uuid.uuid4().hex[:6]}"

        self._stop_event = threading.Event()
        self._custom_sender = sender_service
        self._managed_provider: Optional[BaseEmailProvider] = None
        self._sender: Optional[EmailSenderService] = None

    def _resolve_sender(self) -> EmailSenderService:
        if self._custom_sender is not None:
            return self._custom_sender

        if self._sender is not None:
            return self._sender

        # Initialize worker-scoped provider with dedicated connection pool
        provider_type = (settings.EMAIL_PROVIDER or "brevo").strip().lower()

        if not settings.EMAIL_ENABLED:
            self._managed_provider = SimulationEmailProvider()
        elif provider_type == "brevo":
            limits = httpx.Limits(max_connections=20, max_keepalive_connections=10)
            self._managed_provider = BrevoEmailProvider(
                timeout=settings.BREVO_TIMEOUT_SECONDS,
                limits=limits,
            )
        elif provider_type == "smtp":
            self._managed_provider = SmtpEmailProvider()
        else:
            self._managed_provider = SimulationEmailProvider()

        self._sender = EmailSenderService(
            provider=self._managed_provider,
            email_enabled=settings.EMAIL_ENABLED,
        )
        return self._sender

    def close(self) -> None:
        """Closes provider HTTP client sessions cleanly."""
        if self._managed_provider is not None and hasattr(self._managed_provider, "close"):
            try:
                self._managed_provider.close()
            except Exception as e:
                logger.debug(f"[Email Worker {self.worker_id}] Error during provider close: {e}")
            self._managed_provider = None
        self._sender = None

    def stop(self) -> None:
        """Signals the worker loop to terminate gracefully."""
        logger.info(f"[Email Worker {self.worker_id}] Stop signal received. Finishing in-flight jobs...")
        self._stop_event.set()

    def is_stopped(self) -> bool:
        return self._stop_event.is_set()

    def recover_abandoned_jobs(self, db: Session) -> int:
        """
        Recovers jobs stuck in PROCESSING state from crashed or terminated workers.
        If a job was claimed longer than abandoned_timeout ago, unlocks it or marks FAILED.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=self.abandoned_timeout)
        stmt = (
            select(EmailOutbox)
            .where(
                EmailOutbox.status == EmailOutboxStatus.PROCESSING.value,
                EmailOutbox.locked_at < cutoff,
            )
            .order_by(EmailOutbox.locked_at.asc())
            .limit(self.batch_size)
            .with_for_update(skip_locked=True)
        )
        abandoned_jobs = list(db.scalars(stmt).all())
        now = datetime.now(timezone.utc)
        recovered_count = 0

        for job in abandoned_jobs:
            recovered_count += 1
            logger.warning(
                f"[Email Worker {self.worker_id}] Recovering abandoned job {job.id} "
                f"(originally locked by '{job.locked_by}' at {job.locked_at})"
            )
            if job.attempt_count >= job.max_attempts:
                job.status = EmailOutboxStatus.FAILED.value
                job.locked_at = None
                job.locked_by = None
                job.error_message = "Abandoned by previous worker and exceeded max retry attempts"
                if job.notification_delivery_id:
                    deliv = db.get(NotificationDelivery, job.notification_delivery_id)
                    if deliv:
                        deliv.status = DeliveryStatus.FAILED.value
                        deliv.error_message = job.error_message
                        deliv.last_attempt_at = now
            else:
                job.status = EmailOutboxStatus.PENDING.value
                job.locked_at = None
                job.locked_by = None
                job.next_attempt_at = now + timedelta(seconds=2.0)

        if recovered_count > 0:
            db.commit()
            logger.info(f"[Email Worker {self.worker_id}] Successfully recovered {recovered_count} abandoned job(s).")
        return recovered_count

    def claim_pending_jobs(self, db: Session) -> List[uuid.UUID]:
        """
        Claims up to batch_size pending jobs using SELECT FOR UPDATE SKIP LOCKED.
        Returns list of claimed job UUIDs.
        """
        now = datetime.now(timezone.utc)
        stmt = (
            select(EmailOutbox)
            .where(
                EmailOutbox.status == EmailOutboxStatus.PENDING.value,
                EmailOutbox.next_attempt_at <= now,
            )
            .order_by(EmailOutbox.next_attempt_at.asc(), EmailOutbox.created_at.asc())
            .limit(self.batch_size)
            .with_for_update(skip_locked=True)
        )
        jobs = list(db.scalars(stmt).all())
        claimed_ids: List[uuid.UUID] = []

        for job in jobs:
            job.status = EmailOutboxStatus.PROCESSING.value
            job.locked_at = now
            job.locked_by = self.worker_id
            job.attempt_count += 1
            job.last_attempt_at = now
            claimed_ids.append(job.id)

        if claimed_ids:
            db.commit()
            logger.debug(f"[Email Worker {self.worker_id}] Claimed {len(claimed_ids)} job(s) for processing.")
        return claimed_ids

    def process_single_job(self, job_id: uuid.UUID) -> bool:
        """
        Dispatches a single claimed email job and commits the outcome.
        Returns True if sent successfully, False otherwise.
        """
        with self.db_factory() as db:
            job = db.get(EmailOutbox, job_id)
            if not job or job.status != EmailOutboxStatus.PROCESSING.value:
                return False

            now = datetime.now(timezone.utc)
            sender = self._resolve_sender()

            try:
                result = sender.send_email(
                    recipient_email=job.recipient_email,
                    subject=job.subject,
                    html_content=job.html_content,
                    text_content=job.text_content,
                )
            except Exception as exc:
                sanitized = sanitize_email_error(str(exc))
                result = EmailDispatchResult(
                    success=False,
                    error_message=f"Unexpected dispatch error: {sanitized}",
                    is_permanent_error=False,
                )

            # -----------------------------------------------------------------
            # 1. Success Outcome
            # -----------------------------------------------------------------
            if result.success:
                job.status = EmailOutboxStatus.SENT.value
                job.locked_at = None
                job.locked_by = None
                job.error_message = None
                job.provider_message_id = getattr(result, "message_id", None) or "ok"

                if job.notification_delivery_id:
                    deliv = db.get(NotificationDelivery, job.notification_delivery_id)
                    if deliv:
                        deliv.status = DeliveryStatus.SENT.value
                        deliv.error_message = None
                        deliv.last_attempt_at = now
                db.commit()
                logger.info(
                    f"[Email Worker {self.worker_id}] Successfully sent email job {job.id} "
                    f"to {job.recipient_email} | MessageID: {job.provider_message_id}"
                )
                return True

            # -----------------------------------------------------------------
            # 2. Failure Outcome
            # -----------------------------------------------------------------
            err_msg = result.error_message or "Unknown dispatch error"
            is_perm = getattr(result, "is_permanent_error", False)
            retry_after = getattr(result, "retry_after", None)

            # Permanent failure or max retries exhausted
            if is_perm or job.attempt_count >= job.max_attempts:
                job.status = EmailOutboxStatus.FAILED.value
                job.locked_at = None
                job.locked_by = None
                job.error_message = err_msg

                if job.notification_delivery_id:
                    deliv = db.get(NotificationDelivery, job.notification_delivery_id)
                    if deliv:
                        deliv.status = DeliveryStatus.FAILED.value
                        deliv.error_message = err_msg[:255]
                        deliv.last_attempt_at = now
                db.commit()
                logger.warning(
                    f"[Email Worker {self.worker_id}] Permanent failure on job {job.id} to {job.recipient_email} "
                    f"(Attempts {job.attempt_count}/{job.max_attempts}): {err_msg}"
                )
                return False

            # Transient failure -> schedule retry with exponential backoff & jitter
            if retry_after is not None and retry_after > 0:
                delay_seconds = float(retry_after)
            else:
                jitter = random.uniform(0.5, 2.0)
                calculated_delay = self.backoff_base * (2 ** (job.attempt_count - 1)) + jitter
                delay_seconds = min(calculated_delay, self.max_backoff)

            job.status = EmailOutboxStatus.PENDING.value
            job.locked_at = None
            job.locked_by = None
            job.next_attempt_at = now + timedelta(seconds=delay_seconds)
            job.error_message = err_msg

            if job.notification_delivery_id:
                deliv = db.get(NotificationDelivery, job.notification_delivery_id)
                if deliv:
                    deliv.status = DeliveryStatus.PENDING.value
                    deliv.error_message = err_msg[:255]
                    deliv.last_attempt_at = now
            db.commit()
            logger.info(
                f"[Email Worker {self.worker_id}] Transient failure on job {job.id} to {job.recipient_email}. "
                f"Retrying in {delay_seconds:.1f}s (Attempt {job.attempt_count}/{job.max_attempts}): {err_msg}"
            )
            return False

    def process_batch(self) -> int:
        """
        Runs one iteration: recovers abandoned jobs, claims pending jobs,
        and dispatches them.
        Returns total number of jobs processed.
        """
        with self.db_factory() as db:
            self.recover_abandoned_jobs(db)
            claimed_job_ids = self.claim_pending_jobs(db)

        if not claimed_job_ids:
            return 0

        for job_id in claimed_job_ids:
            if self._stop_event.is_set():
                break
            self.process_single_job(job_id)

        return len(claimed_job_ids)

    def run(self) -> None:
        """
        Continuous worker execution loop with signal handling and graceful shutdown.
        """
        logger.info(
            f"[Email Worker {self.worker_id}] Started with poll_interval={self.poll_interval}s, "
            f"batch_size={self.batch_size}, max_retries={self.max_retries}"
        )

        def _handle_signal(signum, frame):
            sig_name = "SIGINT" if signum == signal.SIGINT else "SIGTERM"
            logger.info(f"[Email Worker {self.worker_id}] Received {sig_name}. Initiating graceful shutdown...")
            self.stop()

        signal.signal(signal.SIGINT, _handle_signal)
        signal.signal(signal.SIGTERM, _handle_signal)

        try:
            while not self._stop_event.is_set():
                try:
                    processed = self.process_batch()
                    if processed == 0 and not self._stop_event.is_set():
                        self._stop_event.wait(timeout=self.poll_interval)
                except Exception as exc:
                    logger.error(f"[Email Worker {self.worker_id}] Unhandled error in processing loop: {exc}")
                    if not self._stop_event.is_set():
                        self._stop_event.wait(timeout=self.poll_interval)
        finally:
            self.close()
            logger.info(f"[Email Worker {self.worker_id}] Worker stopped and connections cleaned up successfully.")


def run_worker() -> None:
    """Convenience CLI entry point function."""
    worker = EmailOutboxWorker()
    worker.run()


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    run_worker()
