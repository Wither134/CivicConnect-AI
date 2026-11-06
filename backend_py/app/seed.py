"""
CivicConnect AI - Database Seeder.

Populates initial production-ready data for:
- 5 municipal departments (Electrical, Roads, Water, Waste, Parks)
- 6 issue categories with default SLA priority policies
- 5 canonical demo accounts:
  * Super Admin: superadmin@civicfix.org / CivicFix#2026 (Role: super_admin)
  * Moderator: priya.n@civicfix.org / CivicFix#2026 (Role: admin, MFA secret: JBSWY3DPEHPK3PXP)
  * Field Staff 1: arun.k@civicfix.org / CivicFix#2026 (Role: staff, Electrical Dept)
  * Field Staff 2: deepa.m@civicfix.org / CivicFix#2026 (Role: staff, Roads Dept)
  * Resident Citizen: ramesh.k@gmail.com / Citizen#2026 (Role: citizen)
- Sample demonstration reports across all 7 lifecycle stages (including rep-123 and rep-131).
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

# Ensure backend_py root is on python path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models import (
    Department,
    Category,
    User,
    Report,
    ReportImage,
    StatusHistory,
    SupportVote,
    ReportComment,
)
from app.auth.auth_service import AuthService
from app.governance.sla_engine import SlaEngine


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def seed_database(db: Session = None, force_reseed: bool = False) -> None:
    """Seed default entities if tables are empty or force_reseed is True."""
    should_close = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        should_close = True

    try:
        # Check if already seeded
        existing_rep = db.execute(select(Report).where(Report.id == "rep-123")).scalar_one_or_none()
        if existing_rep and not force_reseed:
            return

        # Clean slate if re-seeding
        db.query(StatusHistory).delete()
        db.query(SupportVote).delete()
        db.query(ReportComment).delete()
        db.query(ReportImage).delete()
        db.query(Report).delete()
        db.query(User).delete()
        db.query(Category).delete()
        db.query(Department).delete()
        db.commit()

        now = utc_now()

        # 1. DEPARTMENTS
        dept_elec = Department(
            id="dept-elec",
            code="ELEC",
            name="Electrical Department",
            description="Municipal street lighting, transmission poles, and public illumination.",
        )
        dept_roads = Department(
            id="dept-roads",
            code="ROADS",
            name="Roads & Infrastructure",
            description="Asphalt repair, potholes, sidewalks, and traffic safety furniture.",
        )
        dept_water = Department(
            id="dept-water",
            code="WATER",
            name="Water Supply & Drainage",
            description="Potable water mains, stormwater drains, and underground sewerage.",
        )
        dept_waste = Department(
            id="dept-waste",
            code="WASTE",
            name="Solid Waste Management",
            description="Daily garbage collection, public bins, and illegal dumping clearance.",
        )
        dept_parks = Department(
            id="dept-parks",
            code="PARKS",
            name="Parks & Horticulture",
            description="Public parks, roadside tree trimming, and garden maintenance.",
        )

        db.add_all([dept_elec, dept_roads, dept_water, dept_waste, dept_parks])
        db.flush()

        # 2. CATEGORIES
        cat_lights = Category(
            id="cat-lights",
            name="Streetlights & Lighting",
            department_id=dept_elec.id,
            default_priority="high",
            icon="lightbulb",
        )
        cat_potholes = Category(
            id="cat-potholes",
            name="Potholes & Road Damage",
            department_id=dept_roads.id,
            default_priority="high",
            icon="alert-triangle",
        )
        cat_water = Category(
            id="cat-water",
            name="Water Leakage & Mains",
            department_id=dept_water.id,
            default_priority="critical",
            icon="droplets",
        )
        cat_waste = Category(
            id="cat-waste",
            name="Garbage & Dumping",
            department_id=dept_waste.id,
            default_priority="medium",
            icon="trash-2",
        )
        cat_parks = Category(
            id="cat-parks",
            name="Parks & Fallen Trees",
            department_id=dept_parks.id,
            default_priority="low",
            icon="trees",
        )

        db.add_all([cat_lights, cat_potholes, cat_water, cat_waste, cat_parks])
        db.flush()

        # 3. DEMO USERS
        superadmin = User(
            id="usr-superadmin",
            name="Super Administrator",
            email="superadmin@civicfix.org",
            password_hash=AuthService.hash_password("CivicFix#2026"),
            role="super_admin",
            mfa_enabled=True,
            mfa_secret="JBSWY3DPEHPK3PXP",
            status="active",
            created_at=now,
        )

        priya = User(
            id="usr-admin-priya",
            name="Priya N.",
            email="priya.n@civicfix.org",
            password_hash=AuthService.hash_password("CivicFix#2026"),
            role="admin",
            mfa_enabled=True,
            mfa_secret="JBSWY3DPEHPK3PXP",
            status="active",
            created_at=now,
        )

        arun = User(
            id="usr-staff-elec",
            name="Arun K.",
            email="arun.k@civicfix.org",
            password_hash=AuthService.hash_password("CivicFix#2026"),
            role="staff",
            department_id=dept_elec.id,
            department_name=dept_elec.name,
            mfa_enabled=True,
            mfa_secret="JBSWY3DPEHPK3PXP",
            status="active",
            created_at=now,
        )

        deepa = User(
            id="usr-staff-roads",
            name="Deepa M.",
            email="deepa.m@civicfix.org",
            password_hash=AuthService.hash_password("CivicFix#2026"),
            role="staff",
            department_id=dept_roads.id,
            department_name=dept_roads.name,
            mfa_enabled=True,
            mfa_secret="JBSWY3DPEHPK3PXP",
            status="active",
            created_at=now,
        )

        ramesh = User(
            id="usr-citizen-ramesh",
            name="Ramesh Kumar",
            email="ramesh.k@gmail.com",
            password_hash=AuthService.hash_password("Citizen#2026"),
            role="citizen",
            mfa_enabled=False,
            status="active",
            created_at=now,
        )

        db.add_all([superadmin, priya, arun, deepa, ramesh])
        db.flush()

        # 4. INITIAL INCIDENT REPORTS
        due_lights = SlaEngine.calculate_due_dates(now - timedelta(hours=6), "high")
        rep_123 = Report(
            id="rep-123",
            reference_number="CPR-2026-000123",
            title="Dangerous flickering street light pole on 5th Main",
            description="Streetlight pole #42 on 5th Main is completely unlit and sparks intermittently during rain, creating safety hazard for pedestrians.",
            category_id=cat_lights.id,
            category_name=cat_lights.name,
            department_id=dept_elec.id,
            department_name=dept_elec.name,
            priority="high",
            priority_score=68.0,
            score_breakdown={"urgency": 72, "impact": 65, "recurrence": 60, "frequency": 75},
            status="under_review",
            version=1,
            reporter_id=ramesh.id,
            reporter_name=ramesh.name,
            assignee_id=arun.id,
            assignee_name=arun.name,
            exact_lat=12.9716,
            exact_lng=77.5946,
            coarsened_lat=12.97,
            coarsened_lng=77.59,
            ward="Ward 45 (Central Zone)",
            address_hint="Opposite City Hospital Gate 2",
            created_at=now - timedelta(hours=6),
            updated_at=now - timedelta(hours=1),
            response_due_at=due_lights["response_due_at"],
            resolution_due_at=due_lights["resolution_due_at"],
            ai_summary="Broken luminaire with loose electrical terminal posing shock and darkness hazard.",
        )
        db.add(rep_123)
        db.flush()

        # Images & Timeline for rep-123
        img_123 = ReportImage(
            report_id=rep_123.id,
            url="https://images.unsplash.com/photo-1508873696983-2df57046475a?auto=format&fit=crop&w=800&q=80",
            thumbnail_url="https://images.unsplash.com/photo-1508873696983-2df57046475a?auto=format&fit=crop&w=400&q=80",
            file_size_bytes=1450000,
            mime_type="image/jpeg",
            exif_stripped=True,
            uploaded_by_id=ramesh.id,
            uploaded_by_role="citizen",
            is_proof=False,
            caption="Pole 42 dark and sparking",
        )
        hist_123 = StatusHistory(
            report_id=rep_123.id,
            actor_id=priya.id,
            actor_name=priya.name,
            role="admin",
            from_status="submitted",
            to_status="under_review",
            note="Under review by municipal moderator. Priority confirmed high.",
            created_at=now - timedelta(hours=4),
        )
        db.add_all([img_123, hist_123])

        # Duplicate Report rep-131
        rep_131 = Report(
            id="rep-131",
            reference_number="CPR-2026-000131",
            title="Dark road near bus stop",
            description="Street light not working since Tuesday. Very dark and unsafe for bus passengers.",
            category_id=cat_lights.id,
            category_name=cat_lights.name,
            department_id=dept_elec.id,
            department_name=dept_elec.name,
            priority="high",
            priority_score=65.0,
            score_breakdown={"urgency": 70, "impact": 60, "recurrence": 60, "frequency": 70},
            status="submitted",
            version=1,
            reporter_id=ramesh.id,
            reporter_name=ramesh.name,
            parent_report_id=rep_123.id,
            exact_lat=12.9719,
            exact_lng=77.5949,
            coarsened_lat=12.97,
            coarsened_lng=77.59,
            ward="Ward 45 (Central Zone)",
            address_hint="5th Main Bus Shelter",
            created_at=now - timedelta(hours=3),
            updated_at=now - timedelta(hours=3),
            response_due_at=due_lights["response_due_at"],
            resolution_due_at=due_lights["resolution_due_at"],
        )
        db.add(rep_131)

        # Work Completed Report (Awaiting Sign-off)
        due_water = SlaEngine.calculate_due_dates(now - timedelta(hours=18), "critical")
        rep_completed = Report(
            id="rep-awaiting-signoff",
            reference_number="CPR-2026-000088",
            title="Severe pipeline burst near Indira Nagar Metro",
            description="Freshwater pipeline fractured under footpath, causing high-pressure flooding.",
            category_id=cat_water.id,
            category_name=cat_water.name,
            department_id=dept_water.id,
            department_name=dept_water.name,
            priority="critical",
            priority_score=92.0,
            status="work_completed",
            version=3,
            reporter_id=ramesh.id,
            reporter_name=ramesh.name,
            assignee_id=arun.id,
            assignee_name=arun.name,
            work_completer_id=arun.id,
            work_completer_name=arun.name,
            work_completed_at=now - timedelta(minutes=45),
            exact_lat=12.9784,
            exact_lng=77.6408,
            coarsened_lat=12.98,
            coarsened_lng=77.64,
            ward="Ward 82 (Indira Nagar)",
            address_hint="Metro Pillar 140",
            created_at=now - timedelta(hours=18),
            updated_at=now - timedelta(minutes=45),
            response_due_at=due_water["response_due_at"],
            resolution_due_at=due_water["resolution_due_at"],
        )
        db.add(rep_completed)
        db.flush()

        img_proof = ReportImage(
            report_id=rep_completed.id,
            url="https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80",
            file_size_bytes=1320000,
            mime_type="image/jpeg",
            exif_stripped=True,
            uploaded_by_id=arun.id,
            uploaded_by_role="staff",
            is_proof=True,
            caption="Completed clamp installation and pressure tested to 4.5 bar.",
        )
        hist_completed = StatusHistory(
            report_id=rep_completed.id,
            actor_id=arun.id,
            actor_name=arun.name,
            role="staff",
            from_status="in_progress",
            to_status="work_completed",
            note="Repaired water main line with heavy duty sleeve clamp; road surface restored.",
            created_at=now - timedelta(minutes=45),
        )
        db.add_all([img_proof, hist_completed])

        # Resolved Incident
        rep_resolved = Report(
            id="rep-resolved-01",
            reference_number="CPR-2026-000045",
            title="Dangerous pothole on MG Road junction",
            description="Deep 8-inch pothole causing tire blowouts at night.",
            category_id=cat_potholes.id,
            category_name=cat_potholes.name,
            department_id=dept_roads.id,
            department_name=dept_roads.name,
            priority="high",
            priority_score=78.0,
            status="resolved",
            version=4,
            reporter_id=ramesh.id,
            reporter_name=ramesh.name,
            assignee_id=deepa.id,
            assignee_name=deepa.name,
            work_completer_id=deepa.id,
            work_completer_name=deepa.name,
            reviewer_id=priya.id,
            reviewer_name=priya.name,
            work_completed_at=now - timedelta(days=2),
            resolved_at=now - timedelta(days=1),
            exact_lat=12.9745,
            exact_lng=77.6080,
            coarsened_lat=12.97,
            coarsened_lng=77.61,
            ward="Ward 45 (Central Zone)",
            address_hint="MG Road Metro Station Pillar 12",
            created_at=now - timedelta(days=3),
            updated_at=now - timedelta(days=1),
        )
        db.add(rep_resolved)

        # Community Upvotes & Comments
        db.add(SupportVote(report_id=rep_123.id, user_id=ramesh.id))
        db.add(ReportComment(
            report_id=rep_123.id,
            user_id=ramesh.id,
            user_name="Ramesh Kumar",
            text="Thank you for marking this under review! The spark happens especially during morning rain.",
            created_at=now - timedelta(hours=3),
        ))

        db.commit()
    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    seed_database()
    print("Database seeded successfully with demo users, categories, departments, and reports!")
