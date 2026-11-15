import logging
import re
import uuid
from typing import Any, Dict, List, Optional, Set
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.applicant_profile import ApplicantProfile
from app.models.user import User
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.sama_veda.models.author import ResearchAuthor

logger = logging.getLogger("vyasa.sama_veda.directory_sync")

HONORIFIC_PREFIXES = [
    "prof. dr.",
    "prof dr",
    "dr.",
    "prof.",
    "mr.",
    "ms.",
    "mrs.",
    "er.",
    "dr ",
    "prof ",
    "mr ",
    "ms ",
    "mrs ",
    "er ",
    "shri.",
    "smt.",
    "shri ",
    "smt ",
]


def normalize_name_tokens(name: Optional[str]) -> List[str]:
    """
    Extracts lowercase alphanumeric tokens from a full name,
    excluding common honorific titles for robust identity comparison.
    """
    if not name:
        return []
    cleaned = name.strip().lower()
    for prefix in HONORIFIC_PREFIXES:
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):].strip()
            break
    cleaned = re.sub(r"[^a-z0-9\s]", " ", cleaned)
    tokens = [t for t in cleaned.split() if len(t) > 1]
    return tokens


def normalize_name_key(name: Optional[str]) -> str:
    """Returns a joined token key for exact normalized match."""
    return " ".join(normalize_name_tokens(name))


class InstitutionalDirectorySyncService:
    """
    Synchronizes Institutional Directory identities (Authorities, Faculty, and Scholars)
    into the canonical ResearchAuthor index (sama_research_authors).
    
    Guarantees:
    - Decoupled author identities are linked to canonical User IDs when available.
    - Official institutional researchers and authorities are marked as verified (is_verified = True).
    - Idempotent: safe to run repeatedly without creating duplicates.
    - Preserves existing Scopus IDs, publications, and certificates.
    """

    @classmethod
    def sync_institutional_directory(cls, db: Session) -> Dict[str, Any]:
        """
        Scans active NivaranAuthority, ApplicantProfile, and institutional users,
        ensuring every institutional researcher exists in ResearchAuthor.
        """
        logger.info("Starting Institutional Directory synchronization for SAMIKSHA...")

        # 1. Load existing ResearchAuthor index
        existing_authors = db.execute(select(ResearchAuthor)).scalars().all()
        by_user_id: Dict[uuid.UUID, ResearchAuthor] = {}
        by_name_key: Dict[str, ResearchAuthor] = {}

        for a in existing_authors:
            if a.user_id:
                by_user_id[a.user_id] = a
            key = normalize_name_key(a.full_name)
            if key and key not in by_name_key:
                by_name_key[key] = a

        authorities_created = 0
        authorities_linked = 0
        scholars_created = 0
        scholars_linked = 0

        # 2. Sync Active Authorities (Faculty, Deans, HODs, Committee Members)
        active_authorities = db.execute(
            select(NivaranAuthority).where(NivaranAuthority.is_active == True)
        ).scalars().all()

        for auth in active_authorities:
            auth_name = (auth.name_snapshot or "").strip()
            if not auth_name:
                continue

            matched_author: Optional[ResearchAuthor] = None

            # First match by vyasa_user_id
            if auth.vyasa_user_id and auth.vyasa_user_id in by_user_id:
                matched_author = by_user_id[auth.vyasa_user_id]
            else:
                # Match by normalized name
                key = normalize_name_key(auth_name)
                if key in by_name_key:
                    matched_author = by_name_key[key]

            if matched_author:
                # Update and link
                if not matched_author.user_id and auth.vyasa_user_id:
                    matched_author.user_id = auth.vyasa_user_id
                    by_user_id[auth.vyasa_user_id] = matched_author
                if not matched_author.department and auth.department:
                    matched_author.department = auth.department.strip()
                if not matched_author.is_verified:
                    matched_author.is_verified = True
                matched_author.institutional_affiliation = "Chhatrapati Shahu Ji Maharaj University, Kanpur"
                authorities_linked += 1
            else:
                # Create verified ResearchAuthor
                new_author = ResearchAuthor(
                    id=uuid.uuid4(),
                    full_name=auth_name,
                    department=auth.department.strip() if auth.department else "Research and Development",
                    institutional_affiliation="Chhatrapati Shahu Ji Maharaj University, Kanpur",
                    user_id=auth.vyasa_user_id,
                    is_verified=True,
                    verification_notes=f"Institutional Directory Authority: {auth.role.value if hasattr(auth.role, 'value') else str(auth.role)}",
                )
                db.add(new_author)
                db.flush()

                if auth.vyasa_user_id:
                    by_user_id[auth.vyasa_user_id] = new_author
                key = normalize_name_key(auth_name)
                if key:
                    by_name_key[key] = new_author
                authorities_created += 1

        # 3. Sync Active Research Scholars (ApplicantProfile with User pre-joined)
        active_profiles_with_users = db.execute(
            select(ApplicantProfile, User)
            .join(User, ApplicantProfile.user_id == User.id)
            .where(User.is_active == True)
        ).all()

        for profile, user in active_profiles_with_users:
            scholar_name = f"{user.first_name} {user.last_name}".strip()
            if not scholar_name:
                scholar_name = user.email

            matched_author = None
            if profile.user_id in by_user_id:
                matched_author = by_user_id[profile.user_id]
            else:
                key = normalize_name_key(scholar_name)
                if key in by_name_key:
                    matched_author = by_name_key[key]

            dept = profile.department.strip() if profile.department else "Academic Research"

            if matched_author:
                if not matched_author.user_id:
                    matched_author.user_id = profile.user_id
                    by_user_id[profile.user_id] = matched_author
                if not matched_author.department:
                    matched_author.department = dept
                if not matched_author.is_verified:
                    matched_author.is_verified = True
                matched_author.institutional_affiliation = "Chhatrapati Shahu Ji Maharaj University, Kanpur"
                scholars_linked += 1
            else:
                new_author = ResearchAuthor(
                    id=uuid.uuid4(),
                    full_name=scholar_name,
                    department=dept,
                    institutional_affiliation="Chhatrapati Shahu Ji Maharaj University, Kanpur",
                    user_id=profile.user_id,
                    is_verified=True,
                    verification_notes="Institutional Directory: Registered Research Scholar",
                )
                db.add(new_author)
                db.flush()

                by_user_id[profile.user_id] = new_author
                key = normalize_name_key(scholar_name)
                if key:
                    by_name_key[key] = new_author
                scholars_created += 1

        try:
            db.commit()
            logger.info(
                "Institutional Directory sync completed successfully: "
                "Authorities created: %d, linked: %d; Scholars created: %d, linked: %d.",
                authorities_created,
                authorities_linked,
                scholars_created,
                scholars_linked,
            )
        except Exception as exc:
            db.rollback()
            logger.error("Failed to commit Institutional Directory sync: %s", exc)
            raise

        return {
            "authorities_created": authorities_created,
            "authorities_linked": authorities_linked,
            "scholars_created": scholars_created,
            "scholars_linked": scholars_linked,
            "total_synced": authorities_created + authorities_linked + scholars_created + scholars_linked,
        }

    @classmethod
    def sync_single_authority(
        cls,
        db: Session,
        authority: NivaranAuthority,
    ) -> Optional[ResearchAuthor]:
        """
        Synchronizes a newly created or updated single authority into ResearchAuthor.
        """
        auth_name = (authority.name_snapshot or "").strip()
        if not auth_name:
            return None

        # Check existing by vyasa_user_id
        author = None
        if authority.vyasa_user_id:
            author = db.execute(
                select(ResearchAuthor).where(ResearchAuthor.user_id == authority.vyasa_user_id)
            ).scalar_one_or_none()

        if not author:
            key = normalize_name_key(auth_name)
            # Find candidate by name
            candidates = db.execute(select(ResearchAuthor)).scalars().all()
            for cand in candidates:
                if normalize_name_key(cand.full_name) == key:
                    author = cand
                    break

        dept = authority.department.strip() if authority.department else "Research and Development"

        if author:
            if not author.user_id and authority.vyasa_user_id:
                author.user_id = authority.vyasa_user_id
            if not author.department:
                author.department = dept
            author.is_verified = True
            author.institutional_affiliation = "Chhatrapati Shahu Ji Maharaj University, Kanpur"
        else:
            author = ResearchAuthor(
                id=uuid.uuid4(),
                full_name=auth_name,
                department=dept,
                institutional_affiliation="Chhatrapati Shahu Ji Maharaj University, Kanpur",
                user_id=authority.vyasa_user_id,
                is_verified=True,
                verification_notes=f"Institutional Directory Authority: {authority.role.value if hasattr(authority.role, 'value') else str(authority.role)}",
            )
            db.add(author)

        db.flush()
        return author
