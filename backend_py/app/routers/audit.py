"""
CivicConnect AI - Audit Trail & Compliance Router.

Endpoints:
- GET /api/audit/logs : Query append-only audit trail with structured filters
- GET /api/audit/export : RFC 4180 compliant CSV export (Super Admin only)
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.auth.dependencies import require_role
from app.governance.audit_logger import AuditLogger

audit_router = APIRouter(prefix="/api/audit", tags=["Audit Log"])


@audit_router.get("/logs")
def query_audit_logs(
    actor_id: Optional[str] = Query(None, alias="actorId"),
    role: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    target_type: Optional[str] = Query(None, alias="targetType"),
    target_id: Optional[str] = Query(None, alias="targetId"),
    start_date: Optional[datetime] = Query(None, alias="startDate"),
    end_date: Optional[datetime] = Query(None, alias="endDate"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_role(["admin", "super_admin"])),
    db: Session = Depends(get_db),
):
    """
    Query tamper-evident administrative audit logs.
    All sensitive credentials are automatically sanitized.
    """
    entries = AuditLogger.query(
        db=db,
        actor_id=actor_id,
        role=role,
        action=action,
        target_type=target_type,
        target_id=target_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )

    return {
        "logs": [
            {
                "id": e.id,
                "actorId": e.actor_id,
                "actorName": e.actor_name,
                "actorEmail": e.actor_email,
                "actorRole": e.actor_role,
                "action": e.action,
                "targetType": e.target_type,
                "targetId": e.target_id,
                "ipAddress": e.ip_address,
                "details": e.details,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            }
            for e in entries
        ]
    }


@audit_router.get("/export")
def export_audit_csv(
    actor_id: Optional[str] = Query(None, alias="actorId"),
    role: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None, alias="startDate"),
    end_date: Optional[datetime] = Query(None, alias="endDate"),
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db),
):
    """
    Export audit log to an RFC 4180 compliant CSV attachment.
    Super Administrator authorization required.
    """
    entries = AuditLogger.query(
        db=db,
        actor_id=actor_id,
        role=role,
        action=action,
        start_date=start_date,
        end_date=end_date,
        limit=5000,
    )

    csv_content = AuditLogger.export_csv(entries)
    timestamp_str = int(datetime.now().timestamp())
    filename = f"civicconnect_audit_{timestamp_str}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

