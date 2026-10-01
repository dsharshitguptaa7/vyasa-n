from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, require_applicant_user
from app.models.applicant_profile import ApplicantProfile
from app.models.user import User
from app.schemas.applicant import ApplicantProfileResponse

router = APIRouter(prefix="/applicant", tags=["Applicant Operations"])


@router.get("/profile", response_model=ApplicantProfileResponse)
def get_applicant_profile(
    current_user: User = Depends(require_applicant_user),
    db: Session = Depends(get_db),
) -> ApplicantProfileResponse:
    """
    Retrieve authenticated applicant's profile and academic assignment details.
    Guarded by authentication and generic 'applicant' platform role.
    Strictly scoped to the calling user's identity.
    """
    stmt = select(ApplicantProfile).where(ApplicantProfile.user_id == current_user.id)
    profile = db.execute(stmt).scalar_one_or_none()

    role_names = [r.name for r in current_user.roles]

    return ApplicantProfileResponse(
        id=profile.id if profile else current_user.id,
        user_id=current_user.id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        full_name=f"{current_user.first_name} {current_user.last_name}".strip(),
        phone=current_user.phone,
        roles=role_names,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        phd_registration_number=profile.phd_registration_number if profile else None,
        department=profile.department if profile else None,
        subject_id=profile.subject_id if profile else None,
        subject_name=profile.subject_name if profile else None,
        created_at=profile.created_at if profile else current_user.created_at,
    )
