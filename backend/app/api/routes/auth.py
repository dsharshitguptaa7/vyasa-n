import uuid
import logging
logger = logging.getLogger("vyasa.auth")
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies import get_current_user, get_db
from app.core.config import settings
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.core.subjects import get_canonical_subjects, get_subject_by_id
from app.models.applicant_profile import ApplicantProfile
from app.models.audit import AuditLog
from app.models.role import Role
from app.models.two_factor import (
    UserTwoFactorAuth,
    TwoFactorRecoveryCode,
    AuthenticationChallenge,
    TwoFactorAttempt,
)
from app.models.user import User
from app.schemas.auth import (
    ApplicantRegisterRequest,
    ApplicantRegistrationResponse,
    AuthenticatedUserResponse,
    LoginRequest,
    SubjectResponse,
    TokenResponse,
    TokenVerifyRequest,
    TokenVerifyResponse,
)
from app.schemas.two_factor import (
    TwoFactorChallengeResponse,
    TwoFactorSetupResponse,
    TwoFactorConfirmSetupRequest,
    TwoFactorVerifyRequest,
    TwoFactorRecoveryRequest,
    TwoFactorStatusResponse,
    TwoFactorRegenerateRecoveryCodesRequest,
    TwoFactorRecoveryCodesResponse,
)
from app.services.two_factor_service import TwoFactorService
from app.services.notifications.security_email_service import AuthoritySecurityEmailService

from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole
from app.modules.atharva_veda.nivaran.models.taxonomy import SubjectCluster, GrievanceCluster, Subject
from app.modules.atharva_veda.nivaran.models.grievance import StudentMasterRecord

router = APIRouter(prefix="/auth", tags=["Authentication & Identity"])


def get_client_ip(request: Request) -> Optional[str]:
    """Safely extract valid IPv4/IPv6 client IP address."""
    if not request or not request.client or not request.client.host:
        return None
    host = request.client.host
    if host == "testclient":
        return "127.0.0.1"
    return host


def build_authenticated_user_response(user: User, db: Session) -> AuthenticatedUserResponse:
    """
    Build rich canonical identity payload from User, ApplicantProfile,
    StudentMasterRecord, and NivaranAuthority records without inventing data.
    """
    role_names = [r.name for r in user.roles]

    # Resolve institutional authority if appointed
    authority = db.scalar(
        select(NivaranAuthority).where(
            NivaranAuthority.vyasa_user_id == user.id,
            NivaranAuthority.is_active.is_(True),
        )
    )
    auth_role = authority.role.value if authority else None
    auth_id = authority.id if authority else None
    auth_designation = authority.designation if authority else None
    auth_department = authority.department if authority else None
    assigned_cluster_name = None
    assigned_cluster_number = None

    if authority:
        if authority.role == NivaranRole.ASSISTANT_DEAN:
            sc = db.scalar(
                select(SubjectCluster).where(
                    SubjectCluster.assistant_dean_id == authority.id,
                    SubjectCluster.is_active.is_(True),
                )
            )
            if sc:
                assigned_cluster_name = sc.name
                assigned_cluster_number = sc.cluster_number
        elif authority.role == NivaranRole.ASSOCIATE_DEAN:
            gc = db.scalar(
                select(GrievanceCluster).where(
                    GrievanceCluster.associate_dean_id == authority.id,
                    GrievanceCluster.is_active.is_(True),
                )
            )
            if gc:
                assigned_cluster_name = gc.name
                assigned_cluster_number = gc.cluster_number

    # Resolve applicant profile if registered
    applicant_prof = db.scalar(
        select(ApplicantProfile).where(ApplicantProfile.user_id == user.id)
    )
    phd_registration_number = applicant_prof.phd_registration_number if applicant_prof else None
    department = applicant_prof.department if applicant_prof else None
    subject_name = applicant_prof.subject_name if applicant_prof else None

    # Resolve student master record if exists
    smr = db.scalar(
        select(StudentMasterRecord).where(StudentMasterRecord.student_vyasa_user_id == user.id)
    )
    enrollment_number = smr.enrollment_number_snapshot if smr else None
    scholar_record_number = smr.record_number if smr else None
    if not phd_registration_number and smr:
        phd_registration_number = smr.registration_number_snapshot

    return AuthenticatedUserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        roles=role_names,
        phone=user.phone,
        is_active=user.is_active,
        is_verified=user.is_verified,
        authority_role=auth_role,
        authority_id=auth_id,
        authority_designation=auth_designation,
        authority_department=auth_department,
        assigned_cluster_name=assigned_cluster_name,
        assigned_cluster_number=assigned_cluster_number,
        phd_registration_number=phd_registration_number,
        department=department,
        subject_name=subject_name,
        enrollment_number=enrollment_number,
        scholar_record_number=scholar_record_number,
        created_at=user.created_at,
    )


def _issue_authenticated_token(
    user: User,
    db: Session,
    recovery_codes: Optional[List[str]] = None,
) -> TokenResponse:
    """Helper to construct canonical claims and issue full JWT TokenResponse."""
    user_resp = build_authenticated_user_response(user, db)
    token_claims = {
        "sub": str(user.id),
        "email": user.email,
        "roles": user_resp.roles,
        "authority_role": user_resp.authority_role,
    }
    access_token = create_access_token(token_claims)
    expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
        user=user_resp,
        recovery_codes=recovery_codes,
    )


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Authenticate a VYASA user.
    Enforces password verification against stored PBKDF2 hash, rate limits consecutive attempts,
    and checks active account status.
    For institutional authority roles and Super Admin, issues a limited pre-authentication challenge
    requiring TOTP verification or enrollment. Never issues a full access token before 2FA completes.
    """
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")[:500] if request else None
    normalized_email = payload.email.lower().strip()

    # 1. Rate limiting check
    if TwoFactorService.is_rate_limited(db, normalized_email):
        db.add(
            AuditLog(
                user_id=None,
                module="auth",
                action="auth.login_rate_limited",
                entity_name="User",
                entity_id=normalized_email,
                details={"reason": "Excessive failed attempts; temporary lockout enforced"},
                ip_address=client_ip,
                user_agent=user_agent,
            )
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Please try again in {settings.FAILED_LOGIN_LOCKOUT_MINUTES} minutes.",
        )

    stmt = (
        select(User)
        .options(joinedload(User.roles))
        .where(func.lower(User.email) == normalized_email)
    )
    user = db.execute(stmt).unique().scalar_one_or_none()

    if not user:
        TwoFactorService.record_attempt(db, normalized_email, success=False, ip_address=client_ip)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.password_hash or not verify_password(payload.password, user.password_hash):
        TwoFactorService.record_attempt(db, normalized_email, success=False, ip_address=client_ip)
        db.add(
            AuditLog(
                user_id=user.id,
                module="auth",
                action="auth.password_failed",
                entity_name="User",
                entity_id=str(user.id),
                details={"reason": "Invalid credentials provided"},
                ip_address=client_ip,
                user_agent=user_agent,
            )
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        db.add(
            AuditLog(
                user_id=user.id,
                module="auth",
                action="auth.deactivated_attempt",
                entity_name="User",
                entity_id=str(user.id),
                details={"status": "deactivated"},
                ip_address=client_ip,
                user_agent=user_agent,
            )
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact an administrator.",
        )

    # Record password step success
    TwoFactorService.record_attempt(db, normalized_email, success=True, ip_address=client_ip)

    # ----------------------------------------------------
    # AUTHORITY 2FA GATEWAY (CRITICAL SECURITY INVARIANT)
    # ----------------------------------------------------
    if TwoFactorService.is_2fa_mandatory_for_user(user, db):
        two_factor = db.scalar(
            select(UserTwoFactorAuth).where(UserTwoFactorAuth.user_id == user.id)
        )

        if two_factor is None or not two_factor.is_enabled:
            # 2FA Enrollment Required
            challenge = TwoFactorService.create_challenge(
                db=db,
                user_id=user.id,
                purpose="TWO_FACTOR_SETUP",
                ip_address=client_ip,
                user_agent=user_agent,
            )
            db.add(
                AuditLog(
                    user_id=user.id,
                    module="auth",
                    action="auth.two_factor_setup_started",
                    entity_name="AuthenticationChallenge",
                    entity_id=str(challenge.id),
                    details={"purpose": "TWO_FACTOR_SETUP"},
                    ip_address=client_ip,
                    user_agent=user_agent,
                )
            )
            db.commit()

            return TokenResponse(
                requires_two_factor=True,
                two_factor_setup_required=True,
                challenge_id=challenge.id,
                message="Two-factor authentication enrollment is required for institutional authorities.",
            )
        else:
            # 2FA Verification Required
            challenge = TwoFactorService.create_challenge(
                db=db,
                user_id=user.id,
                purpose="TWO_FACTOR_LOGIN",
                ip_address=client_ip,
                user_agent=user_agent,
            )
            db.add(
                AuditLog(
                    user_id=user.id,
                    module="auth",
                    action="auth.two_factor_challenge_issued",
                    entity_name="AuthenticationChallenge",
                    entity_id=str(challenge.id),
                    details={"purpose": "TWO_FACTOR_LOGIN"},
                    ip_address=client_ip,
                    user_agent=user_agent,
                )
            )
            db.commit()

            return TokenResponse(
                requires_two_factor=True,
                two_factor_setup_required=False,
                challenge_id=challenge.id,
                message="Please enter the 6-digit verification code from your authenticator app.",
            )

    # ----------------------------------------------------
    # APPLICANT LOGIN (DIRECT SESSION CREATION)
    # ----------------------------------------------------
    token_resp = _issue_authenticated_token(user, db)
    db.add(
        AuditLog(
            user_id=user.id,
            module="auth",
            action="auth.login_success",
            entity_name="User",
            entity_id=str(user.id),
            details={"persona": "applicant"},
            ip_address=client_ip,
            user_agent=user_agent,
        )
    )
    db.commit()

    # Trigger authority security emails if authority user logged in
    try:
        AuthoritySecurityEmailService.handle_successful_authority_login(
            db=db,
            user=user,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except Exception as _sec_err:
        logger.error(f"[Auth Security] Hook failed: {_sec_err}")

    return token_resp


# ============================================================
# TWO-FACTOR AUTHENTICATION ENDPOINTS
# ============================================================

@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
def get_2fa_setup_details(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
) -> TwoFactorSetupResponse:
    """
    Retrieve TOTP setup key and QR code for an active setup challenge.
    Never exposes raw secrets in persistent logs.
    """
    challenge_id_raw = payload.get("challenge_id")
    if not challenge_id_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="challenge_id is required.",
        )
    try:
        challenge_id = uuid.UUID(str(challenge_id_raw))
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid challenge_id format.",
        )

    challenge = TwoFactorService.get_valid_challenge(db, challenge_id)
    if challenge is None or challenge.purpose not in {"TWO_FACTOR_SETUP", "TWO_FACTOR_REPLACE"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired 2FA setup challenge. Please sign in again.",
        )

    user = db.scalar(select(User).where(User.id == challenge.user_id))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive or not found.",
        )

    two_factor = db.scalar(
        select(UserTwoFactorAuth).where(UserTwoFactorAuth.user_id == user.id)
    )
    if two_factor is None:
        raw_secret = TwoFactorService.generate_totp_secret()
        two_factor = UserTwoFactorAuth(
            id=uuid.uuid4(),
            user_id=user.id,
            totp_secret_encrypted=TwoFactorService.encrypt_secret(raw_secret),
            is_enabled=False,
        )
        db.add(two_factor)
        db.commit()
    else:
        if not two_factor.is_enabled or challenge.purpose == "TWO_FACTOR_REPLACE":
            raw_secret = TwoFactorService.generate_totp_secret()
            two_factor.totp_secret_encrypted = TwoFactorService.encrypt_secret(raw_secret)
            two_factor.is_enabled = False
            db.add(two_factor)
            db.commit()
        else:
            raw_secret = TwoFactorService.decrypt_secret(two_factor.totp_secret_encrypted)

    provisioning_uri = TwoFactorService.get_provisioning_uri(raw_secret, user.email)
    qr_code_b64 = TwoFactorService.generate_qr_code_base64(provisioning_uri)

    return TwoFactorSetupResponse(
        challenge_id=challenge.id,
        requires_2fa_setup=True,
        issuer=settings.TOTP_ISSUER,
        account_name=user.email,
        qr_code=qr_code_b64,
        manual_setup_key=raw_secret,
    )


@router.post("/2fa/confirm-setup", response_model=TokenResponse)
def confirm_2fa_setup(
    payload: TwoFactorConfirmSetupRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Confirm initial TOTP code, activate two-factor authentication, generate 10 recovery codes,
    and issue a fully authenticated session token.
    """
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")[:500] if request else None

    challenge = TwoFactorService.get_valid_challenge(db, payload.challenge_id, for_update=True)
    if challenge is None or challenge.purpose not in {"TWO_FACTOR_SETUP", "TWO_FACTOR_REPLACE"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired setup challenge. Please restart the sign-in process.",
        )

    user = db.scalar(select(User).options(joinedload(User.roles)).where(User.id == challenge.user_id))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive or not found.",
        )

    two_factor = db.scalar(
        select(UserTwoFactorAuth).where(UserTwoFactorAuth.user_id == user.id).with_for_update()
    )
    if two_factor is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Two-factor configuration not found. Please restart setup.",
        )

    decrypted_secret = TwoFactorService.decrypt_secret(two_factor.totp_secret_encrypted)

    matched_ts = TwoFactorService.get_matched_totp_timestep(decrypted_secret, payload.code, valid_window=1)
    if matched_ts is None:
        db.add(
            AuditLog(
                user_id=user.id,
                module="auth",
                action="auth.two_factor_verification_failed",
                entity_name="AuthenticationChallenge",
                entity_id=str(challenge.id),
                details={"reason": "Initial TOTP confirmation code invalid"},
                ip_address=client_ip,
                user_agent=user_agent,
            )
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code.",
        )

    now = datetime.now(timezone.utc)
    two_factor.is_enabled = True
    two_factor.enabled_at = now
    two_factor.last_verified_at = now
    two_factor.last_verified_code_hash = TwoFactorService.hash_code(payload.code)
    two_factor.last_verified_timestep = matched_ts
    db.add(two_factor)

    # Generate 10 single-use recovery codes
    raw_recovery_codes = TwoFactorService.generate_recovery_codes(10)
    TwoFactorService.store_recovery_codes(db, user.id, raw_recovery_codes)

    # Mark challenge consumed atomically
    TwoFactorService.consume_challenge(db, challenge)

    # Commit atomic verification and consumption state before issuing token
    db.commit()

    # Issue fully authenticated token
    token_resp = _issue_authenticated_token(user, db, recovery_codes=raw_recovery_codes)

    db.add(
        AuditLog(
            user_id=user.id,
            module="auth",
            action="auth.two_factor_enabled",
            entity_name="UserTwoFactorAuth",
            entity_id=str(two_factor.id),
            details={"status": "enabled", "recovery_codes_generated": 10},
            ip_address=client_ip,
            user_agent=user_agent,
        )
    )
    db.commit()

    # Trigger authority security emails if authority user logged in
    try:
        AuthoritySecurityEmailService.handle_successful_authority_login(
            db=db,
            user=user,
            client_ip=client_ip,
            user_agent=user_agent,
        )
    except Exception as _sec_err:
        logger.error(f"[Auth Security] Hook failed: {_sec_err}")

    return token_resp


@router.post("/2fa/verify", response_model=TokenResponse)
def verify_2fa_login(
    payload: TwoFactorVerifyRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Verify 6-digit TOTP code during authority login.
    Enforces rate limits, replay protection, and single-use challenge consumption.
    """
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")[:500] if request else None

    challenge = TwoFactorService.get_valid_challenge(
        db, payload.challenge_id, purpose="TWO_FACTOR_LOGIN", for_update=True
    )
    if challenge is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired 2FA login challenge. Please sign in again.",
        )

    user = db.scalar(select(User).options(joinedload(User.roles)).where(User.id == challenge.user_id))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive or not found.",
        )

    # Rate limiting on TOTP attempts
    if TwoFactorService.is_rate_limited(db, user.email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed verification attempts. Please try again in {settings.FAILED_LOGIN_LOCKOUT_MINUTES} minutes.",
        )

    two_factor = db.scalar(
        select(UserTwoFactorAuth).where(
            UserTwoFactorAuth.user_id == user.id,
            UserTwoFactorAuth.is_enabled.is_(True),
        ).with_for_update()
    )
    if two_factor is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Two-factor authentication is not active on this account.",
        )

    decrypted_secret = TwoFactorService.decrypt_secret(two_factor.totp_secret_encrypted)

    # Replay protection check against both RFC 6238 time-step and window hash
    if TwoFactorService.is_code_replayed(two_factor, payload.code, secret=decrypted_secret):
        TwoFactorService.record_attempt(db, user.email, success=False, ip_address=client_ip)
        db.add(
            AuditLog(
                user_id=user.id,
                module="auth",
                action="auth.two_factor_replay_rejected",
                entity_name="AuthenticationChallenge",
                entity_id=str(challenge.id),
                details={"reason": "Replayed OTP code rejected within window"},
                ip_address=client_ip,
                user_agent=user_agent,
            )
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security violation: This verification code was already used. Please wait for the next 30-second authenticator code.",
        )

    matched_ts = TwoFactorService.get_matched_totp_timestep(decrypted_secret, payload.code, valid_window=1)
    if matched_ts is None:
        TwoFactorService.record_attempt(db, user.email, success=False, ip_address=client_ip)
        db.add(
            AuditLog(
                user_id=user.id,
                module="auth",
                action="auth.two_factor_verification_failed",
                entity_name="AuthenticationChallenge",
                entity_id=str(challenge.id),
                details={"reason": "Invalid TOTP code"},
                ip_address=client_ip,
                user_agent=user_agent,
            )
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired verification code.",
        )

    # Success: consume challenge and update verification metadata atomically
    now = datetime.now(timezone.utc)
    two_factor.last_verified_at = now
    two_factor.last_verified_code_hash = TwoFactorService.hash_code(payload.code)
    two_factor.last_verified_timestep = matched_ts
    db.add(two_factor)

    TwoFactorService.consume_challenge(db, challenge)
    TwoFactorService.record_attempt(db, user.email, success=True, ip_address=client_ip)

    # Commit atomic verification and single-use challenge consumption before issuing token
    db.commit()

    token_resp = _issue_authenticated_token(user, db)

    db.add(
        AuditLog(
            user_id=user.id,
            module="auth",
            action="auth.two_factor_verification_succeeded",
            entity_name="AuthenticationChallenge",
            entity_id=str(challenge.id),
            details={"status": "verified"},
            ip_address=client_ip,
            user_agent=user_agent,
        )
    )
    db.commit()

    # Trigger authority security emails if authority user logged in
    try:
        AuthoritySecurityEmailService.handle_successful_authority_login(
            db=db,
            user=user,
            client_ip=client_ip,
            user_agent=user_agent,
            used_recovery_code=False,
        )
    except Exception as _sec_err:
        logger.error(f"[Auth Security] Hook failed: {_sec_err}")

    return token_resp


@router.post("/2fa/recovery", response_model=TokenResponse)
def verify_2fa_recovery(
    payload: TwoFactorRecoveryRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Authenticate an authority using a single-use backup recovery code.
    Atomically consumes the recovery code upon verification.
    """
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")[:500] if request else None

    challenge = TwoFactorService.get_valid_challenge(
        db, payload.challenge_id, purpose="TWO_FACTOR_LOGIN", for_update=True
    )
    if challenge is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired 2FA login challenge. Please sign in again.",
        )

    user = db.scalar(select(User).options(joinedload(User.roles)).where(User.id == challenge.user_id))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive or not found.",
        )

    if TwoFactorService.is_rate_limited(db, user.email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed verification attempts. Please try again in {settings.FAILED_LOGIN_LOCKOUT_MINUTES} minutes.",
        )

    consumed_ok = TwoFactorService.verify_and_consume_recovery_code(db, user.id, payload.recovery_code)
    if not consumed_ok:
        TwoFactorService.record_attempt(db, user.email, success=False, ip_address=client_ip)
        db.add(
            AuditLog(
                user_id=user.id,
                module="auth",
                action="auth.two_factor_recovery_code_failed",
                entity_name="AuthenticationChallenge",
                entity_id=str(challenge.id),
                details={"reason": "Invalid or consumed recovery code"},
                ip_address=client_ip,
                user_agent=user_agent,
            )
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or already consumed backup recovery code.",
        )

    two_factor = db.scalar(
        select(UserTwoFactorAuth).where(UserTwoFactorAuth.user_id == user.id).with_for_update()
    )
    if two_factor:
        two_factor.last_verified_at = datetime.now(timezone.utc)
        db.add(two_factor)

    TwoFactorService.consume_challenge(db, challenge)
    TwoFactorService.record_attempt(db, user.email, success=True, ip_address=client_ip)

    # Commit atomic redemption and challenge consumption before issuing token
    db.commit()

    token_resp = _issue_authenticated_token(user, db)

    db.add(
        AuditLog(
            user_id=user.id,
            module="auth",
            action="auth.two_factor_recovery_code_used",
            entity_name="AuthenticationChallenge",
            entity_id=str(challenge.id),
            details={"status": "recovery_success"},
            ip_address=client_ip,
            user_agent=user_agent,
        )
    )
    db.commit()

    # Trigger authority security emails if authority user logged in
    try:
        AuthoritySecurityEmailService.handle_successful_authority_login(
            db=db,
            user=user,
            client_ip=client_ip,
            user_agent=user_agent,
            used_recovery_code=True,
        )
    except Exception as _sec_err:
        logger.error(f"[Auth Security] Hook failed: {_sec_err}")

    return token_resp


@router.get("/2fa/status", response_model=TwoFactorStatusResponse)
def get_2fa_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TwoFactorStatusResponse:
    """
    Get 2FA status and count of remaining unused recovery codes for authenticated caller.
    """
    two_factor = db.scalar(
        select(UserTwoFactorAuth).where(UserTwoFactorAuth.user_id == current_user.id)
    )
    remaining_codes = TwoFactorService.count_remaining_recovery_codes(db, current_user.id)

    if two_factor is None or not two_factor.is_enabled:
        return TwoFactorStatusResponse(
            is_enabled=False,
            enabled_at=None,
            last_verified_at=None,
            remaining_recovery_codes=0,
        )

    return TwoFactorStatusResponse(
        is_enabled=True,
        enabled_at=two_factor.enabled_at,
        last_verified_at=two_factor.last_verified_at,
        remaining_recovery_codes=remaining_codes,
    )


@router.post("/2fa/recovery-codes/regenerate", response_model=TwoFactorRecoveryCodesResponse)
def regenerate_recovery_codes(
    payload: TwoFactorRegenerateRecoveryCodesRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TwoFactorRecoveryCodesResponse:
    """
    Regenerate 10 fresh backup recovery codes.
    Requires strong re-authentication (password + current TOTP code).
    """
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "")[:500] if request else None

    # 1. Verify password
    if not current_user.password_hash or not verify_password(payload.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password.",
        )

    # 2. Verify current TOTP code
    two_factor = db.scalar(
        select(UserTwoFactorAuth).where(
            UserTwoFactorAuth.user_id == current_user.id,
            UserTwoFactorAuth.is_enabled.is_(True),
        )
    )
    if two_factor is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Two-factor authentication is not active on this account.",
        )

    decrypted_secret = TwoFactorService.decrypt_secret(two_factor.totp_secret_encrypted)
    if not TwoFactorService.verify_totp_code(decrypted_secret, payload.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code.",
        )

    # Generate 10 new recovery codes
    raw_recovery_codes = TwoFactorService.generate_recovery_codes(10)
    TwoFactorService.store_recovery_codes(db, current_user.id, raw_recovery_codes)

    db.add(
        AuditLog(
            user_id=current_user.id,
            module="auth",
            action="auth.two_factor_recovery_codes_regenerated",
            entity_name="UserTwoFactorAuth",
            entity_id=str(two_factor.id),
            details={"count": 10},
            ip_address=client_ip,
            user_agent=user_agent,
        )
    )
    db.commit()

    return TwoFactorRecoveryCodesResponse(
        recovery_codes=raw_recovery_codes,
        message="10 fresh recovery codes have been generated. Previous codes have been invalidated.",
    )


@router.get("/me", response_model=AuthenticatedUserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuthenticatedUserResponse:
    """
    Retrieve authenticated user identity, generic roles, and institutional authority scope.
    """
    return build_authenticated_user_response(current_user, db)



@router.post("/verify", response_model=TokenVerifyResponse, response_model_exclude_none=True)
def verify_token(
    payload: Optional[TokenVerifyRequest] = None,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> TokenVerifyResponse:
    """
    Pillar token verification contract endpoint.
    Allows independent pillars (e.g. NIVARAN) to verify caller token authenticity and active user status
    without accessing the VYASA Core database directly.
    """
    raw_token = None
    if payload and payload.token:
        raw_token = payload.token.strip()
    elif authorization:
        raw_token = authorization.strip()

    if not raw_token:
        return TokenVerifyResponse(valid=False, user=None)

    if raw_token.startswith("Bearer "):
        raw_token = raw_token.split("Bearer ", 1)[1].strip()

    token_payload = decode_access_token(raw_token, verify_issuer=True)
    if not token_payload:
        return TokenVerifyResponse(valid=False, user=None)

    sub = token_payload.get("sub")
    if not sub:
        return TokenVerifyResponse(valid=False, user=None)

    try:
        user_uuid = uuid.UUID(sub)
    except (ValueError, AttributeError):
        return TokenVerifyResponse(valid=False, user=None)

    # Verify user currently exists and is active in VYASA Core database
    stmt = select(User).options(joinedload(User.roles)).where(User.id == user_uuid)
    user = db.execute(stmt).unique().scalar_one_or_none()

    if not user or not user.is_active:
        return TokenVerifyResponse(valid=False, user=None)

    user_resp = AuthenticatedUserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        roles=[r.name for r in user.roles],
    )
    return TokenVerifyResponse(valid=True, user=user_resp)


@router.get("/subjects", response_model=List[SubjectResponse])
def get_subjects(db: Session = Depends(get_db)) -> List[SubjectResponse]:
    """
    Retrieve active institutional subjects for applicant registration.
    Returns only verified, active database-backed institutional subjects.
    Does not present hardcoded catalog subjects when database taxonomy is uninitialized.
    """
    db_subjects = db.execute(
        select(Subject).where(Subject.is_active == True).order_by(Subject.name.asc())
    ).scalars().all()
    return [SubjectResponse(id=s.id, name=s.name) for s in db_subjects]


@router.post(
    "/register",
    response_model=ApplicantRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_applicant(
    payload: ApplicantRegisterRequest,
    db: Session = Depends(get_db),
) -> ApplicantRegistrationResponse:
    """
    Register a new applicant in VYASA Core.
    Creates user identity, assigns generic 'applicant' role,
    and establishes the base applicant profile within an atomic transaction.
    """
    # 1. Normalize and validate email uniqueness
    normalized_email = payload.email.lower().strip()
    existing_user_stmt = select(User).where(func.lower(User.email) == normalized_email)
    if db.execute(existing_user_stmt).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists",
        )

    # 2. Check PhD registration number uniqueness if provided
    normalized_phd_reg = payload.phd_registration_number.strip() if payload.phd_registration_number else None
    if normalized_phd_reg:
        existing_phd_stmt = select(ApplicantProfile).where(
            func.lower(ApplicantProfile.phd_registration_number) == normalized_phd_reg.lower()
        )
        if db.execute(existing_phd_stmt).scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this PhD registration number already exists",
            )

    # 3. Validate subject taxonomy availability and subject ID against active database taxonomy
    active_subjects_count = db.scalar(
        select(func.count(Subject.id)).where(Subject.is_active == True)
    ) or 0
    if active_subjects_count == 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Institutional academic subject taxonomy is not initialized. Registration is temporarily unavailable.",
        )

    db_subject = db.execute(
        select(Subject).where(Subject.id == payload.subject_id)
    ).scalar_one_or_none()

    if not db_subject:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid subject ID. Subject does not exist or is inactive.",
        )

    if not db_subject.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected subject is inactive.",
        )

    resolved_subject_name = db_subject.name

    # 4. Resolve default 'applicant' role
    role_stmt = select(Role).where(Role.name == "applicant")
    applicant_role = db.execute(role_stmt).scalar_one_or_none()
    if not applicant_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default applicant role not configured in system",
        )

    # 5. Name parsing
    full_name_clean = payload.full_name.strip()
    name_parts = full_name_clean.split()
    if len(name_parts) == 1:
        first_name = name_parts[0]
        last_name = "-"
    else:
        first_name = " ".join(name_parts[:-1])
        last_name = name_parts[-1]

    # 6. Atomic User & Profile Creation
    try:
        new_user = User(
            email=normalized_email,
            password_hash=hash_password(payload.password),
            first_name=first_name,
            last_name=last_name,
            phone=payload.phone.strip() if payload.phone else None,
            is_active=True,
            is_verified=False,
        )
        new_user.roles.append(applicant_role)
        db.add(new_user)
        db.flush()

        new_profile = ApplicantProfile(
            user_id=new_user.id,
            phd_registration_number=normalized_phd_reg,
            department=payload.department.strip() if payload.department else None,
            subject_id=payload.subject_id,
            subject_name=resolved_subject_name,
        )
        db.add(new_profile)
        db.commit()
        db.refresh(new_user)
        db.refresh(new_profile)
    except Exception:
        db.rollback()
        raise

    return ApplicantRegistrationResponse(
        message="Registration successful",
        user_id=new_user.id,
        email=new_user.email,
        full_name=f"{new_user.first_name} {new_user.last_name}".strip(),
        role="applicant",
        subject_id=new_profile.subject_id,
        subject_name=new_profile.subject_name,
        phd_registration_number=new_profile.phd_registration_number,
    )
