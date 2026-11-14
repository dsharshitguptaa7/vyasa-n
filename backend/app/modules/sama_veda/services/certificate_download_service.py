import os
import uuid
import hashlib
import logging
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import HTTPException, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.models.user import User
from app.modules.sama_veda.models.certificate import (
    FelicitationCertificate,
    CertificateVerificationEvent,
)
from app.core.storage import (
    storage_service,
    StorageFileNotFoundError,
    StorageError,
)

logger = logging.getLogger(__name__)


def validate_and_stream_certificate_pdf(
    cert: FelicitationCertificate,
    request: Request,
    db: Session,
    current_user: Optional[User] = None,
    verification_source: str = "PUBLIC_DOWNLOAD",
    token_context: Optional[str] = None,
) -> FileResponse:
    """
    Validates certificate issuance status, file existence, and cryptographic SHA-256 integrity,
    then streams the exact original ReportLab PDF without regenerating.
    Enforces audit logging, download telemetry, and safe path traversal guards.
    """
    cert_no = cert.certificate_number if isinstance(cert.certificate_number, str) else "certificate"
    clean_number = cert_no.strip()

    # 1. Verification of Certificate Status
    if cert.is_revoked or cert.status == "REVOKED":
        logger.warning(
            "Download blocked: Certificate %s is REVOKED (Reason: %s)",
            clean_number,
            cert.revocation_reason or "N/A",
        )
        _record_download_telemetry(
            db=db,
            cert=cert,
            request=request,
            source="BLOCKED_REVOKED",
            actor_user_id=current_user.id if current_user else None,
            token_context=token_context,
            result_status="FAILED",
            reason=f"REVOKED: {cert.revocation_reason or 'Institutional action'}",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Certificate {clean_number} is REVOKED and cannot be downloaded. Reason: {cert.revocation_reason or 'Institutional revocation'}",
        )

    if cert.status == "SUPERSEDED":
        logger.info("Download requested for SUPERSEDED certificate %s", clean_number)
        _record_download_telemetry(
            db=db,
            cert=cert,
            request=request,
            source="BLOCKED_SUPERSEDED",
            actor_user_id=current_user.id if current_user else None,
            token_context=token_context,
            result_status="FAILED",
            reason="SUPERSEDED: Replacement document issued",
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Certificate {clean_number} has been SUPERSEDED by an official replacement document. Please refer to the updated certificate.",
        )

    if cert.status in ["DRAFT", "PENDING_APPROVAL", "REJECTED"]:
        logger.warning("Download blocked: Certificate %s status is %s", clean_number, cert.status)
        _record_download_telemetry(
            db=db,
            cert=cert,
            request=request,
            source="BLOCKED_NOT_ISSUED",
            actor_user_id=current_user.id if current_user else None,
            token_context=token_context,
            result_status="FAILED",
            reason=f"Certificate not finalized: {cert.status}",
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Certificate {clean_number} has not been officially approved or issued (Status: {cert.status}).",
        )

    # 2. File Storage Path Resolution & Traversal Prevention
    if not cert.file_storage_path:
        logger.error("Certificate %s has no file_storage_path recorded.", clean_number)
        _record_download_telemetry(
            db=db,
            cert=cert,
            request=request,
            source=verification_source,
            actor_user_id=current_user.id if current_user else None,
            token_context=token_context,
            result_status="FAILED",
            reason="Missing file_storage_path",
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate PDF document unavailable.",
        )

    try:
        file_path: Path = storage_service.get_file_path(cert.file_storage_path)
    except StorageFileNotFoundError:
        logger.error("StorageFileNotFoundError resolving %s for certificate %s", cert.file_storage_path, clean_number)
        _record_download_telemetry(
            db=db,
            cert=cert,
            request=request,
            source=verification_source,
            actor_user_id=current_user.id if current_user else None,
            token_context=token_context,
            result_status="FAILED",
            reason="File not found in storage",
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate PDF unavailable in university digital storage.",
        )
    except StorageError as exc:
        logger.error("StorageError resolving %s: %s", cert.file_storage_path, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Download temporarily unavailable due to a storage resolution error.",
        )

    if not file_path.is_file() or not os.access(file_path, os.R_OK):
        logger.error("File path %s is not readable on disk for certificate %s", file_path, clean_number)
        _record_download_telemetry(
            db=db,
            cert=cert,
            request=request,
            source=verification_source,
            actor_user_id=current_user.id if current_user else None,
            token_context=token_context,
            result_status="FAILED",
            reason="File unreadable on filesystem",
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate PDF unavailable.",
        )

    # 3. PDF Integrity & SHA-256 Checksum Verification
    try:
        with open(file_path, "rb") as f:
            file_bytes = f.read()
    except Exception as exc:
        logger.error("Failed to read certificate PDF %s: %s", file_path, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Download temporarily unavailable.",
        )

    computed_sha256 = hashlib.sha256(file_bytes).hexdigest()

    if cert.checksum_sha256:
        expected_sha256 = cert.checksum_sha256.strip().lower()
        if computed_sha256.lower() != expected_sha256:
            logger.critical(
                "SECURITY ALERT: Cryptographic checksum mismatch on certificate %s (ID: %s)! "
                "Expected recorded checksum %s, but file on disk produced %s. Blocking download.",
                clean_number,
                cert.id,
                expected_sha256,
                computed_sha256,
            )
            _record_download_telemetry(
                db=db,
                cert=cert,
                request=request,
                source="BLOCKED_CHECKSUM_MISMATCH",
                actor_user_id=current_user.id if current_user else None,
                token_context=token_context,
                result_status="FAILED",
                reason=f"Integrity check failed: Expected {expected_sha256[:16]}..., Computed {computed_sha256[:16]}...",
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Certificate PDF integrity verification failed. The stored file does not match its cryptographic seal.",
            )

    # 4. Audit Logging & Telemetry Recording
    try:
        cert.download_count = (cert.download_count or 0) + 1
        _record_download_telemetry(
            db=db,
            cert=cert,
            request=request,
            source=verification_source,
            actor_user_id=current_user.id if current_user else None,
            token_context=token_context,
            result_status="SUCCESS",
            sha256=computed_sha256,
        )
        db.commit()
    except Exception as exc:
        logger.warning("Failed to commit download telemetry: %s", exc)
        db.rollback()

    # 5. Safe Filename and HTTP Response Headers
    # Generate safe filename based strictly on the certificate registration number
    safe_filename = clean_number.replace("/", "_").replace("\\", "_").replace(" ", "_")
    if not safe_filename.lower().endswith(".pdf"):
        safe_filename = f"{safe_filename}.pdf"

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=safe_filename,
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}"',
            "X-Certificate-Number": clean_number,
            "X-Certificate-Status": cert.status,
            "X-Certificate-SHA256": computed_sha256,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
        },
    )


def _record_download_telemetry(
    db: Session,
    cert: FelicitationCertificate,
    request: Request,
    source: str,
    actor_user_id: Optional[uuid.UUID] = None,
    token_context: Optional[str] = None,
    result_status: str = "SUCCESS",
    reason: Optional[str] = None,
    sha256: Optional[str] = None,
):
    """
    Records audit entries in both sama_certificate_verification_events and the system audit_service.
    """
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")

    # 1. Subsystem verification event
    event = CertificateVerificationEvent(
        certificate_id=cert.id,
        verification_source=f"DOWNLOAD_{source}",
        ip_address=client_ip,
        user_agent=user_agent[:500] if user_agent else None,
    )
    db.add(event)

    # 2. System audit service entry
    try:
        from app.services.audit_service import audit_service
        # Mask public token context: only retain first 8 chars for privacy
        safe_token_ref = f"{token_context[:8]}..." if token_context and len(token_context) > 8 else token_context
        audit_service.log_event(
            db=db,
            module="sama_veda",
            action="certificate_download",
            entity_name="FelicitationCertificate",
            entity_id=cert.id,
            actor_user_id=actor_user_id,
            details={
                "certificate_number": cert.certificate_number,
                "status": cert.status,
                "download_source": source,
                "result": result_status,
                "token_context": safe_token_ref,
                "client_ip": client_ip,
                "sha256": sha256 or cert.checksum_sha256,
                "reason": reason,
            },
            fail_silent=True,
        )
    except Exception as exc:
        logger.debug("Failed to record system audit log: %s", exc)
