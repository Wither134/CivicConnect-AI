"""
CivicConnect AI - Relational Database Models (SQLAlchemy).

Implements persistent schemas for:
- Users (RBAC, MFA secret, bcrypt hash, status)
- Departments & Categories
- Reports (GPS, SLA deadlines, versioning, lock leases, AI analysis)
- ReportImages (EXIF stripped flag, proof image flag)
- StatusHistories (Append-only state audit trail)
- SupportVotes (Community upvotes)
- ReportComments (Incident discussion boards)
- DuplicateLinks (Spatial-textual duplicate relations)
- AuditLogs (Tamper-evident administrative audit log)
"""

from datetime import datetime, timezone
import uuid
from typing import Optional, List

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def gen_uuid() -> str:
    return str(uuid.uuid4())


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=gen_uuid)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)  # ELEC, ROADS, WASTE, WATER, PARKS
    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(Text, default="")

    users: Mapped[List["User"]] = relationship("User", back_populates="department")
    categories: Mapped[List["Category"]] = relationship("Category", back_populates="department")
    reports: Mapped[List["Report"]] = relationship("Report", back_populates="department")


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    department_id: Mapped[str] = mapped_column(String(64), ForeignKey("departments.id"))
    default_priority: Mapped[str] = mapped_column(String(32), default="medium")  # low, medium, high, critical
    icon: Mapped[str] = mapped_column(String(64), default="alert-triangle")

    department: Mapped["Department"] = relationship("Department", back_populates="categories")
    reports: Mapped[List["Report"]] = relationship("Report", back_populates="category")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(32), default="citizen", index=True)  # citizen, staff, admin, super_admin
    department_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("departments.id"), nullable=True)
    department_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_secret: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active")  # active, invited, deactivated
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    department: Mapped[Optional["Department"]] = relationship("Department", back_populates="users")
    reports_submitted: Mapped[List["Report"]] = relationship("Report", foreign_keys="Report.reporter_id", back_populates="reporter")
    reports_assigned: Mapped[List["Report"]] = relationship("Report", foreign_keys="Report.assignee_id", back_populates="assignee")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=gen_uuid)
    reference_number: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # CPR-2026-000123
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    
    category_id: Mapped[str] = mapped_column(String(64), ForeignKey("categories.id"))
    category_name: Mapped[str] = mapped_column(String(128))
    department_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("departments.id"), nullable=True)
    department_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    priority: Mapped[str] = mapped_column(String(32), default="medium")  # low, medium, high, critical
    priority_score: Mapped[float] = mapped_column(Float, default=50.0)
    score_breakdown: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)

    # 7-stage state machine
    status: Mapped[str] = mapped_column(String(32), default="submitted", index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)  # Optimistic concurrency version

    reporter_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"))
    reporter_name: Mapped[str] = mapped_column(String(128))

    assignee_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("users.id"), nullable=True)
    assignee_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    work_completer_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("users.id"), nullable=True)
    work_completer_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    reviewer_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("users.id"), nullable=True)
    reviewer_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Spatial GPS coordinates (Exact for authorized personnel, Coarsened for public)
    exact_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    exact_lng: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    coarsened_lat: Mapped[float] = mapped_column(Float, default=12.97)
    coarsened_lng: Mapped[float] = mapped_column(Float, default=77.59)
    ward: Mapped[str] = mapped_column(String(128), default="Ward 45 (Central Zone)")
    address_hint: Mapped[str] = mapped_column(String(255), default="Near municipal point")

    # Dynamic SLA resolution tracking
    response_due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_due_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    first_responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    work_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Concurrency 10-minute soft lease lock
    locked_by_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    locked_by_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    lock_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Side-exit states
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reopen_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parent_report_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("reports.id"), nullable=True)

    # AI Intelligence metadata
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_category_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ai_sop_recommendations: Mapped[Optional[list]] = mapped_column(JSON, default=list)

    # Privacy Data Erasure (GDPR/Citizen Right to Erasure)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delete_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    category: Mapped["Category"] = relationship("Category", back_populates="reports")
    department: Mapped[Optional["Department"]] = relationship("Department", back_populates="reports")
    reporter: Mapped["User"] = relationship("User", foreign_keys=[reporter_id], back_populates="reports_submitted")
    assignee: Mapped[Optional["User"]] = relationship("User", foreign_keys=[assignee_id], back_populates="reports_assigned")
    images: Mapped[List["ReportImage"]] = relationship("ReportImage", back_populates="report", cascade="all, delete-orphan")
    timeline: Mapped[List["StatusHistory"]] = relationship("StatusHistory", back_populates="report", cascade="all, delete-orphan", order_by="StatusHistory.created_at.asc()")
    comments: Mapped[List["ReportComment"]] = relationship("ReportComment", back_populates="report", cascade="all, delete-orphan")
    support_votes: Mapped[List["SupportVote"]] = relationship("SupportVote", back_populates="report", cascade="all, delete-orphan")


class ReportImage(Base):
    __tablename__ = "report_images"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=gen_uuid)
    report_id: Mapped[str] = mapped_column(String(64), ForeignKey("reports.id"))
    url: Mapped[str] = mapped_column(Text)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=1000000)
    mime_type: Mapped[str] = mapped_column(String(64), default="image/jpeg")
    exif_stripped: Mapped[bool] = mapped_column(Boolean, default=True)
    uploaded_by_id: Mapped[str] = mapped_column(String(64))
    uploaded_by_role: Mapped[str] = mapped_column(String(32), default="citizen")
    is_proof: Mapped[bool] = mapped_column(Boolean, default=False)
    caption: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    report: Mapped["Report"] = relationship("Report", back_populates="images")


class StatusHistory(Base):
    __tablename__ = "status_histories"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=gen_uuid)
    report_id: Mapped[str] = mapped_column(String(64), ForeignKey("reports.id"), index=True)
    actor_id: Mapped[str] = mapped_column(String(64))
    actor_name: Mapped[str] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(32))
    from_status: Mapped[str] = mapped_column(String(32))
    to_status: Mapped[str] = mapped_column(String(32))
    note: Mapped[str] = mapped_column(Text)
    proof_image_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    proof_image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    report: Mapped["Report"] = relationship("Report", back_populates="timeline")


class SupportVote(Base):
    __tablename__ = "support_votes"
    __table_args__ = (UniqueConstraint("report_id", "user_id", name="uq_report_user_vote"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=gen_uuid)
    report_id: Mapped[str] = mapped_column(String(64), ForeignKey("reports.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    report: Mapped["Report"] = relationship("Report", back_populates="support_votes")


class ReportComment(Base):
    __tablename__ = "report_comments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=gen_uuid)
    report_id: Mapped[str] = mapped_column(String(64), ForeignKey("reports.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(64))
    user_name: Mapped[str] = mapped_column(String(128))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    report: Mapped["Report"] = relationship("Report", back_populates="comments")


class DuplicateLink(Base):
    __tablename__ = "duplicate_links"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=gen_uuid)
    primary_report_id: Mapped[str] = mapped_column(String(64), ForeignKey("reports.id"))
    duplicate_report_id: Mapped[str] = mapped_column(String(64), ForeignKey("reports.id"))
    similarity_score: Mapped[float] = mapped_column(Float, default=0.0)
    distance_meters: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    merged_by_id: Mapped[str] = mapped_column(String(64))
    merged_by_name: Mapped[str] = mapped_column(String(128))
    undo_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_undone: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=gen_uuid)
    actor_id: Mapped[str] = mapped_column(String(64))
    actor_email: Mapped[str] = mapped_column(String(255))
    actor_name: Mapped[str] = mapped_column(String(128))
    actor_role: Mapped[str] = mapped_column(String(32))
    action: Mapped[str] = mapped_column(String(128), index=True)
    target_type: Mapped[str] = mapped_column(String(64))
    target_id: Mapped[str] = mapped_column(String(64))
    ip_address: Mapped[str] = mapped_column(String(64), default="127.0.0.1")
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), index=True)
    report_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("reports.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(64), default="status_update")  # status_update, sla_alert, resolution
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

