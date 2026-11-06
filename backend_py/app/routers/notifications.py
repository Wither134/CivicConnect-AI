"""
CivicConnect AI - Citizen Notifications Router.

Endpoints:
- GET  /api/notifications : Retrieve recent and unread notifications for authenticated user
- POST /api/notifications/{id}/read : Mark a specific notification as read
- POST /api/notifications/read-all : Mark all notifications for the current user as read
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Notification, User
from app.auth.dependencies import get_current_user

notifications_router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@notifications_router.get("")
def list_notifications(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve notifications for the authenticated user."""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    items = db.execute(stmt).scalars().all()

    unread_count = sum(1 for n in items if not n.is_read)

    return {
        "unreadCount": unread_count,
        "notifications": [
            {
                "id": n.id,
                "reportId": n.report_id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "isRead": n.is_read,
                "createdAt": n.created_at.isoformat() if n.created_at else None,
            }
            for n in items
        ],
    }


@notifications_router.post("/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a notification as read."""
    notif = db.get(Notification, notification_id)
    if not notif or notif.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")

    notif.is_read = True
    db.commit()
    return {"message": "Notification marked as read.", "id": notification_id, "isRead": True}


@notifications_router.post("/read-all")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all notifications for the current user as read."""
    stmt = (
        update(Notification)
        .where(Notification.user_id == current_user.id)
        .where(Notification.is_read.is_(False))
        .values(is_read=True)
    )
    db.execute(stmt)
    db.commit()
    return {"message": "All notifications marked as read."}
