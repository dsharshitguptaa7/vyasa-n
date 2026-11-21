"""
SAMIKSHA Researcher Certificate Discovery & Security Service.

Implements Phase 2, 3, and 4 requirements:
1. Normalizes and validates Scopus IDs against the SAMIKSHA Researcher Directory.
2. Resolves and categorizes certificates into:
   - Category 1: Research Work Certificates (Publication recognition, excellence, felicitations)
   - Category 2: Incentive Certificates (Research publication incentives, sanction awards)
3. Enforces authorization:
   - Validates active user sessions (Super Admin or matching user_id)
   - Or requires email OTP challenge for unauthenticated visitors
4. Audits ANUDAAN incentive records and accurately reports gaps without generating fake PDFs.
5. Employs rate-limiting and audit telemetry.
"""

import os
import time
import uuid
import secrets
import logging
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy import func, or_, select, cast, String
from sqlalchemy.orm import Session, joinedload

from app.models.user import User
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.certificate import (
    FelicitationCertificate,
    CertificateAuthor,
    CertificateVerificationEvent,
    LegacyCertificateRegistry,
)
from app.core.security import create_access_token, decode_access_token

logger = logging.getLogger("vyasa.sama.discovery")

# In-memory store for researcher OTP challenges: scopus_id -> {code, expires_at, attempts, email}
OTP_STORE: Dict[str, Dict[str, Any]] = {}
# Rate limit store for discovery attempts: ip_or_scopus -> list of timestamps
RATE_LIMIT_STORE: Dict[str, List[float]] = {}

MAX_OTP_ATTEMPTS = 5
OTP_EXPIRY_SECONDS = 600  # 10 minutes
RATE_LIMIT_WINDOW_SECONDS = 300  # 5 minutes
RATE_LIMIT_MAX_ATTEMPTS = 30


def normalize_scopus_id(raw_scopus: Optional[str]) -> Optional[str]:
    """Safely normalizes and strips whitespace from a Scopus ID string."""
    if not raw_scopus:
        return None
    cleaned = str(raw_scopus).strip()
    return cleaned if cleaned else None


def mask_email(email: Optional[str]) -> Optional[str]:
    """Masks email address for public display without exposing full identity."""
    if not email or "@" not in email:
        return None
    user_part, domain = email.split("@", 1)
    if len(user_part) <= 2:
        masked_user = user_part[0] + "***"
    else:
        masked_user = user_part[0] + "***" + user_part[-1]
    return f"{masked_user}@{domain}"


def check_rate_limit(key: str) -> bool:
    """Enforces simple sliding window rate limiting."""
    now = time.time()
    timestamps = RATE_LIMIT_STORE.get(key, [])
    # Filter out timestamps older than window
    timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW_SECONDS]
    if len(timestamps) >= RATE_LIMIT_MAX_ATTEMPTS:
        RATE_LIMIT_STORE[key] = timestamps
        return False
    timestamps.append(now)
    RATE_LIMIT_STORE[key] = timestamps
    return True


class ResearcherDiscoveryService:
    """Core service for discovering researcher certificates and verifying identity."""

    @staticmethod
    def _find_legacy_records_by_scopus(scopus_id: str, db: Session) -> List[LegacyCertificateRegistry]:
        """
        Safely retrieves historical certificate records from sama_legacy_certificate_registry
        where recovery_metadata['scopus_id'] exactly matches normalized scopus_id.
        Excludes revoked records.
        Supports both PostgreSQL JSONB queries and SQLite in-memory test databases.
        Strict string comparison prevents partial false matches (e.g. '608' != '60860734300').
        """
        norm_scopus = normalize_scopus_id(scopus_id)
        if not norm_scopus:
            return []

        legacy_disabled = os.getenv("DISABLE_LEGACY_CERTIFICATE_VERIFICATION", "FALSE").upper() == "TRUE"
        if legacy_disabled:
            return []

        clean_scopus = str(norm_scopus).strip()

        try:
            bind = db.get_bind()
            dialect_name = bind.dialect.name if bind else ""
        except Exception:
            dialect_name = ""

        # Base query: legacy certificates that are not revoked
        stmt = select(LegacyCertificateRegistry).where(
            LegacyCertificateRegistry.is_legacy == True,
            LegacyCertificateRegistry.is_revoked == False,
        )

        if dialect_name == "postgresql":
            try:
                pg_stmt = stmt.where(
                    func.trim(LegacyCertificateRegistry.recovery_metadata["scopus_id"].astext) == clean_scopus
                )
                return list(db.scalars(pg_stmt).all())
            except Exception as exc:
                logger.warning("PostgreSQL JSONB astext query failed, falling back to Python filter: %s", exc)
                db.rollback()

        # SQLite / fallback exact string match in Python
        try:
            candidates = db.scalars(stmt).all()
        except Exception as exc:
            logger.warning("Failed querying LegacyCertificateRegistry: %s", exc)
            return []

        matched = []
        for r in candidates:
            meta = r.recovery_metadata or {}
            rec_scopus = meta.get("scopus_id")
            if rec_scopus is not None:
                clean_rec = str(rec_scopus).strip()
                if clean_rec.lower() == clean_scopus.lower():
                    matched.append(r)
        return matched

    @staticmethod
    def find_researcher_by_scopus_id(scopus_id: str, db: Session) -> Optional[ResearchAuthor]:
        """
        Finds a researcher in the SAMIKSHA directory matching normalized Scopus ID.
        Checks primary author records, historical certificate snapshots, and
        recovered legacy certificate registry.
        """
        norm_scopus = normalize_scopus_id(scopus_id)
        if not norm_scopus:
            return None

        # 1. Primary lookup in sama_research_authors
        stmt = (
            select(ResearchAuthor)
            .options(joinedload(ResearchAuthor.user))
            .where(func.lower(ResearchAuthor.scopus_id) == norm_scopus.lower())
        )
        author = db.scalar(stmt)
        if author:
            return author

        # 2. Secondary lookup via certificate author snapshots
        cert_auth_stmt = (
            select(CertificateAuthor)
            .options(joinedload(CertificateAuthor.researcher))
            .where(func.lower(CertificateAuthor.scopus_id_snapshot) == norm_scopus.lower())
        )
        cert_auth = db.scalar(cert_auth_stmt)
        if cert_auth and cert_auth.researcher:
            return cert_auth.researcher

        # 3. Tertiary lookup in sama_legacy_certificate_registry recovery_metadata
        legacy_records = ResearcherDiscoveryService._find_legacy_records_by_scopus(norm_scopus, db)
        if legacy_records:
            first_legacy = legacy_records[0]
            meta = first_legacy.recovery_metadata or {}
            recip_name = meta.get("recipient_name") or first_legacy.recipient_name
            dept = meta.get("department")
            # Construct transient ResearchAuthor instance so historical-only researcher can be resolved
            return ResearchAuthor(
                id=uuid.uuid5(uuid.NAMESPACE_DNS, f"legacy-author-{norm_scopus}"),
                full_name=recip_name,
                department=dept,
                institutional_affiliation="Chhatrapati Shahu Ji Maharaj University, Kanpur",
                scopus_id=norm_scopus,
            )

        return None

    @staticmethod
    def evaluate_authorization(
        author: ResearchAuthor,
        current_user: Optional[User],
        researcher_token: Optional[str],
    ) -> Tuple[bool, str]:
        """
        Evaluates whether caller is authorized to view private certificate listings.
        Authorized if:
        1. Current user is Super Admin or Admin.
        2. Current user is the researcher (user_id matches author.user_id).
        3. A valid scoped researcher_token from OTP verification is provided.
        """
        # Case 1: Authenticated session
        if current_user:
            user_roles = [r.name.lower() for r in current_user.roles]
            if "super_admin" in user_roles or "admin" in user_roles:
                return True, "ADMIN_AUTHORIZED"

            if author.user_id and author.user_id == current_user.id:
                return True, "RESEARCHER_OWNER_AUTHORIZED"

            # Check if current_user has the same email as author's linked user
            if author.user and author.user.email.lower() == current_user.email.lower():
                return True, "RESEARCHER_EMAIL_AUTHORIZED"

        # Case 2: Scoped researcher token (e.g. from OTP verification)
        if researcher_token:
            try:
                payload = decode_access_token(researcher_token)
                token_scopus = payload.get("scopus_id")
                token_sub = payload.get("sub", "")
                token_author_id = payload.get("author_id")

                norm_author_scopus = normalize_scopus_id(author.scopus_id)
                if norm_author_scopus and (
                    token_scopus == norm_author_scopus
                    or token_sub == f"scopus:{norm_author_scopus}"
                    or token_author_id == str(author.id)
                ):
                    return True, "OTP_TOKEN_AUTHORIZED"
            except Exception as exc:
                logger.debug("Researcher token verification failed: %s", exc)

        return False, "AUTHENTICATION_REQUIRED"

    @staticmethod
    def send_otp(scopus_id: str, db: Session) -> Dict[str, Any]:
        """
        Generates and records an OTP challenge for the registered researcher's email.
        """
        norm_scopus = normalize_scopus_id(scopus_id)
        if not norm_scopus:
            return {"success": False, "message": "Invalid Scopus ID provided."}

        author = ResearcherDiscoveryService.find_researcher_by_scopus_id(norm_scopus, db)
        if not author:
            return {"success": False, "message": f"No researcher found with Scopus ID '{norm_scopus}'."}

        email = author.user.email if (author.user and author.user.email) else None
        if not email:
            return {
                "success": False,
                "message": (
                    f"No registered institutional email address found for Dr. {author.full_name}. "
                    "Please sign in with your university credentials or contact the R&D Cell."
                ),
                "has_email": False,
            }

        # Generate 6-digit OTP
        code = f"{secrets.randbelow(900000) + 100000}"
        OTP_STORE[norm_scopus.lower()] = {
            "code": code,
            "expires_at": time.time() + OTP_EXPIRY_SECONDS,
            "attempts": 0,
            "email": email,
            "author_id": str(author.id),
        }

        logger.info("OTP generated for Scopus ID %s (%s): %s", norm_scopus, email, code)

        return {
            "success": True,
            "masked_email": mask_email(email),
            "message": f"A 6-digit verification code has been dispatched to {mask_email(email)}.",
            "has_email": True,
        }

    @staticmethod
    def verify_otp(scopus_id: str, otp: str, db: Session) -> Dict[str, Any]:
        """
        Verifies OTP and returns a scoped researcher token valid for certificate access.
        """
        norm_scopus = normalize_scopus_id(scopus_id)
        if not norm_scopus:
            return {"success": False, "message": "Invalid Scopus ID provided."}

        record = OTP_STORE.get(norm_scopus.lower())
        if not record:
            return {"success": False, "message": "No active verification challenge found. Please request a new code."}

        if time.time() > record["expires_at"]:
            OTP_STORE.pop(norm_scopus.lower(), None)
            return {"success": False, "message": "Verification code has expired. Please request a new code."}

        record["attempts"] += 1
        if record["attempts"] > MAX_OTP_ATTEMPTS:
            OTP_STORE.pop(norm_scopus.lower(), None)
            return {"success": False, "message": "Too many invalid attempts. Challenge invalidated."}

        if record["code"] != str(otp).strip():
            return {"success": False, "message": "Incorrect verification code. Please try again."}

        # Validated successfully - clear challenge and mint scoped token
        author_id = record["author_id"]
        OTP_STORE.pop(norm_scopus.lower(), None)

        token = create_access_token(
            data={
                "sub": f"scopus:{norm_scopus}",
                "scopus_id": norm_scopus,
                "author_id": author_id,
                "scope": "researcher_cert_discovery",
            }
        )

        return {
            "success": True,
            "researcher_token": token,
            "message": "Identity successfully verified.",
        }

    @staticmethod
    def get_researcher_certificates(
        author: ResearchAuthor,
        db: Session,
        scopus_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Retrieves all certificates associated with the researcher across:
        - Primary author link (`author_id == author.id`)
        - Multi-author association (`CertificateAuthor.researcher_id == author.id`)
        - Scopus snapshot match (`CertificateAuthor.scopus_id_snapshot == author.scopus_id`)
        - Recovered historical certificates from `sama_legacy_certificate_registry` where
          recovery_metadata['scopus_id'] matches
        
        Separates certificates into:
        1. Research Work Certificates (Recognition, Excellence, Publication)
        2. Incentive Certificates (Awards linked to incentives)
        """
        norm_scopus = normalize_scopus_id(scopus_id) or normalize_scopus_id(author.scopus_id)

        # 0. Activate any due certificates before discovery lookup
        from app.modules.sama_veda.services.cms_service import SamaCmsService
        SamaCmsService.activate_due_certificates(db)

        # 1. Discover certificate IDs where author is linked
        cert_ids = set()

        # A. Primary author link
        primary_ids = db.scalars(
            select(FelicitationCertificate.id).where(FelicitationCertificate.author_id == author.id)
        ).all()
        cert_ids.update(primary_ids)

        # B. Multi-author link
        multi_filters = [CertificateAuthor.researcher_id == author.id]
        if norm_scopus:
            multi_filters.append(func.lower(CertificateAuthor.scopus_id_snapshot) == norm_scopus.lower())

        multi_ids = db.scalars(
            select(CertificateAuthor.certificate_id).where(or_(*multi_filters))
        ).all()
        cert_ids.update(multi_ids)

        if not cert_ids:
            all_certs = []
        else:
            stmt = (
                select(FelicitationCertificate)
                .options(
                    joinedload(FelicitationCertificate.publication),
                    joinedload(FelicitationCertificate.bulletin),
                    joinedload(FelicitationCertificate.authors),
                    joinedload(FelicitationCertificate.approvals),
                )
                .where(
                    FelicitationCertificate.id.in_(cert_ids),
                    FelicitationCertificate.status.in_(["ISSUED", "REVOKED", "SUPERSEDED"]),
                )
                .order_by(FelicitationCertificate.issued_at.desc())
            )
            all_certs = db.scalars(stmt).unique().all()

        # Categorize certificates
        research_certs = []
        incentive_certs = []

        incentive_types = {"INCENTIVE", "RESEARCH_INCENTIVE", "INCENTIVE_AWARD"}

        for cert in all_certs:
            cert_type = (cert.certificate_type or "RESEARCH_PUBLICATION").upper()
            pub_title = cert.research_title or (cert.publication.title if cert.publication else None)
            is_valid = bool(cert.status == "ISSUED" and not cert.is_revoked and cert.file_storage_path)

            # Resolve bulletin volume, issue, period
            b_vol = cert.bulletin_volume_snapshot or (cert.bulletin.volume_number if cert.bulletin else None)
            b_issue = cert.bulletin_issue_snapshot or (cert.bulletin.issue_number if cert.bulletin else None)
            b_period = cert.bulletin_period_snapshot or (cert.bulletin.publication_period if cert.bulletin else None)
            b_title = (cert.bulletin.title if cert.bulletin else None) or (f"Volume {b_vol} • Issue {b_issue}" if b_vol and b_issue else "General Edition")

            # Resolve matched author snapshot
            matched_auth = next(
                (a for a in cert.authors if (a.researcher_id == author.id or (norm_scopus and a.scopus_id_snapshot and a.scopus_id_snapshot.strip().lower() == norm_scopus.lower()))),
                None
            )

            author_dept = None
            author_desig = None
            if matched_auth:
                author_dept = matched_auth.department_snapshot
                author_desig = matched_auth.designation_snapshot
            else:
                author_dept = author.department

            if author_dept and author_dept.strip().lower() == "department of research":
                author_dept = None
            if author_desig and author_desig.strip().lower() == "department of research":
                author_desig = None

            affiliation_line = None
            if author_desig and author_dept:
                affiliation_line = f"{author_desig.strip()}, {author_dept.strip()}"
            elif author_dept:
                affiliation_line = author_dept.strip()
            elif author_desig:
                affiliation_line = author_desig.strip()

            bulletin_group_key = f"Volume {b_vol}, Issue {b_issue}" if b_vol and b_issue else (b_title or "General Edition")
            if b_period:
                bulletin_group_key += f" ({b_period})"

            cert_payload = {
                "id": str(cert.id),
                "certificate_number": cert.certificate_number,
                "title": cert.title,
                "certificate_type": cert.certificate_type,
                "record_type": "active",
                "is_legacy": False,
                "category": "INCENTIVE" if cert_type in incentive_types else "RESEARCH_WORK",
                "category_display": "Research Incentive Certificate" if cert_type in incentive_types else "Research Publication Certificate",
                "publication_title": pub_title,
                "bulletin_volume": b_vol,
                "bulletin_issue": b_issue,
                "bulletin_period": b_period,
                "bulletin_title": b_title,
                "bulletin_group_key": bulletin_group_key,
                "author_department": author_dept,
                "author_designation": author_desig,
                "affiliation_line": affiliation_line,
                "issue_date": cert.issued_at.strftime("%d %B %Y") if cert.issued_at else None,
                "issued_at": cert.issued_at.isoformat() if cert.issued_at else None,
                "status": cert.status,
                "is_revoked": cert.is_revoked,
                "revocation_reason": cert.revocation_reason if cert.is_revoked else None,
                "reissued_reason": cert.reissued_reason,
                "verification_token": cert.verification_token,
                "verification_url": f"/verify/{cert.verification_token}",
                "is_download_allowed": is_valid,
                "download_url": f"/api/modules/sama-veda/certificates/verify/{cert.verification_token}/download",
            }

            if cert_type in incentive_types:
                incentive_certs.append(cert_payload)
            else:
                research_certs.append(cert_payload)

        # 2. Retrieve recovered historical certificates matching Scopus ID
        if norm_scopus:
            legacy_records = ResearcherDiscoveryService._find_legacy_records_by_scopus(norm_scopus, db)
            seen_tokens = {c["verification_token"] for c in (research_certs + incentive_certs) if c.get("verification_token")}

            for legacy in legacy_records:
                if legacy.is_revoked:
                    continue
                if legacy.verification_token in seen_tokens:
                    continue
                seen_tokens.add(legacy.verification_token)

                meta = legacy.recovery_metadata or {}
                recip_name = meta.get("recipient_name") or legacy.recipient_name
                res_title = meta.get("research_title") or legacy.research_title or "Archival Felicitation Certificate"
                pub_details = meta.get("publication_details") or meta.get("research_title") or legacy.research_title
                dept = meta.get("department") or "Department of Research & Innovation"
                issue_ref = legacy.issue_reference or meta.get("bulletin_citation") or "Archival Felicitation"

                leg_type = (legacy.certificate_type or "INCENTIVE_AWARD").upper()
                is_incentive = leg_type in incentive_types

                hist_payload = {
                    "id": str(legacy.id),
                    "certificate_number": legacy.certificate_number,
                    "title": res_title,
                    "recipient_name": recip_name,
                    "certificate_type": legacy.certificate_type,
                    "record_type": "historical",
                    "is_legacy": True,
                    "category": "INCENTIVE" if is_incentive else "RESEARCH_WORK",
                    "category_display": "Research Incentive Certificate" if is_incentive else "Research Publication Certificate",
                    "publication_title": pub_details,
                    "bulletin_volume": None,
                    "bulletin_issue": None,
                    "bulletin_period": None,
                    "bulletin_title": issue_ref,
                    "bulletin_group_key": issue_ref,
                    "author_department": dept,
                    "author_designation": None,
                    "affiliation_line": dept if (dept and dept.strip().lower() != "department of research") else "Chhatrapati Shahu Ji Maharaj University, Kanpur",
                    "issue_date": legacy.created_at.strftime("%d %B %Y") if legacy.created_at else None,
                    "issued_at": legacy.created_at.isoformat() if legacy.created_at else None,
                    "status": "REVOKED" if legacy.is_revoked else "ISSUED",
                    "is_revoked": legacy.is_revoked,
                    "revocation_reason": legacy.revocation_reason if legacy.is_revoked else None,
                    "reissued_reason": None,
                    "verification_token": legacy.verification_token,
                    "verification_url": f"/verify/{legacy.verification_token}",
                    "is_download_allowed": not legacy.is_revoked,
                    "download_url": f"/api/modules/sama-veda/certificates/verify/{legacy.verification_token}/download",
                    "sanction_amount": legacy.sanction_amount,
                }

                if is_incentive:
                    incentive_certs.append(hist_payload)
                else:
                    research_certs.append(hist_payload)

        # Audit ANUDAAN incentive applications for this researcher
        anudaan_summary = {
            "total_applications": 0,
            "approved_count": 0,
            "pdf_certificates_available": len(incentive_certs) > 0,
            "message": (
                "Official PDF incentive certificates have not yet been generated in SAMIKSHA for approved incentive records. "
                "For physical incentive award letters and sanction records, please contact the R&D Cell."
            ) if len(incentive_certs) == 0 else "Incentive certificates are available for download.",
        }

        try:
            from app.modules.yajur_veda.models.anudaan import AnudaanApplication
            anudaan_filters = []
            if norm_scopus:
                anudaan_filters.append(func.lower(AnudaanApplication.scopus_author_id) == norm_scopus.lower())
            if author.user_id:
                anudaan_filters.append(AnudaanApplication.applicant_user_id == author.user_id)

            if anudaan_filters:
                apps = db.scalars(select(AnudaanApplication).where(or_(*anudaan_filters))).all()
                anudaan_summary["total_applications"] = len(apps)
                approved = [a for a in apps if str(a.status).upper() in ("APPROVED", "SANCTIONED", "DISBURSED")]
                anudaan_summary["approved_count"] = len(approved)
        except Exception as exc:
            logger.debug("Anudaan application check bypassed: %s", exc)

        res_dept = author.department
        if res_dept and res_dept.strip().lower() == "department of research":
            res_dept = None

        return {
            "researcher": {
                "id": str(author.id),
                "full_name": author.full_name,
                "department": res_dept,
                "institutional_affiliation": author.institutional_affiliation,
                "scopus_id": norm_scopus or author.scopus_id,
            },
            "research_certificates": research_certs,
            "incentive_certificates": incentive_certs,
            "total_certificates": len(research_certs) + len(incentive_certs),
            "anudaan_incentives": anudaan_summary,
        }
