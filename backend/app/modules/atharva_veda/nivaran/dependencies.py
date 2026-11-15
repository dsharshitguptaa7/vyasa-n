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

# Canonical authority specifications for Dean Executive Authority
CANONICAL_DEAN_DESIGNATION = "Dean"
CANONICAL_DEAN_RD_DESIGNATION = "Dean"  # Deprecated alias pointing to canonical Dean designation


def is_authorized_dean(authority: Optional[NivaranAuthority], user: User) -> bool:
    """
    Validates institutional jurisdiction and authority mapping for the canonical Dean authority:
    1. Caller must have an active NivaranAuthority profile with canonical role == DEAN.
    2. Caller must belong to the authorized institutional domain (e.g. csjmu.ac.in).
    3. Institutional jurisdiction restrictions are strictly enforced without requiring any fragile
       sub-department or designation string (e.g. 'Dean of Research & Development').
    """
    if not authority or authority.role != NivaranRole.DEAN or not getattr(authority, "is_active", True):
        return False

    # 1. Institutional domain validation (CSJMU / configured institutional domain)
    inst_domain = settings.SUPPORT_CONTACT_EMAIL.split("@")[-1].lower() if "@" in settings.SUPPORT_CONTACT_EMAIL else "csjmu.ac.in"
    user_email = (user.email or getattr(authority, "email_snapshot", "") or "").strip().lower()
    user_domain = user_email.split("@")[-1] if "@" in user_email else ""

    is_institutional_email = (
        user_domain == inst_domain or
        user_email.endswith("@" + inst_domain) or
        user_email.endswith("." + inst_domain) or
        user_email.endswith("@csjmu.ac.in") or
        user_email.endswith(".csjmu.ac.in")
    )
    if not is_institutional_email:
        return False

    return True


# Backward compatibility alias
is_authorized_dean_of_rd = is_authorized_dean


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
    Validates that the caller is an appointed Institutional Authority with the canonical DEAN role
    within the authorized institutional jurisdiction.
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
    
    if not is_authorized_dean(authority, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Institutional Jurisdiction Restricted: Authorized Dean Required.",
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
