"""
CivicConnect AI - Security & RBAC Verification Test Suite.

Verifies all 10 security scenarios specified in the security remediation task:
1. Visitor cannot access moderator/admin functions (HTTP 401).
2. Visitor cannot access Super Admin functions (HTTP 401).
3. Resident cannot promote themselves or alter roles.
4. Resident cannot access moderator or Super Admin APIs (HTTP 403).
5. Moderator cannot access Super Admin endpoints (HTTP 403).
6. Unauthenticated requests to all protected endpoints are rejected (HTTP 401).
7. Client-side token tampering or forged claims are rejected (HTTP 401).
8. Demo role switching cannot grant actual backend permissions without authentic DB user.
9. Staff/technicians cannot access administrative triage or sign-off operations (HTTP 403).
10. Super Admin self-demotion lockout prevention.
"""

from pathlib import Path
import sys
import unittest
import jwt

backend_py_dir = Path(__file__).resolve().parent.parent
if str(backend_py_dir) not in sys.path:
    sys.path.insert(0, str(backend_py_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.seed import seed_database
from app.database import Base, engine, SessionLocal
from app.auth.auth_service import AuthService, JWT_SECRET, JWT_ALGORITHM


class TestSecurityRbac(unittest.TestCase):
    """Rigorous RBAC and Authentication Security Test Suite."""

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            seed_database(db)
        cls.client = TestClient(app)

        # 1. Acquire Resident / Citizen token
        res_citizen = cls.client.post("/api/auth/login", json={
            "email": "ramesh.k@gmail.com",
            "password": "Citizen#2026",
        })
        assert res_citizen.status_code == 200, res_citizen.text
        cls.citizen_token = res_citizen.json()["token"]
        cls.citizen_headers = {"Authorization": f"Bearer {cls.citizen_token}"}

        # 2. Acquire Staff / Field Technician token
        s1_staff = cls.client.post("/api/auth/staff-login", json={
            "email": "arun.k@civicfix.org",
            "password": "CivicFix#2026",
        })
        assert s1_staff.status_code == 200
        s2_staff = cls.client.post("/api/auth/mfa-verify", json={
            "tempToken": s1_staff.json()["tempToken"],
            "code": "123456",
        })
        assert s2_staff.status_code == 200
        cls.staff_token = s2_staff.json()["token"]
        cls.staff_headers = {"Authorization": f"Bearer {cls.staff_token}"}

        # 3. Acquire Moderator / Admin token
        s1_admin = cls.client.post("/api/auth/staff-login", json={
            "email": "priya.n@civicfix.org",
            "password": "CivicFix#2026",
        })
        assert s1_admin.status_code == 200
        s2_admin = cls.client.post("/api/auth/mfa-verify", json={
            "tempToken": s1_admin.json()["tempToken"],
            "code": "123456",
        })
        assert s2_admin.status_code == 200
        cls.admin_token = s2_admin.json()["token"]
        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}

        # 4. Acquire Super Admin token
        s1_super = cls.client.post("/api/auth/staff-login", json={
            "email": "superadmin@civicfix.org",
            "password": "CivicFix#2026",
        })
        assert s1_super.status_code == 200
        s2_super = cls.client.post("/api/auth/mfa-verify", json={
            "tempToken": s1_super.json()["tempToken"],
            "code": "123456",
        })
        assert s2_super.status_code == 200
        cls.super_token = s2_super.json()["token"]
        cls.super_headers = {"Authorization": f"Bearer {cls.super_token}"}

    def test_01_visitor_cannot_access_moderator_queue(self):
        """Scenario 1: Unauthenticated visitors calling /api/admin/reports get 401 Unauthorized."""
        clean_client = TestClient(app)
        res = clean_client.get("/api/admin/reports")
        self.assertEqual(res.status_code, 401)
        self.assertIn("Authentication required", res.json()["detail"])

    def test_02_visitor_cannot_access_superadmin_users(self):
        """Scenario 2: Unauthenticated visitors calling /api/superadmin/users get 401 Unauthorized."""
        clean_client = TestClient(app)
        res = clean_client.get("/api/superadmin/users")
        self.assertEqual(res.status_code, 401)
        self.assertIn("Authentication required", res.json()["detail"])

    def test_03_resident_cannot_access_moderator_queue(self):
        """Scenario 4a: Authenticated resident attempting to access moderator review queue gets 403 Forbidden."""
        res = self.client.get("/api/admin/reports", headers=self.citizen_headers)
        self.assertEqual(res.status_code, 403)
        data = res.json()["detail"]
        self.assertEqual(data["code"], "ROLE_FORBIDDEN")
        self.assertIn("admin or super_admin", data["error"])

    def test_04_resident_cannot_access_superadmin_apis(self):
        """Scenario 4b: Authenticated resident attempting to access Super Admin user management gets 403 Forbidden."""
        res = self.client.get("/api/superadmin/users", headers=self.citizen_headers)
        self.assertEqual(res.status_code, 403)
        data = res.json()["detail"]
        self.assertEqual(data["code"], "ROLE_FORBIDDEN")
        self.assertIn("super_admin", data["error"])

    def test_05_resident_cannot_promote_themselves(self):
        """Scenario 3: Resident cannot promote themselves or alter roles via role endpoint."""
        res = self.client.put(
            "/api/superadmin/users/usr-citizen-ramesh/role",
            json={"role": "super_admin"},
            headers=self.citizen_headers,
        )
        self.assertEqual(res.status_code, 403)

    def test_06_moderator_cannot_access_superadmin_settings(self):
        """Scenario 5: Moderator (Priya) attempting to access Super Admin management gets 403 Forbidden."""
        res = self.client.get("/api/superadmin/users", headers=self.admin_headers)
        self.assertEqual(res.status_code, 403)
        data = res.json()["detail"]
        self.assertEqual(data["code"], "ROLE_FORBIDDEN")
        self.assertIn("super_admin", data["error"])

        # Also cannot access audit export CSV
        res_export = self.client.get("/api/audit/export", headers=self.admin_headers)
        self.assertEqual(res_export.status_code, 403)

    def test_07_staff_cannot_access_admin_triage(self):
        """Field Staff (Arun) cannot access review queue or triage actions."""
        res = self.client.get("/api/admin/reports", headers=self.staff_headers)
        self.assertEqual(res.status_code, 403)

    def test_08_tampered_or_forged_token_is_rejected(self):
        """Scenario 7: Client modifying role claim in a forged JWT without server secret gets 401 Unauthorized."""
        # Forge a token signed with an invalid secret
        fake_payload = {
            "sub": "usr-citizen",
            "userId": "usr-citizen",
            "role": "super_admin",
            "name": "Attacker",
            "email": "attacker@evil.com",
            "exp": 9999999999,
        }
        forged_token = jwt.encode(fake_payload, "wrong_secret_key_12345678901234567890", algorithm="HS256")
        forged_headers = {"Authorization": f"Bearer {forged_token}"}

        res = self.client.get("/api/superadmin/users", headers=forged_headers)
        self.assertEqual(res.status_code, 401)
        self.assertIn("Signature verification failed", res.json()["detail"])

    def test_09_demo_preview_token_cannot_bypass_backend(self):
        """Scenario 8: Client-side preview tokens (e.g. preview-admin) get 401 Unauthorized on backend."""
        preview_headers = {"Authorization": "Bearer preview-admin-token-not-signed"}
        clean_client = TestClient(app)
        res = clean_client.get("/api/admin/reports", headers=preview_headers)
        self.assertEqual(res.status_code, 401)

    def test_10_superadmin_cannot_demote_themselves(self):
        """Scenario 10: Super Admin cannot demote themselves to prevent administrative lockout."""
        res = self.client.put(
            "/api/superadmin/users/usr-superadmin/role",
            json={"role": "citizen"},
            headers=self.super_headers,
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("cannot demote themselves", res.json()["detail"])


if __name__ == "__main__":
    unittest.main()
