"""
CivicConnect AI - Soft Lease Lock Management Router.

Endpoints:
- POST /api/locks/{reportId}/acquire : Acquire or renew 10-minute soft review lease
- POST /api/locks/{reportId}/release : Explicitly release lock
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Report, User
from app.auth.dependencies import get_current_user
from app.governance.lock_manager import LockManager, LockConflictError, StaleVersionError

locks_router = APIRouter(prefix="/api/locks", tags=["Concurrency Locks"])


@locks_router.post("/{report_id}/acquire")
def acquire_lock(
    report_id: str,
    payload: dict = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Acquire or renew a 10-minute soft lease lock on a report.
    Returns HTTP 423 if active lock is held by another moderator.
    """
    version = payload.get("version") if payload else None

    try:
        res = LockManager.acquire_lock(
            db=db,
            report_id=report_id,
            user_id=current_user.id,
            user_name=current_user.name,
            user_role=current_user.role,
            current_version=version,
        )
        return {
            "message": res["message"],
            "lock": res["lock"],
            "isLockedByOther": False,
        }
    except LockConflictError as e:
        return Response(
            status_code=status.HTTP_423_LOCKED,
            content=(
                f'{{"error": "{str(e)}", '
                f'"lock": {{"userName": "{e.locked_by_name}", "userId": "{e.locked_by_id}", "remainingSeconds": {e.remaining_seconds}}}, '
                f'"isLockedByOther": true}}'
            ),
            media_type="application/json",
        )
    except StaleVersionError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@locks_router.post("/{report_id}/release")
def release_lock(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Release active soft lock."""
    released = LockManager.release_lock(db, report_id, current_user.id)
    return {"success": released}

