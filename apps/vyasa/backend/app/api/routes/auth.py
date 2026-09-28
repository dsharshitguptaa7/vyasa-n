import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies import get_current_user, get_db
from app.core.config import settings
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.core.subjects import get_canonical_subjects, get_subject_by_id
from app.models.applicant_profile import ApplicantProfile
from app.models.role import Role
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

router = APIRouter(prefix="/auth", tags=["Authentication & Identity"])


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Authenticate a VYASA Core user and issue a standardized JWT access token.
    Enforces password verification against stored PBKDF2 hash and checks account active status.
    """
    normalized_email = payload.email.lower().strip()
    stmt = (
        select(User)
        .options(joinedload(User.roles))
        .where(func.lower(User.email) == normalized_email)
    )
    user = db.execute(stmt).unique().scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact an administrator.",
        )

    # Resolve generic VYASA Core roles
    role_names = [r.name for r in user.roles]

    # Construct canonical claims
    token_claims = {
        "sub": str(user.id),
        "email": user.email,
        "roles": role_names,
    }
    access_token = create_access_token(token_claims)
    expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

    user_resp = AuthenticatedUserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        roles=role_names,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
        user=user_resp,
    )


@router.get("/me", response_model=AuthenticatedUserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
) -> AuthenticatedUserResponse:
    """
    Retrieve authenticated user identity and generic roles from the verified JWT.
    """
    return AuthenticatedUserResponse(
        id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        roles=[r.name for r in current_user.roles],
    )


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
def get_subjects() -> List[SubjectResponse]:
    """
    Retrieve canonical institutional subjects for applicant registration.
    """
    return [
        SubjectResponse(id=uuid.UUID(s["id"]), name=s["name"])
        for s in get_canonical_subjects()
    ]


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

    # 3. Validate canonical subject ID
    canonical_subject = get_subject_by_id(payload.subject_id)
    if not canonical_subject:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid subject ID. Must be a canonical institutional subject.",
        )

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
            subject_name=canonical_subject["name"],
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
