"""
Applicant Identity Resolution & JIT Session Endpoints for NIVARAN.

Enforces:
1. Authoritative verification of caller identity via VYASA Core (POST /api/auth/verify).
2. Enforcement of generic VYASA 'applicant' ecosystem role (rejects non-applicants with 403).
3. Retrieval of applicant base profile from VYASA Core (GET /api/applicant/profile).
4. Idempotent JIT provisioning / synchronization of domain applicant record (student_master_records).
5. Strict subject reconciliation against canonical NIVARAN taxonomy.
6. Absolute decoupling: NIVARAN never issues JWTs, never accepts credentials, never modifies VYASA DB.
"""

import logging
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.identity import get_authenticated_vyasa_identity
from app.services.applicant_provisioning import (
    ApplicantProvisioningService,
    ProvisioningError,
)
from app.services.vyasa_identity import (
    VerifiedVyasaIdentity,
    VyasaApplicantProfile,
    VyasaIdentityServiceError,
    vyasa_identity_client,
)

logger = logging.getLogger("nivaran.api.applicant")
router = APIRouter()


class VyasaIdentitySummary(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    roles: List[str]


class AcademicContextSummary(BaseModel):
    subject_id: uuid.UUID
    subject_name: str
    cluster_number: int
    cluster_name: str
    assistant_dean_name: Optional[str] = None
    assistant_dean_email: Optional[str] = None
    assistant_dean_designation: Optional[str] = None


class StudentMasterRecordSummary(BaseModel):
    id: uuid.UUID
    student_vyasa_user_id: uuid.UUID
    record_number: str
    registration_number: Optional[str] = None
    enrollment_number: Optional[str] = None
    department: Optional[str] = None
    program_name: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    mobile: Optional[str] = None
    status: str
    subject_id: Optional[uuid.UUID] = None
    subject_name: Optional[str] = None


class ApplicantSessionResponse(BaseModel):
    success: bool
    role: str = "applicant"
    is_new_registration: bool = False
    vyasa_identity: VyasaIdentitySummary
    student_record: StudentMasterRecordSummary
    academic_context: Optional[AcademicContextSummary] = None


def _resolve_applicant_session(
    request: Request,
    db: Session,
    identity: VerifiedVyasaIdentity,
    authorization: Optional[str] = Header(None),
) -> ApplicantSessionResponse:
    # 1. Enforce generic VYASA 'applicant' ecosystem role
    user_roles = [r.lower() for r in identity.roles]
    if "applicant" not in user_roles:
        logger.warning(
            "APPLICANT ROLE CHECK: result=fail, identity_id=%s, roles=%s",
            identity.id,
            identity.roles,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Your VYASA identity does not have the 'applicant' ecosystem role.",
        )
    logger.info("APPLICANT ROLE CHECK: result=pass, identity_id=%s", identity.id)

    # 2. Extract Bearer token for profile retrieval
    token: Optional[str] = None
    auth_header = authorization or request.headers.get("Authorization") or ""
    if auth_header.strip().lower().startswith("bearer "):
        token = auth_header.strip()[7:].strip()

    if not token:
        logger.warning("SESSION REQUEST REJECTED: Missing Bearer token for profile retrieval")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing required Bearer token for applicant session resolution.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Retrieve authoritative applicant profile from VYASA Core
    profile: Optional[VyasaApplicantProfile] = None
    try:
        profile = vyasa_identity_client.get_applicant_profile(token)
    except VyasaIdentityServiceError as exc:
        logger.error("APPLICANT PROFILE FETCH: result=failure (unreachable) error=%s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"VYASA Core applicant profile service unavailable: {str(exc)}",
        ) from exc
    except Exception as exc:
        logger.error("APPLICANT PROFILE FETCH: result=failure (unexpected) error=%s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error while retrieving profile from VYASA Core.",
        ) from exc

    if not profile:
        logger.warning("APPLICANT PROFILE FETCH: result=failure (empty profile) identity_id=%s", identity.id)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unable to retrieve authoritative applicant profile from VYASA Core. JIT provisioning cannot proceed.",
        )
    logger.info("APPLICANT PROFILE FETCH: result=success, department=%s, subject_id=%s", profile.department, profile.subject_id)

    # 4. Idempotently resolve or JIT provision StudentMasterRecord
    ip_address = request.client.host if request.client else None
    try:
        record, matched_subject, is_new_reg = ApplicantProvisioningService.get_or_provision_student(
            db=db,
            identity=identity,
            profile=profile,
            ip_address=ip_address,
        )
    except ProvisioningError as exc:
        logger.warning("JIT PROVISIONING REJECTED: status=%d message=%s", exc.status_code, exc.message)
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        ) from exc
    except Exception as exc:
        logger.error("Database failure during applicant provisioning: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="NIVARAN domain registration failed due to an internal database error.",
        ) from exc

    logger.info(
        "NIVARAN APPLICANT LOOKUP: vyasa_user_id=%s record_found=%s",
        identity.id,
        not is_new_reg,
    )
    logger.info(
        "JIT PROVISIONING: created=%s record_number=%s",
        is_new_reg,
        record.record_number,
    )
    logger.info("SESSION ESTABLISHED: record_number=%s role=applicant", record.record_number)

    # 5. Build Academic Context from reconciled taxonomy
    academic_ctx = None
    if matched_subject:
        cluster = matched_subject.subject_cluster
        assistant_dean = cluster.assistant_dean if cluster else None
        academic_ctx = AcademicContextSummary(
            subject_id=matched_subject.id,
            subject_name=matched_subject.name,
            cluster_number=cluster.cluster_number if cluster else 0,
            cluster_name=cluster.name if cluster else "Unassigned",
            assistant_dean_name=assistant_dean.name_snapshot if assistant_dean else None,
            assistant_dean_email=assistant_dean.email_snapshot if assistant_dean else None,
            assistant_dean_designation=assistant_dean.designation if assistant_dean else None,
        )

    return ApplicantSessionResponse(
        success=True,
        role="applicant",
        is_new_registration=is_new_reg,
        vyasa_identity=VyasaIdentitySummary(
            id=identity.id,
            email=identity.email,
            first_name=identity.first_name,
            last_name=identity.last_name,
            roles=identity.roles,
        ),
        student_record=StudentMasterRecordSummary(
            id=record.id,
            student_vyasa_user_id=record.student_vyasa_user_id,
            record_number=record.record_number,
            registration_number=record.registration_number_snapshot,
            enrollment_number=record.enrollment_number_snapshot,
            department=record.department_snapshot,
            program_name=record.program_name_snapshot,
            full_name=record.full_name_snapshot,
            email=record.email_snapshot,
            mobile=record.mobile_snapshot,
            status=record.status.value if hasattr(record.status, "value") else str(record.status),
            subject_id=matched_subject.id if matched_subject else None,
            subject_name=matched_subject.name if matched_subject else None,
        ),
        academic_context=academic_ctx,
    )


@router.get(
    "/session",
    response_model=ApplicantSessionResponse,
    summary="Resolve authenticated applicant identity, JIT provision/link domain record, and return session",
)
def get_applicant_session(
    request: Request,
    db: Session = Depends(get_db),
    identity: VerifiedVyasaIdentity = Depends(get_authenticated_vyasa_identity),
    authorization: Optional[str] = Header(None),
) -> ApplicantSessionResponse:
    """Applicant SSO & Session Handshake endpoint."""
    return _resolve_applicant_session(request, db, identity, authorization)


@router.get(
    "/me",
    response_model=ApplicantSessionResponse,
    summary="Alias for applicant session resolution",
)
def get_applicant_me(
    request: Request,
    db: Session = Depends(get_db),
    identity: VerifiedVyasaIdentity = Depends(get_authenticated_vyasa_identity),
    authorization: Optional[str] = Header(None),
) -> ApplicantSessionResponse:
    """Applicant profile & session endpoint (me)."""
    return _resolve_applicant_session(request, db, identity, authorization)
