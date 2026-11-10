"""
ANUDAAN (Yajur Veda) Domain Service Layer
Handles application draft lifecycle, multi-publication intake, author attribution,
bank encryption, document upload validation, atomic final submission, and secure tracking.
"""
import logging
import secrets
import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import delete, func, or_, select, text
from sqlalchemy.orm import Session, joinedload

from app.core.logging import logger
from app.core.security import hash_password, verify_password
from app.core.storage import storage_service, sanitize_filename

from app.modules.yajur_veda.models.anudaan import (
    AnudaanApplication,
    AnudaanPerson,
    AnudaanPublication,
    AnudaanBankAccount,
    AnudaanBankAccountHolder,
    AnudaanPublicationAuthor,
    AnudaanDocument,
    AnudaanDeclaration,
    AnudaanVerification,
    normalize_doi,
)
from app.modules.yajur_veda.models.enums import (
    AnudaanApplicantCategory,
    AnudaanApplicationStatus,
    AnudaanDocumentType,
    AnudaanPublicationStatus,
    AnudaanIndexingType,
    AnudaanAuthorRole,
    AnudaanBankOwnershipStatus,
    AnudaanDocumentCategory,
    AnudaanVerificationType,
    AnudaanVerificationStatus,
)
from app.modules.yajur_veda.schemas.anudaan import (
    AnudaanApplicationCreateDraft,
    AnudaanApplicationUpdateDraft,
    AnudaanPublicationCreate,
    AnudaanPublicationUpdate,
    AnudaanAuthorCreate,
    AnudaanAuthorUpdate,
    AnudaanDeclarationAcceptance,
    AnudaanSafeBankAccountOut,
    AnudaanAuthorOut,
    AnudaanPublicationOut,
    AnudaanDocumentOut,
    AnudaanDeclarationOut,
    AnudaanApplicationDetailOut,
    AnudaanTrackingStatusResponse,
    AnudaanTrackingPublicationSummary,
    MANDATORY_DECLARATION_TYPES,
)

logger = logging.getLogger("vyasa.anudaan.service")

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB strict ceiling

MAGIC_BYTES_MAP = {
    b"%PDF-": "application/pdf",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
}


def _verify_magic_bytes(content: bytes) -> str:
    """Validates file magic signatures against allowed PDF, PNG, and JPEG formats."""
    for sig, mime in MAGIC_BYTES_MAP.items():
        if content.startswith(sig):
            return mime
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported file format. Only PDF, PNG, and JPEG documents are permitted.",
    )


def _generate_application_number(db: Session) -> str:
    """Generates unique institutional application identifier: ANU-YYYY-XXXXX."""
    current_year = datetime.now(timezone.utc).year
    prefix = f"ANU-{current_year}-"
    for _ in range(10):
        random_suffix = secrets.token_hex(3).upper()[:5]  # 5 alphanumeric chars
        candidate = f"{prefix}{random_suffix}"
        existing = db.execute(
            select(AnudaanApplication.id).where(AnudaanApplication.application_number == candidate)
        ).scalar_one_or_none()
        if not existing:
            return candidate
    # Fallback to timestamp-based sequence if collisions occur
    seq = int(datetime.now(timezone.utc).timestamp()) % 100000
    return f"{prefix}{seq:05d}"


class AnudaanService:
    """Comprehensive service coordinating the ANUDAAN research incentive lifecycle."""

    # =========================================================================
    # Draft Access & Ownership Verification
    # =========================================================================

    @staticmethod
    def get_application_or_404(db: Session, application_id: uuid.UUID) -> AnudaanApplication:
        """Fetches application with loaded relationships or raises HTTP 404."""
        stmt = (
            select(AnudaanApplication)
            .options(
                joinedload(AnudaanApplication.publications).joinedload(AnudaanPublication.authors).joinedload(AnudaanPublicationAuthor.person),
                joinedload(AnudaanApplication.publications).joinedload(AnudaanPublication.authors).joinedload(AnudaanPublicationAuthor.bank_account),
                joinedload(AnudaanApplication.publications).joinedload(AnudaanPublication.documents),
                joinedload(AnudaanApplication.documents),
                joinedload(AnudaanApplication.declarations),
            )
            .where(AnudaanApplication.id == application_id)
        )
        app = db.execute(stmt).unique().scalar_one_or_none()
        if not app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Application with ID '{application_id}' not found.",
            )
        return app

    @classmethod
    def verify_draft_access(
        cls,
        db: Session,
        application_id: uuid.UUID,
        draft_key: Optional[str],
    ) -> AnudaanApplication:
        """
        Validates draft secret token before allowing any mutation or retrieval.
        Guarantees that unauthenticated users cannot tamper with applications.
        """
        if not draft_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Draft access key is required (header 'X-Anudaan-Draft-Key' or 'draft_key').",
            )

        app = cls.get_application_or_404(db, application_id)
        secret_hash = (app.form_metadata or {}).get("tracking_secret_hash")
        if not secret_hash or not verify_password(draft_key, secret_hash):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid draft access key.",
            )
        return app

    @staticmethod
    def assert_draft_is_mutable(application: AnudaanApplication) -> None:
        """Ensures that the application is still in DRAFT stage and not locked."""
        if application.status != AnudaanApplicationStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Application '{application.application_number}' has already been submitted ({application.status.value}) and is locked for modifications.",
            )

    # =========================================================================
    # 1. Draft Creation & Profile Updates
    # =========================================================================

    @classmethod
    def create_draft_application(
        cls,
        db: Session,
        data: AnudaanApplicationCreateDraft,
        user_id: Optional[uuid.UUID] = None,
    ) -> Tuple[AnudaanApplication, str]:
        """
        Initial intake creating a DRAFT application record.
        Generates tracking credentials and returns raw secret once.
        """
        app_number = _generate_application_number(db)
        tracking_secret = secrets.token_urlsafe(24)
        secret_hash = hash_password(tracking_secret)

        metadata = dict(data.form_metadata or {})
        metadata["tracking_secret_hash"] = secret_hash

        application = AnudaanApplication(
            id=uuid.uuid4(),
            application_number=app_number,
            applicant_user_id=user_id,
            applicant_category=data.applicant_category,
            full_name=data.full_name.strip(),
            institutional_id=data.institutional_id.strip(),
            designation=data.designation.strip(),
            department_name=data.department_name.strip(),
            supervisor_name=data.supervisor_name.strip() if data.supervisor_name else None,
            mobile_number=data.mobile_number.strip(),
            scopus_author_id=data.scopus_author_id.strip() if data.scopus_author_id else None,
            scopus_profile_url=data.scopus_profile_url.strip() if data.scopus_profile_url else None,
            status=AnudaanApplicationStatus.DRAFT,
            form_metadata=metadata,
            submitted_at=None,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        db.add(application)
        db.commit()
        db.refresh(application)
        logger.info(f"Created ANUDAAN draft application {application.application_number} (ID: {application.id})")
        return application, tracking_secret

    @classmethod
    def update_draft_application(
        cls,
        db: Session,
        application_id: uuid.UUID,
        data: AnudaanApplicationUpdateDraft,
        draft_key: Optional[str],
    ) -> AnudaanApplication:
        """Updates applicant profile fields of a DRAFT application."""
        app = cls.verify_draft_access(db, application_id, draft_key)
        cls.assert_draft_is_mutable(app)

        if data.applicant_category is not None:
            app.applicant_category = data.applicant_category
        if data.full_name is not None:
            app.full_name = data.full_name.strip()
        if data.institutional_id is not None:
            app.institutional_id = data.institutional_id.strip()
        if data.designation is not None:
            app.designation = data.designation.strip()
        if data.department_name is not None:
            app.department_name = data.department_name.strip()
        if data.supervisor_name is not None:
            app.supervisor_name = data.supervisor_name.strip() if data.supervisor_name else None
        if data.mobile_number is not None:
            app.mobile_number = data.mobile_number.strip()
        if data.scopus_author_id is not None:
            app.scopus_author_id = data.scopus_author_id.strip() if data.scopus_author_id else None
        if data.scopus_profile_url is not None:
            app.scopus_profile_url = data.scopus_profile_url.strip() if data.scopus_profile_url else None
        if data.form_metadata is not None:
            existing_hash = (app.form_metadata or {}).get("tracking_secret_hash")
            new_metadata = dict(data.form_metadata)
            if existing_hash:
                new_metadata["tracking_secret_hash"] = existing_hash
            app.form_metadata = new_metadata

        db.commit()
        db.refresh(app)
        return app

    # =========================================================================
    # 2. Publication Intake & Management
    # =========================================================================

    @classmethod
    def add_publication(
        cls,
        db: Session,
        application_id: uuid.UUID,
        data: AnudaanPublicationCreate,
        draft_key: Optional[str],
    ) -> AnudaanPublication:
        """Adds a publication to a draft application, checking for active duplicate DOIs."""
        app = cls.verify_draft_access(db, application_id, draft_key)
        cls.assert_draft_is_mutable(app)

        norm_doi = normalize_doi(data.doi)
        if norm_doi:
            # 1. Intra-draft duplicate check (prevent duplicate DOI in same application)
            intra_dup = db.execute(
                select(AnudaanPublication.id).where(
                    AnudaanPublication.application_id == app.id,
                    AnudaanPublication.normalized_doi == norm_doi,
                )
            ).scalar_one_or_none()
            if intra_dup:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Publication with DOI '{data.doi}' is already attached to this draft application.",
                )

            # 2. Duplicate check across active/submitted applications
            dup_stmt = (
                select(AnudaanPublication.id)
                .join(AnudaanApplication, AnudaanPublication.application_id == AnudaanApplication.id)
                .where(
                    AnudaanPublication.normalized_doi == norm_doi,
                    AnudaanApplication.id != app.id,
                    AnudaanApplication.status.in_([
                        AnudaanApplicationStatus.SUBMITTED,
                        AnudaanApplicationStatus.UNDER_REVIEW,
                        AnudaanApplicationStatus.ACCEPTED,
                        AnudaanApplicationStatus.APPROVED_FOR_RELEASE,
                        AnudaanApplicationStatus.RELEASED,
                        AnudaanApplicationStatus.PROCESSING,
                        AnudaanApplicationStatus.CREDITED,
                    ]),
                )
            )
            if db.execute(dup_stmt).scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Publication with DOI '{data.doi}' is already submitted under another active application.",
                )

        pub = AnudaanPublication(
            id=uuid.uuid4(),
            application_id=app.id,
            publication_date=data.publication_date,
            document_type=data.document_type,
            publication_status=data.publication_status,
            indexing_type=data.indexing_type,
            has_csjmu_affiliation=data.has_csjmu_affiliation,
            paper_title=data.paper_title.strip(),
            journal_name=data.journal_name.strip(),
            issn=data.issn.strip() if data.issn else None,
            e_issn=data.e_issn.strip() if data.e_issn else None,
            publication_year=data.publication_year,
            volume=data.volume.strip() if data.volume else None,
            issue=data.issue.strip() if data.issue else None,
            page_details=data.page_details.strip() if data.page_details else None,
            applicant_declared_quartile=data.applicant_declared_quartile,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        pub.set_doi(data.doi)

        db.add(pub)
        db.commit()
        db.refresh(pub)
        return pub

    @classmethod
    def update_publication(
        cls,
        db: Session,
        publication_id: uuid.UUID,
        data: AnudaanPublicationUpdate,
        draft_key: Optional[str],
    ) -> AnudaanPublication:
        """Updates publication metadata in a draft."""
        stmt = (
            select(AnudaanPublication)
            .options(joinedload(AnudaanPublication.application))
            .where(AnudaanPublication.id == publication_id)
        )
        pub = db.execute(stmt).scalar_one_or_none()
        if not pub:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Publication not found.")

        if pub.application:
            app = pub.application
            cls.assert_draft_is_mutable(app)
            secret_hash = (app.form_metadata or {}).get("tracking_secret_hash")
            if not draft_key or not secret_hash or not verify_password(draft_key, secret_hash):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid draft access key.")
        else:
            app = cls.verify_draft_access(db, pub.application_id, draft_key)
            cls.assert_draft_is_mutable(app)

        if data.doi is not None:
            norm_doi = normalize_doi(data.doi)
            if norm_doi and norm_doi != pub.normalized_doi:
                # 1. Intra-draft duplicate check
                intra_dup = db.execute(
                    select(AnudaanPublication.id).where(
                        AnudaanPublication.application_id == pub.application_id,
                        AnudaanPublication.id != pub.id,
                        AnudaanPublication.normalized_doi == norm_doi,
                    )
                ).scalar_one_or_none()
                if intra_dup:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Publication with DOI '{data.doi}' is already attached to this draft application.",
                    )

                # 2. Duplicate check across active/submitted applications
                dup_stmt = (
                    select(AnudaanPublication.id)
                    .join(AnudaanApplication, AnudaanPublication.application_id == AnudaanApplication.id)
                    .where(
                        AnudaanPublication.normalized_doi == norm_doi,
                        AnudaanPublication.id != pub.id,
                        AnudaanApplication.id != pub.application_id,
                        AnudaanApplication.status.in_([
                            AnudaanApplicationStatus.SUBMITTED,
                            AnudaanApplicationStatus.UNDER_REVIEW,
                            AnudaanApplicationStatus.ACCEPTED,
                            AnudaanApplicationStatus.APPROVED_FOR_RELEASE,
                            AnudaanApplicationStatus.RELEASED,
                            AnudaanApplicationStatus.PROCESSING,
                            AnudaanApplicationStatus.CREDITED,
                        ]),
                    )
                )
                if db.execute(dup_stmt).scalar_one_or_none():
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Publication with DOI '{data.doi}' is already submitted under another active application.",
                    )
            pub.set_doi(data.doi)

        if data.publication_date is not None:
            pub.publication_date = data.publication_date
        if data.document_type is not None:
            pub.document_type = data.document_type
        if data.publication_status is not None:
            pub.publication_status = data.publication_status
        if data.indexing_type is not None:
            pub.indexing_type = data.indexing_type
        if data.has_csjmu_affiliation is not None:
            pub.has_csjmu_affiliation = data.has_csjmu_affiliation
        if data.paper_title is not None:
            pub.paper_title = data.paper_title.strip()
        if data.journal_name is not None:
            pub.journal_name = data.journal_name.strip()
        if data.issn is not None:
            pub.issn = data.issn.strip() if data.issn else None
        if data.e_issn is not None:
            pub.e_issn = data.e_issn.strip() if data.e_issn else None
        if data.publication_year is not None:
            pub.publication_year = data.publication_year
        if data.volume is not None:
            pub.volume = data.volume.strip() if data.volume else None
        if data.issue is not None:
            pub.issue = data.issue.strip() if data.issue else None
        if data.page_details is not None:
            pub.page_details = data.page_details.strip() if data.page_details else None
        if data.applicant_declared_quartile is not None:
            pub.applicant_declared_quartile = data.applicant_declared_quartile

        db.commit()
        db.refresh(pub)
        return pub

    @classmethod
    def delete_publication(
        cls,
        db: Session,
        publication_id: uuid.UUID,
        draft_key: Optional[str],
    ) -> None:
        """Deletes publication and cascade removes associated authors and document records."""
        stmt = (
            select(AnudaanPublication)
            .options(joinedload(AnudaanPublication.application))
            .where(AnudaanPublication.id == publication_id)
        )
        pub = db.execute(stmt).scalar_one_or_none()
        if not pub:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Publication not found.")

        if pub.application:
            app = pub.application
            cls.assert_draft_is_mutable(app)
            secret_hash = (app.form_metadata or {}).get("tracking_secret_hash")
            if not draft_key or not secret_hash or not verify_password(draft_key, secret_hash):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid draft access key.")
        else:
            app = cls.verify_draft_access(db, pub.application_id, draft_key)
            cls.assert_draft_is_mutable(app)

        db.delete(pub)
        db.commit()

    # =========================================================================
    # 3. Authorship & Banking Ledger
    # =========================================================================

    @classmethod
    def add_author_to_publication(
        cls,
        db: Session,
        publication_id: uuid.UUID,
        data: AnudaanAuthorCreate,
        draft_key: Optional[str],
    ) -> AnudaanPublicationAuthor:
        """
        Adds author to a publication, resolving person record and banking encryption.
        Strictly enforces FIRST author and nominated CORRESPONDING author single-cardinality rules.
        """
        stmt = (
            select(AnudaanPublication)
            .options(
                joinedload(AnudaanPublication.application),
                joinedload(AnudaanPublication.authors),
            )
            .where(AnudaanPublication.id == publication_id)
        )
        pub = db.execute(stmt).unique().scalar_one_or_none()
        if not pub:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Publication not found.")

        if pub.application:
            app = pub.application
            cls.assert_draft_is_mutable(app)
            secret_hash = (app.form_metadata or {}).get("tracking_secret_hash")
            if not draft_key or not secret_hash or not verify_password(draft_key, secret_hash):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid draft access key.")
        else:
            app = cls.verify_draft_access(db, pub.application_id, draft_key)
            cls.assert_draft_is_mutable(app)

        # 1. Author role cardinality checks
        if data.author_role == AnudaanAuthorRole.FIRST:
            for a in pub.authors:
                if a.author_role == AnudaanAuthorRole.FIRST:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Publication already has a designated first author. Only one first author is permitted.",
                    )

        if data.is_nominated_corresponding_author:
            if data.author_role != AnudaanAuthorRole.CORRESPONDING:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Only an author with CORRESPONDING role can be nominated for corresponding author incentive share.",
                )
            for a in pub.authors:
                if a.is_nominated_corresponding_author:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Publication already has a nominated corresponding author. Exactly one is permitted.",
                    )

        # 2. Resolve or create AnudaanPerson
        person = None
        if data.employee_or_registration_id:
            person = db.execute(
                select(AnudaanPerson).where(AnudaanPerson.employee_or_registration_id == data.employee_or_registration_id.strip())
            ).scalar_one_or_none()
        if not person and data.scopus_author_id:
            person = db.execute(
                select(AnudaanPerson).where(AnudaanPerson.scopus_author_id == data.scopus_author_id.strip())
            ).scalar_one_or_none()
        if not person:
            person = db.execute(
                select(AnudaanPerson).where(
                    AnudaanPerson.full_name == data.full_name.strip(),
                    AnudaanPerson.mobile_number == data.mobile_number,
                )
            ).scalar_one_or_none()

        if not person:
            person = AnudaanPerson(
                full_name=data.full_name.strip(),
                scopus_author_id=data.scopus_author_id.strip() if data.scopus_author_id else None,
                scopus_profile_url=data.scopus_profile_url.strip() if data.scopus_profile_url else None,
                mobile_number=data.mobile_number.strip() if data.mobile_number else None,
                employee_or_registration_id=data.employee_or_registration_id.strip() if data.employee_or_registration_id else None,
            )
            db.add(person)
            db.flush()
        else:
            # Update missing attributes
            if data.scopus_author_id and not person.scopus_author_id:
                person.scopus_author_id = data.scopus_author_id.strip()
            if data.scopus_profile_url and not person.scopus_profile_url:
                person.scopus_profile_url = data.scopus_profile_url.strip()
            if data.mobile_number and not person.mobile_number:
                person.mobile_number = data.mobile_number.strip()
            if data.employee_or_registration_id and not person.employee_or_registration_id:
                person.employee_or_registration_id = data.employee_or_registration_id.strip()

        # 3. Handle Banking designation
        target_bank_id: Optional[uuid.UUID] = None

        if data.author_role in (AnudaanAuthorRole.FIRST, AnudaanAuthorRole.CORRESPONDING):
            if data.bank_reuse_selected and data.bank_account_id:
                # Must be verified before reuse
                holder_link = db.execute(
                    select(AnudaanBankAccountHolder).where(
                        AnudaanBankAccountHolder.person_id == person.id,
                        AnudaanBankAccountHolder.bank_account_id == data.bank_account_id,
                    )
                ).scalar_one_or_none()
                if not holder_link:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Selected bank account is not linked to this researcher.",
                    )
                if holder_link.ownership_verification_status != AnudaanBankOwnershipStatus.VERIFIED:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Bank account reuse requires prior institutional verification. Account is currently UNVERIFIED.",
                    )
                target_bank_id = data.bank_account_id

            elif data.new_bank_details:
                # Encrypt and create new account
                bank = AnudaanBankAccount(
                    account_holder_name=data.new_bank_details.account_holder_name.strip(),
                    bank_name=data.new_bank_details.bank_name.strip(),
                    ifsc_code=data.new_bank_details.ifsc_code.strip().upper(),
                    branch_name=data.new_bank_details.branch_name.strip(),
                    account_type=data.new_bank_details.account_type,
                    bank_mobile_number=data.new_bank_details.bank_mobile_number.strip() if data.new_bank_details.bank_mobile_number else None,
                )
                bank.set_account_number(data.new_bank_details.account_number)
                bank.set_pan(data.new_bank_details.pan_number)
                db.add(bank)
                db.flush()

                # Link person as holder
                holder = AnudaanBankAccountHolder(
                    person_id=person.id,
                    bank_account_id=bank.id,
                    ownership_verification_status=AnudaanBankOwnershipStatus.UNVERIFIED,
                )
                db.add(holder)
                db.flush()
                target_bank_id = bank.id

        author = AnudaanPublicationAuthor(
            id=uuid.uuid4(),
            publication_id=pub.id,
            person_id=person.id,
            author_role=data.author_role,
            author_order=data.author_order,
            is_csjmu_affiliated=data.is_csjmu_affiliated,
            has_multiple_corresponding_authors=data.has_multiple_corresponding_authors,
            is_nominated_corresponding_author=data.is_nominated_corresponding_author,
            bank_reuse_selected=data.bank_reuse_selected,
            bank_account_id=target_bank_id,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(author)
        db.commit()
        db.refresh(author)
        return author

    @classmethod
    def delete_author(
        cls,
        db: Session,
        author_id: uuid.UUID,
        draft_key: Optional[str],
    ) -> None:
        """Deletes author attribution from publication in a draft."""
        stmt = (
            select(AnudaanPublicationAuthor)
            .options(
                joinedload(AnudaanPublicationAuthor.publication).joinedload(AnudaanPublication.application)
            )
            .where(AnudaanPublicationAuthor.id == author_id)
        )
        author = db.execute(stmt).scalar_one_or_none()
        if not author:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author attribution not found.")

        cls.verify_draft_access(db, author.publication.application_id, draft_key)
        cls.assert_draft_is_mutable(author.publication.application)

        db.delete(author)
        db.commit()

    # =========================================================================
    # 4. Document Upload & Storage Integration
    # =========================================================================

    @classmethod
    async def upload_document(
        cls,
        db: Session,
        application_id: uuid.UUID,
        file: UploadFile,
        document_type: AnudaanDocumentCategory,
        draft_key: Optional[str],
        publication_id: Optional[uuid.UUID] = None,
        person_id: Optional[uuid.UUID] = None,
    ) -> AnudaanDocument:
        """
        Validates file magic bytes and size ceiling, stores via storage_service,
        and registers attachment metadata in database.
        """
        app = cls.verify_draft_access(db, application_id, draft_key)
        cls.assert_draft_is_mutable(app)

        content = await file.read()
        file_size = len(content)

        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty file uploaded.",
            )
        if file_size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Uploaded file exceeds maximum limit of 10MB ({file_size} bytes).",
            )

        verified_mime = _verify_magic_bytes(content)
        clean_name = sanitize_filename(file.filename or "upload.bin")
        ext = clean_name.split(".")[-1] if "." in clean_name else "bin"
        storage_key = f"anudaan/applications/{app.id}/{document_type.value.lower()}_{uuid.uuid4().hex[:8]}.{ext}"

        # Pluggable storage save
        storage_service.save_file(
            file_data=content,
            destination_path=storage_key,
            mime_type=verified_mime,
        )

        try:
            doc = AnudaanDocument(
                id=uuid.uuid4(),
                application_id=app.id,
                publication_id=publication_id,
                person_id=person_id,
                document_type=document_type,
                original_filename=clean_name,
                storage_key=storage_key,
                mime_type=verified_mime,
                file_size_bytes=file_size,
                created_at=datetime.now(timezone.utc),
            )
            db.add(doc)

            # Update parent entity storage keys if applicable
            if document_type == AnudaanDocumentCategory.PUBLISHED_PAPER and publication_id:
                pub = db.execute(
                    select(AnudaanPublication).where(AnudaanPublication.id == publication_id)
                ).scalar_one_or_none()
                if pub:
                    pub.paper_document_storage_key = storage_key

            db.commit()
            db.refresh(doc)
            return doc
        except Exception as db_exc:
            logger.warning(f"Database commit failed for uploaded document; purging orphaned file '{storage_key}': {db_exc}")
            try:
                storage_service.delete_file(storage_key)
            except Exception as cleanup_err:
                logger.error(f"Failed to cleanup orphaned storage file '{storage_key}': {cleanup_err}")
            raise db_exc

    @classmethod
    def delete_document(
        cls,
        db: Session,
        document_id: uuid.UUID,
        draft_key: Optional[str],
    ) -> None:
        """Deletes document record and removes physical file from storage service."""
        stmt = (
            select(AnudaanDocument)
            .options(joinedload(AnudaanDocument.application))
            .where(AnudaanDocument.id == document_id)
        )
        doc = db.execute(stmt).scalar_one_or_none()
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

        cls.verify_draft_access(db, doc.application_id, draft_key)
        cls.assert_draft_is_mutable(doc.application)

        storage_key = doc.storage_key
        try:
            storage_service.delete_file(storage_key)
        except Exception as exc:
            logger.warning(f"Failed to delete storage file '{storage_key}': {exc}")

        db.delete(doc)
        db.commit()

    # =========================================================================
    # 5. Final Application Submission & Atomic Verification Gates
    # =========================================================================

    @classmethod
    def submit_application(
        cls,
        db: Session,
        application_id: uuid.UUID,
        declarations: List[AnudaanDeclarationAcceptance],
        draft_key: Optional[str],
    ) -> AnudaanApplication:
        """
        Validates exhaustive institutional eligibility rules, seals declarations,
        transitions application state to SUBMITTED, and dispatches confirmation email.
        Enforces concurrency locking and atomic status transitions.
        """
        app = cls.verify_draft_access(db, application_id, draft_key)
        cls.assert_draft_is_mutable(app)

        # SEC-03: Row-level lock on application row to prevent race conditions during submission
        try:
            db.execute(
                select(AnudaanApplication.id)
                .where(AnudaanApplication.id == application_id)
                .with_for_update()
            )
        except Exception as lock_err:
            logger.debug(f"Row-level locking skipped (non-PostgreSQL engine): {lock_err}")

        # SEC-03: Re-verify draft status under lock
        if app.status != AnudaanApplicationStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Application cannot be submitted because it is currently '{app.status.value}'. Only DRAFT applications can be submitted.",
            )

        # Gate 1: Applicant Profile Integrity
        if not app.full_name or not app.institutional_id or not app.department_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incomplete applicant profile. Name, institutional ID, and department are mandatory.",
            )

        if app.applicant_category in (AnudaanApplicantCategory.SCHOLAR_CAMPUS, AnudaanApplicantCategory.POSTDOC_CAMPUS):
            if not app.supervisor_name or not app.supervisor_name.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Supervisor name is mandatory for {app.applicant_category.value} applicants.",
                )

        # Gate 2: Publications Presence
        if not app.publications:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one research publication must be attached to the application.",
            )

        # SEC-04: Intra-draft duplicate DOI prevention
        raw_dois = [p.normalized_doi for p in app.publications if p.normalized_doi]
        if len(raw_dois) != len(set(raw_dois)):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Duplicate DOIs detected across publications within this application.",
            )

        # SEC-04 & SEC-05: Concurrency protection via deterministic PostgreSQL advisory transaction locks
        sorted_dois = sorted(list(set(raw_dois)))
        for doi_val in sorted_dois:
            try:
                db.execute(
                    text("SELECT pg_advisory_xact_lock(hashtext(:doi_key))"),
                    {"doi_key": f"anudaan_doi:{doi_val}"},
                )
            except Exception as lock_err:
                logger.debug(f"pg_advisory_xact_lock skipped: {lock_err}")

        # SEC-04: Revalidate DOIs against all active applications in the database
        active_statuses = [
            AnudaanApplicationStatus.SUBMITTED,
            AnudaanApplicationStatus.UNDER_REVIEW,
            AnudaanApplicationStatus.ACCEPTED,
            AnudaanApplicationStatus.APPROVED_FOR_RELEASE,
            AnudaanApplicationStatus.RELEASED,
            AnudaanApplicationStatus.PROCESSING,
            AnudaanApplicationStatus.CREDITED,
        ]
        for doi_val in sorted_dois:
            conflict = db.execute(
                select(AnudaanPublication.id)
                .join(AnudaanApplication, AnudaanApplication.id == AnudaanPublication.application_id)
                .where(
                    AnudaanPublication.normalized_doi == doi_val,
                    AnudaanPublication.application_id != app.id,
                    AnudaanApplication.status.in_(active_statuses),
                )
            ).first()
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Publication with DOI '{doi_val}' has already been submitted in an active application.",
                )

        # Gate 3: Per-Publication Strict Invariants
        for pub in app.publications:
            if pub.publication_date < date(2026, 1, 1):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Publication '{pub.paper_title[:50]}' was published prior to January 1, 2026 and is ineligible.",
                )
            if pub.publication_status != AnudaanPublicationStatus.PUBLISHED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Publication '{pub.paper_title[:50]}' status is not PUBLISHED.",
                )
            if pub.document_type not in (AnudaanDocumentType.ARTICLE, AnudaanDocumentType.REVIEW):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Publication '{pub.paper_title[:50]}' document type must be ARTICLE or REVIEW.",
                )
            if pub.indexing_type not in (AnudaanIndexingType.SCOPUS, AnudaanIndexingType.WEB_OF_SCIENCE, AnudaanIndexingType.SCOPUS_AND_WOS):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Publication '{pub.paper_title[:50]}' must be indexed in Scopus or Web of Science.",
                )
            if not pub.has_csjmu_affiliation:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Publication '{pub.paper_title[:50]}' does not declare CSJMU affiliation.",
                )

            # Manuscript document attachment check
            has_paper_doc = pub.paper_document_storage_key is not None or any(
                d.document_type == AnudaanDocumentCategory.PUBLISHED_PAPER for d in pub.documents
            )
            if not has_paper_doc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Manuscript PDF is required for publication '{pub.paper_title[:50]}'.",
                )

            # Authors Invariant Checks
            first_authors = [a for a in pub.authors if a.author_role == AnudaanAuthorRole.FIRST]
            corr_authors = [a for a in pub.authors if a.author_role == AnudaanAuthorRole.CORRESPONDING]
            nominated_corr_authors = [a for a in pub.authors if a.is_nominated_corresponding_author]

            if len(first_authors) != 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Publication '{pub.paper_title[:50]}' must have exactly one designated first author (found {len(first_authors)}).",
                )
            if len(corr_authors) < 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Publication '{pub.paper_title[:50]}' must have at least one corresponding author.",
                )
            if len(nominated_corr_authors) != 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Publication '{pub.paper_title[:50]}' must have exactly one nominated corresponding author for payout share (found {len(nominated_corr_authors)}).",
                )

            # Payout banking check
            first_author = first_authors[0]
            if not first_author.bank_account_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"First author on publication '{pub.paper_title[:50]}' must have designated bank details.",
                )
            nominated_corr = nominated_corr_authors[0]
            if not nominated_corr.bank_account_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Nominated corresponding author on publication '{pub.paper_title[:50]}' must have designated bank details.",
                )

            for a in pub.authors:
                if a.author_role == AnudaanAuthorRole.CO_AUTHOR and a.bank_account_id is not None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Co-author '{a.person.full_name}' cannot have designated bank details (co-authors are non-payable).",
                    )

        # Gate 4: 8 Mandatory Statutory Declarations (Field Mapping V1.1)
        if len(declarations) < len(MANDATORY_DECLARATION_TYPES):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"All {len(MANDATORY_DECLARATION_TYPES)} statutory declarations are mandatory for final submission.",
            )

        provided_types = set()
        for decl in declarations:
            d_type = decl.declaration_type.upper().strip()
            if d_type not in MANDATORY_DECLARATION_TYPES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid statutory declaration type: '{decl.declaration_type}'.",
                )
            if not decl.accepted:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Statutory declaration '{d_type}' must be explicitly accepted.",
                )
            if not decl.declaration_text_snapshot or len(decl.declaration_text_snapshot.strip()) < 10:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Statutory declaration '{d_type}' must include a valid declaration text snapshot.",
                )
            provided_types.add(d_type)

        missing = set(MANDATORY_DECLARATION_TYPES) - provided_types
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing mandatory statutory declarations: {', '.join(sorted(missing))}.",
            )

        # Clear prior declarations to prevent duplicate entries
        db.execute(delete(AnudaanDeclaration).where(AnudaanDeclaration.application_id == app.id))

        # Record fresh declarations
        for decl in declarations:
            db_decl = AnudaanDeclaration(
                application_id=app.id,
                declaration_type=decl.declaration_type.upper().strip(),
                accepted=decl.accepted,
                accepted_at=datetime.now(timezone.utc),
                accepted_by_identifier=app.full_name,
                declaration_version=decl.declaration_version,
                declaration_text_snapshot=decl.declaration_text_snapshot.strip(),
            )
            db.add(db_decl)

        # SEC-07: Initialize durable email outbox entry in form_metadata before commit
        applicant_email = (app.form_metadata or {}).get("email")
        if not applicant_email and app.applicant_user:
            applicant_email = app.applicant_user.email

        current_meta = dict(app.form_metadata or {})
        current_meta["email_notification_outbox"] = {
            "status": "PENDING",
            "attempts": 0,
            "recipient": applicant_email,
            "subject": f"Submission Confirmation: ANUDAAN Application {app.application_number}",
            "last_attempt_at": None,
            "last_error": None,
        }
        app.form_metadata = current_meta

        # Transition Application State
        app.status = AnudaanApplicationStatus.SUBMITTED
        app.submitted_at = datetime.now(timezone.utc)

        # Initialize append-only verification audit entries
        affiliation_verif = AnudaanVerification(
            application_id=app.id,
            verification_type=AnudaanVerificationType.AFFILIATION_CHECK,
            verification_status=AnudaanVerificationStatus.PENDING,
            verification_source="SYSTEM_SUBMISSION",
            remarks="Automated pending verification queue entry.",
        )
        quartile_verif = AnudaanVerification(
            application_id=app.id,
            verification_type=AnudaanVerificationType.QUARTILE_VERIFICATION,
            verification_status=AnudaanVerificationStatus.PENDING,
            verification_source="SYSTEM_SUBMISSION",
            remarks="Automated pending quartile verification entry.",
        )
        db.add(affiliation_verif)
        db.add(quartile_verif)

        db.commit()
        db.refresh(app)
        logger.info(f"Successfully finalized and submitted ANUDAAN application {app.application_number}")

        # Transactional confirmation email dispatch with outbox state update
        cls._send_submission_confirmation_email(db, app)

        return app

    @classmethod
    def _send_submission_confirmation_email(cls, db: Session, app: AnudaanApplication) -> None:
        """
        Dispatches submission confirmation email and tracks delivery in durable outbox.
        Updates attempt count and failure state without raising unhandled exceptions.
        """
        applicant_email = (app.form_metadata or {}).get("email")
        if not applicant_email and app.applicant_user:
            applicant_email = app.applicant_user.email

        outbox = dict((app.form_metadata or {}).get("email_notification_outbox") or {})
        outbox["attempts"] = int(outbox.get("attempts", 0)) + 1
        outbox["last_attempt_at"] = datetime.now(timezone.utc).isoformat()

        if not applicant_email:
            logger.info(f"No recipient email found for application {app.application_number}; skipping confirmation email.")
            outbox["status"] = "SKIPPED"
            outbox["last_error"] = "No recipient email address registered on application."
            meta = dict(app.form_metadata or {})
            meta["email_notification_outbox"] = outbox
            app.form_metadata = meta
            db.commit()
            return

        try:
            from app.services.notifications.email_service import email_sender_service
            from app.services.notifications.email_templates import render_email_layout

            formatted_date = app.submitted_at.strftime("%B %d, %Y at %I:%M %p UTC") if app.submitted_at else "Just now"
            html_body, text_body = render_email_layout(
                title="ANUDAAN Application Submission Confirmation",
                preheader=f"Application {app.application_number} successfully received.",
                headline="Research Incentive Application Received",
                body_paragraphs=[
                    f"Dear {app.full_name},",
                    f"Your research publication incentive application has been successfully submitted under the ANUDAAN scheme (Yajur Veda Pillar) of CSJM University.",
                    "Your application has been routed to the Dean's review queue. You can track the real-time evaluation status using your Application Number and the secure Tracking Secret provided during draft creation.",
                    "Please keep your tracking credentials safe. University authorities will not ask for your secret token.",
                ],
                key_values=[
                    ("Application Number", app.application_number),
                    ("Applicant Name", app.full_name),
                    ("Institutional ID", app.institutional_id),
                    ("Category", app.applicant_category.value),
                    ("Department", app.department_name),
                    ("Publications Submitted", str(len(app.publications))),
                    ("Submission Date", formatted_date),
                ],
                pillar_label="ANUDAAN — YAJUR VEDA",
                support_email="research.incentives@csjmu.ac.in",
            )

            success, err = email_sender_service.send_email(
                recipient_email=applicant_email,
                subject=f"Submission Confirmation: ANUDAAN Application {app.application_number}",
                html_content=html_body,
                text_content=text_body,
            )
            if success:
                outbox["status"] = "SENT"
                outbox["last_error"] = None
            else:
                outbox["status"] = "FAILED"
                outbox["last_error"] = str(err)
                logger.warning(f"Failed to deliver confirmation email for {app.application_number}: {err}")
        except Exception as exc:
            outbox["status"] = "FAILED"
            outbox["last_error"] = str(exc)
            logger.error(f"Unexpected error while sending submission confirmation email for {app.application_number}: {exc}")

        meta = dict(app.form_metadata or {})
        meta["email_notification_outbox"] = outbox
        app.form_metadata = meta
        db.commit()

    @classmethod
    def retry_failed_submission_notification(cls, db: Session, application_id: uuid.UUID) -> bool:
        """Retries email notification for an application whose outbox status is FAILED or PENDING."""
        app = db.execute(
            select(AnudaanApplication).where(AnudaanApplication.id == application_id)
        ).scalar_one_or_none()
        if not app:
            return False
        cls._send_submission_confirmation_email(db, app)
        outbox = (app.form_metadata or {}).get("email_notification_outbox") or {}
        return outbox.get("status") == "SENT"

    # =========================================================================
    # 6. Secure Application Tracking
    # =========================================================================

    @classmethod
    def track_application(
        cls,
        db: Session,
        application_number: str,
        tracking_secret: str,
    ) -> AnudaanTrackingStatusResponse:
        """
        Public tracking verification. Matches application_number and tracking_secret
        against the stored PBKDF2 hash. Returns safe sanitized tracking view.
        Returns uniform 404 response on both missing applications and bad secrets (SEC-02).
        """
        cleaned_number = application_number.strip().upper()
        stmt = (
            select(AnudaanApplication)
            .options(joinedload(AnudaanApplication.publications))
            .where(AnudaanApplication.application_number == cleaned_number)
        )
        app = db.execute(stmt).unique().scalar_one_or_none()
        if not app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found or tracking secret is invalid.",
            )

        stored_hash = (app.form_metadata or {}).get("tracking_secret_hash")
        if not stored_hash or not verify_password(tracking_secret.strip(), stored_hash):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found or tracking secret is invalid.",
            )

        # Status descriptive mapping
        descriptions = {
            AnudaanApplicationStatus.DRAFT: "Draft application in progress.",
            AnudaanApplicationStatus.SUBMITTED: "Application successfully submitted and queued for Dean review.",
            AnudaanApplicationStatus.UNDER_REVIEW: "Under active review by institutional authority.",
            AnudaanApplicationStatus.NEEDS_CLARIFICATION: "Clarification requested by Dean. Please respond.",
            AnudaanApplicationStatus.ACCEPTED: "Application approved by Dean and submitted to Vice Chancellor.",
            AnudaanApplicationStatus.REJECTED: "Application has been declined.",
            AnudaanApplicationStatus.APPROVED_FOR_RELEASE: "Approved by Vice Chancellor for financial disbursement.",
            AnudaanApplicationStatus.RELEASED: "Disbursement approved. Processing in Accounts division.",
            AnudaanApplicationStatus.PROCESSING: "Bank transfer in progress.",
            AnudaanApplicationStatus.CREDITED: "Incentive credited to designated bank account.",
        }

        pub_summaries = [
            AnudaanTrackingPublicationSummary(
                id=p.id,
                paper_title=p.paper_title,
                journal_name=p.journal_name,
                publication_year=p.publication_year,
                applicant_declared_quartile=p.applicant_declared_quartile,
                verified_quartile=p.verified_quartile,
                indexing_type=p.indexing_type,
                document_type=p.document_type,
            )
            for p in app.publications
        ]

        return AnudaanTrackingStatusResponse(
            application_number=app.application_number,
            status=app.status,
            applicant_name=app.full_name,
            applicant_category=app.applicant_category,
            department_name=app.department_name,
            submitted_at=app.submitted_at,
            publication_count=len(app.publications),
            publications=pub_summaries,
            last_updated=app.updated_at,
            status_description=descriptions.get(app.status, app.status.value),
        )

    # =========================================================================
    # 7. Safe Reusable Bank Details Lookup (SEC-01 IDOR Protection)
    # =========================================================================

    @classmethod
    def get_verified_bank_accounts_for_person(
        cls,
        db: Session,
        application_id: uuid.UUID,
        person_id: uuid.UUID,
        draft_key: Optional[str],
    ) -> List[AnudaanSafeBankAccountOut]:
        """
        Returns verified bank accounts for an identified researcher belonging to the draft.
        Validates draft access key and verifies person belongs to the application.
        Rejects arbitrary person IDs not attached to this application (SEC-01).
        """
        app = cls.verify_draft_access(db, application_id, draft_key)

        person = db.execute(
            select(AnudaanPerson).where(AnudaanPerson.id == person_id)
        ).scalar_one_or_none()
        if not person:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Person with ID '{person_id}' not found.",
            )

        # Verify person membership in this application:
        # 1. Author on any of the application's publications
        is_author = any(
            author.person_id == person_id
            for pub in app.publications
            for author in pub.authors
        )
        # 2. Or matches applicant identity (via user_id or institutional employee/registration ID)
        is_applicant = False
        if app.applicant_user_id and person.user_id == app.applicant_user_id:
            is_applicant = True
        elif person.employee_or_registration_id and person.employee_or_registration_id == app.institutional_id:
            is_applicant = True

        if not is_author and not is_applicant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. The specified person does not belong to this application.",
            )

        stmt = (
            select(AnudaanBankAccount)
            .join(AnudaanBankAccountHolder, AnudaanBankAccountHolder.bank_account_id == AnudaanBankAccount.id)
            .where(
                AnudaanBankAccountHolder.person_id == person_id,
                AnudaanBankAccountHolder.ownership_verification_status == AnudaanBankOwnershipStatus.VERIFIED,
            )
        )
        accounts = db.execute(stmt).scalars().all()
        return [AnudaanSafeBankAccountOut.model_validate(acc) for acc in accounts]
