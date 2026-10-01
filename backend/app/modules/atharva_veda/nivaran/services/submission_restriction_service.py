import logging
import re
import uuid
from datetime import datetime, time, timezone
from typing import Optional, List
from zoneinfo import ZoneInfo
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.audit import AuditLog
from app.models.user import User
from app.modules.atharva_veda.nivaran.models.grievance import Grievance
from app.modules.atharva_veda.nivaran.models.enums import GrievanceStatus

logger = logging.getLogger("vyasa.atharva.submission_restrictions")

ACTIVE_GRIEVANCE_STATUSES = [
    GrievanceStatus.SUBMITTED,
    GrievanceStatus.AI_PROCESSING,
    GrievanceStatus.PENDING_REVIEW,
    GrievanceStatus.ASSIGNED,
    GrievanceStatus.IN_PROGRESS,
    GrievanceStatus.AWAITING_INFORMATION,
    GrievanceStatus.ESCALATED,
    GrievanceStatus.REOPENED,
]

DAILY_SUBMISSION_LIMIT = 5
SIMILARITY_THRESHOLD = 0.85


def normalize_text(text: Optional[str]) -> str:
    """Normalizes punctuation and casing for textual similarity analysis."""
    if not text:
        return ""
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return " ".join(cleaned.split())


def extract_core_subject(text: Optional[str]) -> str:
    """Extracts the underlying subject matter by stripping standard formal prefixes."""
    cleaned = normalize_text(text)
    prefixes = [
        "application for change of",
        "application for",
        "request for change of",
        "request for",
        "issue regarding",
        "grievance regarding",
        "complaint regarding",
        "matter regarding",
        "matter of",
        "regarding",
        "sub",
        "subject",
    ]
    for p in sorted(prefixes, key=len, reverse=True):
        if cleaned.startswith(p + " "):
            cleaned = cleaned[len(p):].strip()
    return cleaned


def check_daily_submission_limit(db: Session, applicant: User) -> None:
    """
    Validates that the applicant has not exceeded the institutional daily grievance submission limit
    (5 per rolling calendar day) in the Asia/Kolkata timezone.
    """
    tz_str = getattr(settings, "APPLICATION_TIMEZONE", "Asia/Kolkata")
    try:
        local_tz = ZoneInfo(tz_str)
    except Exception:
        local_tz = ZoneInfo("Asia/Kolkata")

    now_local = datetime.now(local_tz)
    start_of_day_local = datetime.combine(now_local.date(), time.min, tzinfo=local_tz)
    start_of_day_utc = start_of_day_local.astimezone(timezone.utc)

    stmt = select(Grievance).where(
        Grievance.applicant_vyasa_user_id == applicant.id,
        Grievance.created_at >= start_of_day_utc,
    )
    todays_grievances = db.scalars(stmt).all()
    count = len(todays_grievances)

    if count >= DAILY_SUBMISSION_LIMIT:
        logger.warning(
            f"[Quota Exceeded] Applicant {applicant.id} ({applicant.email}) has reached daily limit "
            f"of {DAILY_SUBMISSION_LIMIT} submissions for date {now_local.date()}."
        )
        audit_entry = AuditLog(
            user_id=applicant.id,
            module="atharva_veda",
            action="APPLICANT_DAILY_LIMIT_EXCEEDED",
            entity_name="Grievance",
            entity_id=str(applicant.id),
            details={
                "daily_limit": DAILY_SUBMISSION_LIMIT,
                "submission_count": count,
                "date": str(now_local.date()),
            },
        )
        db.add(audit_entry)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Daily grievance submission limit reached. A maximum of {DAILY_SUBMISSION_LIMIT} "
                "grievances may be submitted per calendar day. Please try again tomorrow."
            ),
        )


def compute_tfidf_cosine_similarity(text1: str, text2: str) -> float:
    """
    Computes TF-IDF vector cosine similarity between two texts.
    Falls back gracefully to token-overlap Jaccard coefficient if scikit-learn is unavailable.
    """
    t1_norm = normalize_text(text1)
    t2_norm = normalize_text(text2)
    if not t1_norm or not t2_norm:
        return 0.0

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity

        vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
        tfidf_matrix = vectorizer.fit_transform([t1_norm, t2_norm])
        sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        return float(sim)
    except Exception as e:
        logger.debug(f"[Similarity] Scikit-learn fallback to token overlap: {e}")
        words1 = set(t1_norm.split())
        words2 = set(t2_norm.split())
        if not words1 or not words2:
            return 0.0
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        return len(intersection) / len(union)


def check_similar_active_grievance(
    db: Session,
    applicant: User,
    title: str,
    description: str,
    subject_id: Optional[uuid.UUID] = None,
    category_id: Optional[uuid.UUID] = None,
    predicted_category: Optional[str] = None,
) -> None:
    """
    Enforces active grievance deduplication for the submitting applicant matching NIVARAN reference:
    1. Same Category Hard Block: Cannot file multiple active grievances in the same category.
    2. Same Subject & Title Hard Block: Cannot file identical subject matters simultaneously.
    3. Semantic Text Similarity: TF-IDF cosine similarity >= 0.85 triggers HTTP 409 Conflict.
    Preserves CLOSED and RESOLVED historical grievances without blocking new inquiries.
    """
    stmt = select(Grievance).where(
        Grievance.applicant_vyasa_user_id == applicant.id,
        Grievance.status.in_(ACTIVE_GRIEVANCE_STATUSES),
    )
    active_grievances = db.scalars(stmt).all()

    if not active_grievances:
        return

    # If predicted_category name given, resolve to category_id
    if not category_id and predicted_category:
        try:
            from app.modules.atharva_veda.nivaran.services.ai_processing_service import resolve_db_category
            resolved = resolve_db_category(db, predicted_category)
            if resolved:
                category_id = resolved.id
        except Exception as e:
            logger.debug(f"[Similarity Detection] Category resolution note: {e}")

    new_full_text = f"{title} {description}"
    norm_new_title = normalize_text(title)
    core_new_title = extract_core_subject(title)

    for existing in active_grievances:
        # Rule 1: Category collision (if category is resolved)
        if category_id:
            existing_cat = existing.final_category_id or existing.category_id
            if existing_cat == category_id:
                cat_name = existing.category.name if existing.category else "the category"
                logger.info(
                    f"[Duplicate Category] Applicant {applicant.id} duplicate category attempt against {existing.grievance_id}"
                )
                audit_entry = AuditLog(
                    user_id=applicant.id,
                    module="atharva_veda",
                    action="SIMILAR_GRIEVANCE_BLOCKED",
                    entity_name="Grievance",
                    entity_id=str(existing.id),
                    details={
                        "existing_grievance_id": existing.grievance_id,
                        "reason": f"Same active category collision ({cat_name})",
                    },
                )
                db.add(audit_entry)
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Duplicate active grievance detected: You already have an active grievance "
                        f"({existing.grievance_id}) currently in process under {cat_name}."
                    ),
                )

        # Rule 2: Subject & exact title match (if subject_id known or titles match)
        norm_exist_title = normalize_text(existing.title)
        core_exist_title = extract_core_subject(existing.title)
        is_title_match = (norm_new_title and norm_exist_title and norm_new_title == norm_exist_title)
        is_core_match = (len(core_new_title) >= 5 and core_new_title == core_exist_title)

        if (subject_id and existing.subject_id == subject_id and is_title_match) or is_core_match:
            audit_entry = AuditLog(
                user_id=applicant.id,
                module="atharva_veda",
                action="SIMILAR_GRIEVANCE_BLOCKED",
                entity_name="Grievance",
                entity_id=str(existing.id),
                details={
                    "existing_grievance_id": existing.grievance_id,
                    "reason": f"Same subject match ('{existing.title}')",
                },
            )
            db.add(audit_entry)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Duplicate active grievance detected: You already have an active grievance "
                    f"({existing.grievance_id}) with identical subject matter."
                ),
            )

        # Rule 3: Semantic Cosine Similarity >= 0.85
        existing_full_text = f"{existing.title} {existing.description}"
        sim_score = compute_tfidf_cosine_similarity(new_full_text, existing_full_text)
        if sim_score >= SIMILARITY_THRESHOLD:
            logger.info(
                f"[Semantic Duplicate] Applicant {applicant.id} matched active grievance {existing.grievance_id} "
                f"with similarity score {sim_score:.4f} >= {SIMILARITY_THRESHOLD}"
            )
            audit_entry = AuditLog(
                user_id=applicant.id,
                module="atharva_veda",
                action="SIMILAR_GRIEVANCE_BLOCKED",
                entity_name="Grievance",
                entity_id=str(existing.id),
                details={
                    "existing_grievance_id": existing.grievance_id,
                    "similarity_score": round(sim_score, 4),
                    "reason": f"High semantic text similarity ({int(sim_score * 100)}%)",
                },
            )
            db.add(audit_entry)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Duplicate active grievance detected: A highly similar active grievance ({existing.grievance_id}) "
                    f"is already under investigation (similarity {int(sim_score * 100)}%). Duplicate submissions are not permitted."
                ),
            )
