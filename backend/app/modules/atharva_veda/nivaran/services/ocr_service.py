import json
import logging
import os
import re
from typing import Dict, Any, Optional

from app.core.config import settings

logger = logging.getLogger("vyasa.atharva.ocr_service")

# Handled MIME types matching NIVARAN reference behavior
SUPPORTED_OCR_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
}

MAX_OCR_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


class GrievanceOCRExtractor:
    """
    Dedicated OCR extraction service for handwritten or printed grievance applications.
    Uses Google Gemini multimodal capability via the official `google-genai` SDK.
    Strictly performs input-assistance extraction without side-effects or database writes.
    """

    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        self._api_key = (
            api_key
            or getattr(settings, "GEMINI_API_KEY", None)
            or os.getenv("GEMINI_API_KEY", "")
            or os.getenv("GOOGLE_API_KEY", "")
            or os.getenv("PARTH_LLM_API_KEY", "")
        )
        if self._api_key:
            self._api_key = self._api_key.strip()
        self.model_name = (
            model_name
            or getattr(settings, "GEMINI_MODEL", None)
            or os.getenv("GEMINI_MODEL", "")
            or "gemini-2.0-flash-lite"
        ).strip()
        self._client = None

    def _get_client(self):
        """Lazy initialize the Google GenAI client."""
        if not self._api_key:
            raise ValueError(
                "Gemini API key is not configured on the server. Please configure GEMINI_API_KEY in backend environment."
            )
        if self._client is None:
            try:
                from google import genai
                self._client = genai.Client(api_key=self._api_key)
            except Exception as e:
                logger.error(f"[GrievanceOCRExtractor] Failed to initialize Google GenAI Client: {e}")
                raise RuntimeError("Failed to initialize Google Gemini client for OCR extraction.") from e
        return self._client

    def extract_from_document(
        self,
        file_bytes: bytes,
        mime_type: str,
    ) -> Dict[str, Any]:
        """
        Extract concise title and detailed description from an uploaded handwritten or printed document.

        Returns:
            dict with:
                - title: str
                - description: str
                - confidence_note: Optional[str]
        """
        if not file_bytes:
            raise ValueError("Empty file provided for OCR extraction.")

        if mime_type not in SUPPORTED_OCR_MIME_TYPES:
            raise ValueError(
                f"Unsupported file format '{mime_type}'. Supported formats: PNG, JPG, JPEG, WEBP, PDF."
            )

        if len(file_bytes) > MAX_OCR_FILE_SIZE_BYTES:
            raise ValueError("File size exceeds 10MB limit.")

        client = self._get_client()

        from google.genai import types

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

            # Parse JSON safely
            clean_text = re.sub(r"^```(?:json)?\s*", "", response_text, flags=re.MULTILINE)
            clean_text = re.sub(r"\s*```$", "", clean_text, flags=re.MULTILINE).strip()

            parsed = json.loads(clean_text)

            extracted_title = str(parsed.get("title", "")).strip()
            extracted_description = str(parsed.get("description", "")).strip()

            # Ensure minimum sanity lengths for pre-filling
            if len(extracted_title) < 5:
                extracted_title = extracted_title or "Handwritten Grievance Application"

            if len(extracted_description) < 10:
                extracted_description = (
                    extracted_description
                    or "Extracted from uploaded handwritten application. Please review and verify details."
                )

            return {
                "title": extracted_title,
                "description": extracted_description,
                "confidence_note": "Extracted via Gemini Multimodal. Please verify all details before submitting.",
            }

        except json.JSONDecodeError as je:
            logger.error(f"[GrievanceOCRExtractor] JSON parsing failed: {je}")
            raise ValueError("Failed to parse structured information from the document.") from je
        except Exception as e:
            logger.error(f"[GrievanceOCRExtractor] OCR extraction error: {e}")
            raise RuntimeError(f"OCR extraction failed: {str(e)}") from e


# Singleton OCR extractor instance
ocr_extractor = GrievanceOCRExtractor()
