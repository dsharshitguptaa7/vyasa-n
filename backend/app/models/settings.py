import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(
        String(100),
        primary_key=True,
        comment="Configuration parameter key, e.g. platform.maintenance_mode",
    )
    value: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Configuration value stored as string",
    )
    data_type: Mapped[str] = mapped_column(
        String(32),
        default="string",
        nullable=False,
        comment="Type hint: string, boolean, integer, json",
    )
    description: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    is_public: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether this setting can be read without authentication",
    )
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        comment="Admin user who last modified this setting",
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
    )

    # Relationships
    author = relationship("User", foreign_keys=[updated_by])

    def __repr__(self) -> str:
        return f"<SystemSetting(key='{self.key}', value='{self.value}', is_public={self.is_public})>"
