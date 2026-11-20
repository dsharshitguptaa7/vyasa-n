"""
Service layer for VYASAⁿ AI Knowledge Centre.
Enforces:
1. Mandatory SADMIN approval for document activation, rejection, and archiving.
2. Safe lifecycle transitions: draft -> processing -> pending_approval -> active.
3. Version immutability: never overwrite an existing object key; store v1, v2 under vyasa-knowledge/{domain}/.
4. SHA-256 duplicate detection across active knowledge documents.
5. Prevention of partial indexing: failed extraction/embedding documents never become active.
6. Atomic version swapping: active version continues serving until a replacement version is approved.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import logging
import os
from typing import Dict, List, Optional, Tuple, Any
import uuid

from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.orm import Session, joinedload

from app.core.storage import storage_service, sanitize_filename
from app.core.storage.base import (
    DEFAULT_KNOWLEDGE_MAX_UPLOAD_BYTES,
    KNOWLEDGE_ALLOWED_MIME_TYPES,
)
from app.models.user import User
from app.modules.knowledge_centre.models import (
    AiKnowledgeDocument,
    AiKnowledgeDocumentVersion,
    AiKnowledgeChunk,
    KnowledgeDocumentStatus,
    KnowledgeApprovalStatus,
    KnowledgeExtractionStatus,
    KnowledgeVerificationStatus,
    KNOWLEDGE_STORAGE_PREFIX,
)
from app.modules.phd_rag.services.document_parser import DocumentParser
from app.modules.phd_rag.services.embedding_service import embedding_service

logger = logging.getLogger("vyasa.knowledge_centre.service")

DEFAULT_STALE_PROCESSING_THRESHOLD_MINUTES = 15


class KnowledgeCentreError(Exception):
    """Base exception for Knowledge Centre domain rules."""
    pass


class KnowledgePermissionDeniedError(KnowledgeCentreError):
    """Raised when an operation requires SADMIN but non-sadmin attempts it."""
    pass


class KnowledgeDuplicateDocumentError(KnowledgeCentreError):
    """Raised when a document with identical SHA-256 checksum already exists."""
    pass


class KnowledgeInvalidLifecycleStateError(KnowledgeCentreError):
    """Raised when attempting an illegal state transition."""
    pass


class ExtractionJobRevokedError(KnowledgeCentreError):
    """Raised when an extraction job's ownership token has been superseded or revoked."""
    pass


import threading
_stale_recovery_lock = threading.Lock()


def assert_sadmin(user: User) -> None:
    """Verifies that the acting user has the central 'super_admin' role."""
    roles = [r.name.lower() for r in getattr(user, "roles", [])]
    if "super_admin" not in roles:
        raise KnowledgePermissionDeniedError(
            "Access restricted to Super Admin (SADMIN) only."
        )


def generate_knowledge_storage_key(
    domain: str,
    version_number: int,
    filename: str,
    unique_id: Optional[str] = None,
) -> str:
    """
    Generate an immutable, version-specific storage key under vyasa-knowledge/.
    Format: vyasa-knowledge/{domain}/v{version}_{uuid12}_{sanitized_filename}
    """
    clean_domain = domain.strip().lower().replace(" ", "-")
    safe_name = sanitize_filename(filename)
    prefix_id = unique_id or uuid.uuid4().hex[:12]
    return f"{KNOWLEDGE_STORAGE_PREFIX}/{clean_domain}/v{version_number}_{prefix_id}_{safe_name}"


class KnowledgeCentreService:
    """
    Orchestrates authoritative document intake, version control, and SADMIN lifecycle.
    """

    def check_duplicate_checksum(
        self,
        db: Session,
        checksum_sha256: str,
        exclude_document_id: Optional[uuid.UUID] = None,
    ) -> Optional[AiKnowledgeDocumentVersion]:
        """
        Check if an active or pending document with the same SHA-256 checksum already exists.
        """
        stmt = (
            select(AiKnowledgeDocumentVersion)
            .join(AiKnowledgeDocument, AiKnowledgeDocumentVersion.document_id == AiKnowledgeDocument.id)
            .where(
                AiKnowledgeDocumentVersion.checksum_sha256 == checksum_sha256,
                AiKnowledgeDocument.status.in_([
                    KnowledgeDocumentStatus.DRAFT.value,
                    KnowledgeDocumentStatus.PROCESSING.value,
                    KnowledgeDocumentStatus.PENDING_APPROVAL.value,
                    KnowledgeDocumentStatus.ACTIVE.value,
                ]),
            )
        )
        if exclude_document_id:
            stmt = stmt.where(AiKnowledgeDocument.id != exclude_document_id)

        return db.execute(stmt).scalars().first()

    def create_document(
        self,
        db: Session,
        title: str,
        domain: str,
        document_type: str,
        filename: str,
        file_bytes: bytes,
        uploaded_by: User,
        description: Optional[str] = None,
        subdomain: Optional[str] = None,
        academic_session: Optional[str] = None,
        issuing_authority: Optional[str] = None,
        effective_from: Optional[datetime] = None,
        effective_until: Optional[datetime] = None,
    ) -> Tuple[AiKnowledgeDocument, AiKnowledgeDocumentVersion]:
        """
        Initial intake of an authoritative document:
        - Validates SADMIN permission.
        - Calculates SHA-256 and checks duplicate upload.
        - Generates immutable storage key under vyasa-knowledge/{domain}/v1_...
        - Persists file using storage_service.
        - Creates AiKnowledgeDocument and AiKnowledgeDocumentVersion (v1) in DRAFT state.
        """
        assert_sadmin(uploaded_by)

        checksum = hashlib.sha256(file_bytes).hexdigest()
        existing = self.check_duplicate_checksum(db, checksum)
        if existing:
            raise KnowledgeDuplicateDocumentError(
                f"Document with identical content (SHA-256: {checksum}) already exists in knowledge base: "
                f"Document ID {existing.document_id}, Version {existing.version_number}."
            )

        storage_key = generate_knowledge_storage_key(
            domain=domain,
            version_number=1,
            filename=filename,
        )

        # Save to storage provider
        subfolder = f"{KNOWLEDGE_STORAGE_PREFIX}/{domain.strip().lower()}"
        save_res = storage_service.save_file(
            content=file_bytes,
            filename=f"v1_{sanitize_filename(filename)}",
            subfolder=subfolder,
            allowed_mime_types=KNOWLEDGE_ALLOWED_MIME_TYPES,
            max_size_bytes=DEFAULT_KNOWLEDGE_MAX_UPLOAD_BYTES,
        )

        try:
            doc = AiKnowledgeDocument(
                title=title,
                description=description,
                domain=domain,
                subdomain=subdomain,
                document_type=document_type,
                academic_session=academic_session,
                issuing_authority=issuing_authority,
                effective_from=effective_from,
                effective_until=effective_until,
                status=KnowledgeDocumentStatus.DRAFT.value,
                uploaded_by_id=uploaded_by.id,
            )
            db.add(doc)
            db.flush()

            version = AiKnowledgeDocumentVersion(
                document_id=doc.id,
                version_number=1,
                storage_key=save_res.storage_key,
                checksum_sha256=save_res.sha256_checksum,
                original_filename=filename,
                mime_type=save_res.mime_type,
                size_bytes=save_res.file_size_bytes,
                extraction_status=KnowledgeExtractionStatus.PENDING.value,
                approval_status=KnowledgeApprovalStatus.PENDING.value,
            )
            db.add(version)
            db.flush()
        except Exception as db_exc:
            logger.error("DB persistence failed for knowledge upload. Cleaning up orphaned storage key '%s': %s", save_res.storage_key, db_exc)
            try:
                storage_service.delete_file(save_res.storage_key)
            except Exception as del_exc:
                logger.error("Failed to delete orphaned storage key '%s': %s", save_res.storage_key, del_exc)
            raise db_exc

        return doc, version

    def transition_to_processing(
        self,
        db: Session,
        document_id: uuid.UUID,
        version_id: uuid.UUID,
        job_id: Optional[uuid.UUID] = None,
    ) -> Tuple[AiKnowledgeDocument, AiKnowledgeDocumentVersion, uuid.UUID]:
        """
        Transition document to PROCESSING state when extraction / indexing starts.
        Atomically establishes unique worker job_id and initial heartbeat.
        """
        doc = db.get(AiKnowledgeDocument, document_id)
        ver = db.get(AiKnowledgeDocumentVersion, version_id)
        if not doc or not ver:
            raise KnowledgeCentreError("Document or version not found.")

        assigned_job_id = job_id or uuid.uuid4()
        now = datetime.now(timezone.utc)

        ver.job_id = assigned_job_id
        ver.heartbeat_at = now
        ver.extraction_status = KnowledgeExtractionStatus.PENDING.value
        ver.processing_error = None

        doc.status = KnowledgeDocumentStatus.PROCESSING.value
        doc.updated_at = now
        db.commit()
        return doc, ver, assigned_job_id

    def update_heartbeat(
        self,
        db: Session,
        version_id: uuid.UUID,
        job_id: uuid.UUID,
    ) -> bool:
        """
        Updates worker progress heartbeat.
        Validates that the worker still retains authorized job ownership.
        Raises ExtractionJobRevokedError if job ownership was revoked or superseded.
        """
        from sqlalchemy import update
        now = datetime.now(timezone.utc)
        stmt = (
            update(AiKnowledgeDocumentVersion)
            .where(
                AiKnowledgeDocumentVersion.id == version_id,
                AiKnowledgeDocumentVersion.job_id == job_id,
            )
            .values(heartbeat_at=now)
        )
        res = db.execute(stmt)
        db.commit()
        if res.rowcount == 0:
            logger.warning(
                "Heartbeat rejected: worker job %s for version %s has been revoked or superseded.",
                job_id,
                version_id,
            )
            raise ExtractionJobRevokedError(
                f"Worker job {job_id} on version {version_id} was revoked or superseded. Aborting extraction."
            )
        return True

    def record_extraction_success(
        self,
        db: Session,
        document_id: uuid.UUID,
        version_id: uuid.UUID,
        chunks_count: int,
    ) -> AiKnowledgeDocumentVersion:
        """
        Record successful extraction and indexing.
        Document transitions to PENDING_APPROVAL. (Does NOT automatically activate!)
        """
        doc = db.get(AiKnowledgeDocument, document_id)
        ver = db.get(AiKnowledgeDocumentVersion, version_id)
        if not doc or not ver:
            raise KnowledgeCentreError("Document or version not found.")

        if chunks_count == 0:
            raise KnowledgeInvalidLifecycleStateError(
                "Cannot mark extraction successful with 0 extracted chunks."
            )

        ver.extraction_status = KnowledgeExtractionStatus.PARSED.value
        ver.processing_error = None
        doc.status = KnowledgeDocumentStatus.PENDING_APPROVAL.value
        db.flush()
        return ver

    def record_extraction_failure(
        self,
        db: Session,
        document_id: uuid.UUID,
        version_id: uuid.UUID,
        error_message: str,
    ) -> AiKnowledgeDocumentVersion:
        """
        Record extraction failure.
        A failed document version NEVER becomes active.
        """
        doc = db.get(AiKnowledgeDocument, document_id)
        ver = db.get(AiKnowledgeDocumentVersion, version_id)
        if not doc or not ver:
            raise KnowledgeCentreError("Document or version not found.")

        ver.extraction_status = KnowledgeExtractionStatus.FAILED.value
        ver.processing_error = error_message
        # Failed documents are kept in draft or returned to draft with errors; never pending_approval or active!
        doc.status = KnowledgeDocumentStatus.DRAFT.value
        db.flush()
        return ver

    def approve_version(
        self,
        db: Session,
        document_id: uuid.UUID,
        version_id: uuid.UUID,
        approving_user: User,
    ) -> AiKnowledgeDocument:
        """
        SADMIN approval:
        - Only SADMIN can approve.
        - Version must have extraction_status in ('parsed', 'indexed').
        - Failed or 0-chunk documents cannot be approved.
        - On approval, document status transitions to ACTIVE, current_version_id is set,
          and published_at timestamp is stamped.
        """
        assert_sadmin(approving_user)

        doc = db.get(AiKnowledgeDocument, document_id)
        ver = db.get(AiKnowledgeDocumentVersion, version_id)
        if not doc or not ver:
            raise KnowledgeCentreError("Document or version not found.")

        if ver.extraction_status not in (
            KnowledgeExtractionStatus.PARSED.value,
            KnowledgeExtractionStatus.INDEXED.value,
        ):
            raise KnowledgeInvalidLifecycleStateError(
                f"Cannot approve document version with extraction status '{ver.extraction_status}'. "
                "Document must be fully extracted and parsed before SADMIN approval."
            )

        now = datetime.now(timezone.utc)
        ver.approval_status = KnowledgeApprovalStatus.APPROVED.value
        ver.approved_by_id = approving_user.id
        ver.approved_at = now

        doc.current_version_id = ver.id
        doc.approved_by_id = approving_user.id
        doc.status = KnowledgeDocumentStatus.ACTIVE.value
        doc.published_at = now

        db.flush()
        logger.info(
            "Document %s version %s approved by SADMIN %s and marked ACTIVE.",
            doc.id, ver.version_number, approving_user.id
        )
        return doc

    def reject_version(
        self,
        db: Session,
        document_id: uuid.UUID,
        version_id: uuid.UUID,
        rejecting_user: User,
        reason: Optional[str] = None,
    ) -> AiKnowledgeDocument:
        """
        SADMIN rejection:
        - Version transitions to REJECTED.
        - Document transitions to REJECTED (or remains on existing active version if superseding).
        """
        assert_sadmin(rejecting_user)

        doc = db.get(AiKnowledgeDocument, document_id)
        ver = db.get(AiKnowledgeDocumentVersion, version_id)
        if not doc or not ver:
            raise KnowledgeCentreError("Document or version not found.")

        ver.approval_status = KnowledgeApprovalStatus.REJECTED.value
        ver.processing_error = reason

        # If document had no prior active version, mark document rejected
        if not doc.current_version_id or doc.current_version_id == ver.id:
            doc.status = KnowledgeDocumentStatus.REJECTED.value

        db.flush()
        return doc

    def archive_document(
        self,
        db: Session,
        document_id: uuid.UUID,
        archiving_user: User,
    ) -> AiKnowledgeDocument:
        """
        SADMIN archiving:
        - Only SADMIN can archive.
        - Document transitions to ARCHIVED and is removed from active RAG retrieval.
        """
        assert_sadmin(archiving_user)

        doc = db.get(AiKnowledgeDocument, document_id)
        if not doc:
            raise KnowledgeCentreError(f"Document {document_id} not found.")

        now = datetime.now(timezone.utc)
        doc.status = KnowledgeDocumentStatus.ARCHIVED.value
        doc.archived_at = now
        db.flush()
        return doc

    def create_new_version(
        self,
        db: Session,
        document_id: uuid.UUID,
        filename: str,
        file_bytes: bytes,
        uploaded_by: User,
    ) -> AiKnowledgeDocumentVersion:
        """
        Creates a new immutable version for an existing document:
        - Preserves historical versions.
        - Does NOT replace current active version until new version is approved.
        - Calculates next version number (max + 1).
        """
        assert_sadmin(uploaded_by)

        doc = db.get(AiKnowledgeDocument, document_id)
        if not doc:
            raise KnowledgeCentreError(f"Document {document_id} not found.")

        # Determine next version number
        stmt = select(func.max(AiKnowledgeDocumentVersion.version_number)).where(
            AiKnowledgeDocumentVersion.document_id == document_id
        )
        max_ver = db.execute(stmt).scalar() or 1
        new_version_num = max_ver + 1

        checksum = hashlib.sha256(file_bytes).hexdigest()
        existing = self.check_duplicate_checksum(db, checksum, exclude_document_id=document_id)
        if existing:
            raise KnowledgeDuplicateDocumentError(
                f"Document with identical content (SHA-256: {checksum}) already exists: "
                f"Document ID {existing.document_id}, Version {existing.version_number}."
            )

        subfolder = f"{KNOWLEDGE_STORAGE_PREFIX}/{doc.domain.strip().lower()}"
        save_res = storage_service.save_file(
            content=file_bytes,
            filename=f"v{new_version_num}_{sanitize_filename(filename)}",
            subfolder=subfolder,
            allowed_mime_types=KNOWLEDGE_ALLOWED_MIME_TYPES,
            max_size_bytes=DEFAULT_KNOWLEDGE_MAX_UPLOAD_BYTES,
        )

        try:
            new_version = AiKnowledgeDocumentVersion(
                document_id=doc.id,
                version_number=new_version_num,
                storage_key=save_res.storage_key,
                checksum_sha256=save_res.sha256_checksum,
                original_filename=filename,
                mime_type=save_res.mime_type,
                size_bytes=save_res.file_size_bytes,
                extraction_status=KnowledgeExtractionStatus.PENDING.value,
                approval_status=KnowledgeApprovalStatus.PENDING.value,
            )
            db.add(new_version)
            db.flush()
        except Exception as db_exc:
            logger.error("DB persistence failed for new version. Cleaning up storage key '%s': %s", save_res.storage_key, db_exc)
            try:
                storage_service.delete_file(save_res.storage_key)
            except Exception as del_exc:
                logger.error("Failed to delete orphaned storage key '%s': %s", save_res.storage_key, del_exc)
            raise db_exc

        logger.info(
            "Created new version v%d for document %s (storage_key: %s). Prior version remains active.",
            new_version_num, doc.id, new_version.storage_key
        )
        return new_version

    def extract_and_index_document(
        self,
        db: Session,
        document_id: uuid.UUID,
        version_id: uuid.UUID,
        job_id: Optional[uuid.UUID] = None,
    ) -> int:
        """
        Executes document text extraction, chunking, and embedding with strict job ownership:
        1. Atomically transitions document to PROCESSING and stamps job_id and heartbeat.
        2. Heartbeats before and after parsing.
        3. Heartbeats before and during batch embedding iterations.
        4. Validates ownership via atomic CAS before committing extracted chunks.
        5. If ownership was revoked by recovery or newer retry, rolls back and aborts cleanly.
        """
        from sqlalchemy import delete, update
        try:
            doc, ver, assigned_job = self.transition_to_processing(db, document_id, version_id, job_id=job_id)
        except Exception as exc:
            logger.error("Failed to transition document %s to processing: %s", document_id, exc)
            return 0

        try:
            # 2. Resolve local file path
            local_path = storage_service.get_file_path(ver.storage_key)

            # Heartbeat check
            self.update_heartbeat(db, version_id, assigned_job)

            # 3. Parse file
            parser = DocumentParser()
            parse_res = parser.parse_file(str(local_path))

            # 4. Chunk document
            chunks = parser.chunk_document(parse_res)
            if not chunks:
                raise KnowledgeCentreError("Document extraction yielded 0 extractable text passages.")

            # Heartbeat check
            self.update_heartbeat(db, version_id, assigned_job)

            # 5. Clear any prior chunks for this version
            db.execute(delete(AiKnowledgeChunk).where(AiKnowledgeChunk.version_id == version_id))

            # 6. Embed chunks in batch with full provenance tracking and periodic heartbeats
            texts = [c.chunk_text for c in chunks]
            batch_size = 16
            all_embeddings = []
            final_provenance = {}

            for batch_start in range(0, len(texts), batch_size):
                self.update_heartbeat(db, version_id, assigned_job)
                batch_texts = texts[batch_start : batch_start + batch_size]
                emb_batch, prov = embedding_service.embed_batch_with_provenance(batch_texts, batch_size=batch_size)
                all_embeddings.extend(emb_batch)
                final_provenance = prov

            # 7. Persist chunks with embedded provenance metadata
            for i, (chk, emb) in enumerate(zip(chunks, all_embeddings)):
                meta = {
                    "document_title": doc.title,
                    "domain": doc.domain,
                    "section_heading": chk.section_heading,
                    "source_filename": ver.original_filename,
                    "academic_session": doc.academic_session,
                    "token_count": chk.token_count,
                    "checksum_sha256": chk.checksum_sha256,
                    "embedding_model": final_provenance.get("embedding_model"),
                    "embedding_dimensions": final_provenance.get("embedding_dimensions"),
                    "embedding_provider": final_provenance.get("embedding_provider"),
                    "embedding_mode": final_provenance.get("embedding_mode"),
                    "embedding_status": final_provenance.get("embedding_status", "indexed"),
                    "generated_at": final_provenance.get("generated_at"),
                }
                chunk_record = AiKnowledgeChunk(
                    document_id=doc.id,
                    version_id=ver.id,
                    chunk_index=i,
                    content=chk.chunk_text,
                    page_number=chk.page_number or chk.slide_number,
                    chunk_metadata=meta,
                    embedding=emb,
                    verification_status=KnowledgeVerificationStatus.INDEXED.value,
                )
                db.add(chunk_record)

            db.flush()

            # 8. ATOMIC CAS VALIDATION: Confirm we still hold job ownership before committing
            now = datetime.now(timezone.utc)
            cas_stmt = (
                update(AiKnowledgeDocumentVersion)
                .where(
                    AiKnowledgeDocumentVersion.id == version_id,
                    AiKnowledgeDocumentVersion.job_id == assigned_job,
                )
                .values(
                    extraction_status=KnowledgeExtractionStatus.PARSED.value,
                    processing_error=None,
                    heartbeat_at=now,
                )
            )
            cas_res = db.execute(cas_stmt)
            if cas_res.rowcount == 0:
                # Ownership was revoked! Discard chunks and abort
                db.rollback()
                logger.warning(
                    "Worker commit aborted: Job ownership %s on version %s was revoked prior to commit.",
                    assigned_job,
                    version_id,
                )
                raise ExtractionJobRevokedError(
                    f"Job ownership {assigned_job} revoked prior to commit. Discarded chunks."
                )

            # Update document to PENDING_APPROVAL
            doc.status = KnowledgeDocumentStatus.PENDING_APPROVAL.value
            doc.updated_at = now
            db.commit()
            logger.info("Successfully extracted and indexed %d chunks for document %s (version %s, job %s)", len(chunks), document_id, version_id, assigned_job)
            return len(chunks)

        except ExtractionJobRevokedError as rev_err:
            db.rollback()
            logger.warning("Extraction aborted cleanly: %s", rev_err)
            return 0
        except Exception as exc:
            db.rollback()
            err_msg = str(exc)
            logger.error("Failed to extract document %s (version %s, job %s): %s", document_id, version_id, assigned_job, err_msg, exc_info=True)
            try:
                db.execute(
                    update(AiKnowledgeDocumentVersion)
                    .where(
                        AiKnowledgeDocumentVersion.id == version_id,
                        AiKnowledgeDocumentVersion.job_id == assigned_job,
                    )
                    .values(
                        extraction_status=KnowledgeExtractionStatus.FAILED.value,
                        processing_error=err_msg,
                    )
                )
                doc.status = KnowledgeDocumentStatus.DRAFT.value
                db.commit()
            except Exception:
                db.rollback()
            return 0

    def retry_extraction(
        self,
        db: Session,
        document_id: uuid.UUID,
        version_id: Optional[uuid.UUID],
        acting_user: User,
    ) -> Tuple[AiKnowledgeDocumentVersion, uuid.UUID]:
        """SADMIN retry for a failed or stuck document version: issues fresh job_id."""
        assert_sadmin(acting_user)

        doc = db.get(AiKnowledgeDocument, document_id)
        if not doc:
            raise KnowledgeCentreError(f"Document {document_id} not found.")

        target_version_id = version_id or doc.current_version_id
        if not target_version_id:
            latest = db.execute(
                select(AiKnowledgeDocumentVersion)
                .where(AiKnowledgeDocumentVersion.document_id == document_id)
                .order_by(desc(AiKnowledgeDocumentVersion.version_number))
            ).scalars().first()
            if not latest:
                raise KnowledgeCentreError("No version found to retry.")
            target_version_id = latest.id

        ver = db.get(AiKnowledgeDocumentVersion, target_version_id)
        if not ver:
            raise KnowledgeCentreError(f"Version {target_version_id} not found.")

        new_job_id = uuid.uuid4()
        now = datetime.now(timezone.utc)

        ver.job_id = new_job_id
        ver.heartbeat_at = now
        ver.extraction_status = KnowledgeExtractionStatus.PENDING.value
        ver.processing_error = None

        doc.status = KnowledgeDocumentStatus.PROCESSING.value
        doc.updated_at = now
        db.commit()
        return ver, new_job_id

    def recover_stale_processing_jobs(
        self,
        db: Session,
        stale_minutes: int = DEFAULT_STALE_PROCESSING_THRESHOLD_MINUTES,
        acting_user: Optional[User] = None,
    ) -> List[Dict[str, Any]]:
        """
        SADMIN-controlled recovery workflow for stranded extraction jobs with coordination locking:
        1. Serializes recovery calls via advisory / thread locking to prevent concurrent recovery collisions.
        2. Detects stale jobs based on heartbeat_at (fallback to doc.updated_at if heartbeat_at is NULL).
           Active jobs updating their heartbeat are NEVER touched even if running > stale_minutes.
        3. Atomically revokes job_id and marks extraction_status='failed' via compare-and-set.
        4. Purges partial chunks only for the revoked stale version.
        5. Preserves prior approved active document version if one exists.
        """
        if acting_user:
            assert_sadmin(acting_user)

        from sqlalchemy import delete, update

        with _stale_recovery_lock:
            # PostgreSQL advisory lock for multi-instance recovery coordination
            try:
                bind = db.get_bind()
                if bind and bind.dialect.name == "postgresql":
                    db.execute(select(func.pg_advisory_xact_lock(0x56594153415F5354)))
            except Exception as lock_err:
                logger.debug("PostgreSQL administrative recovery lock note: %s", lock_err)

            now = datetime.now(timezone.utc)
            cutoff = now - timedelta(minutes=stale_minutes)

            # Query documents in PROCESSING state
            stale_stmt = (
                select(AiKnowledgeDocument)
                .where(
                    AiKnowledgeDocument.status == KnowledgeDocumentStatus.PROCESSING.value,
                )
            )
            candidates = db.scalars(stale_stmt).all()
            recovered_records = []

            for doc in candidates:
                # Find the latest version currently attached
                latest_ver = db.execute(
                    select(AiKnowledgeDocumentVersion)
                    .where(AiKnowledgeDocumentVersion.document_id == doc.id)
                    .order_by(desc(AiKnowledgeDocumentVersion.version_number))
                ).scalars().first()

                if not latest_ver:
                    continue

                # Check heartbeat staleness
                last_activity = latest_ver.heartbeat_at or doc.updated_at
                # Normalize timezone if naive
                if last_activity and last_activity.tzinfo is None:
                    last_activity = last_activity.replace(tzinfo=timezone.utc)

                if last_activity and last_activity >= cutoff:
                    # Job is actively running and updating heartbeat; LEAVE IT UNTOUCHED!
                    logger.info(
                        "Document %s (v%d, job %s) has fresh heartbeat (%s >= %s). Leaving active worker untouched.",
                        doc.id,
                        latest_ver.version_number,
                        latest_ver.job_id,
                        last_activity,
                        cutoff,
                    )
                    continue

                # ATOMIC RECOVERY: Revoke job_id and mark failed via CAS
                reclaim_stmt = (
                    update(AiKnowledgeDocumentVersion)
                    .where(
                        AiKnowledgeDocumentVersion.id == latest_ver.id,
                        AiKnowledgeDocumentVersion.job_id == latest_ver.job_id,
                        AiKnowledgeDocumentVersion.extraction_status.in_([
                            KnowledgeExtractionStatus.PENDING.value,
                            "processing",
                        ]),
                    )
                    .values(
                        job_id=None,
                        extraction_status=KnowledgeExtractionStatus.FAILED.value,
                        processing_error=f"Stale extraction recovered: heartbeat expired (inactive for >{stale_minutes}m).",
                        heartbeat_at=now,
                    )
                )
                reclaim_res = db.execute(reclaim_stmt)
                if reclaim_res.rowcount == 0:
                    # Another process already claimed or worker completed
                    continue

                # Purge partial chunks for the failed version
                db.execute(delete(AiKnowledgeChunk).where(AiKnowledgeChunk.version_id == latest_ver.id))

                # Preserve prior active version if available
                has_prior_active = bool(
                    doc.current_version_id
                    and doc.current_version
                    and doc.current_version.approval_status == KnowledgeApprovalStatus.APPROVED.value
                )

                if has_prior_active:
                    doc.status = KnowledgeDocumentStatus.ACTIVE.value
                    recovery_action = "restored_prior_active_version"
                else:
                    doc.status = KnowledgeDocumentStatus.DRAFT.value
                    recovery_action = "reset_to_draft"

                doc.updated_at = now
                recovered_records.append({
                    "document_id": str(doc.id),
                    "title": doc.title,
                    "version_number": latest_ver.version_number,
                    "recovery_action": recovery_action,
                    "stale_duration_minutes": stale_minutes,
                })
                logger.warning(
                    "Recovered stranded knowledge document %s (v%d): action=%s (heartbeat inactive >%dm)",
                    doc.id,
                    latest_ver.version_number,
                    recovery_action,
                    stale_minutes,
                )

            if recovered_records:
                db.commit()

            return recovered_records

    def get_dashboard_stats(self, db: Session) -> Dict[str, Any]:
        """Calculates platform-wide AI Knowledge Centre inventory and pipeline metrics."""
        total_docs = db.scalar(select(func.count(AiKnowledgeDocument.id))) or 0
        published_docs = db.scalar(
            select(func.count(AiKnowledgeDocument.id)).where(AiKnowledgeDocument.status == KnowledgeDocumentStatus.ACTIVE.value)
        ) or 0
        pending_approvals = db.scalar(
            select(func.count(AiKnowledgeDocument.id)).where(AiKnowledgeDocument.status == KnowledgeDocumentStatus.PENDING_APPROVAL.value)
        ) or 0
        processing_docs = db.scalar(
            select(func.count(AiKnowledgeDocument.id)).where(AiKnowledgeDocument.status == KnowledgeDocumentStatus.PROCESSING.value)
        ) or 0
        failed_docs = db.scalar(
            select(func.count(AiKnowledgeDocumentVersion.id)).where(AiKnowledgeDocumentVersion.extraction_status == KnowledgeExtractionStatus.FAILED.value)
        ) or 0

        total_passages = db.scalar(select(func.count(AiKnowledgeChunk.id))) or 0
        verified_passages = db.scalar(
            select(func.count(AiKnowledgeChunk.id)).where(AiKnowledgeChunk.verification_status == KnowledgeVerificationStatus.VERIFIED.value)
        ) or 0
        indexed_passages = db.scalar(
            select(func.count(AiKnowledgeChunk.id)).where(
                AiKnowledgeChunk.verification_status.in_([
                    KnowledgeVerificationStatus.INDEXED.value,
                    KnowledgeVerificationStatus.VERIFIED.value,
                ]),
                AiKnowledgeChunk.embedding.isnot(None),
            )
        ) or 0

        # Domain distribution
        domain_rows = db.execute(
            select(AiKnowledgeDocument.domain, func.count(AiKnowledgeDocument.id)).group_by(AiKnowledgeDocument.domain)
        ).all()
        domain_dist = {r[0]: r[1] for r in domain_rows if r[0]}

        # Status distribution
        status_rows = db.execute(
            select(AiKnowledgeDocument.status, func.count(AiKnowledgeDocument.id)).group_by(AiKnowledgeDocument.status)
        ).all()
        status_dist = {r[0]: r[1] for r in status_rows if r[0]}

        return {
            "total_documents": total_docs,
            "published_documents": published_docs,
            "pending_approvals": pending_approvals,
            "processing_documents": processing_docs,
            "failed_documents": failed_docs,
            "total_passages": total_passages,
            "verified_passages": verified_passages,
            "indexed_passages": indexed_passages,
            "domain_distribution": domain_dist,
            "status_distribution": status_dist,
        }

    def list_documents(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 20,
        domain: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        document_type: Optional[str] = None,
    ) -> Tuple[List[AiKnowledgeDocument], int]:
        """Queries documents with filters, pagination, and total count."""
        stmt = select(AiKnowledgeDocument).options(
            joinedload(AiKnowledgeDocument.current_version),
            joinedload(AiKnowledgeDocument.versions),
        )

        if domain:
            stmt = stmt.where(AiKnowledgeDocument.domain == domain.strip().lower())
        if status:
            stmt = stmt.where(AiKnowledgeDocument.status == status.strip().lower())
        if document_type:
            stmt = stmt.where(AiKnowledgeDocument.document_type == document_type.strip().lower())
        if search:
            q = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    AiKnowledgeDocument.title.ilike(q),
                    AiKnowledgeDocument.description.ilike(q),
                    AiKnowledgeDocument.issuing_authority.ilike(q),
                )
            )

        # Count query
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.scalar(count_stmt) or 0

        # Order and paginate
        stmt = stmt.order_by(desc(AiKnowledgeDocument.created_at)).offset(skip).limit(limit)
        items = db.execute(stmt).unique().scalars().all()

        return list(items), total

    def get_document_detail(
        self,
        db: Session,
        document_id: uuid.UUID,
    ) -> Optional[AiKnowledgeDocument]:
        """Fetches full document entity with versions and chunks."""
        stmt = (
            select(AiKnowledgeDocument)
            .options(
                joinedload(AiKnowledgeDocument.versions),
                joinedload(AiKnowledgeDocument.current_version),
                joinedload(AiKnowledgeDocument.chunks),
            )
            .where(AiKnowledgeDocument.id == document_id)
        )
        return db.execute(stmt).unique().scalar_one_or_none()

    def list_chunks(
        self,
        db: Session,
        document_id: uuid.UUID,
        version_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
    ) -> Tuple[List[AiKnowledgeChunk], int]:
        """
        Retrieves paginated passage chunks for a document or specific version,
        ordered by chunk_index.
        """
        stmt = select(AiKnowledgeChunk).where(AiKnowledgeChunk.document_id == document_id)
        if version_id:
            stmt = stmt.where(AiKnowledgeChunk.version_id == version_id)
        if search:
            q = f"%{search.strip()}%"
            stmt = stmt.where(AiKnowledgeChunk.content.ilike(q))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.scalar(count_stmt) or 0

        stmt = stmt.order_by(AiKnowledgeChunk.chunk_index.asc()).offset(skip).limit(limit)
        items = db.execute(stmt).scalars().all()
        return list(items), total


# Singleton instance
knowledge_service = KnowledgeCentreService()
