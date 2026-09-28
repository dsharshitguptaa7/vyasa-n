"""
Grievance Filing & Applicant Retrieval Endpoints for NIVARAN.

Endpoints:
- POST /api/v1/grievances: Applicant creates new grievance.
- GET  /api/v1/grievances: List grievances filed by the authenticated applicant.
- GET  /api/v1/grievances/{id}: Get applicant-safe grievance details.
"""

import logging
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import (
    DailyLimitExceededError,
    GrievanceNotFoundError,
    InvalidLifecycleTransitionError,
    OCRDailyLimitExceededError,
    OCRExtractionError,
    SimilarActiveGrievanceError,
    SubjectInactiveError,
    SubjectNotFoundError,
    UnauthorizedApplicantAccessError,
)
from app.core.identity import get_current_applicant_id
from app.schemas.grievance import (
    ApplicantGrievanceListResponse,
    ApplicantGrievanceResponse,
    GrievanceOCRExtractResponse,
    GrievanceSubmissionRequest,
)
from app.services.grievance_query import GrievanceQueryService
from app.services.grievance_submission import GrievanceSubmissionService
from app.services.ocr_service import (
    MAX_OCR_FILE_SIZE_BYTES,
    SUPPORTED_OCR_MIME_TYPES,
    check_daily_ocr_limit,
    ocr_extractor,
    record_accepted_ocr_request,
)

logger = logging.getLogger("nivaran.api.grievances")
router = APIRouter()


@router.post(
    "",
    response_model=ApplicantGrievanceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new grievance",
    description="Allows an authenticated applicant to file a new grievance under a verified academic subject.",
)
def submit_grievance(
    payload: GrievanceSubmissionRequest,
    request: Request,
    db: Session = Depends(get_db),
    applicant_id: uuid.UUID = Depends(get_current_applicant_id),
) -> ApplicantGrievanceResponse:
    """Submit a new grievance in SUBMITTED status with append-only history and audit log."""
    client_ip: Optional[str] = request.client.host if request.client else None

    try:
        grievance = GrievanceSubmissionService.submit_grievance(
            db=db,
            applicant_vyasa_user_id=applicant_id,
            payload=payload,
            ip_address=client_ip,
        )
        return GrievanceQueryService.format_applicant_response(db, grievance)
    except DailyLimitExceededError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error_code": e.code,
                "message": e.message,
            },
        )
    except SimilarActiveGrievanceError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error_code": e.code,
                "message": e.message,
                "existing_grievance_id": e.existing_grievance_id,
            },
        )
    except (SubjectNotFoundError, SubjectInactiveError, InvalidLifecycleTransitionError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)


@router.post(
    "/ocr/extract",
    response_model=GrievanceOCRExtractResponse,
    status_code=status.HTTP_200_OK,
    summary="Extract grievance text from document using Gemini (Input Assistance Only)",
    description="Stateless OCR extraction assistance. Does not create or save a grievance record.",
)
async def extract_grievance_ocr(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    applicant_id: uuid.UUID = Depends(get_current_applicant_id),
) -> GrievanceOCRExtractResponse:
    """Stateless OCR extraction using Gemini API for applicant form pre-fill."""
    client_ip: Optional[str] = request.client.host if request.client else None

    mime_type = file.content_type or ""
    if not mime_type or mime_type == "application/octet-stream":
        ext = (file.filename or "").lower().split(".")[-1]
        ext_map = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "webp": "image/webp",
            "pdf": "application/pdf",
        }
        mime_type = ext_map.get(ext, mime_type)

    if mime_type not in SUPPORTED_OCR_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{file.content_type}'. Supported formats: PNG, JPG, JPEG, WEBP, PDF.",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    if len(file_bytes) > MAX_OCR_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the 10MB limit for OCR extraction.",
        )

    # 1. Enforce independent daily OCR limit (3 per day in Asia/Kolkata)
    try:
        check_daily_ocr_limit(db=db, applicant_vyasa_user_id=applicant_id, ip_address=client_ip)
    except OCRDailyLimitExceededError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error_code": e.code,
                "message": e.message,
            },
        )

    # 2. Execute stateless Gemini OCR
    try:
        extracted = ocr_extractor.extract_from_document(
            file_bytes=file_bytes,
            mime_type=mime_type,
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except OCRExtractionError as oe:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": oe.code,
                "message": oe.message,
            },
        )
    except Exception as exc:
        logger.error("Unexpected OCR error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "OCR_EXTRACTION_ERROR",
                "message": "Failed to digitize document. Please type your grievance details manually or try a clearer image.",
            },
        )

    # 3. Successful OCR extraction consumes 1 OCR quota
    record_accepted_ocr_request(db=db, applicant_vyasa_user_id=applicant_id, ip_address=client_ip)

    return GrievanceOCRExtractResponse(
        title=extracted["title"],
        description=extracted["description"],
    )


@router.get(
    "",
    response_model=ApplicantGrievanceListResponse,
    summary="List applicant's filed grievances",
    description="Retrieve all grievances filed by the authenticated applicant.",
)
def list_my_grievances(
    db: Session = Depends(get_db),
    applicant_id: uuid.UUID = Depends(get_current_applicant_id),
) -> ApplicantGrievanceListResponse:
    """Retrieve applicant-scoped list of grievances."""
    grievances = GrievanceQueryService.list_applicant_grievances(db, applicant_id)
    items = [GrievanceQueryService.format_applicant_response(db, g) for g in grievances]
    return ApplicantGrievanceListResponse(total=len(items), items=items)


@router.get(
    "/{grievance_id}",
    response_model=ApplicantGrievanceResponse,
    summary="Get grievance details",
    description="Retrieve applicant-safe details for a specific grievance by UUID or tracking code.",
)
def get_grievance_details(
    grievance_id: str,
    db: Session = Depends(get_db),
    applicant_id: uuid.UUID = Depends(get_current_applicant_id),
) -> ApplicantGrievanceResponse:
    """Retrieve single grievance scoped strictly to the authenticated applicant."""
    try:
        grievance = GrievanceQueryService.get_applicant_grievance(
            db=db,
            grievance_ref=grievance_id,
            applicant_vyasa_user_id=applicant_id,
        )
        return GrievanceQueryService.format_applicant_response(db, grievance)
    except GrievanceNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except UnauthorizedApplicantAccessError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
