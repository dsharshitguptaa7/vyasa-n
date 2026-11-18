# -*- coding: utf-8 -*-
"""
Persistent Conversation Service for VYASAⁿ AI Knowledge Centre & Scholar Gateway.
Manages persistent conversational sessions, bounded turn retrieval, and ownership isolation.

Features:
1. Strong Ownership Isolation: Every conversation operation verifies user_id ownership.
2. Thread Persistence: Conversation headers and message turns are durable across restarts.
3. Bounded History Retrieval: Paginated turn queries prevent context explosion.
4. Transaction Safety: Robust session handling with automatic rollback on errors.
5. Zero Secret Storage: Citations and answers are sanitized before database storage.
"""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, List, Optional, Tuple
import uuid

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.modules.knowledge_centre.conversation_models import (
    AiAssistantConversation,
    AiAssistantMessage,
)
from app.modules.knowledge_centre.synthesis_service import SynthesisResult

logger = logging.getLogger("vyasa.knowledge_centre.conversation_service")

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 50


class ConversationServiceError(Exception):
    """Base exception for conversation operations."""
    pass


class ConversationNotFoundError(ConversationServiceError):
    """Raised when a requested conversation ID does not exist."""
    pass


class ConversationAccessDeniedError(ConversationServiceError):
    """Raised when an authenticated user attempts to access another user's conversation."""
    pass


class PersistentConversationService:
    """
    Manages persistent scholar conversations backed by PostgreSQL.
    """

    def get_or_create_conversation(
        self,
        db: Session,
        user_id: uuid.UUID,
        conversation_id: Optional[str] = None,
        initial_title: Optional[str] = None,
    ) -> Tuple[AiAssistantConversation, bool]:
        """
        Retrieves an existing conversation or creates a new one.
        Validates ownership if an existing ID is supplied.
        Returns: (conversation, created_flag)
        """
        if conversation_id:
            try:
                conv_uuid = uuid.UUID(conversation_id)
            except (ValueError, TypeError):
                # Invalid UUID format -> create fresh conversation
                conv_uuid = None

            if conv_uuid:
                existing = db.scalar(
                    select(AiAssistantConversation)
                    .where(
                        AiAssistantConversation.id == conv_uuid,
                        AiAssistantConversation.is_deleted == False,
                    )
                )
                if existing:
                    if existing.user_id != user_id:
                        logger.warning(
                            "Cross-user conversation access attempt: User %s tried to access conversation %s owned by %s",
                            user_id,
                            existing.id,
                            existing.user_id,
                        )
                        raise ConversationAccessDeniedError("Access denied: You do not own this conversation.")
                    return existing, False

        # Create new conversation
        title = initial_title.strip()[:255] if initial_title else "New Inquiry"
        new_conv = AiAssistantConversation(
            id=uuid.UUID(conversation_id) if conversation_id and self._is_valid_uuid(conversation_id) else uuid.uuid4(),
            user_id=user_id,
            title=title,
        )
        try:
            db.add(new_conv)
            db.commit()
            db.refresh(new_conv)
            return new_conv, True
        except Exception as e:
            db.rollback()
            logger.error("Failed to create conversation for user %s: %s", user_id, e)
            raise ConversationServiceError(f"Database error creating conversation: {e}") from e

    def record_turn(
        self,
        db: Session,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        user_query: str,
        synthesis_result: SynthesisResult,
    ) -> Tuple[AiAssistantMessage, AiAssistantMessage]:
        """
        Atomically records user inquiry and assistant response messages.
        Updates conversation title if it is the first inquiry.
        """
        conv = db.scalar(
            select(AiAssistantConversation)
            .where(
                AiAssistantConversation.id == conversation_id,
                AiAssistantConversation.is_deleted == False,
            )
        )
        if not conv:
            raise ConversationNotFoundError(f"Conversation {conversation_id} not found.")

        if conv.user_id != user_id:
            raise ConversationAccessDeniedError("Access denied: You do not own this conversation.")

        try:
            # 1. User Message
            user_msg = AiAssistantMessage(
                conversation_id=conversation_id,
                role="user",
                content=user_query.strip(),
            )
            db.add(user_msg)

            # 2. Assistant Message (Sanitized citations only)
            sanitized_citations = [c.to_dict() for c in synthesis_result.citations]
            assistant_msg = AiAssistantMessage(
                conversation_id=conversation_id,
                role="assistant",
                content=synthesis_result.answer.strip(),
                evidence_status=synthesis_result.evidence_status,
                has_conflict=synthesis_result.has_conflict,
                is_grounded=synthesis_result.is_grounded,
                citations=sanitized_citations,
                domains_searched=synthesis_result.domains_searched,
                model_used=synthesis_result.model_used,
            )
            db.add(assistant_msg)

            # 3. Update Conversation updated_at and Title if default
            if conv.title == "New Inquiry" or not conv.title:
                # Derive title from first 60 chars of query
                clean_preview = user_query.strip().split("\n")[0][:60]
                conv.title = clean_preview if clean_preview else "Inquiry"

            conv.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(user_msg)
            db.refresh(assistant_msg)
            return user_msg, assistant_msg

        except Exception as e:
            db.rollback()
            logger.error("Failed to record turn for conversation %s: %s", conversation_id, e)
            raise ConversationServiceError(f"Database error recording turn: {e}") from e

    def get_conversation_history(
        self,
        db: Session,
        conversation_id: str,
        user_id: uuid.UUID,
        limit: int = DEFAULT_PAGE_SIZE,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Retrieves paginated messages for a conversation session.
        Enforces user ownership check.
        """
        try:
            conv_uuid = uuid.UUID(conversation_id)
        except (ValueError, TypeError):
            raise ConversationNotFoundError(f"Invalid conversation ID format: {conversation_id}")

        conv = db.scalar(
            select(AiAssistantConversation)
            .where(
                AiAssistantConversation.id == conv_uuid,
                AiAssistantConversation.is_deleted == False,
            )
        )
        if not conv:
            raise ConversationNotFoundError(f"Conversation {conversation_id} not found.")

        if conv.user_id != user_id:
            raise ConversationAccessDeniedError("Access denied: You do not own this conversation.")

        bounded_limit = max(1, min(limit, MAX_PAGE_SIZE))
        bounded_offset = max(0, offset)

        total_messages = db.scalar(
            select(func.count(AiAssistantMessage.id))
            .where(AiAssistantMessage.conversation_id == conv_uuid)
        ) or 0

        messages = db.scalars(
            select(AiAssistantMessage)
            .where(AiAssistantMessage.conversation_id == conv_uuid)
            .order_by(AiAssistantMessage.created_at.asc())
            .offset(bounded_offset)
            .limit(bounded_limit)
        ).all()

        turns = [m.to_dict() for m in messages]

        return {
            "conversation_id": str(conv.id),
            "title": conv.title,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
            "total_messages": total_messages,
            "limit": bounded_limit,
            "offset": bounded_offset,
            "turns": turns,
        }

    def list_user_conversations(
        self,
        db: Session,
        user_id: uuid.UUID,
        limit: int = DEFAULT_PAGE_SIZE,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Lists conversations owned by the authenticated user with pagination.
        """
        bounded_limit = max(1, min(limit, MAX_PAGE_SIZE))
        bounded_offset = max(0, offset)

        total_count = db.scalar(
            select(func.count(AiAssistantConversation.id))
            .where(
                AiAssistantConversation.user_id == user_id,
                AiAssistantConversation.is_deleted == False,
            )
        ) or 0

        conversations = db.scalars(
            select(AiAssistantConversation)
            .where(
                AiAssistantConversation.user_id == user_id,
                AiAssistantConversation.is_deleted == False,
            )
            .order_by(AiAssistantConversation.updated_at.desc())
            .offset(bounded_offset)
            .limit(bounded_limit)
        ).all()

        return {
            "total": total_count,
            "limit": bounded_limit,
            "offset": bounded_offset,
            "conversations": [c.to_summary_dict() for c in conversations],
        }

    def delete_conversation(
        self,
        db: Session,
        conversation_id: str,
        user_id: uuid.UUID,
    ) -> bool:
        """
        Soft-deletes a conversation owned by the authenticated user.
        """
        try:
            conv_uuid = uuid.UUID(conversation_id)
        except (ValueError, TypeError):
            raise ConversationNotFoundError(f"Invalid conversation ID format: {conversation_id}")

        conv = db.scalar(
            select(AiAssistantConversation)
            .where(
                AiAssistantConversation.id == conv_uuid,
                AiAssistantConversation.is_deleted == False,
            )
        )
        if not conv:
            raise ConversationNotFoundError(f"Conversation {conversation_id} not found.")

        if conv.user_id != user_id:
            raise ConversationAccessDeniedError("Access denied: You do not own this conversation.")

        try:
            conv.is_deleted = True
            db.commit()
            logger.info("Conversation %s soft-deleted by user %s", conversation_id, user_id)
            return True
        except Exception as e:
            db.rollback()
            logger.error("Failed to delete conversation %s: %s", conversation_id, e)
            raise ConversationServiceError(f"Database error deleting conversation: {e}") from e

    def prune_expired_conversations(
        self,
        db: Session,
        retention_days: int = 90,
    ) -> int:
        """
        Prunes conversations older than retention_days.
        Returns count of pruned conversations.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
        try:
            expired_ids = db.scalars(
                select(AiAssistantConversation.id)
                .where(
                    AiAssistantConversation.updated_at < cutoff,
                )
            ).all()

            if expired_ids:
                db.execute(
                    delete(AiAssistantConversation)
                    .where(AiAssistantConversation.id.in_(expired_ids))
                )
                db.commit()
                logger.info("Pruned %d expired conversations older than %d days", len(expired_ids), retention_days)
                return len(expired_ids)
            return 0
        except Exception as e:
            db.rollback()
            logger.error("Failed to prune expired conversations: %s", e)
            return 0

    @staticmethod
    def _is_valid_uuid(val: str) -> bool:
        try:
            uuid.UUID(str(val))
            return True
        except (ValueError, TypeError):
            return False


# Global service singleton
persistent_conversation_service = PersistentConversationService()
