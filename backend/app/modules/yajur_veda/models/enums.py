"""
ANUDAAN (Yajur Veda) Module Enumerations
Authoritative status codes, roles, categories, and classification types for
CSJMU Research Publication Incentive Management System (ANUDAAN V1.1).
"""
from enum import Enum


class AnudaanApplicantCategory(str, Enum):
    """Eligible applicant categories at CSJMU Campus."""
    FACULTY_CAMPUS = "FACULTY_CAMPUS"
    SCHOLAR_CAMPUS = "SCHOLAR_CAMPUS"
    POSTDOC_CAMPUS = "POSTDOC_CAMPUS"


class AnudaanApplicationStatus(str, Enum):
    """
    Lifecycle status progression for an Anudaan incentive application.
    DRAFT -> SUBMITTED -> UNDER_REVIEW -> NEEDS_CLARIFICATION / ACCEPTED / REJECTED
    -> APPROVED_FOR_RELEASE -> RELEASED -> PROCESSING -> CREDITED.
    """
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    APPROVED_FOR_RELEASE = "APPROVED_FOR_RELEASE"
    RELEASED = "RELEASED"
    PROCESSING = "PROCESSING"
    CREDITED = "CREDITED"


class AnudaanDocumentType(str, Enum):
    """Eligible publication document classifications."""
    ARTICLE = "ARTICLE"
    REVIEW = "REVIEW"


class AnudaanPublicationStatus(str, Enum):
    """Publication lifecycle status; only PUBLISHED is eligible for incentive."""
    PUBLISHED = "PUBLISHED"
    ACCEPTED = "ACCEPTED"
    IN_PRESS = "IN_PRESS"
    PREPRINT = "PREPRINT"


class AnudaanIndexingType(str, Enum):
    """Verified indexing repository for research publication."""
    SCOPUS = "SCOPUS"
    WEB_OF_SCIENCE = "WEB_OF_SCIENCE"
    SCOPUS_AND_WOS = "SCOPUS_AND_WOS"


class AnudaanQuartile(str, Enum):
    """SJR / JCR journal impact quartile."""
    Q1 = "Q1"
    Q2 = "Q2"
    Q3 = "Q3"
    Q4 = "Q4"
    UNASSIGNED = "UNASSIGNED"


class AnudaanAuthorRole(str, Enum):
    """Author attribution role on research publication."""
    FIRST = "FIRST"
    CORRESPONDING = "CORRESPONDING"
    CO_AUTHOR = "CO_AUTHOR"


class AnudaanBankAccountType(str, Enum):
    """Bank account classification."""
    SAVINGS = "SAVINGS"
    CURRENT = "CURRENT"


class AnudaanBankOwnershipStatus(str, Enum):
    """Verification state of person-to-bank account relationship."""
    UNVERIFIED = "UNVERIFIED"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class AnudaanDocumentCategory(str, Enum):
    """Document attachment classification."""
    PUBLISHED_PAPER = "PUBLISHED_PAPER"
    CANCELLED_CHEQUE = "CANCELLED_CHEQUE"
    PASSBOOK = "PASSBOOK"
    OTHER = "OTHER"


class AnudaanVerificationType(str, Enum):
    """Type of verification step conducted."""
    AFFILIATION_CHECK = "AFFILIATION_CHECK"
    QUARTILE_VERIFICATION = "QUARTILE_VERIFICATION"
    BANK_ACCOUNT_VERIFICATION = "BANK_ACCOUNT_VERIFICATION"
    SCOPUS_VALIDATION = "SCOPUS_VALIDATION"
    DEAN_APPROVAL = "DEAN_APPROVAL"
    MANUAL_CHECK = "MANUAL_CHECK"


class AnudaanVerificationStatus(str, Enum):
    """Status result of verification inspection."""
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    FLAGGED = "FLAGGED"
    REJECTED = "REJECTED"
