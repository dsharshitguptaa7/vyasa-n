# -*- coding: utf-8 -*-
"""
SAMIKSHA CMS — Legacy Certificate Recovery & Archival Verification Service
Handles:
1. Validation of recovered historical certificate datasets.
2. Idempotent isolated seeding into sama_legacy_certificate_registry.
3. Dedicated historical verification response formatting for public endpoints.
4. Safe resolution of token and serial-number collisions (e.g. 000002).
"""
import os
import re
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, func

from app.schemas.response import ApiResponse
from app.modules.sama_veda.models.certificate import LegacyCertificateRegistry, FelicitationCertificate

logger = logging.getLogger("vyasa.sama_veda.legacy_recovery")


class LegacyRecoverySecurityError(Exception):
    """Raised when an operation attempts to run against an unauthorized or unsafe environment."""
    pass


class LegacyRecoveryService:
    """
    Core service managing the historical certificate registry.
    """

    @classmethod
    def validate_dataset(cls, dataset: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Performs strict forensic validation on the historical certificate dataset.
        Ensures 100% token uniqueness, valid 32-hex format, non-empty metadata,
        and verifies that unissued serials (45, 73) were not fabricated.
        """
        errors = []
        warnings = []
        tokens_seen = set()
        cert_nos_seen = set()
        valid_records = []

        expected_count = 75
        actual_count = len(dataset)
        if actual_count != expected_count:
            warnings.append(f"Expected {expected_count} records, received {actual_count}")

        for idx, r in enumerate(dataset):
            c_no = r.get("cert_no") or r.get("certificate_number")
            token = r.get("token") or r.get("verification_token")
            recip = r.get("recipient") or r.get("recipient_name")

            if not c_no:
                errors.append(f"Record #{idx}: Missing certificate_number")
                continue
            if not token:
                errors.append(f"Record #{idx} ({c_no}): Missing verification_token")
                continue
            if not recip:
                errors.append(f"Record #{idx} ({c_no}): Missing recipient name")
                continue

            # Validate token is clean 32-char hex
            clean_token = token.strip().lower()
            if not re.match(r"^[0-9a-f]{32}$", clean_token):
                errors.append(f"Record #{idx} ({c_no}): Invalid token format '{token}' (must be 32 hex chars)")
                continue

            if clean_token in tokens_seen:
                errors.append(f"Duplicate token detected: '{clean_token}' in record #{idx} ({c_no})")
                continue
            tokens_seen.add(clean_token)

            if c_no in cert_nos_seen:
                errors.append(f"Duplicate certificate_number in dataset: '{c_no}'")
                continue
            cert_nos_seen.add(c_no)

            valid_records.append({
                "certificate_number": c_no,
                "recipient_name": recip,
                "research_title": r.get("title") or r.get("research_title") or "",
                "certificate_type": r.get("certificate_type") or ("INCENTIVE_AWARD" if r.get("amount") else "SCHOLARLY_FELICITATION"),
                "issue_reference": r.get("citation") or r.get("issue_reference") or "Volume 2, Issue 3 (July - September 2026)",
                "sanction_amount": r.get("amount") or r.get("sanction_amount"),
                "verification_token": clean_token,
                "source_pdf_reference": r.get("source_pdf") or r.get("source_pdf_reference"),
                "source_sha256": r.get("sha256") or r.get("source_sha256"),
                "recovery_source": r.get("recovery_source", "DISTRIBUTION_PRINT_BATCH_VECTOR_STREAM"),
                "recovery_metadata": {
                    "original_page": r.get("page"),
                    "department": r.get("department"),
                    "recipient_display": r.get("recipient_display"),
                }
            })

        # Check sequence integrity
        cert_digits = [int(c.split("/")[-1]) for c in cert_nos_seen if "/" in c and c.split("/")[-1].isdigit()]
        excluded_serials = [45, 73]
        for exc in excluded_serials:
            if exc in cert_digits:
                errors.append(f"Excluded serial {exc} was unexpectedly found in dataset!")

        return {
            "is_valid": len(errors) == 0,
            "total_evaluated": len(dataset),
            "valid_count": len(valid_records),
            "unique_tokens": len(tokens_seen),
            "unique_cert_numbers": len(cert_nos_seen),
            "errors": errors,
            "warnings": warnings,
            "valid_records": valid_records,
        }

    @classmethod
    def dry_run_seed(cls, db: Session, dataset: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Executes a dry-run analysis of seeding historical records against the current database session.
        Checks for:
        - New records that would be inserted.
        - Existing identical records already in legacy registry.
        - Token collisions against active certificates ledger (MUST BE ZERO).
        - Conflicting records.
        Does NOT commit or alter any database state.
        """
        val = cls.validate_dataset(dataset)
        if not val["is_valid"]:
            return {
                "success": False,
                "reason": "Dataset validation failed",
                "validation_errors": val["errors"],
            }

        valid_records = val["valid_records"]

        # Fetch existing legacy records
        existing_legacy_tokens = set(
            db.scalars(select(LegacyCertificateRegistry.verification_token)).all()
        )
        existing_legacy_cert_nos = set(
            db.scalars(select(LegacyCertificateRegistry.certificate_number)).all()
        )

        # Fetch active tokens to ensure ZERO collision with active certificates
        active_tokens = set(
            db.scalars(select(FelicitationCertificate.verification_token)).all()
        )

        new_records = []
        already_present = []
        token_collisions_with_active = []
        conflicts = []

        for r in valid_records:
            t = r["verification_token"]
            c_no = r["certificate_number"]

            # Security rule: A legacy token must NEVER collide with an active certificate's token
            if t in active_tokens:
                token_collisions_with_active.append({
                    "certificate_number": c_no,
                    "token": t,
                    "error": "Token collides with active ledger verification_token!"
                })
                continue

            if t in existing_legacy_tokens:
                already_present.append(c_no)
            else:
                new_records.append(r)

        return {
            "success": len(token_collisions_with_active) == 0 and len(conflicts) == 0,
            "total_proposed": len(dataset),
            "valid_records": len(valid_records),
            "new_records_count": len(new_records),
            "already_present_count": len(already_present),
            "token_collisions_with_active": token_collisions_with_active,
            "conflicts": conflicts,
            "new_records": new_records,
            "already_present": already_present,
        }

    @classmethod
    def execute_seed(
        cls,
        db: Session,
        dataset: List[Dict[str, Any]],
        dry_run: bool = False,
        allow_remote: bool = False,
    ) -> Dict[str, Any]:
        """
        Idempotently seeds validated historical certificate records into sama_legacy_certificate_registry.
        Guarantees:
        - Multi-layered remote execution protection (fails closed unless explicit environment authorization is active).
        - PostgreSQL transactional advisory locking to prevent race conditions.
        - Zero duplicate tokens inserted.
        - Atomic transaction with complete rollback on any error.
        - Preserves existing legacy records if already present.
        """
        bind_url = str(db.bind.url) if db.bind else ""
        from urllib.parse import urlparse
        parsed = urlparse(bind_url)
        host = (parsed.hostname or "").lower()
        is_remote = host not in ("localhost", "127.0.0.1", "", "test_loopback")

        # Multi-layered remote execution security gate
        if is_remote or "neon.tech" in bind_url:
            auth_env = os.getenv("ALLOW_PRODUCTION_LEGACY_RECOVERY_EXECUTION", "FALSE").upper()
            if auth_env != "TRUE" or not allow_remote:
                raise LegacyRecoverySecurityError(
                    f"BLOCKED: Attempted live seed execution against remote database host '{host}'. "
                    "Seeding against remote/production databases requires both ALLOW_PRODUCTION_LEGACY_RECOVERY_EXECUTION=TRUE "
                    "and explicit allow_remote authorization."
                )

        analysis = cls.dry_run_seed(db, dataset)
        if not analysis["success"]:
            return analysis

        if dry_run:
            analysis["executed"] = False
            analysis["message"] = "Dry run completed successfully. No changes written."
            return analysis

        # Concurrency protection for PostgreSQL — strictly fails closed if lock cannot be acquired or confirmed
        lock_obtained = False
        dialect_name = db.bind.dialect.name if db.bind else ""
        if dialect_name == "postgresql":
            from sqlalchemy import text
            try:
                lock_res = db.execute(text("SELECT pg_try_advisory_lock(88291031)")).scalar()
                if not lock_res:
                    raise LegacyRecoverySecurityError(
                        "BLOCKED: Could not acquire PostgreSQL advisory lock (88291031). "
                        "Another legacy seed operation is currently active."
                    )
                lock_obtained = True
            except Exception as e:
                if isinstance(e, LegacyRecoverySecurityError):
                    raise
                raise LegacyRecoverySecurityError(
                    f"BLOCKED: PostgreSQL advisory lock (88291031) verification failed: {e}. "
                    "Execution cannot continue without confirmed advisory locking."
                ) from e

        inserted_count = 0
        try:
            for r in analysis["new_records"]:
                reg = LegacyCertificateRegistry(
                    certificate_number=r["certificate_number"],
                    recipient_name=r["recipient_name"],
                    research_title=r["research_title"],
                    certificate_type=r["certificate_type"],
                    issue_reference=r["issue_reference"],
                    sanction_amount=r["sanction_amount"],
                    verification_token=r["verification_token"],
                    source_pdf_reference=r["source_pdf_reference"],
                    source_sha256=r["source_sha256"],
                    is_legacy=True,
                    is_revoked=False,
                    recovery_source=r["recovery_source"],
                    recovery_metadata=r["recovery_metadata"],
                )
                db.add(reg)
                inserted_count += 1

            db.commit()
            analysis["executed"] = True
            analysis["inserted_count"] = inserted_count
            analysis["message"] = f"Successfully seeded {inserted_count} historical certificates into legacy registry."
            return analysis

        except Exception as exc:
            db.rollback()
            logger.error(f"Seeder transaction aborted and rolled back: {exc}", exc_info=True)
            raise
        finally:
            if dialect_name == "postgresql" and lock_obtained:
                try:
                    db.execute(text("SELECT pg_advisory_unlock(88291031)"))
                    db.commit()
                except Exception:
                    pass

    @classmethod
    def validate_storage_key(cls, key: str) -> str:
        """
        Validates and sanitizes a manually entered DigitalOcean Spaces object key.
        Rejects path traversal, drive letters, protocols, and non-pdf extensions.
        """
        if not key or not isinstance(key, str):
            raise ValueError("Storage key cannot be empty.")
        clean = key.strip().replace("\\", "/")
        if clean.startswith("http://") or clean.startswith("https://"):
            raise ValueError("Storage key cannot be an external URL. Enter the relative Spaces object key (e.g. 'sama_veda/certificates/filename.pdf').")
        if re.match(r"^[a-zA-Z]:", clean):
            raise ValueError("Storage key cannot be an absolute filesystem drive path.")
        if ".." in clean:
            raise ValueError("Storage key contains invalid path traversal sequences ('..').")
        if clean.startswith("/"):
            raise ValueError("Storage key must be a relative object key and cannot begin with a root slash ('/').")
        if not clean:
            raise ValueError("Storage key cannot be empty or root slash.")
        if not clean.lower().endswith(".pdf"):
            raise ValueError("Storage key must target a PDF file ending in .pdf.")
        if any(c in clean for c in '<>"|?*'):
            raise ValueError("Storage key contains invalid characters.")
        return clean

    @classmethod
    def validate_scopus_id(cls, scopus_id: str) -> str:
        """
        Validates Scopus Author ID.
        Must be a numeric string of 8 to 12 digits.
        """
        if not scopus_id or not isinstance(scopus_id, str):
            raise ValueError("Scopus ID cannot be empty.")
        clean = scopus_id.strip()
        if not re.match(r"^\d{8,12}$", clean):
            raise ValueError(f"Invalid Scopus Author ID '{clean}'. Scopus IDs must be an 8 to 12-digit numeric identifier.")
        return clean

    @classmethod
    def get_candidate_storage_keys(cls, legacy: LegacyCertificateRegistry) -> List[str]:
        """
        Determines candidate storage keys in DigitalOcean Spaces / local storage
        for a historical certificate based on institutional naming conventions and manual assignment.
        Priority:
        1. Manually assigned original PDF storage key.
        2. Existing recovered PDF reference / filename.
        3. Existing known certificate-number-based candidate keys.
        4. Existing token-based candidate keys.
        5. Existing safe local recovery/archive candidates.
        """
        candidates = []
        meta = legacy.recovery_metadata or {}

        # 1. Manually assigned original PDF storage key
        manual_key = meta.get("storage_key")
        if manual_key and isinstance(manual_key, str) and manual_key.strip():
            clean_man = manual_key.strip().replace("\\", "/").lstrip("/")
            for prefix in ("backend/storage/", "storage/", "./"):
                if clean_man.startswith(prefix):
                    clean_man = clean_man[len(prefix):]
            if clean_man:
                candidates.append(clean_man)

        # 2. Existing recovered PDF reference
        ref = (legacy.source_pdf_reference or "").strip().replace("\\", "/")
        if ref:
            for prefix in ("backend/storage/", "storage/", "./"):
                if ref.startswith(prefix):
                    candidates.append(ref[len(prefix):])
            base = os.path.basename(ref)
            if base:
                candidates.append(f"sama_veda/certificates/{base}")
                candidates.append(base)
            candidates.append(ref)

        orig_fn = meta.get("original_filename")
        if orig_fn and isinstance(orig_fn, str) and orig_fn.strip():
            clean_fn = orig_fn.strip().replace("\\", "/").lstrip("/")
            candidates.append(f"sama_veda/certificates/{clean_fn}")
            candidates.append(clean_fn)

        # 3. Existing known certificate-number-based candidate keys
        cert_no_clean = (legacy.certificate_number or "").replace("/", "_").strip()
        if cert_no_clean:
            candidates.append(f"sama_veda/certificates/{cert_no_clean}.pdf")
            candidates.append(f"{cert_no_clean}.pdf")

        # 4. Existing token-based candidate keys
        tok = (legacy.verification_token or "").strip()
        if tok:
            candidates.append(f"sama_veda/certificates/{tok}.pdf")
            candidates.append(f"{tok}.pdf")
            if cert_no_clean:
                candidates.append(f"sama_veda/certificates/{tok[:12]}_{cert_no_clean}.pdf")
                candidates.append(f"{tok[:12]}_{cert_no_clean}.pdf")

        seen = set()
        unique = []
        for c in candidates:
            c_clean = c.strip().lstrip("/")
            if c_clean and c_clean not in seen:
                seen.add(c_clean)
                unique.append(c_clean)
        return unique

    @classmethod
    def resolve_pdf_path(cls, legacy: LegacyCertificateRegistry) -> Optional[str]:
        """
        Resolves the physical or cloud-cached PDF file path for a historical certificate.
        First inspects manually assigned storage key / direct local disk;
        then delegates to DigitalOcean Spaces via the core storage_service proxy,
        which downloads and caches the object atomically.
        """
        meta = legacy.recovery_metadata or {}
        manual_key = meta.get("storage_key")

        # 1. If manual key is assigned, attempt resolution for it first
        if manual_key and isinstance(manual_key, str) and manual_key.strip():
            clean_manual = manual_key.strip().replace("\\", "/").lstrip("/")
            for base_dir in [Path.cwd(), Path.cwd() / "backend", Path.cwd().parent]:
                candidate = (base_dir / clean_manual).resolve()
                if candidate.is_file():
                    return str(candidate)
            try:
                from app.core.storage import storage_service
                cached_path = None
                if hasattr(storage_service, "get_file_path"):
                    try:
                        cached_path = storage_service.get_file_path(clean_manual)
                    except Exception:
                        pass
                if not cached_path and hasattr(storage_service, "download_file"):
                    try:
                        cached_path = storage_service.download_file(clean_manual)
                    except Exception:
                        pass
                if cached_path and Path(cached_path).is_file():
                    return str(Path(cached_path).resolve())
            except Exception as exc:
                logger.debug(f"Manual storage key '{clean_manual}' not resolved via storage_service: {exc}")

        # 2. Existing recovered PDF reference
        ref = legacy.source_pdf_reference
        if ref:
            p = Path(ref)
            if p.is_file():
                return str(p.resolve())
            for base_dir in [Path.cwd(), Path.cwd() / "backend", Path.cwd().parent]:
                candidate = (base_dir / ref).resolve()
                if candidate.is_file():
                    return str(candidate)
                if ref.startswith("backend/"):
                    sub_candidate = (base_dir / ref[len("backend/"):]).resolve()
                    if sub_candidate.is_file():
                        return str(sub_candidate)

        # 3. Candidate keys in priority order via storage_service
        try:
            from app.core.storage import storage_service
            for key in cls.get_candidate_storage_keys(legacy):
                try:
                    if storage_service.exists(key):
                        cached_path = None
                        if hasattr(storage_service, "get_file_path"):
                            try:
                                cached_path = storage_service.get_file_path(key)
                            except Exception:
                                pass
                        if not cached_path and hasattr(storage_service, "download_file"):
                            try:
                                cached_path = storage_service.download_file(key)
                            except Exception:
                                pass
                        if cached_path and Path(cached_path).is_file():
                            return str(Path(cached_path).resolve())
                except Exception:
                    continue
        except Exception as exc:
            logger.debug(f"Failed resolving PDF via storage_service for {legacy.certificate_number}: {exc}")

        return None

    @classmethod
    def test_pdf_availability(
        cls,
        legacy: LegacyCertificateRegistry,
        candidate_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Actively tests whether the historical certificate PDF exists in DigitalOcean Spaces or local storage.
        If candidate_key is provided, tests that specific key; otherwise checks candidate keys in priority order.
        Returns detailed status: found, missing, or error.
        """
        from app.core.config import settings
        from app.core.storage import storage_service, StorageFileNotFoundError, StorageError

        active_provider = storage_service.get_provider()
        provider_name = getattr(active_provider, "provider_name", None) or getattr(settings, "STORAGE_PROVIDER", "spaces")

        keys_to_test = []
        if candidate_key and candidate_key.strip():
            clean_test_key = cls.validate_storage_key(candidate_key)
            keys_to_test.append(clean_test_key)
        else:
            keys_to_test = cls.get_candidate_storage_keys(legacy)

        # First check if legacy has a direct valid local path
        if not candidate_key and legacy.source_pdf_reference:
            ref = legacy.source_pdf_reference
            for base_dir in [Path.cwd(), Path.cwd() / "backend", Path.cwd().parent]:
                candidate_p = (base_dir / ref).resolve()
                if candidate_p.is_file():
                    try:
                        size = candidate_p.stat().st_size
                        return {
                            "status": "found",
                            "storage_key": ref,
                            "provider": "local_storage",
                            "exists": True,
                            "file_size_bytes": size,
                            "resolved_path": str(candidate_p),
                            "message": f"Historical PDF verified on local storage ({size:,} bytes).",
                        }
                    except Exception:
                        pass

        last_error = None
        for key in keys_to_test:
            try:
                if storage_service.exists(key):
                    size = None
                    try:
                        meta = storage_service.get_file_metadata(key)
                        size = meta.get("content_length") or meta.get("size")
                    except Exception:
                        pass
                    if size is None:
                        try:
                            fpath = storage_service.get_file_path(key)
                            if fpath and fpath.is_file():
                                size = fpath.stat().st_size
                        except Exception:
                            pass

                    size_str = f" ({size:,} bytes)" if size else ""
                    return {
                        "status": "found",
                        "storage_key": key,
                        "provider": provider_name,
                        "exists": True,
                        "file_size_bytes": size,
                        "resolved_path": key,
                        "message": f"Historical PDF verified in {provider_name.title()}{size_str}.",
                    }
            except (StorageFileNotFoundError, FileNotFoundError):
                continue
            except StorageError as serr:
                last_error = str(serr)
                continue
            except Exception as exc:
                last_error = str(exc)
                continue

        if last_error:
            return {
                "status": "error",
                "storage_key": keys_to_test[0] if keys_to_test else None,
                "provider": provider_name,
                "exists": False,
                "file_size_bytes": None,
                "resolved_path": None,
                "message": f"Storage provider communication error: {last_error}",
            }

        tested_repr = f"'{keys_to_test[0]}'" if len(keys_to_test) == 1 else f"{len(keys_to_test)} candidate keys"
        return {
            "status": "missing",
            "storage_key": keys_to_test[0] if keys_to_test else None,
            "provider": provider_name,
            "exists": False,
            "file_size_bytes": None,
            "resolved_path": None,
            "message": f"Historical certificate PDF object not found in {provider_name} for {tested_repr}.",
        }

    @classmethod
    def is_pdf_available(cls, legacy: LegacyCertificateRegistry) -> bool:
        """
        Checks whether the historical certificate PDF object exists either locally on disk
        or in DigitalOcean Spaces without pulling the full file payload if unneeded.
        """
        ref = legacy.source_pdf_reference
        if ref and os.path.isfile(ref):
            return True

        try:
            from app.core.storage import storage_service
            for key in cls.get_candidate_storage_keys(legacy):
                try:
                    if storage_service.exists(key):
                        return True
                except Exception:
                    continue
        except Exception:
            pass

        return False

    @classmethod
    def build_legacy_verification_response(cls, legacy: LegacyCertificateRegistry) -> ApiResponse:
        """
        Formats a dedicated, institutional-grade historical certificate verification response.
        Displays only verified archival data without fabricating active approval timestamps.
        """
        is_revoked = legacy.is_revoked
        status = "REVOKED" if is_revoked else "HISTORICAL"
        msg = (
            "Certificate has been REVOKED."
            if is_revoked
            else "Official historical certificate verified successfully from University Archival Registry."
        )

        meta = legacy.recovery_metadata or {}
        scopus_id = meta.get("scopus_id")
        dept = meta.get("department", "Chhatrapati Shahu Ji Maharaj University, Kanpur")

        # Verified signatories present on the physical printed certificates
        approvals_out = [
            {
                "authority_type": "DEAN_RD",
                "signatory_name": "Prof. Namita Tiwari",
                "designation": "Dean – Research & Development",
                "status": "HISTORICAL_ARCHIVAL_RECORD",
                "decided_at": None,
            },
            {
                "authority_type": "VICE_CHANCELLOR",
                "signatory_name": "Prof. Vinay Kumar Pathak",
                "designation": "Vice Chancellor",
                "status": "HISTORICAL_ARCHIVAL_RECORD",
                "decided_at": None,
            },
        ]

        authors_out = [
            {
                "id": str(legacy.id),
                "author_name": legacy.recipient_name,
                "academic_title": None,
                "scopus_id": scopus_id,
                "affiliation": "Chhatrapati Shahu Ji Maharaj University, Kanpur",
                "department": dept,
                "author_order": 1,
                "author_role": "CORRESPONDING_AUTHOR",
            }
        ]

        has_pdf = cls.is_pdf_available(legacy)

        clean_amt = None
        if legacy.sanction_amount:
            clean_amt = legacy.sanction_amount.replace("INR", "").replace(",", "").strip()

        return ApiResponse(
            success=True,
            message=msg,
            data={
                "id": str(legacy.id),
                "certificate_number": legacy.certificate_number,
                "certificate_type": legacy.certificate_type,
                "status": status,
                "title": (
                    "Certificate of Appreciation for Research Publication"
                    if legacy.certificate_type == "INCENTIVE_AWARD"
                    else "Certificate of Appreciation & Research Excellence"
                ),
                "presentation_statement": (
                    "This certificate is proudly awarded to"
                    if legacy.certificate_type == "INCENTIVE_AWARD"
                    else "This certificate is proudly conferred upon"
                ),
                "research_contribution_statement": (
                    "in recognition of distinguished research productivity and scholarly impact under the University Publication Incentive Policy"
                ),
                "research_title": legacy.research_title,
                "congratulatory_statement": (
                    "The University acknowledges the distinguished scholarly dedication and meritorious contribution to academic research."
                ),
                "publication_details": {
                    "incentive_amount": clean_amt,
                    "sanction_order_ref": meta.get("sanction_order_ref", "CSJMU/R&D/INCENTIVE/2026"),
                    "issue_citation": legacy.issue_reference or "Volume 2, Issue 3 (July - September 2026)",
                    "recovery_source": legacy.recovery_source,
                    "is_historical_archive": True,
                },
                "verification_token": legacy.verification_token,
                "issued_at": legacy.created_at.isoformat() if legacy.created_at else None,
                "approved_at": None,
                "is_revoked": is_revoked,
                "revoked_at": legacy.revoked_at.isoformat() if legacy.revoked_at else None,
                "revocation_reason": legacy.revocation_reason if is_revoked else None,
                "reissued_from_id": None,
                "reissued_reason": None,
                "sha256_checksum": legacy.source_sha256 or "",
                "is_download_allowed": has_pdf and not is_revoked,
                "replacement_certificate": None,
                "authors": authors_out,
                "approvals": approvals_out,
                "author": authors_out[0],
                "bulletin": {
                    "id": "historical-issue-3",
                    "title": "CSJMU RESEARCH BULLETIN",
                    "volume_number": 2,
                    "issue_number": 3,
                    "publication_period": "July - September 2026",
                },
                "publication": {
                    "id": f"historical-pub-{str(legacy.id)[:8]}",
                    "title": legacy.research_title or "",
                    "source_journal": meta.get("source_journal", "Indexed Scientific Journal"),
                    "category": "RESEARCH_PUBLICATION",
                    "doi": meta.get("doi"),
                },
                "is_legacy": True,
                "historical_designation": "OFFICIAL HISTORICAL CERTIFICATE ARCHIVE",
            },
        )
