"""
CivicConnect AI - PostgreSQL-Compatible Soft Locking & Concurrency Manager.

Implements Anti-Chaos Rule:
1. 10-minute soft lease lock per report (locked_by_id, locked_by_name, lock_expires_at).
2. Database-level atomic acquisition using SELECT FOR UPDATE on PostgreSQL.
3. Graceful handling of SQLite local development with full documentation of
   database-level lock serialization vs row-level locking.
4. Renewal by lock owner, clean release, and automatic acquisition when expired.
5. Optimistic concurrency control (version validation) to prevent stale edits.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Report


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


DEFAULT_LOCK_TTL_SECONDS = 600  # 10 minutes


class LockManagerError(Exception):
    """Base exception for lock operations."""
    pass


class LockConflictError(LockManagerError):
    """Raised when an active lock is held by another user."""
    def __init__(self, message: str, locked_by_id: str, locked_by_name: str, expires_at: datetime, remaining_seconds: int):
        super().__init__(message)
        self.locked_by_id = locked_by_id
        self.locked_by_name = locked_by_name
        self.expires_at = expires_at
        self.remaining_seconds = remaining_seconds


class StaleVersionError(LockManagerError):
    """Raised when an optimistic concurrency version conflict is detected."""
    def __init__(self, message: str, expected_version: int, current_version: int):
        super().__init__(message)
        self.expected_version = expected_version
        self.current_version = current_version


class LockManager:
    """
    Manages operational concurrency locks on civic incident reports.

    SQLite Concurrency Notes:
    -------------------------
    SQLite operates with a single database-level lock during write transactions.
    While PostgreSQL supports fine-grained row-level locking (`SELECT ... FOR UPDATE`),
    SQLite serializes all transactions at the database file level. In development on SQLite,
    `with_for_update()` is safely omitted or ignored by SQLite's dialect.
    In production PostgreSQL, row-level locks prevent race conditions during high-volume triage.
    """

    @classmethod
    def acquire_lock(
        cls,
        db: Session,
        report_id: str,
        user_id: str,
        user_name: str,
        user_role: str,
        current_version: Optional[int] = None,
        ttl_seconds: int = DEFAULT_LOCK_TTL_SECONDS,
    ) -> dict[str, Any]:
        """
        Atomically acquire or renew a soft lease lock on a report.

        Returns a dictionary with lock details if successful.
        Raises LockConflictError if an active lock is held by another user.
        Raises StaleVersionError if current_version does not match report.version.
        """
        now = utc_now()
        bind = db.get_bind()
        is_sqlite = bind.dialect.name == "sqlite"

        # Build query; use FOR UPDATE only when supported by the underlying dialect
        stmt = select(Report).where(Report.id == report_id)
        if not is_sqlite:
            stmt = stmt.with_for_update()

        report = db.execute(stmt).scalar_one_or_none()
        if not report:
            raise LockManagerError(f"Report '{report_id}' not found.")

        # Optimistic concurrency check if version provided
        if current_version is not None and report.version != current_version:
            raise StaleVersionError(
                f"Stale edit detected. Current version is {report.version}, but client submitted version {current_version}.",
                expected_version=current_version,
                current_version=report.version,
            )

        # Ensure lock_expires_at is timezone-aware for comparison
        existing_expires = report.lock_expires_at
        if existing_expires is not None and existing_expires.tzinfo is None:
            existing_expires = existing_expires.replace(tzinfo=timezone.utc)

        # Check if an active lock is currently held
        if existing_expires is not None and existing_expires > now:
            if report.locked_by_id == user_id:
                # Renew lock for the same user
                new_expires = now + timedelta(seconds=ttl_seconds)
                report.lock_expires_at = new_expires
                report.locked_by_name = user_name
                db.commit()
                return {
                    "success": True,
                    "message": "Lock renewed successfully",
                    "lock": {
                        "report_id": report_id,
                        "user_id": user_id,
                        "user_name": user_name,
                        "user_role": user_role,
                        "expires_at": new_expires.isoformat(),
                        "remaining_seconds": ttl_seconds,
                    },
                }

            # Held by another user -> raise conflict
            remaining = int((existing_expires - now).total_seconds())
            holder_name = report.locked_by_name or "Another moderator"
            raise LockConflictError(
                message=f"{holder_name} is currently reviewing this report. Lock expires in {remaining}s.",
                locked_by_id=report.locked_by_id or "",
                locked_by_name=holder_name,
                expires_at=existing_expires,
                remaining_seconds=remaining,
            )

        # No active lock or lock has expired: claim the lock
        new_expires = now + timedelta(seconds=ttl_seconds)
        report.locked_by_id = user_id
        report.locked_by_name = user_name
        report.lock_expires_at = new_expires
        db.commit()

        return {
            "success": True,
            "message": "Lock acquired",
            "lock": {
                "report_id": report_id,
                "user_id": user_id,
                "user_name": user_name,
                "user_role": user_role,
                "expires_at": new_expires.isoformat(),
                "remaining_seconds": ttl_seconds,
            },
        }

    @classmethod
    def release_lock(
        cls,
        db: Session,
        report_id: str,
        user_id: str,
        force: bool = False,
    ) -> bool:
        """
        Release an active soft lock.
        Returns True if released or if already unlocked; False if held by someone else without force.
        """
        report = db.get(Report, report_id)
        if not report:
            return False

        if report.locked_by_id is None:
            return True

        if report.locked_by_id == user_id or force:
            report.locked_by_id = None
            report.locked_by_name = None
            report.lock_expires_at = None
            db.commit()
            return True

        return False

    @classmethod
    def get_lock_status(cls, report: Report, now: Optional[datetime] = None) -> dict[str, Any]:
        """Return non-mutating active lock inspection."""
        now = now or utc_now()
        expires = report.lock_expires_at
        if expires is not None and expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)

        if expires is not None and expires > now:
            remaining = max(0, int((expires - now).total_seconds()))
            return {
                "is_locked": True,
                "locked_by_id": report.locked_by_id,
                "locked_by_name": report.locked_by_name,
                "expires_at": expires.isoformat(),
                "remaining_seconds": remaining,
            }

        return {
            "is_locked": False,
            "locked_by_id": None,
            "locked_by_name": None,
            "expires_at": None,
            "remaining_seconds": 0,
        }

    @staticmethod
    def check_optimistic_concurrency(expected_version: int, current_version: int) -> dict[str, Any]:
        """
        Validates client version against server version.
        Raises StaleVersionError if versions do not match.
        """
        if expected_version != current_version:
            raise StaleVersionError(
                f"Stale edit detected: client submitted version {expected_version}, but server has version {current_version}.",
                expected_version=expected_version,
                current_version=current_version,
            )
        return {"valid": True, "version": current_version}

