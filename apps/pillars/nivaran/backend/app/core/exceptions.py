"""Domain exceptions for NIVARAN Pillar."""


class NivaranError(Exception):
    """Base exception for all NIVARAN domain errors."""

    def __init__(self, message: str, code: str = "NIVARAN_ERROR") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


class SubjectNotFoundError(NivaranError):
    """Raised when the specified academic subject does not exist."""

    def __init__(self, subject_id: str) -> None:
        super().__init__(
            message=f"Subject with ID '{subject_id}' was not found in institutional taxonomy.",
            code="SUBJECT_NOT_FOUND",
        )


class SubjectInactiveError(NivaranError):
    """Raised when the specified academic subject is inactive or not currently accepting filings."""

    def __init__(self, subject_name: str) -> None:
        super().__init__(
            message=f"Subject '{subject_name}' is currently inactive.",
            code="SUBJECT_INACTIVE",
        )


class GrievanceNotFoundError(NivaranError):
    """Raised when a grievance does not exist or is not accessible."""

    def __init__(self, grievance_id: str) -> None:
        super().__init__(
            message=f"Grievance '{grievance_id}' was not found.",
            code="GRIEVANCE_NOT_FOUND",
        )


class UnauthorizedApplicantAccessError(NivaranError):
    """Raised when an applicant attempts to access another applicant's grievance."""

    def __init__(self) -> None:
        super().__init__(
            message="Access denied: You do not have permission to view this grievance.",
            code="UNAUTHORIZED_ACCESS",
        )


class InvalidLifecycleTransitionError(NivaranError):
    """Raised when an illegal status transition is attempted."""

    def __init__(self, from_status: str | None, to_status: str, reason: str = "") -> None:
        msg = f"Invalid lifecycle transition from '{from_status}' to '{to_status}'."
        if reason:
            msg += f" Reason: {reason}"
        super().__init__(message=msg, code="INVALID_LIFECYCLE_TRANSITION")


class ModelLoadError(NivaranError):
    """Raised when the AI classifier artifact cannot be loaded or validated."""

    def __init__(self, message: str) -> None:
        super().__init__(
            message=message,
            code="AI_MODEL_LOAD_ERROR",
        )


class DailyLimitExceededError(NivaranError):
    """Raised when an applicant exceeds the daily grievance submission limit."""

    def __init__(
        self,
        message: str = "You have reached your grievance submission limit for today. Please try again tomorrow.",
    ) -> None:
        super().__init__(
            message=message,
            code="DAILY_LIMIT_EXCEEDED",
        )


class SimilarActiveGrievanceError(NivaranError):
    """Raised when an applicant attempts to submit a duplicate or highly similar active grievance."""

    def __init__(
        self,
        existing_grievance_id: str,
        message: str = "Your similar grievance is already registered and is currently under process.",
    ) -> None:
        super().__init__(
            message=message,
            code="SIMILAR_ACTIVE_GRIEVANCE",
        )
        self.existing_grievance_id = existing_grievance_id


class OCRDailyLimitExceededError(NivaranError):
    """Raised when an applicant exceeds the daily OCR request limit."""

    def __init__(
        self,
        message: str = "You have reached your OCR limit for today. Please try again tomorrow.",
    ) -> None:
        super().__init__(
            message=message,
            code="OCR_DAILY_LIMIT_EXCEEDED",
        )


class OCRExtractionError(NivaranError):
    """Raised when document OCR extraction fails."""

    def __init__(
        self,
        message: str = "Failed to digitize document. Please type your grievance details manually or try a clearer image.",
    ) -> None:
        super().__init__(
            message=message,
            code="OCR_EXTRACTION_ERROR",
        )

