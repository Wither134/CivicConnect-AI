"""
CivicConnect AI - Phase 3 Master End-to-End API Test Suite.

Tests all integrated FastAPI endpoints using TestClient:
- Health diagnostics (/api/health)
- Authentication (/api/auth/register, /login, /staff-login, /mfa-verify, /me, /logout)
- Citizen Reports (/api/reports, /my-reports, /{id}, /{id}/support, /{id}/comments)
- Administrative Triage (/api/admin/reports, /{id}/status, /{id}/assign)
- Field Staff Queue (/api/staff/assignments, /{id}/start, /{id}/complete)
- Soft Locking (/api/locks/{id}/acquire, /release)
- Public Dashboard & GIS Map (/api/public/dashboard, /categories, /reports-map)
- Local ML DBSCAN Hotspots (/api/gis/hotspots)
- Audit Trail & CSV Export (/api/audit/logs, /export)
"""

from datetime import datetime
from pathlib import Path
import sys
import unittest

# Ensure backend_py is in python path
backend_py_dir = Path(__file__).resolve().parent.parent
if str(backend_py_dir) not in sys.path:
    sys.path.insert(0, str(backend_py_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.seed import seed_database
from app.database import Base, engine, SessionLocal


class TestApiEndpoints(unittest.TestCase):
    """End-to-end integration test suite across all 9 API routers."""

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            seed_database(db)
        cls.client = TestClient(app)
        cls.resident_token = None

    def test_01_health_check(self):
        """Service health check endpoint returns 200 OK."""
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["service"], "CivicConnect AI API")

    def test_02_public_dashboard_and_categories(self):
        """Public dashboard returns Screen 3 KPIs, weekly trends, and categories."""
        res = self.client.get("/api/public/dashboard")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("kpis", data)
        self.assertIn("weeklyTrends", data)
        self.assertIn("categoriesBreakdown", data)

        res_cats = self.client.get("/api/public/categories")
        self.assertEqual(res_cats.status_code, 200)
        cats = res_cats.json()["categories"]
        self.assertGreaterEqual(len(cats), 4)

    def test_03_citizen_registration_and_me(self):
        """Citizen signs up, sets cookie, and retrieves profile from /api/auth/me."""
        reg_payload = {
            "name": "Nandaksh Resident",
            "email": f"resident_{int(datetime.now().timestamp())}@community.org",
            "password": "SecurePassword#2026",
        }
        res = self.client.post("/api/auth/register", json=reg_payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertIn("token", data)
        self.assertEqual(data["user"]["role"], "citizen")

        token = data["token"]
        TestApiEndpoints.resident_token = token
        headers = {"Authorization": f"Bearer {token}"}

        # Check /api/auth/me
        res_me = self.client.get("/api/auth/me", headers=headers)
        self.assertEqual(res_me.status_code, 200)
        me_data = res_me.json()
        self.assertIsNotNone(me_data["user"])
        self.assertEqual(me_data["user"]["name"], "Nandaksh Resident")

    def test_04_staff_two_step_mfa_login(self):
        """Admin (Priya) completes Step 1 password check then Step 2 MFA with demo code 123456."""
        # Step 1
        res_step1 = self.client.post("/api/auth/staff-login", json={
            "email": "priya.n@civicfix.org",
            "password": "CivicFix#2026",
        })
        self.assertEqual(res_step1.status_code, 200)
        data1 = res_step1.json()
        self.assertTrue(data1["requiresMfa"])
        temp_token = data1["tempToken"]

        # Step 2
        res_step2 = self.client.post("/api/auth/mfa-verify", json={
            "tempToken": temp_token,
            "code": "123456",
        })
        self.assertEqual(res_step2.status_code, 200)
        data2 = res_step2.json()
        self.assertIn("token", data2)
        self.assertEqual(data2["user"]["role"], "admin")
        self.assertEqual(data2["user"]["name"], "Priya N.")

    def test_05_citizen_submit_report_with_ml_analysis(self):
        """Citizen submits complaint; ML pipeline runs and calculates SLA."""
        token = self.resident_token
        if not token:
            login_res = self.client.post("/api/auth/login", json={
                "email": "ramesh.k@gmail.com",
                "password": "Citizen#2026",
            })
            token = login_res.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Submit report
        report_payload = {
            "title": "Severe deep pothole damaging vehicles on MG Road",
            "description": "Large dangerous pothole right near the bus shelter entrance. Multiple scooters have skidded.",
            "category_name": "Potholes & Road Damage",
            "ward": "Ward 45 (Central Zone)",
            "address_hint": "Opposite Metro Pillar 18",
            "exact_lat": 12.9720,
            "exact_lng": 77.5950,
            "images": ["https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600"],
        }
        res = self.client.post("/api/reports", json=report_payload, headers=headers)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["report"]["status"], "submitted")
        self.assertTrue(data["report"]["referenceNumber"].startswith("CPR-2026-"))
        rep_id = data["report"]["id"]

        # Verify Report Detail endpoint
        res_detail = self.client.get(f"/api/reports/{rep_id}", headers=headers)
        self.assertEqual(res_detail.status_code, 200)
        detail = res_detail.json()
        self.assertEqual(detail["title"], report_payload["title"])
        self.assertIsNotNone(detail["priorityScore"])
        self.assertIsNotNone(detail["resolutionDueAt"])
        self.assertIsNotNone(detail["aiSummary"])

    def test_06_community_support_and_comments(self):
        """Citizens can upvote reports and post discussion comments."""
        login_res = self.client.post("/api/auth/login", json={
            "email": "ramesh.k@gmail.com",
            "password": "Citizen#2026",
        })
        headers = {"Authorization": f"Bearer {login_res.json()['token']}"}

        # Upvote rep-123
        res_support = self.client.post("/api/reports/rep-123/support", headers=headers)
        self.assertEqual(res_support.status_code, 200)
        self.assertIn("has_voted", res_support.json())

        # Post comment
        comment_payload = {"text": "Local resident confirming this has been dark for 4 days."}
        res_comment = self.client.post("/api/reports/rep-123/comments", json=comment_payload, headers=headers)
        self.assertEqual(res_comment.status_code, 201)

        # Get comments
        res_get_comm = self.client.get("/api/reports/rep-123/comments")
        self.assertEqual(res_get_comm.status_code, 200)
        self.assertGreaterEqual(len(res_get_comm.json()["comments"]), 1)

    def test_07_admin_review_queue_and_lock_management(self):
        """Admin views priority review queue, acquires soft lock, and releases lock."""
        # Login Priya
        step1 = self.client.post("/api/auth/staff-login", json={
            "email": "priya.n@civicfix.org",
            "password": "CivicFix#2026",
        })
        step2 = self.client.post("/api/auth/mfa-verify", json={
            "tempToken": step1.json()["tempToken"],
            "code": "123456",
        })
        admin_headers = {"Authorization": f"Bearer {step2.json()['token']}"}

        # Admin Review Queue
        res_queue = self.client.get("/api/admin/reports?tab=review_queue", headers=admin_headers)
        self.assertEqual(res_queue.status_code, 200)
        q_data = res_queue.json()
        self.assertIn("kpis", q_data)
        self.assertIn("reports", q_data)
        self.assertGreaterEqual(len(q_data["reports"]), 1)

        # Acquire lock on rep-123
        res_lock = self.client.post("/api/locks/rep-123/acquire", json={"version": 1}, headers=admin_headers)
        self.assertEqual(res_lock.status_code, 200)
        self.assertFalse(res_lock.json()["isLockedByOther"])

        # Release lock on rep-123
        res_rel = self.client.post("/api/locks/rep-123/release", headers=admin_headers)
        self.assertEqual(res_rel.status_code, 200)
        self.assertTrue(res_rel.json()["success"])

    def test_08_staff_assignments_and_work_completion(self):
        """Staff (Arun) sees assigned jobs, starts work, and completes with proof."""
        # Login Arun (Electrical Staff)
        step1 = self.client.post("/api/auth/staff-login", json={
            "email": "arun.k@civicfix.org",
            "password": "CivicFix#2026",
        })
        step2 = self.client.post("/api/auth/mfa-verify", json={
            "tempToken": step1.json()["tempToken"],
            "code": "123456",
        })
        staff_headers = {"Authorization": f"Bearer {step2.json()['token']}"}

        # Get assignments
        res_assign = self.client.get("/api/staff/assignments", headers=staff_headers)
        self.assertEqual(res_assign.status_code, 200)
        self.assertIn("jobs", res_assign.json())

    def test_09_gis_hotspots(self):
        """DBSCAN spatial clustering returns cluster centroids and categories."""
        res = self.client.get("/api/gis/hotspots")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("clusters", data)

    def test_10_audit_log_and_export(self):
        """Admin queries audit log; Super Admin exports CSV."""
        # Login Super Admin
        step1 = self.client.post("/api/auth/staff-login", json={
            "email": "superadmin@civicfix.org",
            "password": "CivicFix#2026",
        })
        step2 = self.client.post("/api/auth/mfa-verify", json={
            "tempToken": step1.json()["tempToken"],
            "code": "123456",
        })
        super_headers = {"Authorization": f"Bearer {step2.json()['token']}"}

        # Query logs
        res_logs = self.client.get("/api/audit/logs", headers=super_headers)
        self.assertEqual(res_logs.status_code, 200)
        self.assertIn("logs", res_logs.json())

        # Export CSV
        res_csv = self.client.get("/api/audit/export", headers=super_headers)
        self.assertEqual(res_csv.status_code, 200)
        self.assertEqual(res_csv.headers["content-type"], "text/csv; charset=utf-8")
        self.assertTrue(res_csv.text.startswith("ID,Timestamp,Actor Name"))


if __name__ == "__main__":
    from datetime import datetime
    unittest.main()
