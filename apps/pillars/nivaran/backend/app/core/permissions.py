"""
Domain Permissions and Role-Permission Mapping for NIVARAN Pillar.

This module defines fine-grained institutional permissions and maps them to
NIVARAN domain authority roles.

CRITICAL ARCHITECTURE:
- Zero database tables: permissions are represented in application domain logic.
- VYASA Core owns user identity & generic SSO roles.
- NIVARAN owns institutional grievance roles & permissions.
"""

import enum
from typing import Dict, Set

from app.models.enums import NivaranRole


class NivaranPermission(str, enum.Enum):
    # Grievance Administration & Visibility
    VIEW_ALL_GRIEVANCES = "VIEW_ALL_GRIEVANCES"
    VIEW_GRIEVANCE = "VIEW_GRIEVANCE"
    ASSIGN_GRIEVANCE = "ASSIGN_GRIEVANCE"
    CHANGE_PRIORITY = "CHANGE_PRIORITY"
    CHANGE_STATUS = "CHANGE_STATUS"
    CLOSE_GRIEVANCE = "CLOSE_GRIEVANCE"
    REOPEN_GRIEVANCE = "REOPEN_GRIEVANCE"
    RESOLVE_GRIEVANCE = "RESOLVE_GRIEVANCE"

    # Internal Dialogue & Communication
    ADD_INTERNAL_COMMENT = "ADD_INTERNAL_COMMENT"
    VIEW_INTERNAL_COMMENTS = "VIEW_INTERNAL_COMMENTS"

    # Documentation & Archival Evidence
    UPLOAD_ATTACHMENT = "UPLOAD_ATTACHMENT"
    VIEW_ATTACHMENT = "VIEW_ATTACHMENT"
    DELETE_ATTACHMENT = "DELETE_ATTACHMENT"
    GENERATE_E_FILE = "GENERATE_E_FILE"
    SEARCH_E_FILE_REPOSITORY = "SEARCH_E_FILE_REPOSITORY"
    PREVIEW_E_FILE = "PREVIEW_E_FILE"
    DOWNLOAD_E_FILE = "DOWNLOAD_E_FILE"

    # Operational Intelligence & Telemetry
    VIEW_ANALYTICS = "VIEW_ANALYTICS"
    VIEW_ACTIVITY_LOGS = "VIEW_ACTIVITY_LOGS"
    VIEW_AUDIT_LOGS = "VIEW_AUDIT_LOGS"

    # Digital Signatures & System Verification
    SIGN_DOCUMENT = "SIGN_DOCUMENT"
    VERIFY_SIGNATURE = "VERIFY_SIGNATURE"

    # Feedback Administration
    VIEW_FEEDBACK = "VIEW_FEEDBACK"
    SUBMIT_FEEDBACK = "SUBMIT_FEEDBACK"


# Canonical Role-to-Permissions Mapping for NIVARAN Domain Roles
ROLE_PERMISSIONS: Dict[NivaranRole, Set[NivaranPermission]] = {
    NivaranRole.MANAGER: {
        # Grievance Administration & Global Visibility
        NivaranPermission.VIEW_ALL_GRIEVANCES,
        NivaranPermission.VIEW_GRIEVANCE,
        NivaranPermission.ASSIGN_GRIEVANCE,
        NivaranPermission.CHANGE_PRIORITY,
        NivaranPermission.CHANGE_STATUS,
        NivaranPermission.CLOSE_GRIEVANCE,
        NivaranPermission.REOPEN_GRIEVANCE,
        NivaranPermission.RESOLVE_GRIEVANCE,

        # Internal Dialogue & Communication
        NivaranPermission.ADD_INTERNAL_COMMENT,
        NivaranPermission.VIEW_INTERNAL_COMMENTS,

        # Documentation & Archival Evidence
        NivaranPermission.UPLOAD_ATTACHMENT,
        NivaranPermission.VIEW_ATTACHMENT,
        NivaranPermission.DELETE_ATTACHMENT,
        NivaranPermission.GENERATE_E_FILE,
        NivaranPermission.SEARCH_E_FILE_REPOSITORY,
        NivaranPermission.PREVIEW_E_FILE,
        NivaranPermission.DOWNLOAD_E_FILE,

        # Operational Intelligence & Telemetry
        NivaranPermission.VIEW_ANALYTICS,
        NivaranPermission.VIEW_ACTIVITY_LOGS,
        NivaranPermission.VIEW_AUDIT_LOGS,

        # Digital Signatures & System Verification
        NivaranPermission.SIGN_DOCUMENT,
        NivaranPermission.VERIFY_SIGNATURE,

        # Feedback Administration
        NivaranPermission.VIEW_FEEDBACK,
        NivaranPermission.SUBMIT_FEEDBACK,
    },
    NivaranRole.DEAN: {
        NivaranPermission.VIEW_ALL_GRIEVANCES,
        NivaranPermission.VIEW_GRIEVANCE,
        NivaranPermission.ASSIGN_GRIEVANCE,
        NivaranPermission.CHANGE_PRIORITY,
        NivaranPermission.CHANGE_STATUS,
        NivaranPermission.CLOSE_GRIEVANCE,
        NivaranPermission.REOPEN_GRIEVANCE,
        NivaranPermission.RESOLVE_GRIEVANCE,
        NivaranPermission.ADD_INTERNAL_COMMENT,
        NivaranPermission.VIEW_INTERNAL_COMMENTS,
        NivaranPermission.UPLOAD_ATTACHMENT,
        NivaranPermission.VIEW_ATTACHMENT,
        NivaranPermission.GENERATE_E_FILE,
        NivaranPermission.SEARCH_E_FILE_REPOSITORY,
        NivaranPermission.PREVIEW_E_FILE,
        NivaranPermission.DOWNLOAD_E_FILE,
        NivaranPermission.VIEW_ANALYTICS,
        NivaranPermission.VIEW_ACTIVITY_LOGS,
        NivaranPermission.VIEW_AUDIT_LOGS,
        NivaranPermission.SIGN_DOCUMENT,
        NivaranPermission.VERIFY_SIGNATURE,
        NivaranPermission.VIEW_FEEDBACK,
    },
    NivaranRole.ASSOCIATE_DEAN: {
        NivaranPermission.VIEW_GRIEVANCE,
        NivaranPermission.ASSIGN_GRIEVANCE,
        NivaranPermission.CHANGE_STATUS,
        NivaranPermission.RESOLVE_GRIEVANCE,
        NivaranPermission.ADD_INTERNAL_COMMENT,
        NivaranPermission.VIEW_INTERNAL_COMMENTS,
        NivaranPermission.UPLOAD_ATTACHMENT,
        NivaranPermission.VIEW_ATTACHMENT,
        NivaranPermission.SIGN_DOCUMENT,
        NivaranPermission.VERIFY_SIGNATURE,
        NivaranPermission.VIEW_FEEDBACK,
    },
    NivaranRole.ASSISTANT_DEAN: {
        NivaranPermission.VIEW_GRIEVANCE,
        NivaranPermission.ASSIGN_GRIEVANCE,
        NivaranPermission.CHANGE_STATUS,
        NivaranPermission.RESOLVE_GRIEVANCE,
        NivaranPermission.ADD_INTERNAL_COMMENT,
        NivaranPermission.VIEW_INTERNAL_COMMENTS,
        NivaranPermission.UPLOAD_ATTACHMENT,
        NivaranPermission.VIEW_ATTACHMENT,
        NivaranPermission.SIGN_DOCUMENT,
        NivaranPermission.VERIFY_SIGNATURE,
        NivaranPermission.VIEW_FEEDBACK,
    },
    NivaranRole.GUEST_MEMBER: {
        NivaranPermission.VIEW_GRIEVANCE,
        NivaranPermission.VIEW_INTERNAL_COMMENTS,
        NivaranPermission.VIEW_ATTACHMENT,
    },
    NivaranRole.APPLICANT: {
        NivaranPermission.VIEW_GRIEVANCE,
        NivaranPermission.UPLOAD_ATTACHMENT,
        NivaranPermission.VIEW_ATTACHMENT,
        NivaranPermission.SUBMIT_FEEDBACK,
    },
}
