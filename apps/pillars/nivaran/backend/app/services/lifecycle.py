"""
Grievance Lifecycle State Machine for NIVARAN Pillar.

Manages valid business state transitions across the 10 documented lifecycle stages:
- SUBMITTED
- AI_PROCESSING
- PENDING_REVIEW
- ASSIGNED
- IN_PROGRESS
- AWAITING_INFORMATION
- RESOLVED
- ESCALATED
- CLOSED
- REOPENED
"""

from typing import Dict, Optional, Set
from app.core.exceptions import InvalidLifecycleTransitionError
from app.models.enums import GrievanceStatus


class LifecycleStateMachine:
    """
    State machine enforcing valid lifecycle transitions.
    Structured to accommodate role-based authorization in subsequent workflow phases.
    """

    # Comprehensive state transition graph (for future workflow expansion)
    ALLOWED_TRANSITIONS: Dict[Optional[GrievanceStatus], Set[GrievanceStatus]] = {
        # Initial creation
        None: {GrievanceStatus.SUBMITTED},
        # From SUBMITTED
        GrievanceStatus.SUBMITTED: {
            GrievanceStatus.AI_PROCESSING,
            GrievanceStatus.PENDING_REVIEW,
        },
        # From AI_PROCESSING
        GrievanceStatus.AI_PROCESSING: {
            GrievanceStatus.PENDING_REVIEW,
            GrievanceStatus.ASSIGNED,
        },
        # From PENDING_REVIEW
        GrievanceStatus.PENDING_REVIEW: {
            GrievanceStatus.ASSIGNED,
        },
        # From ASSIGNED
        GrievanceStatus.ASSIGNED: {
            GrievanceStatus.IN_PROGRESS,
            GrievanceStatus.ESCALATED,
        },
        # From IN_PROGRESS
        GrievanceStatus.IN_PROGRESS: {
            GrievanceStatus.AWAITING_INFORMATION,
            GrievanceStatus.RESOLVED,
            GrievanceStatus.ESCALATED,
        },
        # From AWAITING_INFORMATION
        GrievanceStatus.AWAITING_INFORMATION: {
            GrievanceStatus.IN_PROGRESS,
            GrievanceStatus.RESOLVED,
        },
        # From ESCALATED
        GrievanceStatus.ESCALATED: {
            GrievanceStatus.IN_PROGRESS,
            GrievanceStatus.RESOLVED,
        },
        # From RESOLVED
        GrievanceStatus.RESOLVED: {
            GrievanceStatus.CLOSED,
            GrievanceStatus.REOPENED,
        },
        # From CLOSED
        GrievanceStatus.CLOSED: {
            GrievanceStatus.REOPENED,
        },
        # From REOPENED
        GrievanceStatus.REOPENED: {
            GrievanceStatus.IN_PROGRESS,
            GrievanceStatus.ASSIGNED,
        },
    }

    @classmethod
    def validate_transition(
        cls,
        current_status: Optional[GrievanceStatus],
        target_status: GrievanceStatus,
        role: Optional[str] = None,
    ) -> bool:
        """
        Validate whether a transition from current_status to target_status is permissible.
        Raises InvalidLifecycleTransitionError if invalid.
        """
        allowed = cls.ALLOWED_TRANSITIONS.get(current_status, set())
        if target_status not in allowed:
            raise InvalidLifecycleTransitionError(
                from_status=current_status.value if current_status else "NULL",
                to_status=target_status.value,
                reason=f"Transition from {current_status.value if current_status else 'NULL'} to {target_status.value} is not permitted.",
            )
        return True

    @classmethod
    def validate_initial_transition(cls, initial_status: GrievanceStatus) -> bool:
        """
        Validate that a newly filed grievance strictly begins with SUBMITTED.
        """
        return cls.validate_transition(None, initial_status)
