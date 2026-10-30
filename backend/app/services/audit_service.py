"""
VYASA Central Audit Service
Standardized compliance, governance, and administrative audit event logger.
Records immutable audit trails to the 'audit_logs' table with credential sanitization
and fail-closed error management for sensitive administrative operations.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional, Set, Union
import uuid

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit import AuditLog

logger = logging.getLogger("vyasa.audit_service")

# Keywords that must be masked in audit details to prevent leaking credentials
SENSITIVE_KEY_SUBSTRINGS: Set[str] = {
    "password",
    "secret",
    "token",
    "totp",
    "api_key",
    "apikey",
    "private_key",
    "credential",
    "auth",
    "cookie",
}


class AuditServiceError(Exception):
    """Raised when an audit event fails to record during a sensitive operation."""
    pass


def sanitize_audit_details(details: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Recursively sanitize metadata dict to ensure sensitive credentials,
    passwords, or cryptographic keys are never written to audit_logs.
    """
    if details is None:
        return None
    if not isinstance(details, dict):
        return {"data": str(details)}

    sanitized: Dict[str, Any] = {}
    for key, value in details.items():
        lower_key = str(key).lower()
        if any(substr in lower_key for substr in SENSITIVE_KEY_SUBSTRINGS):
            sanitized[key] = "[REDACTED]"
        elif isinstance(value, dict):
            sanitized[key] = sanitize_audit_details(value)
        elif isinstance(value, list):
            sanitized[key] = [
                sanitize_audit_details(item) if isinstance(item, dict) else item
                for item in value
            ]
        elif isinstance(value, (uuid.UUID, datetime)):
            sanitized[key] = str(value)
        else:
            sanitized[key] = value
    return sanitized


class CentralAuditService:
    """
    Centralized administrative and operational audit service.
    Guarantees consistent recording across all Veda modules and platform core.
    """

    @staticmethod
    def log(
        db: Session,
        *,
        module: str,
        action: str,
        entity_name: str,
        entity_id: Union[str, uuid.UUID],
        actor_user_id: Optional[uuid.UUID] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        commit: bool = False,
        fail_silent: bool = False,
    ) -> AuditLog:
        """
        Record a structured audit log entry to the database.

        Parameters:
            db: Active SQLAlchemy session.
            module: Subsystem identifier (e.g., 'sama_veda', 'atharva_veda', 'core', 'auth').
            action: Specific action performed (e.g., 'certificate.issued', 'author.verified').
            entity_name: Domain model or target resource name (e.g., 'ResearchAuthor', 'Certificate').
            entity_id: Identifier of the target entity.
            actor_user_id: UUID of the actor performing the action; None for anonymous/system.
            details: Optional metadata dict. Sensitive keys will be automatically redacted.
            ip_address: Originating client IP address.
            user_agent: Originating client User-Agent string.
            commit: Whether to commit immediately (default False, flushed with caller transaction).
            fail_silent: If False (default), raises AuditServiceError on failure to prevent
                         silent suppression during sensitive operations.
        """
        # Validate mandatory non-empty identifiers
        if not module or not str(module).strip():
            raise ValueError("Audit log 'module' is strictly required and cannot be empty.")
        if not action or not str(action).strip():
            raise ValueError("Audit log 'action' is strictly required and cannot be empty.")
        if not entity_name or not str(entity_name).strip():
            raise ValueError("Audit log 'entity_name' is strictly required and cannot be empty.")
        if not entity_id or not str(entity_id).strip():
            raise ValueError("Audit log 'entity_id' is strictly required and cannot be empty.")

        clean_entity_id = str(entity_id).strip()
        safe_details = sanitize_audit_details(details)

        try:
            entry = AuditLog(
                user_id=actor_user_id,
                module=str(module).strip(),
                action=str(action).strip(),
                entity_name=str(entity_name).strip(),
                entity_id=clean_entity_id,
                details=safe_details,
                ip_address=ip_address[:45] if ip_address else None,
                user_agent=user_agent[:500] if user_agent else None,
            )
            db.add(entry)
            if commit:
                db.commit()
                db.refresh(entry)
            else:
                db.flush([entry])
            return entry

        except Exception as exc:
            logger.error(
                "Failed to persist audit log entry for module '%s', action '%s': %s",
                module, action, str(exc), exc_info=True,
            )
            if fail_silent:
                logger.warning("Suppressing audit failure due to fail_silent=True flag.")
                return AuditLog(
                    id=uuid.uuid4(),
                    module=module,
                    action=action,
                    entity_name=entity_name,
                    entity_id=clean_entity_id,
                )
            raise AuditServiceError(
                f"Audit logging failed for sensitive operation '{action}' on '{entity_name}:{clean_entity_id}': {exc}"
            ) from exc

    @staticmethod
    def log_from_request(
        request: Request,
        db: Session,
        *,
        module: str,
        action: str,
        entity_name: str,
        entity_id: Union[str, uuid.UUID],
        actor_user_id: Optional[uuid.UUID] = None,
        details: Optional[Dict[str, Any]] = None,
        commit: bool = False,
        fail_silent: bool = False,
    ) -> AuditLog:
        """
        Convenience wrapper extracting IP address and User-Agent from a FastAPI Request.
        """
        ip = None
        if request.client:
            ip = request.client.host
        # Fall back to X-Forwarded-For if available
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            ip = forwarded.split(",")[0].strip()

        ua = request.headers.get("user-agent")

        return CentralAuditService.log(
            db=db,
            module=module,
            action=action,
            entity_name=entity_name,
            entity_id=entity_id,
            actor_user_id=actor_user_id,
            details=details,
            ip_address=ip,
            user_agent=ua,
            commit=commit,
            fail_silent=fail_silent,
        )


# Exported singleton instance
audit_service = CentralAuditService()
