"""
CivicConnect AI - Governance & Compliance Engines.

Contains:
- state_machine: 7-stage report lifecycle, permitted transitions, two-person resolution rule.
- lock_manager: PostgreSQL-compatible soft locking with optimistic concurrency.
- sla_engine: Timezone-aware deadline calculation, countdowns, and priority recalculation.
- abuse_prevention: Daily citizen submission rate limiting, coordinate coarsening, profanity screening.
- audit_logger: Append-only administrative audit log with sanitized CSV export.
"""

from app.governance.state_machine import (
    StateMachine,
    ReportStatus,
    UserRole,
    TransitionContext,
    TransitionResult,
    StateMachineError,
    UnauthorizedTransitionError,
    IllegalTransitionError,
    TwoPersonRuleViolationError,
    MissingEvidenceError,
    InvalidTransitionNoteError,
)
from app.governance.lock_manager import (
    LockManager,
    LockConflictError,
    StaleVersionError,
)
from app.governance.sla_engine import (
    SlaEngine,
    SlaEvaluation,
    DEFAULT_SLA_POLICIES,
)
from app.governance.abuse_prevention import (
    AbusePrevention,
    check_citizen_daily_limit,
    coarsen_coordinates,
    scan_text_for_moderation,
)
from app.governance.audit_logger import (
    AuditLogger,
    sanitize_audit_details,
)

__all__ = [
    "StateMachine",
    "ReportStatus",
    "UserRole",
    "TransitionContext",
    "TransitionResult",
    "StateMachineError",
    "UnauthorizedTransitionError",
    "IllegalTransitionError",
    "TwoPersonRuleViolationError",
    "MissingEvidenceError",
    "InvalidTransitionNoteError",
    "LockManager",
    "LockConflictError",
    "StaleVersionError",
    "SlaEngine",
    "SlaEvaluation",
    "DEFAULT_SLA_POLICIES",
    "AbusePrevention",
    "check_citizen_daily_limit",
    "coarsen_coordinates",
    "scan_text_for_moderation",
    "AuditLogger",
    "sanitize_audit_details",
]

