# -*- coding: utf-8 -*-
"""
SQLAlchemy models for VYASAⁿ AI Knowledge Centre Persistent Conversations
and Distributed PostgreSQL Rate Limiting.

Schema:
1. ai_assistant_conversations: Persistent conversation thread metadata, user ownership, and lifecycle.
2. ai_assistant_messages: Individual user and assistant turns with grounded evidence, citations, and claim stats.
3. ai_assistant_rate_limits: Distributed atomic sliding-window timestamps per authenticated user.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base


class AiAssistantConversation(Base):
    """
    Persistent conversational session for authenticated scholars, faculty, and administrators.
    Guarantees user ownership isolation and thread continuity across container restarts.
    """
    __tablename__ = "ai_assistant_conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="New Inquiry",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        index=True,
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    # Relationships
    messages: Mapped[List["AiAssistantMessage"]] = relationship(
        "AiAssistantMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="AiAssistantMessage.created_at.asc()",
    )

    __table_args__ = (
        Index("ix_ai_assistant_conversations_user_updated", "user_id", "updated_at"),
    )

    def to_summary_dict(self) -> Dict[str, Any]:
        return {
            "conversation_id": str(self.id),
            "user_id": str(self.user_id),
            "title": self.title,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_archived": self.is_archived,
        }


class AiAssistantMessage(Base):
    """
    Individual conversational turn (user inquiry or assistant synthesis) within a persistent session.
    Preserves factual claims, evidence status, and validated citation items.
    """
    __tablename__ = "ai_assistant_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_assistant_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,  # "user" or "assistant"
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    evidence_status: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,  # "sufficient" | "insufficient" | "conflicting_sources" | "generation_failed"
    )
    has_conflict: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    is_grounded: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    citations: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )
    domains_searched: Mapped[Optional[List[str]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )
    model_used: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationship
    conversation: Mapped["AiAssistantConversation"] = relationship(
        "AiAssistantConversation",
        back_populates="messages",
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "conversation_id": str(self.conversation_id),
            "role": self.role,
            "content": self.content,
            "evidence_status": self.evidence_status,
            "has_conflict": self.has_conflict,
            "is_grounded": self.is_grounded,
            "citations": self.citations or [],
            "domains_searched": self.domains_searched or [],
            "model_used": self.model_used,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AiAssistantRateLimit(Base):
    """
    Atomic distributed sliding-window tracker for App Platform horizontal scaling.
    Records request timestamps per authenticated user.
    """
    __tablename__ = "ai_assistant_rate_limits"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    request_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        Index("ix_ai_assistant_rate_limits_user_ts", "user_id", "request_timestamp"),
    )
