"""
VYASAᴺ Centralized Institutional Email Sender Service.

Supported Providers:
- Brevo (Primary Transactional Email Provider via HTTP REST API v3)
- SMTP (Standard University Mail Relay with STARTTLS/SSL)
- Simulation (Safe dry-run logging for development and testing)

Security Invariants:
- Zero API keys, passwords, OTPs, or authentication secrets logged or leaked in error strings.
- EMAIL_ENABLED=False is the default safe mode, performing zero network calls.
- Recipient addresses are strictly validated against RFC 5322 syntax before dispatch.
- Ambiguous network failures avoid uncontrolled duplicate retries to protect recipients.
"""

from abc import ABC, abstractmethod
import email.utils
import json
import logging
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Dict, Any, Tuple, Union
import httpx
import tenacity

from app.core.config import settings

logger = logging.getLogger("vyasa.email.service")

# RFC 5322 regex for basic email syntax validation
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

# Regex to scrub sensitive API keys and secrets from error strings
SENSITIVE_KEY_REGEX = re.compile(r"(xkeysib-[a-zA-Z0-9\-]+|key-[a-zA-Z0-9]+|Bearer\s+[a-zA-Z0-9\-_\.]+)", re.IGNORECASE)
CONNECTION_CRED_REGEX = re.compile(r"://[^@]+@", re.IGNORECASE)


def sanitize_email_error(error_msg: str) -> str:
    """Masks API keys, passwords, and connection credentials from error messages."""
    if not error_msg:
        return "Unknown error"
    sanitized = SENSITIVE_KEY_REGEX.sub("[REDACTED_API_KEY]", str(error_msg))
    sanitized = CONNECTION_CRED_REGEX.sub("://***:***@", sanitized)
    first_line = sanitized.split("\n")[0].strip()
    return first_line[:250]


class BaseEmailProvider(ABC):
    """Abstract interface for all institutional email delivery transports."""

    @abstractmethod
    def send_email(
        self,
        recipient_email: str,
        subject: str,
        html_content: str,
        text_content: str,
    ) -> Tuple[bool, Optional[str]]:
        """
        Dispatches an email.
        Returns: (success: bool, error_message: Optional[str])
        """
        pass


class BrevoEmailProvider(BaseEmailProvider):
    """
    Brevo Transactional Email Provider (v3 REST API).
    Endpoint: POST https://api.brevo.com/v3/smtp/email
    Header: api-key: <BREVO_API_KEY>

    Idempotency & Retry Considerations:
    Brevo's v3 transactional email API does not support client-side idempotency keys.
    To prevent duplicate sends:
    - Retries are only attempted on initial network connection establishment failures (ConnectError).
    - Read timeouts or server responses are NOT automatically retried, as the email
      may have already been enqueued on Brevo's mail servers.
    - Idempotency across business transactions is enforced by NotificationEngine.event_id.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_url: Optional[str] = None,
        from_address: Optional[str] = None,
        from_name: Optional[str] = None,
        timeout: Optional[int] = None,
        http_client: Optional[httpx.Client] = None,
    ):
        self.api_key = (api_key or settings.BREVO_API_KEY or "").strip()
        self.api_url = (api_url or settings.BREVO_API_URL).strip()
        self.from_address = (from_address or settings.EMAIL_FROM_ADDRESS).strip()
        self.from_name = (from_name or settings.EMAIL_FROM_NAME).strip()
        self.timeout = timeout or settings.BREVO_TIMEOUT_SECONDS
        self._custom_http_client = http_client

    def _get_client(self) -> httpx.Client:
        if self._custom_http_client is not None:
            return self._custom_http_client
        return httpx.Client(timeout=self.timeout)

    def send_email(
        self,
        recipient_email: str,
        subject: str,
        html_content: str,
        text_content: str,
    ) -> Tuple[bool, Optional[str]]:
        if not self.api_key:
            err = "Brevo configuration error: BREVO_API_KEY is not configured"
            logger.error(f"[Brevo Provider] Refusing dispatch: {err}")
            return False, err

        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": self.api_key,
        }

        payload = {
            "sender": {
                "name": self.from_name,
                "email": self.from_address,
            },
            "to": [
                {
                    "email": recipient_email,
                }
            ],
            "subject": subject,
            "htmlContent": html_content,
            "textContent": text_content,
            "tags": ["vyasa-institutional", "transactional"],
        }

        max_attempts = 2
        for attempt in range(1, max_attempts + 1):
            try:
                client = self._get_client()
                response = client.post(
                    self.api_url,
                    headers=headers,
                    json=payload,
                )
                return self._handle_response(response, recipient_email, subject)

            except httpx.ConnectError as conn_err:
                if attempt < max_attempts:
                    logger.warning(
                        f"[Brevo Provider] Connection failure on attempt {attempt}/{max_attempts} to {recipient_email}. Retrying..."
                    )
                    continue
                sanitized = sanitize_email_error(str(conn_err))
                logger.error(f"[Brevo Provider Error] Connection failed to {recipient_email}: {sanitized}")
                return False, f"Brevo network connection failed: {sanitized}"

            except httpx.TimeoutException as timeout_err:
                sanitized = sanitize_email_error(str(timeout_err))
                logger.error(
                    f"[Brevo Provider Timeout] Request timed out after {self.timeout}s to {recipient_email} (no retry to avoid duplicates)"
                )
                return False, f"Brevo API request timed out after {self.timeout}s"

            except Exception as exc:
                sanitized = sanitize_email_error(str(exc))
                logger.error(f"[Brevo Provider Error] Unexpected error to {recipient_email}: {sanitized}")
                return False, f"Brevo dispatch error: {sanitized}"

        return False, "Brevo dispatch failed after retries"

    def _handle_response(
        self,
        response: httpx.Response,
        recipient_email: str,
        subject: str,
    ) -> Tuple[bool, Optional[str]]:
        if response.status_code in (200, 201):
            try:
                res_data = response.json()
                msg_id = res_data.get("messageId", "ok")
            except Exception:
                msg_id = "ok"
            logger.info(
                f"[Brevo Provider] Successfully delivered email to {recipient_email} | MessageID: {msg_id} | Subject: '{subject}'"
            )
            return True, None

        status = response.status_code
        error_detail = ""
        try:
            res_json = response.json()
            error_detail = res_json.get("message") or res_json.get("code") or response.text[:200]
        except Exception:
            error_detail = response.text[:200]

        sanitized_detail = sanitize_email_error(error_detail)

        if status == 400:
            err = f"Brevo client error (400): {sanitized_detail}"
            logger.warning(f"[Brevo Provider] Bad request for {recipient_email}: {err}")
            return False, err
        elif status == 401:
            err = "Brevo authentication failed: Invalid or unauthorized API key"
            logger.error(f"[Brevo Provider] {err}")
            return False, err
        elif status == 402:
            err = "Brevo account error: Sending quota exceeded or account payment required"
            logger.error(f"[Brevo Provider] {err}")
            return False, err
        elif status == 429:
            err = "Brevo rate limit exceeded: Too many requests"
            logger.warning(f"[Brevo Provider] {err}")
            return False, err
        else:
            err = f"Brevo gateway error ({status}): {sanitized_detail}"
            logger.error(f"[Brevo Provider] {err}")
            return False, err


class SmtpEmailProvider(BaseEmailProvider):
    """Traditional SMTP/STARTTLS/SSL Provider for university mail server relay."""

    def __init__(
        self,
        smtp_host: Optional[str] = None,
        smtp_port: Optional[int] = None,
        smtp_username: Optional[str] = None,
        smtp_password: Optional[str] = None,
        use_tls: Optional[bool] = None,
        use_ssl: Optional[bool] = None,
        from_address: Optional[str] = None,
        from_name: Optional[str] = None,
        timeout: Optional[int] = None,
    ):
        self.smtp_host = smtp_host or settings.SMTP_HOST
        self.smtp_port = smtp_port or settings.SMTP_PORT
        self.smtp_username = smtp_username or settings.SMTP_USERNAME
        self.smtp_password = smtp_password or settings.SMTP_PASSWORD
        self.use_tls = use_tls if use_tls is not None else settings.SMTP_USE_TLS
        self.use_ssl = use_ssl if use_ssl is not None else settings.SMTP_USE_SSL
        self.from_address = from_address or settings.EMAIL_FROM_ADDRESS
        self.from_name = from_name or settings.EMAIL_FROM_NAME
        self.timeout = timeout or settings.SMTP_TIMEOUT_SECONDS

    def _build_mime_message(
        self,
        recipient_email: str,
        subject: str,
        html_content: str,
        text_content: str,
    ) -> MIMEMultipart:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = email.utils.formataddr((self.from_name, self.from_address))
        msg["To"] = recipient_email
        msg["Date"] = email.utils.formatdate(localtime=True)
        msg["Message-ID"] = email.utils.make_msgid(domain="csjmu.ac.in")

        part_text = MIMEText(text_content, "plain", "utf-8")
        part_html = MIMEText(html_content, "html", "utf-8")
        msg.attach(part_text)
        msg.attach(part_html)
        return msg

    def send_email(
        self,
        recipient_email: str,
        subject: str,
        html_content: str,
        text_content: str,
    ) -> Tuple[bool, Optional[str]]:
        if not self.smtp_host:
            return False, "SMTP configuration error: SMTP_HOST is not configured"

        msg = self._build_mime_message(recipient_email, subject, html_content, text_content)

        @tenacity.retry(
            reraise=True,
            stop=tenacity.stop_after_attempt(3),
            wait=tenacity.wait_exponential(multiplier=0.5, min=0.5, max=3.0),
            retry=tenacity.retry_if_exception_type((
                smtplib.SMTPServerDisconnected,
                smtplib.SMTPConnectError,
                smtplib.SMTPHeloError,
                smtplib.SMTPResponseException,
                OSError,
                TimeoutError,
            )),
        )
        def _attempt_send():
            if self.use_ssl:
                server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, timeout=self.timeout)
            else:
                server = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=self.timeout)

            try:
                server.ehlo()
                if self.use_tls and not self.use_ssl:
                    server.starttls()
                    server.ehlo()

                if self.smtp_username and self.smtp_password:
                    server.login(self.smtp_username, self.smtp_password)

                server.send_message(msg)
            finally:
                try:
                    server.quit()
                except Exception:
                    pass

        try:
            _attempt_send()
            logger.info(f"[SMTP Provider] Successfully delivered email to {recipient_email} | Subject: '{subject}'")
            return True, None
        except Exception as exc:
            sanitized = sanitize_email_error(str(exc))
            logger.error(f"[SMTP Provider Error] Delivery failed to {recipient_email}: {sanitized}")
            return False, sanitized


class SimulationEmailProvider(BaseEmailProvider):
    """Safe dry-run provider that logs simulated dispatch without network calls."""

    def send_email(
        self,
        recipient_email: str,
        subject: str,
        html_content: str,
        text_content: str,
    ) -> Tuple[bool, Optional[str]]:
        logger.info(
            f"[Email Sender Simulated] To: {recipient_email} | Subject: '{subject}' | (Simulated / EMAIL_ENABLED=False)"
        )
        return True, None


# =============================================================================
# Main Centralized Email Sender Service (Facade)
# =============================================================================

class EmailSenderService:
    """
    Central facade for all institutional email dispatch.
    Decoupled from specific underlying providers (Brevo, SMTP, Simulation).
    """

    def __init__(
        self,
        provider: Optional[BaseEmailProvider] = None,
        email_enabled: Optional[bool] = None,
        from_address: Optional[str] = None,
        from_name: Optional[str] = None,
        smtp_host: Optional[str] = None,
        smtp_port: Optional[int] = None,
        smtp_username: Optional[str] = None,
        smtp_password: Optional[str] = None,
        use_tls: Optional[bool] = None,
        use_ssl: Optional[bool] = None,
        timeout: Optional[int] = None,
    ):
        self.email_enabled = email_enabled if email_enabled is not None else settings.EMAIL_ENABLED
        self.from_address = from_address or settings.EMAIL_FROM_ADDRESS
        self.from_name = from_name or settings.EMAIL_FROM_NAME
        self._custom_provider = provider

        # SMTP backward-compatibility parameters
        self._smtp_host = smtp_host
        self._smtp_port = smtp_port
        self._smtp_username = smtp_username
        self._smtp_password = smtp_password
        self._use_tls = use_tls
        self._use_ssl = use_ssl
        self._timeout = timeout

    def _resolve_provider(self) -> BaseEmailProvider:
        if self._custom_provider is not None:
            return self._custom_provider

        # Safe simulation mode when live email is disabled
        if not self.email_enabled:
            return SimulationEmailProvider()

        # If explicit SMTP parameters are passed, or EMAIL_PROVIDER is smtp, route to SMTP
        provider_type = (settings.EMAIL_PROVIDER or "brevo").strip().lower()
        if self._smtp_host is not None or provider_type == "smtp":
            return SmtpEmailProvider(
                smtp_host=self._smtp_host,
                smtp_port=self._smtp_port,
                smtp_username=self._smtp_username,
                smtp_password=self._smtp_password,
                use_tls=self._use_tls,
                use_ssl=self._use_ssl,
                from_address=self.from_address,
                from_name=self.from_name,
                timeout=self._timeout,
            )
        elif provider_type == "brevo":
            return BrevoEmailProvider(
                from_address=self.from_address,
                from_name=self.from_name,
            )
        else:
            return SimulationEmailProvider()

    @staticmethod
    def validate_recipient_email(email_str: Optional[str]) -> bool:
        """Validates recipient email address syntax and bounds."""
        if not email_str or not isinstance(email_str, str):
            return False
        cleaned = email_str.strip()
        if len(cleaned) < 5 or len(cleaned) > 254:
            return False
        return bool(EMAIL_REGEX.match(cleaned))

    def send_email(
        self,
        recipient_email: str,
        subject: str,
        html_content: str,
        text_content: str,
    ) -> Tuple[bool, Optional[str]]:
        """
        Dispatches email through the active provider.
        Returns: (success: bool, error_message: Optional[str])
        """
        cleaned_recipient = (recipient_email or "").strip()
        if not self.validate_recipient_email(cleaned_recipient):
            err = f"Invalid recipient email address: '{cleaned_recipient}'"
            logger.warning(f"[Email Sender] Refusing dispatch: {err}")
            return False, err

        # If live dispatch is disabled globally and no custom provider is injected, run safe simulation
        if not self.email_enabled and self._custom_provider is None:
            return SimulationEmailProvider().send_email(
                recipient_email=cleaned_recipient,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
            )

        provider = self._resolve_provider()
        return provider.send_email(
            recipient_email=cleaned_recipient,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
        )


# Default singleton instance
email_sender_service = EmailSenderService()
