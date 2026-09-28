"""
Applicant Grievance Submission Restrictions Service.

Enforces:
1. Concurrency protection via row-level and transaction-level advisory locks.
2. Daily submission limit (3 grievances per candidate per calendar day in Asia/Kolkata).
3. Active duplicate detection:
   - Rule 1: Category match against active grievances.
   - Rule 2: Normalized subject / title match.
   - Rule 3: TF-IDF cosine similarity >= 0.85 across active grievances.
"""

import logging
import re
import uuid
from datetime import datetime, time, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import DailyLimitExceededError, SimilarActiveGrievanceError
from app.core.timezone import ist_day_bounds_utc, now_ist, now_utc, today_ist
from app.models.audit import AuditLog
from app.models.enums import GrievanceStatus
from app.models.grievance import Grievance, StudentMasterRecord
from app.models.taxonomy import Category

logger = logging.getLogger("nivaran.restrictions")

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


def acquire_submission_lock(db: Session, applicant_vyasa_user_id: uuid.UUID) -> None:
    """
    Acquire concurrency lock for applicant submission.
    1. If a StudentMasterRecord exists, serialize via row-lock with_for_update().
    2. In addition, acquire a PostgreSQL transaction-level advisory lock on applicant UUID.
    Does NOT require creating or modifying any database tables.
    """
    try:
        # Row-level lock if student master record is present
        db.execute(
            select(StudentMasterRecord.id)
            .where(StudentMasterRecord.student_vyasa_user_id == applicant_vyasa_user_id)
            .with_for_update()
        )
    except Exception as e:
        logger.debug("Row lock on StudentMasterRecord skipped: %s", e)

    try:
        # PostgreSQL transaction advisory lock (released automatically on commit/rollback)
        db.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:user_id))"),
            {"user_id": str(applicant_vyasa_user_id)},
        )
    except Exception as e:
        logger.debug("Advisory lock skipped or unsupported by dialect: %s", e)


def check_daily_submission_limit(
    db: Session,
    applicant_vyasa_user_id: uuid.UUID,
    ip_address: Optional[str] = None,
) -> None:
    """
    Enforces maximum 3 grievance submissions per applicant per calendar day in Asia/Kolkata timezone.
    All persisted grievance statuses count.
    Failed/duplicate requests that never commit a grievance row do not count.
    """
    limit = getattr(settings, "DAILY_GRIEVANCE_SUBMISSION_LIMIT", 3)
    start_of_day_utc, end_of_day_utc = ist_day_bounds_utc()
    today_date = today_ist()

    stmt = select(func.count(Grievance.id)).where(
        Grievance.applicant_vyasa_user_id == applicant_vyasa_user_id,
        Grievance.created_at >= start_of_day_utc,
        Grievance.created_at <= end_of_day_utc,
    )
    count = db.execute(stmt).scalar() or 0

    if count >= limit:
        logger.warning(
            "Applicant %s exceeded daily submission limit (%d/%d) for IST date %s",
            applicant_vyasa_user_id,
            count,
            limit,
            today_date,
        )

        # Audit log entry for throttle violation
        audit_entry = AuditLog(
            user_vyasa_id=applicant_vyasa_user_id,
            action="APPLICANT_DAILY_LIMIT_EXCEEDED",
            entity_type="Grievance",
            description=f"Applicant reached daily limit of {limit} submissions ({count} found today in IST).",
            ip_address=ip_address,
            created_at=now_utc(),
        )
        db.add(audit_entry)
        db.commit()

        raise DailyLimitExceededError(
            message="You have reached your grievance submission limit for today. Please try again tomorrow."
        )


def normalize_category_name(name: Optional[str]) -> str:
    """Resilient category normalization across kebab-case, snake_case, and spaced strings."""
    if not name:
        return ""
    return name.replace("_", " ").replace("-", " ").strip().lower()


def normalize_subject_text(text: Optional[str]) -> str:
    """Punctuation stripping and whitespace normalization for title matching."""
    if not text:
        return ""
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return " ".join(cleaned.split())


def extract_core_subject(text: Optional[str]) -> str:
    """Strips standard administrative formal prefixes from title to expose core subject matter."""
    cleaned = normalize_subject_text(text)
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
            cleaned = cleaned[len(p) :].strip()
    return cleaned


def check_similar_active_grievance(
    db: Session,
    applicant_vyasa_user_id: uuid.UUID,
    title: str,
    description: str,
    predicted_category_name: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> None:
    """
    Checks if applicant has an active grievance blocking this submission.
    Preserves RESOLVED and CLOSED grievances without blocking.

    Rules:
      1. Same Category Rule (Hard Block): If predicted category matches existing active grievance category.
      2. Same Subject Rule (Hard Block): If normalized title or stripped core subject matches.
      3. High Text Similarity (Hard Block): TF-IDF cosine similarity >= 0.85 across combined text.
    """
    # 1. Fetch only active grievances for this applicant
    stmt = (
        select(Grievance)
        .where(
            Grievance.applicant_vyasa_user_id == applicant_vyasa_user_id,
            Grievance.status.in_(ACTIVE_GRIEVANCE_STATUSES),
        )
    )
    active_grievances = db.scalars(stmt).all()

    if not active_grievances:
        return

    new_combined_text = f"{title.strip()}. {description.strip()}"
    norm_new_title = normalize_subject_text(title)
    core_new_subject = extract_core_subject(title)
    norm_predicted_cat = normalize_category_name(predicted_category_name)
    threshold = getattr(settings, "SIMILARITY_THRESHOLD_GLOBAL", 0.85)

    for existing in active_grievances:
        # Determine existing authoritative category name
        existing_cat_name = None
        if existing.final_category_id:
            cat_obj = db.get(Category, existing.final_category_id)
            if cat_obj:
                existing_cat_name = cat_obj.name
        elif existing.category_id:
            cat_obj = db.get(Category, existing.category_id)
            if cat_obj:
                existing_cat_name = cat_obj.name

        norm_exist_cat = normalize_category_name(existing_cat_name)

        # Rule 1: Category Match
        is_same_category = False
        if norm_predicted_cat and norm_exist_cat and norm_predicted_cat == norm_exist_cat:
            is_same_category = True

        # Rule 2: Subject Match
        is_same_subject = False
        norm_exist_title = normalize_subject_text(existing.title)
        core_exist_subject = extract_core_subject(existing.title)

        if norm_new_title and norm_exist_title and norm_new_title == norm_exist_title:
            is_same_subject = True
        elif len(core_new_subject) >= 5 and core_new_subject == core_exist_subject:
            is_same_subject = True

        # Rule 3: TF-IDF Cosine Similarity
        existing_combined_text = f"{existing.title.strip()}. {existing.description.strip()}"
        sim_score = 0.0
        try:
            vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
            tfidf_matrix = vectorizer.fit_transform([new_combined_text, existing_combined_text])
            sim_score = float(cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0])
        except Exception as e:
            logger.debug("TF-IDF pairwise calculation error: %s", e)
            tokens_new = set(new_combined_text.lower().split())
            tokens_exist = set(existing_combined_text.lower().split())
            union = tokens_new.union(tokens_exist)
            sim_score = len(tokens_new.intersection(tokens_exist)) / len(union) if union else 0.0

        is_high_similarity = sim_score >= threshold

        block_reason = None
        if is_same_category:
            block_reason = f"same active category '{existing_cat_name or predicted_category_name}'"
        elif is_same_subject:
            block_reason = f"same active subject '{existing.title}'"
        elif is_high_similarity:
            block_reason = f"high text similarity ({sim_score:.4f} >= {threshold})"

        if block_reason is not None:
            logger.warning(
                "Duplicate grievance blocked for applicant %s. Matched %s (%s, sim: %.4f)",
                applicant_vyasa_user_id,
                existing.grievance_id,
                block_reason,
                sim_score,
            )

            audit_entry = AuditLog(
                user_vyasa_id=applicant_vyasa_user_id,
                grievance_id=existing.id,
                action="SIMILAR_GRIEVANCE_BLOCKED",
                entity_type="Grievance",
                entity_id=existing.id,
                description=f"Duplicate submission blocked. Matched {existing.grievance_id} ({block_reason}).",
                ip_address=ip_address,
                created_at=datetime.now(timezone.utc),
            )
            db.add(audit_entry)
            db.commit()

            raise SimilarActiveGrievanceError(
                existing_grievance_id=existing.grievance_id,
                message="Your similar grievance is already registered and is currently under process.",
            )
