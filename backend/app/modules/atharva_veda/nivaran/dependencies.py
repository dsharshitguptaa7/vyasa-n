"""
Atharva Veda (NIVARAN-AI) Dependencies
Guarantees strict separation between Applicant, Admin, and Institutional Authority personas.
"""
import re
from typing import Optional, Set
from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.config import settings
from app.models.user import User
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole

# Institutional jurisdiction and designation specifications for Dean Executive Authority
CANONICAL_DEAN_RD_DESIGNATION = "Dean of Research & Development"
DEAN_RD_DESIGNATION_ALIASES: Set[str] = {
    "dean of research & development",
    "dean, research & development",
    "dean research & development",
    "dean of research and development",
    "dean, research and development",
    "dean research and development",
    "dean of r&d",
    "dean, r&d",
    "dean (r&d)",
    "dean r&d",
    "dean of research",
    "dean, research",
}
RD_DEPARTMENTS: Set[str] = {"r&d", "research & development", "research and development", "research"}
NON_RD_DEPARTMENTS: Set[str] = {"academics", "academic affairs", "student affairs", "student welfare", "examinations", "administration"}


def is_authorized_dean_of_rd(authority: Optional[NivaranAuthority], user: User) -> bool:
    """
    Validates institutional jurisdiction for Dean of Research & Development:
    1. Caller must have an active NivaranAuthority profile with role == DEAN.
    2. Caller must belong to the authorized institutional domain (e.g. csjmu.ac.in).
    3. Caller's designation or department must match the Research & Development jurisdiction,
       and must not belong to a foreign department/faculty (e.g. Academic Affairs).
    """
    if not authority or authority.role != NivaranRole.DEAN:
        return False

    # 1. Institutional domain validation (CSJMU)
    inst_domain = settings.SUPPORT_CONTACT_EMAIL.split("@")[-1].lower() if "@" in settings.SUPPORT_CONTACT_EMAIL else "csjmu.ac.in"
    user_email = (user.email or "").strip().lower()
    user_domain = user_email.split("@")[-1] if "@" in user_email else ""
    if user_domain != inst_domain and not user_email.endswith("@csjmu.ac.in"):
        return False

    # 2. Department check
    dept = (authority.department or "").strip().lower()
    if dept in NON_RD_DEPARTMENTS:
        return False

    # 3. Designation normalization and alias matching
    desig = (authority.designation or "").strip().lower()
    norm_desig = re.sub(r"\s+", " ", re.sub(r"[,()\-]", " ", desig)).strip()

    is_alias_match = desig in DEAN_RD_DESIGNATION_ALIASES or norm_desig in {
        re.sub(r"\s+", " ", re.sub(r"[,()\-]", " ", a)).strip() for a in DEAN_RD_DESIGNATION_ALIASES
    }
    has_rd_keywords = "research" in desig or "r&d" in desig or "r & d" in desig
    is_rd_dept = dept in RD_DEPARTMENTS

    # Non-R&D exclusion: if explicitly assigned to another faculty/domain without R&D
    if any(k in desig for k in ("academic", "student welfare", "student affairs", "examination")) and not has_rd_keywords:
        return False

    return is_alias_match or (has_rd_keywords and (is_rd_dept or not dept)) or (is_rd_dept and not desig)


def get_current_atharva_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Validates that the current user has an active platform session.
    """
    return current_user


def get_current_nivaran_authority(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Optional[NivaranAuthority]:
    """
    Resolves active institutional authority record for the authenticated caller, if appointed.
    """
    return db.scalar(
        select(NivaranAuthority).where(
            NivaranAuthority.vyasa_user_id == current_user.id,
            NivaranAuthority.is_active.is_(True),
        )
    )


def require_atharva_applicant(current_user: User = Depends(get_current_user)) -> User:
    """
    Validates that the caller is an active user with the 'applicant' platform role.
    Institutional authorities and platform administrators without applicant role are denied.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your user account is deactivated.",
        )

    roles = [r.name.lower() for r in current_user.roles]
    if "applicant" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to registered applicants only.",
        )
    return current_user


def require_atharva_manager(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Validates that the caller is an appointed Institutional Authority with the MANAGER role.
    Administrators, applicants, and other authority roles are denied business triage access.
    """
    authority = db.scalar(
        select(NivaranAuthority).where(
            NivaranAuthority.vyasa_user_id == current_user.id,
            NivaranAuthority.is_active.is_(True),
        )
    )
    if not authority or authority.role != NivaranRole.MANAGER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Atharva Veda Managers.",
        )
    return current_user


def require_atharva_assistant_dean(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Validates that the caller is an appointed Institutional Authority with the ASSISTANT_DEAN role.
    """
    authority = db.scalar(
        select(NivaranAuthority).where(
            NivaranAuthority.vyasa_user_id == current_user.id,
            NivaranAuthority.is_active.is_(True),
        )
    )
    if not authority or authority.role != NivaranRole.ASSISTANT_DEAN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Atharva Veda Assistant Deans.",
        )
    return current_user


def require_atharva_associate_dean(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Validates that the caller is an appointed Institutional Authority with the ASSOCIATE_DEAN role.
    """
    authority = db.scalar(
        select(NivaranAuthority).where(
            NivaranAuthority.vyasa_user_id == current_user.id,
            NivaranAuthority.is_active.is_(True),
        )
    )
    if not authority or authority.role != NivaranRole.ASSOCIATE_DEAN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Atharva Veda Associate Deans.",
        )
    return current_user


def require_atharva_dean(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Validates that the caller is an appointed Institutional Authority with the DEAN role
    specifically within the Dean of Research & Development institutional jurisdiction.
    """
    authority = db.scalar(
        select(NivaranAuthority).where(
            NivaranAuthority.vyasa_user_id == current_user.id,
            NivaranAuthority.is_active.is_(True),
        )
    )
    if not authority or authority.role != NivaranRole.DEAN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Atharva Veda Dean.",
        )
    
    if not is_authorized_dean_of_rd(authority, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institutional Jurisdiction Restricted: Dean of Research & Development Required.",
        )

    return current_user


def require_can_form_committee(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Enforces that only Associate Deans and Deans can form committees directly.
    Assistant Deans receive a clear 403 Forbidden explaining they can only request formation.
    """
    authority = db.scalar(
        select(NivaranAuthority).where(
            NivaranAuthority.vyasa_user_id == current_user.id,
            NivaranAuthority.is_active.is_(True),
        )
    )
    if not authority:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institutional authority profile required.",
        )
    if authority.role == NivaranRole.ASSISTANT_DEAN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assistant Deans cannot directly form committees; please submit a Committee Formation Request.",
        )
    if authority.role not in (NivaranRole.ASSOCIATE_DEAN, NivaranRole.DEAN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Associate Deans and Deans are authorized to form committees.",
        )
    return current_user


def require_can_review_committee_request(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Enforces that only Associate Deans and Deans can review committee requests.
    """
    authority = db.scalar(
        select(NivaranAuthority).where(
            NivaranAuthority.vyasa_user_id == current_user.id,
            NivaranAuthority.is_active.is_(True),
        )
    )
    if not authority:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institutional authority profile required.",
        )
    if authority.role == NivaranRole.ASSISTANT_DEAN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assistant Deans are not authorized to review committee formation requests.",
        )
    if authority.role not in (NivaranRole.ASSOCIATE_DEAN, NivaranRole.DEAN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Associate Deans and Deans are authorized to review committee formation requests.",
        )
    return current_user


def require_atharva_authority(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Validates that the caller is an appointed active Nivaran authority.
    """
    authority = db.scalar(
        select(NivaranAuthority).where(
            NivaranAuthority.vyasa_user_id == current_user.id,
            NivaranAuthority.is_active.is_(True),
        )
    )
    if not authority:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institutional authority profile required.",
        )
    return current_user
