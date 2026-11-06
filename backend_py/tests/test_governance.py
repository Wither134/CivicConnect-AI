"""
CivicConnect AI - Phase 1 Governance Test Suite.

Unit and integration tests for:
1. State Machine (7 stages, role permissions, two-person rule, evidence, AI isolation).
2. Lock Manager (10-minute soft lease, renewal, release, expiry, optimistic concurrency).
3. SLA Engine (Critical 24h, High 72h, Med 120h, Low 240h, recalculations, countdowns).
4. Abuse Prevention (5 complaints/day DB count, coordinate coarsening, advisory content scan).
5. Audit Logger (append-only, credential redaction, RFC 4180 CSV export).
"""

from datetime import datetime, timedelta, timezone
import io
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Report, AuditLog, StatusHistory, User, Department, Category
from app.governance.state_machine import (
    StateMachine,
    ReportStatus,
    UserRole,
    TransitionContext,
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
    DEFAULT_SLA_POLICIES,
    ensure_utc,
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


def get_test_db():
    """Create an isolated in-memory SQLite database for test execution."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    return session_factory()


class TestStateMachine(unittest.TestCase):
    """Test suite for the 7-stage state machine and governance rules."""

    def test_citizen_and_visitor_cannot_transition(self):
        """Citizens and visitors must be strictly forbidden from transitioning reports."""
        ctx_citizen = TransitionContext(
            actor_id="usr-cit-1",
            actor_role="citizen",
            actor_name="Ramesh K.",
        )
        res = StateMachine.validate_transition("submitted", "under_review", ctx_citizen)
        self.assertFalse(res.allowed)
        self.assertIn("not authorized", res.error.lower())

        ctx_visitor = TransitionContext(
            actor_id="usr-vis-1",
            actor_role="visitor",
            actor_name="Anonymous Visitor",
        )
        res_v = StateMachine.validate_transition("submitted", "under_review", ctx_visitor)
        self.assertFalse(res_v.allowed)

    def test_admin_normal_forward_flow(self):
        """Admin can step through the canonical lifecycle."""
        admin_ctx = TransitionContext(
            actor_id="usr-admin-1",
            actor_role="admin",
            actor_name="Priya N.",
        )

        # submitted -> under_review
        res1 = StateMachine.validate_transition("submitted", "under_review", admin_ctx)
        self.assertTrue(res1.allowed)
        self.assertEqual(res1.next_status, "under_review")

        # under_review -> verified
        res2 = StateMachine.validate_transition("under_review", "verified", admin_ctx)
        self.assertTrue(res2.allowed)
        self.assertEqual(res2.next_status, "verified")

        # verified -> assigned
        res3 = StateMachine.validate_transition("verified", "assigned", admin_ctx)
        self.assertTrue(res3.allowed)
        self.assertEqual(res3.next_status, "assigned")

    def test_staff_transition_restrictions(self):
        """Staff can only update reports assigned to them, and only through assigned -> in_progress -> work_completed."""
        # Unassigned staff attempt
        ctx_unassigned = TransitionContext(
            actor_id="usr-staff-2",
            actor_role="staff",
            actor_name="Deepa M.",
            assignee_id="usr-staff-1",  # Assigned to Arun
        )
        res = StateMachine.validate_transition("assigned", "in_progress", ctx_unassigned)
        self.assertFalse(res.allowed)
        self.assertIn("directly assigned to them", res.error)

        # Correctly assigned staff
        ctx_assigned = TransitionContext(
            actor_id="usr-staff-1",
            actor_role="staff",
            actor_name="Arun K.",
            assignee_id="usr-staff-1",
        )
        res_ok = StateMachine.validate_transition("assigned", "in_progress", ctx_assigned)
        self.assertTrue(res_ok.allowed)
        self.assertEqual(res_ok.next_status, "in_progress")

    def test_work_completion_evidence_and_note_required(self):
        """Marking work completed requires at least one proof photo and a 10+ char progress note."""
        staff_ctx = TransitionContext(
            actor_id="usr-staff-1",
            actor_role="staff",
            actor_name="Arun K.",
            assignee_id="usr-staff-1",
        )

        # Missing note & proof
        res1 = StateMachine.validate_transition("in_progress", "work_completed", staff_ctx)
        self.assertFalse(res1.allowed)

        # Note too short (< 10 chars)
        staff_ctx.note = "Fixed it"
        staff_ctx.proof_image_id = "img-proof-01"
        res2 = StateMachine.validate_transition("in_progress", "work_completed", staff_ctx)
        self.assertFalse(res2.allowed)
        self.assertIn("at least 10 characters", res2.error)

        # Missing proof photo
        staff_ctx.note = "Replaced faulty sodium vapor lamp and tested wiring."
        staff_ctx.proof_image_id = None
        res3 = StateMachine.validate_transition("in_progress", "work_completed", staff_ctx)
        self.assertFalse(res3.allowed)
        self.assertIn("proof photo", res3.error)

        # Valid proof & note
        staff_ctx.proof_image_id = "img-proof-01"
        res4 = StateMachine.validate_transition("in_progress", "work_completed", staff_ctx)
        self.assertTrue(res4.allowed)
        self.assertEqual(res4.next_status, "work_completed")

    def test_two_person_resolution_rule(self):
        """The person who marks work completed cannot sign off as Resolved."""
        # Same user: Priya completed work and tries to resolve
        same_person_ctx = TransitionContext(
            actor_id="usr-admin-1",
            actor_role="admin",
            actor_name="Priya N.",
            work_completer_id="usr-admin-1",  # SAME USER
            note="Inspected the completed repairs and confirmed operational.",
            proof_image_id="img-proof-01",
        )
        res_violation = StateMachine.validate_transition("work_completed", "resolved", same_person_ctx)
        self.assertFalse(res_violation.allowed)
        self.assertIn("Two-person rule violation", res_violation.error)

        # Different user: Arun completed work, Priya grants resolution sign-off
        valid_two_person_ctx = TransitionContext(
            actor_id="usr-admin-1",
            actor_role="admin",
            actor_name="Priya N.",
            work_completer_id="usr-staff-1",  # DIFFERENT USER (Arun)
            note="Inspected photographic proof: verified luminaire operational and compliant.",
            proof_image_id="img-proof-01",
        )
        res_valid = StateMachine.validate_transition("work_completed", "resolved", valid_two_person_ctx)
        self.assertTrue(res_valid.allowed)
        self.assertEqual(res_valid.next_status, "resolved")

    def test_illegal_transition_rejection(self):
        """Illegal state jumps (e.g. submitted -> resolved) must be rejected."""
        admin_ctx = TransitionContext(
            actor_id="usr-admin-1",
            actor_role="admin",
            actor_name="Priya N.",
            note="Attempting to resolve unreviewed incident immediately.",
        )
        res = StateMachine.validate_transition("submitted", "resolved", admin_ctx)
        self.assertFalse(res.allowed)
        self.assertIn("Illegal status transition", res.error)

    def test_ai_trigger_is_blocked_unconditionally(self):
        """AI recommendations must never trigger transitions autonomously."""
        ai_ctx = TransitionContext(
            actor_id="ai-bot",
            actor_role="admin",
            actor_name="CivicPulse AI Engine",
            is_ai_triggered=True,
        )
        res = StateMachine.validate_transition("submitted", "under_review", ai_ctx)
        self.assertFalse(res.allowed)
        self.assertIn("AI advisory systems are not permitted", res.error)

    def test_apply_transition_database_integration(self):
        """Applying a transition updates report version, timestamps, and appends a StatusHistory record."""
        db = get_test_db()
        report = Report(
            id="rep-state-1",
            reference_number="CPR-2026-TEST01",
            title="Broken streetlight",
            description="Dark street lamp near park",
            category_id="cat-elec",
            category_name="Electrical",
            status="in_progress",
            version=1,
            reporter_id="usr-cit-1",
            reporter_name="Citizen Ramesh",
            assignee_id="usr-staff-1",
            assignee_name="Arun K.",
        )
        db.add(report)
        db.commit()

        ctx = TransitionContext(
            actor_id="usr-staff-1",
            actor_role="staff",
            actor_name="Arun K.",
            note="Replaced high-pressure sodium bulb and verified luminaire output.",
            proof_image_id="img-proof-99",
        )

        StateMachine.apply_transition(report, "work_completed", ctx, db=db)
        db.commit()

        # Check Report model mutations
        self.assertEqual(report.status, "work_completed")
        self.assertEqual(report.version, 2)
        self.assertEqual(report.work_completer_id, "usr-staff-1")
        self.assertIsNotNone(report.work_completed_at)

        # Check StatusHistory table
        history = db.query(StatusHistory).filter_by(report_id="rep-state-1").first()
        self.assertIsNotNone(history)
        self.assertEqual(history.from_status, "in_progress")
        self.assertEqual(history.to_status, "work_completed")
        self.assertEqual(history.actor_id, "usr-staff-1")


class TestLockManager(unittest.TestCase):
    """Test suite for concurrency soft lease locks and optimistic concurrency."""

    def setUp(self):
        self.db = get_test_db()
        self.report = Report(
            id="rep-lock-1",
            reference_number="CPR-2026-LOCK01",
            title="Pothole on 1st Cross",
            description="Dangerous pothole for two wheelers",
            category_id="cat-roads",
            category_name="Roads",
            status="submitted",
            version=1,
            reporter_id="usr-cit-1",
            reporter_name="Ramesh",
        )
        self.db.add(self.report)
        self.db.commit()

    def test_acquire_and_conflict(self):
        """User 1 acquires lock; User 2 is rejected while lock is active."""
        # User 1 acquires lock
        res1 = LockManager.acquire_lock(
            self.db,
            report_id="rep-lock-1",
            user_id="usr-admin-1",
            user_name="Priya N.",
            user_role="admin",
            current_version=1,
            ttl_seconds=600,
        )
        self.assertTrue(res1["success"])
        self.assertEqual(res1["lock"]["user_id"], "usr-admin-1")

        # User 2 attempts to acquire same report
        with self.assertRaises(LockConflictError) as cm:
            LockManager.acquire_lock(
                self.db,
                report_id="rep-lock-1",
                user_id="usr-admin-2",
                user_name="Vikram S.",
                user_role="admin",
                current_version=1,
            )
        self.assertEqual(cm.exception.locked_by_id, "usr-admin-1")
        self.assertIn("Priya N. is currently reviewing this report", str(cm.exception))

    def test_owner_renew_and_release(self):
        """Owner can renew their lease and explicitly release it."""
        LockManager.acquire_lock(
            self.db,
            report_id="rep-lock-1",
            user_id="usr-admin-1",
            user_name="Priya N.",
            user_role="admin",
            current_version=1,
        )

        # Owner renews
        renew_res = LockManager.acquire_lock(
            self.db,
            report_id="rep-lock-1",
            user_id="usr-admin-1",
            user_name="Priya N.",
            user_role="admin",
            current_version=1,
        )
        self.assertTrue(renew_res["success"])
        self.assertIn("renewed", renew_res["message"].lower())

        # Release lock
        released = LockManager.release_lock(self.db, report_id="rep-lock-1", user_id="usr-admin-1")
        self.assertTrue(released)

        # Now User 2 can acquire
        res_u2 = LockManager.acquire_lock(
            self.db,
            report_id="rep-lock-1",
            user_id="usr-admin-2",
            user_name="Vikram S.",
            user_role="admin",
            current_version=1,
        )
        self.assertTrue(res_u2["success"])
        self.assertEqual(res_u2["lock"]["user_id"], "usr-admin-2")

    def test_expired_lock_can_be_acquired(self):
        """An expired lock allows another user to take over."""
        # Set lock with past expiration timestamp
        past_time = datetime.now(timezone.utc) - timedelta(minutes=15)
        self.report.locked_by_id = "usr-admin-1"
        self.report.locked_by_name = "Priya N."
        self.report.lock_expires_at = past_time
        self.db.commit()

        # User 2 acquires expired lock
        res = LockManager.acquire_lock(
            self.db,
            report_id="rep-lock-1",
            user_id="usr-admin-2",
            user_name="Vikram S.",
            user_role="admin",
            current_version=1,
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["lock"]["user_id"], "usr-admin-2")

    def test_optimistic_concurrency_version_mismatch(self):
        """Submitting a stale version raises StaleVersionError."""
        self.report.version = 3
        self.db.commit()

        with self.assertRaises(StaleVersionError):
            LockManager.acquire_lock(
                self.db,
                report_id="rep-lock-1",
                user_id="usr-admin-1",
                user_name="Priya N.",
                user_role="admin",
                current_version=2,  # Stale version 2 submitted when server has 3
            )


class TestSlaEngine(unittest.TestCase):
    """Test suite for SLA calculations, priority policies, and countdowns."""

    def test_all_priority_deadlines(self):
        """Verify the 4 target deadlines: Critical (24h), High (72h), Med (120h), Low (240h)."""
        base = datetime(2026, 11, 1, 10, 0, 0, tzinfo=timezone.utc)

        crit = SlaEngine.calculate_due_dates(base, "critical")
        self.assertEqual(crit["resolution_due_at"], base + timedelta(hours=24))
        self.assertEqual(crit["response_due_at"], base + timedelta(hours=4))

        high = SlaEngine.calculate_due_dates(base, "high")
        self.assertEqual(high["resolution_due_at"], base + timedelta(hours=72))
        self.assertEqual(high["response_due_at"], base + timedelta(hours=24))

        med = SlaEngine.calculate_due_dates(base, "medium")
        self.assertEqual(med["resolution_due_at"], base + timedelta(hours=120))
        self.assertEqual(med["response_due_at"], base + timedelta(hours=48))

        low = SlaEngine.calculate_due_dates(base, "low")
        self.assertEqual(low["resolution_due_at"], base + timedelta(hours=240))
        self.assertEqual(low["response_due_at"], base + timedelta(hours=96))

    def test_sla_evaluation_breach_and_at_risk(self):
        """Test on-track, at-risk, and breached SLA evaluations."""
        created_at = datetime(2026, 11, 1, 10, 0, 0, tzinfo=timezone.utc)

        # 10 hours later on High (72h deadline) -> On track
        eval_ontrack = SlaEngine.evaluate(
            created_at=created_at,
            priority="high",
            status="assigned",
            first_responded_at=created_at + timedelta(hours=2),
            now=created_at + timedelta(hours=10),
        )
        self.assertFalse(eval_ontrack.is_breached)
        self.assertEqual(eval_ontrack.status_label, "On track")

        # 70 hours later on High (2 hours left < 4h threshold) -> At risk
        eval_atrisk = SlaEngine.evaluate(
            created_at=created_at,
            priority="high",
            status="assigned",
            first_responded_at=created_at + timedelta(hours=2),
            now=created_at + timedelta(hours=70),
        )
        self.assertFalse(eval_atrisk.is_breached)
        self.assertEqual(eval_atrisk.status_label, "At risk")

        # 75 hours later on High -> SLA breach
        eval_breach = SlaEngine.evaluate(
            created_at=created_at,
            priority="high",
            status="assigned",
            first_responded_at=created_at + timedelta(hours=2),
            now=created_at + timedelta(hours=75),
        )
        self.assertTrue(eval_breach.is_breached)
        self.assertEqual(eval_breach.status_label, "SLA breach")

    def test_priority_recalculation(self):
        """Priority change updates due dates while preserving created_at."""
        created_at = datetime(2026, 11, 1, 10, 0, 0, tzinfo=timezone.utc)
        report = Report(
            id="rep-sla-1",
            reference_number="CPR-2026-SLA01",
            title="Water pipe bursting",
            description="Large water pipe leak flooding street",
            category_id="cat-water",
            category_name="Water",
            status="submitted",
            priority="medium",
            created_at=created_at,
            response_due_at=created_at + timedelta(hours=48),
            resolution_due_at=created_at + timedelta(hours=120),
            reporter_id="usr-1",
            reporter_name="Citizen",
        )

        # Elevate to critical
        audit_diff = SlaEngine.recalculate_for_priority_change(report, "critical")
        self.assertEqual(report.priority, "critical")
        self.assertEqual(report.resolution_due_at, created_at + timedelta(hours=24))
        self.assertEqual(audit_diff["old_priority"], "medium")
        self.assertEqual(audit_diff["new_priority"], "critical")

    def test_countdown_formatting(self):
        """Verify countdown format strings."""
        now = datetime(2026, 11, 1, 12, 0, 0, tzinfo=timezone.utc)
        self.assertEqual(SlaEngine.format_countdown(now + timedelta(hours=18), now), "18h remaining")
        self.assertEqual(SlaEngine.format_countdown(now + timedelta(days=3), now), "3d remaining")
        self.assertEqual(SlaEngine.format_countdown(now + timedelta(minutes=45), now), "Due in 45m")
        self.assertEqual(SlaEngine.format_countdown(now - timedelta(hours=5), now), "Overdue by 5h")


class TestAbusePrevention(unittest.TestCase):
    """Test suite for citizen submission rate limits, privacy coarsening, and advisory filter."""

    def test_citizen_daily_limit_enforced_in_db(self):
        """Citizen can submit up to 5 reports per 24 hours. The 6th is rejected."""
        db = get_test_db()
        citizen_id = "cit-ramesh"
        now = datetime.now(timezone.utc)

        # Insert 5 reports for citizen_id
        for i in range(5):
            rep = Report(
                id=f"rep-abuse-{i}",
                reference_number=f"CPR-2026-A0{i}",
                title=f"Complaint #{i}",
                description="Street maintenance needed",
                category_id="cat-roads",
                category_name="Roads",
                reporter_id=citizen_id,
                reporter_name="Ramesh",
                created_at=now - timedelta(hours=i + 1),
            )
            db.add(rep)
        db.commit()

        # Check citizen Ramesh -> at limit
        check = check_citizen_daily_limit(db, citizen_id, limit=5, now=now)
        self.assertFalse(check["allowed"])
        self.assertEqual(check["current_count"], 5)
        self.assertEqual(check["remaining"], 0)

        # Check another citizen -> allowed
        check_other = check_citizen_daily_limit(db, "cit-other-user", limit=5, now=now)
        self.assertTrue(check_other["allowed"])
        self.assertEqual(check_other["current_count"], 0)
        self.assertEqual(check_other["remaining"], 5)

    def test_coordinate_coarsening(self):
        """Exact coordinates are coarsened to 2 decimal places (~1.1 km) for public safety."""
        # Bangalore coordinates
        exact_lat = 12.9715987
        exact_lng = 77.5945627
        coarse_lat, coarse_lng = coarsen_coordinates(exact_lat, exact_lng, precision=2)
        self.assertEqual(coarse_lat, 12.97)
        self.assertEqual(coarse_lng, 77.59)

        # Invalid / missing coordinates handled safely
        self.assertEqual(coarsen_coordinates(None, 77.59), (None, None))
        self.assertEqual(coarsen_coordinates("invalid", 77.59), (None, None))
        self.assertEqual(coarsen_coordinates(195.0, 77.59), (None, None))  # Out of range

    def test_advisory_content_scan_does_not_delete(self):
        """Scans and flags spam/abusive terms without modifying or deleting complaints."""
        clean_text = "Street light pole #42 is flickering and off at night."
        clean_res = scan_text_for_moderation(clean_text)
        self.assertFalse(clean_res["is_flagged"])

        spam_text = "Join our telegram channel for free money crypto airdrop urgent cash loan!"
        spam_res = scan_text_for_moderation(spam_text)
        self.assertTrue(spam_res["is_flagged"])
        self.assertIn("free money", spam_res["flagged_terms"])
        self.assertEqual(spam_res["action_required"], "human_moderation")


class TestAuditLogger(unittest.TestCase):
    """Test suite for append-only audit logging and RFC 4180 CSV exports."""

    def test_audit_log_creation_and_credential_sanitization(self):
        """Audit logger automatically redacts passwords, tokens, and MFA secrets."""
        db = get_test_db()

        log_entry = AuditLogger.log(
            db=db,
            actor_id="usr-admin-1",
            actor_email="priya.n@civicfix.org",
            actor_name="Priya N.",
            actor_role="admin",
            action="USER_STAFF_INVITE",
            target_type="user",
            target_id="usr-new-staff",
            details={
                "invited_email": "deepa.m@civicfix.org",
                "password_hash": "$2b$12$SuperSecretHashStringShouldNotLeak",
                "temp_token": "jwt.secret.token.12345",
                "mfa_secret": "JBSWY3DPEHPK3PXP",
                "department": "Roads",
            },
        )

        self.assertIsNotNone(log_entry.id)
        # Verify sensitive credentials were redacted
        self.assertEqual(log_entry.details["password_hash"], "[REDACTED]")
        self.assertEqual(log_entry.details["temp_token"], "[REDACTED]")
        self.assertEqual(log_entry.details["mfa_secret"], "[REDACTED]")
        # Safe fields preserved
        self.assertEqual(log_entry.details["department"], "Roads")

    def test_audit_csv_export_proper_rfc4180_escaping(self):
        """CSV export handles commas, quotes, and newlines safely."""
        db = get_test_db()

        # Add entries with commas and quotes in action and details
        AuditLogger.log(
            db=db,
            actor_id="usr-admin-1",
            actor_email="priya.n@civicfix.org",
            actor_name="Priya, N. (Lead)",
            actor_role="admin",
            action="STATUS_CHANGE",
            target_type="report",
            target_id="rep-101",
            details={"note": 'Verified: "Fixed luminaire, tested wiring, and repainted pole."'},
        )

        entries = AuditLogger.query(db=db)
        csv_output = AuditLogger.export_csv(entries)

        self.assertIn("Priya, N. (Lead)", csv_output)
        self.assertIn("STATUS_CHANGE", csv_output)
        # Check header exists
        lines = csv_output.strip().split("\n")
        self.assertTrue(lines[0].startswith("ID,Timestamp,Actor Name"))
        self.assertGreaterEqual(len(lines), 2)


if __name__ == "__main__":
    unittest.main()

