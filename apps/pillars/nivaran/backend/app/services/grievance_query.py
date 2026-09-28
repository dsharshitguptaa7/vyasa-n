"""
Grievance Query Service for Applicant-Scoped Retrieval.

Enforces strict tenant/applicant isolation:
- Queries are filtered by authenticated applicant_vyasa_user_id.
- Excludes internal audit details, authority metadata, and confidential comments.
"""

import uuid
from typing import List, Union

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import GrievanceNotFoundError, UnauthorizedApplicantAccessError
from app.models.document import Document
from app.models.grievance import Grievance, GrievanceStatusHistory
from app.models.taxonomy import Subject, SubjectCluster
from app.schemas.document import ApplicantDocumentResponse
from app.schemas.grievance import ApplicantGrievanceResponse, ApplicantStatusHistoryResponse


class GrievanceQueryService:
    """Service providing applicant-isolated read access to grievances."""

    @classmethod
    def list_applicant_grievances(
        cls, db: Session, applicant_vyasa_user_id: uuid.UUID
    ) -> List[Grievance]:
        """
        Retrieve all grievances filed by the specific applicant.
        Strictly isolated to applicant_vyasa_user_id.
        """
        stmt = (
            select(Grievance)
            .where(Grievance.applicant_vyasa_user_id == applicant_vyasa_user_id)
            .options(
                joinedload(Grievance.subject).joinedload(Subject.subject_cluster),
                joinedload(Grievance.status_history),
            )
            .order_by(Grievance.submitted_at.desc())
        )
        return list(db.execute(stmt).unique().scalars().all())

    @classmethod
    def get_applicant_grievance(
        cls,
        db: Session,
        grievance_ref: Union[uuid.UUID, str],
        applicant_vyasa_user_id: uuid.UUID,
    ) -> Grievance:
        """
        Retrieve a single grievance by UUID or human-readable tracking ID.
        Raises UnauthorizedApplicantAccessError if the grievance belongs to another applicant.
        """
        # Determine whether query is by UUID primary key or grievance_id string
        is_uuid = False
        target_uuid = None
        if isinstance(grievance_ref, uuid.UUID):
            is_uuid = True
            target_uuid = grievance_ref
        else:
            try:
                target_uuid = uuid.UUID(grievance_ref)
                is_uuid = True
            except (ValueError, AttributeError):
                is_uuid = False

        if is_uuid:
            stmt = select(Grievance).where(Grievance.id == target_uuid)
        else:
            stmt = select(Grievance).where(Grievance.grievance_id == str(grievance_ref))

        stmt = stmt.options(
            joinedload(Grievance.subject).joinedload(Subject.subject_cluster),
            joinedload(Grievance.status_history),
        )

        grievance = db.execute(stmt).unique().scalar_one_or_none()

        if grievance is None:
            raise GrievanceNotFoundError(str(grievance_ref))

        # Enforce strict applicant access scoping
        if grievance.applicant_vyasa_user_id != applicant_vyasa_user_id:
            raise UnauthorizedApplicantAccessError()

        return grievance

    @classmethod
    def format_applicant_response(cls, db: Session, grievance: Grievance) -> ApplicantGrievanceResponse:
        """
        Transform Grievance ORM model into an applicant-safe Pydantic response.
        Excludes authority notes, confidential logs, AI inference scores, and internal flags.
        """
        # Load documents for this grievance
        doc_stmt = (
            select(Document)
            .where(Document.grievance_id == grievance.id)
            .order_by(Document.created_at.asc())
        )
        documents = list(db.execute(doc_stmt).scalars().all())

        doc_responses = [
            ApplicantDocumentResponse(
                id=d.id,
                file_name=d.file_name,
                mime_type=d.mime_type,
                file_size=d.file_size,
                document_type=d.document_type,
                created_at=d.created_at,
            )
            for d in documents
        ]

        history_responses = [
            ApplicantStatusHistoryResponse(
                new_status=h.new_status,
                remarks=h.remarks,
                changed_at=h.changed_at,
            )
            for h in sorted(grievance.status_history or [], key=lambda x: x.changed_at)
        ]

        subject_name = grievance.subject.name if grievance.subject else None
        subject_cluster_name = (
            grievance.subject.subject_cluster.name
            if grievance.subject and grievance.subject.subject_cluster
            else None
        )

        return ApplicantGrievanceResponse(
            id=grievance.id,
            grievance_id=grievance.grievance_id,
            title=grievance.title,
            description=grievance.description,
            subject_id=grievance.subject_id,
            subject_name=subject_name,
            subject_cluster_name=subject_cluster_name,
            status=grievance.status,
            priority=grievance.priority,
            submitted_at=grievance.submitted_at,
            last_action_at=grievance.last_action_at,
            documents=doc_responses,
            status_history=history_responses,
        )
