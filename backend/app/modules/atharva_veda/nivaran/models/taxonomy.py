import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.modules.atharva_veda.nivaran.models.enums import CategoryRoutingType


class SubjectCluster(Base):
    __tablename__ = "nivaran_subject_clusters"
    __table_args__ = (
        CheckConstraint("cluster_number > 0", name="ck_nivaran_sub_cluster_num_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    cluster_number: Mapped[int] = mapped_column(
        Integer,
        unique=True,
        nullable=False,
        comment="Dynamic cluster numbering (e.g. 1..10 or expanded by admin)",
    )
    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    assistant_dean_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        unique=True,
        nullable=True,
        comment="Configured Assistant Dean authority for this subject cluster",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
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
    assistant_dean = relationship("NivaranAuthority", foreign_keys=[assistant_dean_id])
    subjects = relationship("Subject", back_populates="cluster")

    def __repr__(self) -> str:
        return f"<SubjectCluster(id={self.id}, num={self.cluster_number}, name='{self.name}', asst_dean={self.assistant_dean_id})>"


class Subject(Base):
    __tablename__ = "nivaran_subjects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    subject_cluster_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_subject_clusters.id", ondelete="RESTRICT"),
        nullable=False,
        comment="Foreign key to academic subject cluster",
    )
    name: Mapped[str] = mapped_column(
        String(150),
        unique=True,
        nullable=False,
    )
    code: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
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
    cluster = relationship("SubjectCluster", back_populates="subjects")

    def __repr__(self) -> str:
        return f"<Subject(id={self.id}, name='{self.name}', cluster_id={self.subject_cluster_id})>"


class GrievanceCluster(Base):
    __tablename__ = "nivaran_grievance_clusters"
    __table_args__ = (
        CheckConstraint("cluster_number > 0", name="ck_nivaran_grv_cluster_num_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    cluster_number: Mapped[int] = mapped_column(
        Integer,
        unique=True,
        nullable=False,
        comment="Dynamic cluster numbering (e.g. 1..3 or expanded by admin)",
    )
    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    associate_dean_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        unique=True,
        nullable=True,
        comment="Configured Associate Dean authority for this grievance cluster",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
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
    associate_dean = relationship("NivaranAuthority", foreign_keys=[associate_dean_id])
    categories = relationship("Category", back_populates="grievance_cluster")

    def __repr__(self) -> str:
        return f"<GrievanceCluster(id={self.id}, num={self.cluster_number}, name='{self.name}', assoc_dean={self.associate_dean_id})>"


class Category(Base):
    __tablename__ = "nivaran_categories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    routing_type: Mapped[CategoryRoutingType] = mapped_column(
        Enum(CategoryRoutingType, name="category_routing_type"),
        nullable=False,
        comment="Routing mode: CLUSTER, GRIEVANCE_CLUSTER, SUBJECT_ASSISTANT_DEAN, FIXED_AUTHORITY",
    )
    grievance_cluster_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_grievance_clusters.id", ondelete="RESTRICT"),
        nullable=True,
        comment="Grievance cluster target when routing_type is CLUSTER or GRIEVANCE_CLUSTER",
    )
    fixed_authority_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=True,
        comment="Fixed authority target when routing_type is FIXED_AUTHORITY",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
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
    grievance_cluster = relationship("GrievanceCluster", back_populates="categories")
    fixed_authority = relationship("NivaranAuthority", foreign_keys=[fixed_authority_id])

    def __repr__(self) -> str:
        return f"<Category(id={self.id}, name='{self.name}', routing_type='{self.routing_type}')>"
