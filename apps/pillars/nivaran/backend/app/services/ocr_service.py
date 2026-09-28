"""
Gemini OCR Extraction Service for NIVARAN Pillar.

Provides stateless input-assistance for applicants digitizing handwritten
or printed grievance letters.
Strictly performs document text extraction:
- Does NOT create a grievance
- Does NOT insert a grievance row
- Does NOT create status history
- Does NOT create AI processing records
- Does NOT persist uploaded files
- Does NOT use Gemini for category classification or routing
"""

import json
import logging
import os
import re
import uuid
from datetime import datetime, time, timezone
from typing import Any, Dict, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import OCRDailyLimitExceededError, OCRExtractionError
from app.core.timezone import ist_day_bounds_utc, now_ist, now_utc
from app.models.audit import AuditLog

logger = logging.getLogger("nivaran.ocr")

SUPPORTED_OCR_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
}

MAX_OCR_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def check_daily_ocr_limit(
    db: Session,
    applicant_vyasa_user_id: uuid.UUID,
    ip_address: Optional[str] = None,
) -> None:
    """
    Enforces maximum 3 successful OCR requests per applicant per calendar day in Asia/Kolkata timezone.
    Independent of grievance submission quota.
    """
    limit = getattr(settings, "DAILY_OCR_REQUEST_LIMIT", 3)
    start_of_day_utc, end_of_day_utc = ist_day_bounds_utc()

    stmt = select(func.count(AuditLog.id)).where(
        AuditLog.user_vyasa_id == applicant_vyasa_user_id,
        AuditLog.action == "OCR_REQUEST_ACCEPTED",
        AuditLog.created_at >= start_of_day_utc,
        AuditLog.created_at <= end_of_day_utc,
    )
    count = db.execute(stmt).scalar() or 0

    if count >= limit:
        logger.warning(
            "Applicant %s exceeded daily OCR limit (%d/%d) for today (%s)",
            applicant_vyasa_user_id,
            count,
            limit,
            now_ist().date(),
        )
        raise OCRDailyLimitExceededError(
            message="You have reached your OCR limit for today. Please try again tomorrow."
        )


def record_accepted_ocr_request(
    db: Session,
    applicant_vyasa_user_id: uuid.UUID,
    ip_address: Optional[str] = None,
) -> None:
    """Records an accepted OCR extraction in the audit log for daily quota tracking."""
    audit_entry = AuditLog(
        user_vyasa_id=applicant_vyasa_user_id,
        action="OCR_REQUEST_ACCEPTED",
        entity_type="OCR",
        description="OCR document extraction successfully processed by Gemini assistance.",
        ip_address=ip_address,
        created_at=now_utc(),
    )
    db.add(audit_entry)
    db.commit()


class GrievanceOCRExtractor:
    """
    Stateless OCR extraction engine using Google Gemini Multimodal API.
    Used strictly for applicant form input assistance.
    """

    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        self._api_key = (
            api_key
            or settings.GEMINI_API_KEY
            or os.getenv("GEMINI_API_KEY", "")
            or os.getenv("GOOGLE_API_KEY", "")
            or os.getenv("PARTH_LLM_API_KEY", "")
        ).strip()
        self.model_name = (
            model_name or settings.GEMINI_MODEL or "gemini-3.1-flash-lite"
        ).strip()
        self._client = None

    def _get_client(self):
        """Lazy initialization of Google GenAI client."""
        if not self._api_key:
            raise OCRExtractionError(
                "Gemini OCR service is not configured. Please contact the administrator."
            )
        if self._client is None:
            try:
                from google import genai

                self._client = genai.Client(api_key=self._api_key)
            except Exception as e:
                logger.error("[GrievanceOCRExtractor] Client initialization failed: %s", e)
                raise OCRExtractionError("Failed to initialize OCR extraction client.") from e
        return self._client

    def extract_from_document(
        self,
        file_bytes: bytes,
        mime_type: str,
    ) -> Dict[str, str]:
        """
        Extract concise title and detailed description from an uploaded document.
        Does not store or persist file bytes.
        """
        if not file_bytes:
            raise ValueError("Uploaded file is empty.")

        if mime_type not in SUPPORTED_OCR_MIME_TYPES:
            raise ValueError(
                f"Unsupported file format '{mime_type}'. Supported formats: PNG, JPG, JPEG, WEBP, PDF."
            )

        if len(file_bytes) > MAX_OCR_FILE_SIZE_BYTES:
            raise ValueError("File size exceeds 10MB limit.")

        client = self._get_client()

        prompt = (
            "You are an expert institutional document reader for an academic and university grievance portal. "
            "Analyze the attached handwritten or printed grievance application/letter carefully.\n\n"
            "CRITICAL EXTRACTION RULES:\n"
            "1. Extract a concise, meaningful 'title' summarizing the core issue (between 5 and 100 characters). "
            "   Example: 'Discrepancy in Semester 4 Grade Card Marks' or 'Delayed Research Fellowship Disbursement'.\n"
            "2. Extract the complete, detailed grievance 'description' containing all factual information stated in the document, "
            "   including dates, roll/registration numbers, academic departments, sequence of events, and specific redressal requested.\n"
            "3. ZERO HALLUCINATION PRINCIPLE: If handwriting or text is illegible, smudged, or cut off, DO NOT invent, assume, or guess missing information. "
            "   Transcribe only what is clearly legible and indicate unreadable portions using '[unreadable handwriting]'.\n"
            "4. Respond with valid JSON matching this exact structure:\n"
            "   {\n"
            '     "title": "Concise grievance title",\n'
            '     "description": "Comprehensive verbatim/factual grievance description..."\n'
            "   }\n"
            "Do not include code markdown formatting (like ```json), just output the raw JSON string."
        )

        try:
            from google.genai import types

            part = types.Part.from_bytes(
                data=file_bytes,
                mime_type=mime_type,
            )

            config = types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json",
            )

            response = client.models.generate_content(
                model=self.model_name,
                contents=[prompt, part],
                config=config,
            )

            response_text = (response.text or "").strip()
            if not response_text:
                raise ValueError("AI model returned an empty response.")

            clean_text = re.sub(r"^```(?:json)?\s*", "", response_text, flags=re.MULTILINE)
            clean_text = re.sub(r"\s*```$", "", clean_text, flags=re.MULTILINE).strip()

            parsed = json.loads(clean_text)

            extracted_title = str(parsed.get("title", "")).strip()
            extracted_description = str(parsed.get("description", "")).strip()

            if len(extracted_title) < 5:
                extracted_title = extracted_title or "Handwritten Grievance Application"

            if len(extracted_description) < 10:
                extracted_description = (
                    extracted_description
                    or "Extracted from uploaded application document. Please review and verify details."
                )

            return {
                "title": extracted_title,
                "description": extracted_description,
            }

        except ValueError as ve:
            logger.warning("[GrievanceOCRExtractor] Validation error: %s", ve)
            raise
        except json.JSONDecodeError as je:
            logger.error("[GrievanceOCRExtractor] JSON parsing failed: %s", je)
            raise OCRExtractionError("Failed to parse structured text from document.") from je
        except Exception as e:
            logger.error("[GrievanceOCRExtractor] OCR extraction system error: %s", e)
            raise OCRExtractionError(
                "Failed to digitize document. Please type your grievance details manually or try a clearer image."
            ) from e


ocr_extractor = GrievanceOCRExtractor()
