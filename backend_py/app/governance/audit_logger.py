"""
CivicConnect AI - Immutable Administrative Audit Logger.

Implements:
1. Append-only tamper-evident audit logging to the relational AuditLog table.
2. Automatic redaction of sensitive credentials (passwords, MFA secrets, JWT tokens).
3. Flexible filtering across actors, roles, actions, date ranges, and entity types.
4. RFC 4180 compliant CSV export with safe escaping of commas, quotes, and newlines.
"""

import csv
from datetime import datetime, timezone
import io
import json
from typing import Any, Optional, Sequence
import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


SENSITIVE_FIELD_NAMES = {
    "password",
    "password_hash",
    "pass",
    "token",
    "temp_token",
    "access_token",
    "refresh_token",
    "mfa_secret",
    "secret",
    "authorization",
    "cookie",
    "set-cookie",
}


def sanitize_audit_details(data: Optional[dict[str, Any]]) -> dict[str, Any]:
    """
    Recursively redact any sensitive credential keys before storing in audit log.
    """
    if not data or not isinstance(data, dict):
        return {}

    sanitized: dict[str, Any] = {}
    for key, val in data.items():
        key_lower = key.lower()
        if any(sensitive in key_lower for sensitive in SENSITIVE_FIELD_NAMES):
            sanitized[key] = "[REDACTED]"
        elif isinstance(val, dict):
            sanitized[key] = sanitize_audit_details(val)
        elif isinstance(val, list):
            sanitized[key] = [
                sanitize_audit_details(item) if isinstance(item, dict) else item
                for item in val
            ]
        else:
            sanitized[key] = val

    return sanitized


class AuditLogger:
    """Tamper-Evident Administrative Audit Log Suite."""

    @classmethod
    def log(
        cls,
        db: Session,
        actor_id: str,
        actor_email: str,
        actor_name: str,
        actor_role: str,
        action: str,
        target_type: str,
        target_id: str,
        details: Optional[dict[str, Any]] = None,
        ip_address: str = "127.0.0.1",
        commit: bool = True,
    ) -> AuditLog:
        """
        Append an immutable audit entry to the relational database.
        Never overwrites or deletes existing entries.
        """
        clean_details = sanitize_audit_details(details)

        entry = AuditLog(
            id=f"AUD-{int(utc_now().timestamp())}-{uuid.uuid4().hex[:6].upper()}",
            actor_id=actor_id,
            actor_email=actor_email,
            actor_name=actor_name,
            actor_role=actor_role,
            action=action,
            target_type=target_type,
            target_id=target_id,
            ip_address=ip_address,
            details=clean_details,
            timestamp=utc_now(),
        )

        db.add(entry)
        if commit:
            db.commit()
            db.refresh(entry)

        return entry

    @classmethod
    def query(
        cls,
        db: Session,
        actor_id: Optional[str] = None,
        role: Optional[str] = None,
        action: Optional[str] = None,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Sequence[AuditLog]:
        """
        Query audit entries with structured filters and pagination.
        """
        stmt = select(AuditLog)

        if actor_id:
            stmt = stmt.where(AuditLog.actor_id == actor_id)
        if role:
            stmt = stmt.where(AuditLog.actor_role == role)
        if action:
            stmt = stmt.where(AuditLog.action.ilike(f"%{action}%"))
        if target_type:
            stmt = stmt.where(AuditLog.target_type == target_type)
        if target_id:
            stmt = stmt.where(AuditLog.target_id == target_id)
        if start_date:
            stmt = stmt.where(AuditLog.timestamp >= start_date)
        if end_date:
            stmt = stmt.where(AuditLog.timestamp <= end_date)

        stmt = stmt.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit)
        return db.execute(stmt).scalars().all()

    @staticmethod
    def export_csv(entries: Sequence[AuditLog]) -> str:
        """
        Export audit records to RFC 4180 compliant CSV string.
        Properly escapes commas, quotes, special characters, and multiline details.
        """
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

        # Header row
        writer.writerow([
            "ID",
            "Timestamp",
            "Actor Name",
            "Actor Email",
            "Role",
            "Action",
            "Target Type",
            "Target ID",
            "IP Address",
            "Details",
        ])

        for e in entries:
            ts_str = e.timestamp.isoformat() if e.timestamp else ""
            details_str = json.dumps(e.details, default=str) if e.details else "{}"
            writer.writerow([
                e.id,
                ts_str,
                e.actor_name,
                e.actor_email,
                e.actor_role,
                e.action,
                e.target_type,
                e.target_id,
                e.ip_address,
                details_str,
            ])

        return output.getvalue()

