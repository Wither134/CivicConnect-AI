"""
CivicConnect AI - Service Level Agreement (SLA) Engine.

Calculates municipal response and resolution deadlines:
- Critical : 24 hours resolution (4 hours response)
- High     : 72 hours resolution (24 hours response)
- Medium   : 120 hours resolution (48 hours response)
- Low      : 240 hours resolution (96 hours response)

Supports:
- Timezone-aware UTC calculations.
- Configurable thresholds.
- Dynamic evaluation (is_breached, remaining_time, status_label: 'On track' | 'At risk' | 'SLA breach').
- Safe recalculation upon priority change while preserving historical baseline timestamps.
- Human-friendly countdown formatting.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.models import Report


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure a datetime is timezone-aware UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@dataclass(frozen=True)
class SlaPolicy:
    priority: str
    response_target_hours: int
    resolution_target_hours: int


DEFAULT_SLA_POLICIES: dict[str, SlaPolicy] = {
    "critical": SlaPolicy(priority="critical", response_target_hours=4, resolution_target_hours=24),
    "high": SlaPolicy(priority="high", response_target_hours=24, resolution_target_hours=72),
    "medium": SlaPolicy(priority="medium", response_target_hours=48, resolution_target_hours=120),
    "low": SlaPolicy(priority="low", response_target_hours=96, resolution_target_hours=240),
}


@dataclass
class SlaEvaluation:
    is_response_breached: bool
    is_resolution_breached: bool
    is_breached: bool
    response_remaining_seconds: int
    resolution_remaining_seconds: int
    response_due_at: datetime
    resolution_due_at: datetime
    status_label: str  # 'On track' | 'At risk' | 'SLA breach'
    countdown_display: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_response_breached": self.is_response_breached,
            "is_resolution_breached": self.is_resolution_breached,
            "is_breached": self.is_breached,
            "response_remaining_seconds": self.response_remaining_seconds,
            "resolution_remaining_seconds": self.resolution_remaining_seconds,
            "response_due_at": self.response_due_at.isoformat(),
            "resolution_due_at": self.resolution_due_at.isoformat(),
            "status_label": self.status_label,
            "countdown_display": self.countdown_display,
        }


class SlaEngine:
    """Civic SLA Deadline and Compliance Engine."""

    @classmethod
    def get_policy(cls, priority: Optional[str], custom_policies: Optional[dict[str, SlaPolicy]] = None) -> SlaPolicy:
        """Resolve policy by priority with safe fallback to 'medium'."""
        policies = custom_policies or DEFAULT_SLA_POLICIES
        key = (priority or "medium").lower().strip()
        return policies.get(key, policies.get("medium", DEFAULT_SLA_POLICIES["medium"]))

    @classmethod
    def calculate_due_dates(
        cls,
        created_at: datetime,
        priority: Optional[str],
        custom_policies: Optional[dict[str, SlaPolicy]] = None,
    ) -> dict[str, datetime]:
        """
        Calculate timezone-aware response and resolution deadlines from creation timestamp.
        """
        base_time = ensure_utc(created_at) or utc_now()
        policy = cls.get_policy(priority, custom_policies)

        response_due_at = base_time + timedelta(hours=policy.response_target_hours)
        resolution_due_at = base_time + timedelta(hours=policy.resolution_target_hours)

        return {
            "response_due_at": response_due_at,
            "resolution_due_at": resolution_due_at,
        }

    @classmethod
    def evaluate(
        cls,
        created_at: datetime,
        priority: Optional[str],
        status: str,
        first_responded_at: Optional[datetime] = None,
        resolved_at: Optional[datetime] = None,
        now: Optional[datetime] = None,
        custom_policies: Optional[dict[str, SlaPolicy]] = None,
    ) -> SlaEvaluation:
        """
        Evaluate real-time SLA compliance for an active or resolved incident.
        """
        current_time = ensure_utc(now) or utc_now()
        due_dates = cls.calculate_due_dates(created_at, priority, custom_policies)
        resp_due = due_dates["response_due_at"]
        res_due = due_dates["resolution_due_at"]

        resp_done = ensure_utc(first_responded_at)
        resolved_done = ensure_utc(resolved_at)

        # Response SLA Evaluation
        if resp_done is not None:
            is_response_breached = resp_done > resp_due
            response_remaining = max(0, int((resp_due - resp_done).total_seconds()))
        else:
            is_response_breached = current_time > resp_due
            response_remaining = int((resp_due - current_time).total_seconds())

        # Resolution SLA Evaluation
        is_closed = status.lower() in ("resolved", "rejected")
        if resolved_done is not None or is_closed:
            effective_resolve_time = resolved_done or current_time
            is_resolution_breached = effective_resolve_time > res_due
            resolution_remaining = max(0, int((res_due - effective_resolve_time).total_seconds()))
        else:
            is_resolution_breached = current_time > res_due
            resolution_remaining = int((res_due - current_time).total_seconds())

        is_breached = (is_response_breached and resp_done is None) or (is_resolution_breached and not is_closed)

        # Status Label: 'On track' | 'At risk' | 'SLA breach'
        if is_breached:
            status_label = "SLA breach"
        elif not is_closed and resolution_remaining < (4 * 3600):  # Less than 4 hours remaining
            status_label = "At risk"
        else:
            status_label = "On track"

        countdown_display = cls.format_countdown(res_due, current_time if not is_closed else (resolved_done or current_time))

        return SlaEvaluation(
            is_response_breached=is_response_breached,
            is_resolution_breached=is_resolution_breached,
            is_breached=is_breached,
            response_remaining_seconds=response_remaining,
            resolution_remaining_seconds=resolution_remaining,
            response_due_at=resp_due,
            resolution_due_at=res_due,
            status_label=status_label,
            countdown_display=countdown_display,
        )

    @classmethod
    def recalculate_for_priority_change(
        cls,
        report: Report,
        new_priority: str,
        custom_policies: Optional[dict[str, SlaPolicy]] = None,
    ) -> dict[str, Any]:
        """
        Recalculate SLA deadlines when priority changes, preserving baseline created_at.
        Returns old and new values for audit logging.
        """
        old_priority = report.priority
        old_resp_due = report.response_due_at
        old_res_due = report.resolution_due_at

        new_dates = cls.calculate_due_dates(report.created_at, new_priority, custom_policies)

        report.priority = new_priority
        report.response_due_at = new_dates["response_due_at"]
        report.resolution_due_at = new_dates["resolution_due_at"]

        return {
            "report_id": report.id,
            "old_priority": old_priority,
            "new_priority": new_priority,
            "old_response_due_at": old_resp_due.isoformat() if old_resp_due else None,
            "new_response_due_at": new_dates["response_due_at"].isoformat(),
            "old_resolution_due_at": old_res_due.isoformat() if old_res_due else None,
            "new_resolution_due_at": new_dates["resolution_due_at"].isoformat(),
        }

    @staticmethod
    def format_countdown(due_at: Optional[datetime], now: Optional[datetime] = None) -> str:
        """
        Formats a human-friendly countdown:
        e.g. '18h remaining', '2d remaining', 'Overdue by 3h', 'Due in 45m'.
        """
        if due_at is None:
            return "No SLA"

        now_dt = ensure_utc(now) or utc_now()
        due_dt = ensure_utc(due_at)

        delta_seconds = int((due_dt - now_dt).total_seconds())

        if delta_seconds < 0:
            overdue_sec = abs(delta_seconds)
            if overdue_sec < 3600:
                mins = max(1, overdue_sec // 60)
                return f"Overdue by {mins}m"
            elif overdue_sec < 86400:
                hours = overdue_sec // 3600
                return f"Overdue by {hours}h"
            else:
                days = overdue_sec // 86400
                return f"Overdue by {days}d"

        if delta_seconds < 3600:
            mins = max(1, delta_seconds // 60)
            return f"Due in {mins}m"
        elif delta_seconds < 86400:
            hours = delta_seconds // 3600
            return f"{hours}h remaining"
        else:
            days = delta_seconds // 86400
            return f"{days}d remaining"

