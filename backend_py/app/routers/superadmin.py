"""
CivicConnect AI - Super Administrator Console Router.

Endpoints:
- GET  /api/superadmin/users : List all users across roles
- POST /api/superadmin/users/invite : Invite new Staff or Administrator member
- PUT  /api/superadmin/users/{id}/role : Modify user role, department, or deactivation status
- GET  /api/superadmin/departments : Department management
- POST /api/superadmin/departments : Add municipal department
- GET  /api/superadmin/sla-thresholds : Inspect SLA policy thresholds
- POST /api/superadmin/sla-thresholds : Configure custom SLA response/resolution targets
"""

from datetime import datetime, timezone
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Department, Category
from app.auth.dependencies import require_role
from app.auth.auth_service import AuthService
from app.governance.sla_engine import DEFAULT_SLA_POLICIES, SlaPolicy
from app.governance.audit_logger import AuditLogger
from app.schemas import (
    InviteStaffRequest,
    UpdateUserRoleRequest,
    SlaPolicyConfigRequest,
)

superadmin_router = APIRouter(prefix="/api/superadmin", tags=["Super Admin"])


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@superadmin_router.get("/users")
def get_all_users(
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db),
):
    """List all accounts across all tiers (Citizen, Staff, Admin, Super Admin)."""
    users = db.execute(select(User).order_by(User.created_at.desc())).scalars().all()
    return {
        "users": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "departmentId": u.department_id,
                "departmentName": u.department_name,
                "mfaEnabled": u.mfa_enabled,
                "status": u.status,
                "lastLogin": u.last_login.isoformat() if u.last_login else None,
                "createdAt": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }


@superadmin_router.post("/users/invite", status_code=status.HTTP_201_CREATED)
def invite_staff_user(
    payload: InviteStaffRequest,
    request: Request,
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db),
):
    """Invite a new Staff or Administrator member to the municipal command center."""
    clean_email = payload.email.strip().lower()
    stmt = select(User).where(User.email == clean_email)
    existing = db.execute(stmt).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    dept_name = None
    if payload.department_id:
        dept = db.get(Department, payload.department_id)
        if dept:
            dept_name = dept.name

    temp_pass = payload.temporary_password or "CivicFix#2026"
    password_hash = AuthService.hash_password(temp_pass)

    new_user = User(
        name=payload.name.strip(),
        email=clean_email,
        password_hash=password_hash,
        role=payload.role,
        department_id=payload.department_id,
        department_name=dept_name,
        mfa_enabled=True,
        mfa_secret="JBSWY3DPEHPK3PXP",  # Standard demo secret
        status="active",
        created_at=utc_now(),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    client_ip = request.client.host if request.client else "127.0.0.1"
    AuditLogger.log(
        db=db,
        actor_id=current_user.id,
        actor_email=current_user.email,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="USER_STAFF_INVITED",
        target_type="user",
        target_id=new_user.id,
        ip_address=client_ip,
        details={"name": new_user.name, "email": new_user.email, "role": new_user.role},
    )

    return {
        "message": f"Invited {new_user.name} ({new_user.role}) successfully.",
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "role": new_user.role,
            "departmentName": new_user.department_name,
        },
    }


@superadmin_router.put("/users/{user_id}/role")
def update_user_role(
    user_id: str,
    payload: UpdateUserRoleRequest,
    request: Request,
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db),
):
    """Modify user role, department, or active status."""
    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if target_user.id == current_user.id and payload.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Super Admin cannot demote themselves to prevent administrative lockout.",
        )

    old_role = target_user.role
    target_user.role = payload.role
    if payload.department_id:
        dept = db.get(Department, payload.department_id)
        if dept:
            target_user.department_id = dept.id
            target_user.department_name = dept.name
    if payload.status:
        target_user.status = payload.status

    db.commit()

    client_ip = request.client.host if request.client else "127.0.0.1"
    AuditLogger.log(
        db=db,
        actor_id=current_user.id,
        actor_email=current_user.email,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="USER_ROLE_UPDATED",
        target_type="user",
        target_id=target_user.id,
        ip_address=client_ip,
        details={"oldRole": old_role, "newRole": target_user.role},
    )

    return {"message": "User updated successfully.", "role": target_user.role}


@superadmin_router.get("/departments")
def get_departments(
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db),
):
    """List municipal departments."""
    depts = db.execute(select(Department)).scalars().all()
    return {
        "departments": [
            {
                "id": d.id,
                "code": d.code,
                "name": d.name,
                "description": d.description,
                "staffCount": len(d.users),
            }
            for d in depts
        ]
    }


@superadmin_router.get("/sla-thresholds")
def get_sla_thresholds(
    current_user: User = Depends(require_role(["super_admin"])),
):
    """Inspect configured SLA response and resolution targets."""
    return {
        "policies": {
            p.priority: {
                "priority": p.priority,
                "responseTargetHours": p.response_target_hours,
                "resolutionTargetHours": p.resolution_target_hours,
            }
            for p in DEFAULT_SLA_POLICIES.values()
        }
    }


@superadmin_router.post("/sla-thresholds")
def update_sla_thresholds(
    payload: SlaPolicyConfigRequest,
    request: Request,
    current_user: User = Depends(require_role(["super_admin"])),
    db: Session = Depends(get_db),
):
    """Configure custom SLA response and resolution target hours."""
    DEFAULT_SLA_POLICIES["critical"] = SlaPolicy("critical", 4, payload.critical_hours)
    DEFAULT_SLA_POLICIES["high"] = SlaPolicy("high", 24, payload.high_hours)
    DEFAULT_SLA_POLICIES["medium"] = SlaPolicy("medium", 48, payload.medium_hours)
    DEFAULT_SLA_POLICIES["low"] = SlaPolicy("low", 96, payload.low_hours)

    client_ip = request.client.host if request.client else "127.0.0.1"
    AuditLogger.log(
        db=db,
        actor_id=current_user.id,
        actor_email=current_user.email,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="SLA_CONFIG_UPDATED",
        target_type="system_config",
        target_id="sla_policies",
        ip_address=client_ip,
        details={
            "critical_hours": payload.critical_hours,
            "high_hours": payload.high_hours,
            "medium_hours": payload.medium_hours,
            "low_hours": payload.low_hours,
        },
    )

    return {"message": "SLA thresholds updated successfully."}

