"""
CivicConnect AI - Seven-Stage Report Lifecycle State Machine.

Enforces:
1. Seven canonical stages:
   submitted -> under_review -> verified -> assigned -> in_progress -> work_completed -> resolved
   plus side-exits: rejected, duplicate, and reopened (returns to assigned).
2. Strict role-based transition permissions.
3. Two-Person Resolution Rule:
   The staff member or administrator who marks work as completed CANNOT be the
   administrator who grants final sign-off to mark the issue Resolved.
4. Mandatory proof photos and 10+ character audit justifications.
5. AI Isolation Boundary:
   AI systems are strictly advisory. Automated calls attempting to trigger state
   transitions are blocked unconditionally.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional, Sequence
from sqlalchemy.orm import Session

from app.models import Report, StatusHistory, Notification


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ReportStatus(str, Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    VERIFIED = "verified"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    WORK_COMPLETED = "work_completed"
    RESOLVED = "resolved"
    REJECTED = "rejected"
    DUPLICATE = "duplicate"
    REOPENED = "reopened"


class UserRole(str, Enum):
    VISITOR = "visitor"
    CITIZEN = "citizen"
    STAFF = "staff"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class StateMachineError(Exception):
    """Base exception for all state machine violations."""
    pass


class UnauthorizedTransitionError(StateMachineError):
    """Raised when actor role has insufficient authority for requested state transition."""
    pass


class IllegalTransitionError(StateMachineError):
    """Raised when the requested state transition is not allowed from the current state."""
    pass


class TwoPersonRuleViolationError(StateMachineError):
    """Raised when the same person attempts to both complete and resolve a civic report."""
    pass


class MissingEvidenceError(StateMachineError):
    """Raised when mandatory proof images are missing for work completion or resolution."""
    pass


class InvalidTransitionNoteError(StateMachineError):
    """Raised when required justification notes are missing or shorter than 10 characters."""
    pass


@dataclass
class TransitionContext:
    actor_id: str
    actor_role: str
    actor_name: str
    assignee_id: Optional[str] = None
    work_completer_id: Optional[str] = None
    note: Optional[str] = None
    proof_image_id: Optional[str] = None
    proof_image_url: Optional[str] = None
    parent_report_id: Optional[str] = None
    is_ai_triggered: bool = False


@dataclass
class TransitionResult:
    allowed: bool
    next_status: Optional[str] = None
    error: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


class StateMachine:
    """CivicConnect Seven-Stage State Machine Validator and Dispatcher."""

    @staticmethod
    def validate_transition(
        current_status: str,
        target_status: str,
        ctx: TransitionContext,
    ) -> TransitionResult:
        """
        Validate whether a transition is permitted according to state flow,
        role authorizations, two-person rule, photographic evidence, and audit notes.
        """
        # AI safety guard: AI must never trigger transitions autonomously
        if ctx.is_ai_triggered:
            return TransitionResult(
                allowed=False,
                error="AI advisory systems are not permitted to trigger status transitions. Human staff approval required.",
            )

        role = ctx.actor_role.lower()

        # Citizens and visitors cannot transition report states
        if role in (UserRole.VISITOR.value, UserRole.CITIZEN.value):
            return TransitionResult(
                allowed=False,
                error=f"Role '{ctx.actor_role}' is not authorized to change report status.",
            )

        # Field Staff transition rules
        if role == UserRole.STAFF.value:
            # Must be the staff member assigned to this report
            if ctx.assignee_id and ctx.assignee_id != ctx.actor_id:
                return TransitionResult(
                    allowed=False,
                    error="Staff can only update reports directly assigned to them.",
                )

            # Permitted: assigned -> in_progress
            if current_status == ReportStatus.ASSIGNED.value and target_status == ReportStatus.IN_PROGRESS.value:
                return TransitionResult(
                    allowed=True,
                    next_status=ReportStatus.IN_PROGRESS.value,
                    metadata={"action": "start_work", "timestamp": utc_now().isoformat()},
                )

            # Permitted: in_progress -> work_completed
            if current_status == ReportStatus.IN_PROGRESS.value and target_status == ReportStatus.WORK_COMPLETED.value:
                if not ctx.note or len(ctx.note.strip()) < 10:
                    return TransitionResult(
                        allowed=False,
                        error="Marking work completed requires a progress note of at least 10 characters.",
                    )
                if not ctx.proof_image_id:
                    return TransitionResult(
                        allowed=False,
                        error="Marking work completed requires at least one proof photo.",
                    )
                return TransitionResult(
                    allowed=True,
                    next_status=ReportStatus.WORK_COMPLETED.value,
                    metadata={
                        "action": "complete_work",
                        "proof_image_id": ctx.proof_image_id,
                        "work_completer_id": ctx.actor_id,
                        "timestamp": utc_now().isoformat(),
                    },
                )

            return TransitionResult(
                allowed=False,
                error=(
                    f"Staff cannot transition report from '{current_status}' to '{target_status}'. "
                    "Permitted transitions for staff: assigned -> in_progress, in_progress -> work_completed."
                ),
            )

        # Administrator & Super Administrator transition rules
        if role in (UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value):
            # Normal forward flow
            if current_status == ReportStatus.SUBMITTED.value and target_status == ReportStatus.UNDER_REVIEW.value:
                return TransitionResult(allowed=True, next_status=ReportStatus.UNDER_REVIEW.value)

            if current_status == ReportStatus.UNDER_REVIEW.value and target_status == ReportStatus.VERIFIED.value:
                return TransitionResult(allowed=True, next_status=ReportStatus.VERIFIED.value)

            if current_status == ReportStatus.VERIFIED.value and target_status == ReportStatus.ASSIGNED.value:
                return TransitionResult(allowed=True, next_status=ReportStatus.ASSIGNED.value)

            # Admin starting progress directly (e.g. emergency response)
            if current_status == ReportStatus.ASSIGNED.value and target_status == ReportStatus.IN_PROGRESS.value:
                return TransitionResult(allowed=True, next_status=ReportStatus.IN_PROGRESS.value)

            # Admin marking work completed
            if current_status == ReportStatus.IN_PROGRESS.value and target_status == ReportStatus.WORK_COMPLETED.value:
                if not ctx.note or len(ctx.note.strip()) < 10:
                    return TransitionResult(
                        allowed=False,
                        error="Marking work completed requires a progress note of at least 10 characters.",
                    )
                if not ctx.proof_image_id:
                    return TransitionResult(
                        allowed=False,
                        error="Marking work completed requires at least one proof photo.",
                    )
                return TransitionResult(
                    allowed=True,
                    next_status=ReportStatus.WORK_COMPLETED.value,
                    metadata={
                        "action": "complete_work",
                        "proof_image_id": ctx.proof_image_id,
                        "work_completer_id": ctx.actor_id,
                    },
                )

            # Return from in_progress back to assigned (reassigning work)
            if current_status == ReportStatus.IN_PROGRESS.value and target_status == ReportStatus.ASSIGNED.value:
                return TransitionResult(allowed=True, next_status=ReportStatus.ASSIGNED.value)

            # Two-Person Rule for Resolution:
            # Staff or admin marks work completed with proof photo.
            # A distinct administrator must independently inspect and sign off as Resolved.
            # The SAME individual cannot do both on a single report!
            if current_status == ReportStatus.WORK_COMPLETED.value and target_status == ReportStatus.RESOLVED.value:
                if ctx.work_completer_id and ctx.work_completer_id == ctx.actor_id:
                    return TransitionResult(
                        allowed=False,
                        error="Two-person rule violation: The administrator who signs off as Resolved cannot be the same person who completed the work.",
                    )
                if not ctx.note or len(ctx.note.strip()) < 10:
                    return TransitionResult(
                        allowed=False,
                        error="Resolution sign-off requires a completion note of at least 10 characters.",
                    )
                if not ctx.proof_image_id:
                    return TransitionResult(
                        allowed=False,
                        error="Resolution sign-off requires verified proof photo.",
                    )
                return TransitionResult(
                    allowed=True,
                    next_status=ReportStatus.RESOLVED.value,
                    metadata={
                        "action": "sign_off_resolved",
                        "reviewer_id": ctx.actor_id,
                        "timestamp": utc_now().isoformat(),
                    },
                )

            # Reopening back to assigned (e.g., citizen or moderator rejects completion proof)
            if (
                current_status in (ReportStatus.WORK_COMPLETED.value, ReportStatus.REJECTED.value, ReportStatus.RESOLVED.value)
                and target_status == ReportStatus.REOPENED.value
            ):
                if not ctx.note or len(ctx.note.strip()) < 10:
                    return TransitionResult(
                        allowed=False,
                        error="Reopening a report requires an explanation note of at least 10 characters.",
                    )
                # Reopened incidents transition to 'assigned' state
                return TransitionResult(
                    allowed=True,
                    next_status=ReportStatus.ASSIGNED.value,
                    metadata={"action": "reopen", "reopened_by": ctx.actor_id},
                )

            # Rejections from early or active stages
            if (
                current_status in (
                    ReportStatus.SUBMITTED.value,
                    ReportStatus.UNDER_REVIEW.value,
                    ReportStatus.VERIFIED.value,
                    ReportStatus.ASSIGNED.value,
                    ReportStatus.IN_PROGRESS.value,
                )
                and target_status == ReportStatus.REJECTED.value
            ):
                if not ctx.note or len(ctx.note.strip()) < 10:
                    return TransitionResult(
                        allowed=False,
                        error="Rejecting a report requires a reason with at least 10 characters.",
                    )
                return TransitionResult(
                    allowed=True,
                    next_status=ReportStatus.REJECTED.value,
                    metadata={"action": "reject", "reason": ctx.note},
                )

            # Marking as Duplicate of another report
            if (
                current_status in (
                    ReportStatus.SUBMITTED.value,
                    ReportStatus.UNDER_REVIEW.value,
                    ReportStatus.VERIFIED.value,
                )
                and target_status == ReportStatus.DUPLICATE.value
            ):
                if not ctx.parent_report_id:
                    return TransitionResult(
                        allowed=False,
                        error="Marking as duplicate requires selecting an active parent report.",
                    )
                return TransitionResult(
                    allowed=True,
                    next_status=ReportStatus.DUPLICATE.value,
                    metadata={"action": "mark_duplicate", "parent_report_id": ctx.parent_report_id},
                )

            return TransitionResult(
                allowed=False,
                error=f"Illegal status transition from '{current_status}' to '{target_status}'.",
            )

        return TransitionResult(
            allowed=False,
            error=f"Unknown role '{ctx.actor_role}'.",
        )

    @classmethod
    def apply_transition(
        cls,
        report: Report,
        target_status: str,
        ctx: TransitionContext,
        db: Optional[Session] = None,
    ) -> TransitionResult:
        """
        Validate and atomically execute a status transition on an existing Report model.
        Updates state, optimistic concurrency version, actor pointers, and appends
        a StatusHistory record to the audit trail.
        """
        # Automatically populate context from report if not explicitly provided
        effective_ctx = TransitionContext(
            actor_id=ctx.actor_id,
            actor_role=ctx.actor_role,
            actor_name=ctx.actor_name,
            assignee_id=ctx.assignee_id or report.assignee_id,
            work_completer_id=ctx.work_completer_id or report.work_completer_id,
            note=ctx.note,
            proof_image_id=ctx.proof_image_id or (report.images[0].id if report.images else None),
            proof_image_url=ctx.proof_image_url or (report.images[0].url if report.images else None),
            parent_report_id=ctx.parent_report_id or report.parent_report_id,
            is_ai_triggered=ctx.is_ai_triggered,
        )

        result = cls.validate_transition(report.status, target_status, effective_ctx)
        if not result.allowed:
            # Raise appropriate domain exception based on error type
            err = result.error or "Transition not allowed"
            if "not authorized" in err or "only update reports directly assigned" in err:
                raise UnauthorizedTransitionError(err)
            elif "Two-person rule" in err:
                raise TwoPersonRuleViolationError(err)
            elif "proof photo" in err:
                raise MissingEvidenceError(err)
            elif "at least 10 characters" in err:
                raise InvalidTransitionNoteError(err)
            else:
                raise IllegalTransitionError(err)

        from_status = report.status
        next_status = result.next_status or target_status
        now = utc_now()

        # Apply state changes to Report model
        report.status = next_status
        report.version = (report.version or 1) + 1
        report.updated_at = now

        if next_status == ReportStatus.WORK_COMPLETED.value:
            report.work_completer_id = ctx.actor_id
            report.work_completer_name = ctx.actor_name
            report.work_completed_at = now
        elif next_status == ReportStatus.RESOLVED.value:
            report.reviewer_id = ctx.actor_id
            report.reviewer_name = ctx.actor_name
            report.resolved_at = now
        elif next_status == ReportStatus.REJECTED.value:
            report.rejection_reason = ctx.note
        elif next_status == ReportStatus.ASSIGNED.value and from_status in (
            ReportStatus.WORK_COMPLETED.value,
            ReportStatus.REJECTED.value,
            ReportStatus.RESOLVED.value,
        ):
            report.reopen_reason = ctx.note
        elif next_status == ReportStatus.DUPLICATE.value:
            report.parent_report_id = effective_ctx.parent_report_id

        # Append StatusHistory audit timeline entry
        history_entry = StatusHistory(
            report_id=report.id,
            actor_id=ctx.actor_id,
            actor_name=ctx.actor_name,
            role=ctx.actor_role,
            from_status=from_status,
            to_status=next_status,
            note=ctx.note or f"Status transitioned from {from_status} to {next_status}",
            proof_image_id=effective_ctx.proof_image_id,
            proof_image_url=effective_ctx.proof_image_url,
            created_at=now,
        )

        if db is not None:
            db.add(history_entry)

            # Generate real citizen notification
            if report.reporter_id:
                notif_titles = {
                    ReportStatus.UNDER_REVIEW.value: f"Under Review: {report.reference_number}",
                    ReportStatus.VERIFIED.value: f"Complaint Verified: {report.reference_number}",
                    ReportStatus.ASSIGNED.value: f"Assigned: {report.reference_number}",
                    ReportStatus.IN_PROGRESS.value: f"Work In Progress: {report.reference_number}",
                    ReportStatus.WORK_COMPLETED.value: f"Work Completed: {report.reference_number}",
                    ReportStatus.RESOLVED.value: f"Resolved & Verified: {report.reference_number}",
                    ReportStatus.REJECTED.value: f"Report Update: {report.reference_number}",
                }
                notif_msgs = {
                    ReportStatus.UNDER_REVIEW.value: f"Your report '{report.title}' is now under municipal review.",
                    ReportStatus.VERIFIED.value: f"Your report '{report.title}' has been verified by dispatch.",
                    ReportStatus.ASSIGNED.value: f"Your report '{report.title}' has been dispatched to field maintenance.",
                    ReportStatus.IN_PROGRESS.value: f"Field technicians have commenced on-site work for '{report.title}'.",
                    ReportStatus.WORK_COMPLETED.value: f"Technician reported work finished with photographic evidence for '{report.title}'. Awaiting moderator verification.",
                    ReportStatus.RESOLVED.value: f"Your report '{report.title}' has been verified and officially signed off as Resolved!",
                    ReportStatus.REJECTED.value: f"Your report '{report.title}' was rejected: {ctx.note or 'Out of municipal scope'}",
                }
                title = notif_titles.get(next_status, f"Status Update: {report.reference_number}")
                msg = notif_msgs.get(next_status, f"Status changed to {next_status}: {ctx.note or ''}")
                notif = Notification(
                    user_id=report.reporter_id,
                    report_id=report.id,
                    title=title,
                    message=msg,
                    type="status_update" if next_status != ReportStatus.RESOLVED.value else "resolution",
                    created_at=now,
                )
                db.add(notif)

        return result

    @staticmethod
    def get_permitted_transitions(current_status: str, role: str) -> list[str]:
        """Return list of permitted next statuses for given status & role."""
        role_lower = role.lower()
        if role_lower in (UserRole.VISITOR.value, UserRole.CITIZEN.value):
            return []

        if role_lower == UserRole.STAFF.value:
            if current_status == ReportStatus.ASSIGNED.value:
                return [ReportStatus.IN_PROGRESS.value]
            if current_status == ReportStatus.IN_PROGRESS.value:
                return [ReportStatus.WORK_COMPLETED.value]
            return []

        if role_lower in (UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value):
            dispatch_map = {
                ReportStatus.SUBMITTED.value: [
                    ReportStatus.UNDER_REVIEW.value,
                    ReportStatus.REJECTED.value,
                    ReportStatus.DUPLICATE.value,
                ],
                ReportStatus.UNDER_REVIEW.value: [
                    ReportStatus.VERIFIED.value,
                    ReportStatus.REJECTED.value,
                    ReportStatus.DUPLICATE.value,
                ],
                ReportStatus.VERIFIED.value: [
                    ReportStatus.ASSIGNED.value,
                    ReportStatus.REJECTED.value,
                    ReportStatus.DUPLICATE.value,
                ],
                ReportStatus.ASSIGNED.value: [
                    ReportStatus.IN_PROGRESS.value,
                    ReportStatus.REJECTED.value,
                ],
                ReportStatus.IN_PROGRESS.value: [
                    ReportStatus.WORK_COMPLETED.value,
                    ReportStatus.ASSIGNED.value,
                    ReportStatus.REJECTED.value,
                ],
                ReportStatus.WORK_COMPLETED.value: [
                    ReportStatus.RESOLVED.value,
                    ReportStatus.REOPENED.value,
                ],
                ReportStatus.REJECTED.value: [
                    ReportStatus.REOPENED.value,
                ],
                ReportStatus.RESOLVED.value: [
                    ReportStatus.REOPENED.value,
                ],
            }
            return dispatch_map.get(current_status, [])

        return []

