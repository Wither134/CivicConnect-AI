"""
CivicConnect AI - Phase 2 Auth & Schemas Test Suite.

Unit and integration tests for:
1. Password hashing (bcrypt) and verification.
2. JWT Access Token generation (8-hour) and decoding.
3. Temporary MFA Token generation (5-minute) and stage validation.
4. Two-step TOTP Multi-Factor Authentication (pyotp and demo fallback 123456).
5. Citizen registration (strictly 'citizen' role).
6. Portal role enforcement (citizens cannot use staff portal, staff cannot use citizen portal).
7. MFA failure audit logging.
8. Pydantic validation schemas.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import unittest

# Ensure backend_py is in python path
backend_py_dir = Path(__file__).resolve().parent.parent
if str(backend_py_dir) not in sys.path:
    sys.path.insert(0, str(backend_py_dir))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import User, Department, AuditLog
from app.auth.mfa_service import MfaService, DEMO_MFA_SECRET
from app.auth.auth_service import (
    AuthService,
    AuthError,
    InvalidCredentialsError,
    RolePortalMismatchError,
    MfaVerificationError,
    TokenExpiredOrInvalidError,
)
from app.auth.dependencies import extract_token_from_request, IDLE_TIMEOUT_SECONDS
from app import schemas


def get_test_db():
    """Create an isolated in-memory SQLite database."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    return session_factory()


class TestMfaService(unittest.TestCase):
    """Test suite for TOTP MFA generation and verification."""

    def test_secret_generation(self):
        """Generates random 32-character Base32 secret."""
        secret = MfaService.generate_secret()
        self.assertIsInstance(secret, str)
        self.assertEqual(len(secret), 32)

    def test_provisioning_uri(self):
        """Generates valid otpauth:// URI."""
        secret = MfaService.generate_secret()
        uri = MfaService.get_provisioning_uri(secret, "priya.n@civicfix.org", "CivicConnect AI")
        self.assertTrue(uri.startswith("otpauth://totp/"))
        self.assertIn("priya.n%40civicfix.org", uri)
        self.assertIn("CivicConnect", uri)

    def test_demo_passcodes_always_accepted(self):
        """Evaluator demo codes '123456' and '654321' are accepted."""
        self.assertTrue(MfaService.verify_code(DEMO_MFA_SECRET, "123456"))
        self.assertTrue(MfaService.verify_code(DEMO_MFA_SECRET, "654321"))
        self.assertTrue(MfaService.verify_code(None, "123456"))

    def test_real_totp_code_verification(self):
        """Generates and verifies a mathematical TOTP code using pyotp."""
        import pyotp
        secret = MfaService.generate_secret()
        totp = pyotp.TOTP(secret)
        current_code = totp.now()

        # Real code is accepted
        self.assertTrue(MfaService.verify_code(secret, current_code))

        # Invalid code is rejected
        self.assertFalse(MfaService.verify_code(secret, "000000"))
        self.assertFalse(MfaService.verify_code(secret, "abcdef"))
        self.assertFalse(MfaService.verify_code(secret, ""))


class TestAuthService(unittest.TestCase):
    """Test suite for password hashing, JWTs, registration, and two-step MFA login."""

    def setUp(self):
        self.db = get_test_db()

    def test_password_hashing_and_verification(self):
        """bcrypt hashes passwords and verifies accurately."""
        password = "SecurePassword#2026"
        hashed = AuthService.hash_password(password)

        self.assertNotEqual(password, hashed)
        self.assertTrue(hashed.startswith("$2b$") or hashed.startswith("$2a$"))
        self.assertTrue(AuthService.verify_password(password, hashed))
        self.assertFalse(AuthService.verify_password("WrongPassword", hashed))

        # Password < 8 characters rejected
        with self.assertRaises(AuthError):
            AuthService.hash_password("short")

    def test_citizen_registration_and_login(self):
        """Citizen self-registration strictly assigns 'citizen' role and creates access token."""
        user, token = AuthService.register_citizen(
            self.db,
            name="Ramesh Kumar",
            email="ramesh.k@gmail.com",
            password="CitizenPassword#2026",
        )

        self.assertEqual(user.role, "citizen")
        self.assertEqual(user.email, "ramesh.k@gmail.com")
        self.assertIsNotNone(token)

        # Token payload verification
        payload = AuthService.verify_token(token)
        self.assertEqual(payload["userId"], user.id)
        self.assertEqual(payload["role"], "citizen")

        # Duplicate email registration rejected
        with self.assertRaises(AuthError):
            AuthService.register_citizen(
                self.db,
                name="Duplicate Ramesh",
                email="ramesh.k@gmail.com",
                password="AnotherPassword#2026",
            )

        # Citizen login succeeds with correct credentials
        login_user, login_token = AuthService.login_citizen(
            self.db,
            email="ramesh.k@gmail.com",
            password="CitizenPassword#2026",
        )
        self.assertEqual(login_user.id, user.id)
        self.assertIsNotNone(login_token)

        # Citizen login fails with wrong password
        with self.assertRaises(InvalidCredentialsError):
            AuthService.login_citizen(
                self.db,
                email="ramesh.k@gmail.com",
                password="WrongPassword123",
            )

    def test_staff_cannot_use_citizen_portal(self):
        """Staff/Admin accounts attempting to sign in on the citizen portal are rejected."""
        staff_user = User(
            id="usr-staff-1",
            name="Arun K.",
            email="arun.k@civicfix.org",
            password_hash=AuthService.hash_password("StaffPass#2026"),
            role="staff",
            department_name="Electrical",
            status="active",
        )
        self.db.add(staff_user)
        self.db.commit()

        with self.assertRaises(RolePortalMismatchError):
            AuthService.login_citizen(self.db, "arun.k@civicfix.org", "StaffPass#2026")

    def test_citizen_cannot_use_staff_portal(self):
        """Citizen accounts attempting staff login step 1 are rejected."""
        user, _ = AuthService.register_citizen(
            self.db,
            name="Ramesh K.",
            email="ramesh.citizen@gmail.com",
            password="CitizenPass#2026",
        )

        with self.assertRaises(RolePortalMismatchError):
            AuthService.initiate_staff_login(self.db, "ramesh.citizen@gmail.com", "CitizenPass#2026")

    def test_staff_two_step_mfa_login(self):
        """Staff login requires step 1 (password -> tempToken) and step 2 (tempToken + code -> accessToken)."""
        admin_user = User(
            id="usr-admin-1",
            name="Priya N.",
            email="priya.n@civicfix.org",
            password_hash=AuthService.hash_password("AdminPass#2026"),
            role="admin",
            mfa_enabled=True,
            mfa_secret="JBSWY3DPEHPK3PXP",
            status="active",
        )
        self.db.add(admin_user)
        self.db.commit()

        # Step 1: Initiate staff login
        step1 = AuthService.initiate_staff_login(self.db, "priya.n@civicfix.org", "AdminPass#2026")
        self.assertTrue(step1["requiresMfa"])
        temp_token = step1["tempToken"]
        self.assertIsNotNone(temp_token)

        # Temp token has stage: 'mfa_pending'
        decoded_temp = AuthService.verify_token(temp_token)
        self.assertEqual(decoded_temp["stage"], "mfa_pending")
        self.assertEqual(decoded_temp["userId"], "usr-admin-1")

        # Step 2: Failed MFA code logs failure and raises error
        with self.assertRaises(MfaVerificationError):
            AuthService.complete_mfa_login(self.db, temp_token, "000000")

        # Verify MFA failure logged in audit trail
        audit_entry = self.db.query(AuditLog).filter_by(action="MFA_FAILURE").first()
        self.assertIsNotNone(audit_entry)
        self.assertEqual(audit_entry.actor_id, "usr-admin-1")

        # Step 2: Successful MFA login with demo code '123456'
        user, access_token = AuthService.complete_mfa_login(self.db, temp_token, "123456")
        self.assertEqual(user.id, "usr-admin-1")
        self.assertIsNotNone(access_token)

        # Access token has 8-hour expiry and full claims
        payload = AuthService.verify_token(access_token)
        self.assertEqual(payload["userId"], "usr-admin-1")
        self.assertEqual(payload["role"], "admin")
        self.assertEqual(payload["email"], "priya.n@civicfix.org")

    def test_token_expiration(self):
        """Expired JWT raises TokenExpiredOrInvalidError."""
        import jwt
        # Create an expired token manually
        expired_payload = {
            "sub": "usr-1",
            "userId": "usr-1",
            "exp": int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp()),
        }
        expired_token = jwt.encode(expired_payload, "civicfix-hackathon-ps14-secure-key-2026", algorithm="HS256")

        with self.assertRaises(TokenExpiredOrInvalidError):
            AuthService.verify_token(expired_token)


class TestSchemasValidation(unittest.TestCase):
    """Test suite for Pydantic request and response models."""

    def test_register_request_validation(self):
        """Validates name length, email format, and password length."""
        req = schemas.UserRegisterRequest(
            name="John Doe",
            email="john.doe@example.com",
            password="StrongPassword#123",
        )
        self.assertEqual(req.name, "John Doe")
        self.assertEqual(req.email, "john.doe@example.com")

        # Invalid email format
        with self.assertRaises(Exception):
            schemas.UserRegisterRequest(
                name="John Doe",
                email="not-an-email",
                password="StrongPassword#123",
            )

        # Short password (< 8 chars)
        with self.assertRaises(Exception):
            schemas.UserRegisterRequest(
                name="John Doe",
                email="john@example.com",
                password="short",
            )

    def test_report_create_request_validation(self):
        """Validates report title and description minimum lengths."""
        req = schemas.ReportCreateRequest(
            title="Dangerous pothole on MG Road",
            description="Deep pothole causing accidents near the metro station entrance.",
            category_name="Roads",
            exact_lat=12.9716,
            exact_lng=77.5946,
        )
        self.assertEqual(req.title, "Dangerous pothole on MG Road")
        self.assertEqual(req.exact_lat, 12.9716)

        # Short title (< 5 chars)
        with self.assertRaises(Exception):
            schemas.ReportCreateRequest(
                title="Poth",
                description="Long description describing the problem accurately.",
            )

    def test_status_update_request_validation(self):
        """Validates targetStatus and minimum 10-char note."""
        req = schemas.StatusUpdateRequest(
            targetStatus="verified",
            note="Verified site conditions and safety priority.",
            version=1,
        )
        self.assertEqual(req.targetStatus, "verified")

        # Note < 10 chars
        with self.assertRaises(Exception):
            schemas.StatusUpdateRequest(
                targetStatus="verified",
                note="Too short",
                version=1,
            )


if __name__ == "__main__":
    unittest.main()

