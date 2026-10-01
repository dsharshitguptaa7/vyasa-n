"""
Atharva Veda (NIVARAN-AI) Dependencies
Guarantees strict separation between Applicant, Admin, and Institutional Authority personas.
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole


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
    Validates that the caller is an appointed Institutional Authority with the DEAN role.
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
    return current_user

