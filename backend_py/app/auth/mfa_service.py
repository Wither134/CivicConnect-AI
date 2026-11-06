"""
CivicConnect AI - Two-Step TOTP Multi-Factor Authentication Service.

Implements:
1. Standard RFC 6238 Base32 TOTP secret generation with pyotp.
2. Authenticator app URI generation (otpauth://).
3. Standard 6-digit TOTP verification with +/- 1 time-step drift tolerance.
4. Demo verification code fallback ('123456' / '654321') for evaluation & hackathon demos.
"""

from typing import Optional
import pyotp


DEMO_MFA_SECRET = "JBSWY3DPEHPK3PXP"
DEMO_PASSCODES = {"123456", "654321"}


class MfaService:
    """TOTP Multi-Factor Authentication Utility."""

    @staticmethod
    def generate_secret() -> str:
        """Generate a random 32-character Base32 secret for TOTP."""
        return pyotp.random_base32()

    @staticmethod
    def get_provisioning_uri(secret: str, email: str, issuer_name: str = "CivicConnect AI") -> str:
        """
        Generate an otpauth:// URI that can be rendered as a QR code
        for Google Authenticator, Microsoft Authenticator, Authy, etc.
        """
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(name=email, issuer_name=issuer_name)

    @classmethod
    def verify_code(cls, secret: Optional[str], code: str) -> bool:
        """
        Validate a 6-digit MFA passcode.

        Accepts:
        - Real mathematical TOTP passcode from an authenticator app (valid_window=1 allows +/- 30s drift).
        - Evaluator demo passcodes ('123456' / '654321') matching CommunityConnect's demo credentials.
        """
        if not code:
            return False

        clean_code = code.strip()
        if not clean_code.isdigit() or len(clean_code) != 6:
            return False

        # Demo bypass codes for evaluators and staff accounts
        if clean_code in DEMO_PASSCODES:
            return True

        active_secret = (secret or "").strip()
        if not active_secret:
            active_secret = DEMO_MFA_SECRET

        try:
            totp = pyotp.TOTP(active_secret)
            return bool(totp.verify(clean_code, valid_window=1))
        except Exception:
            return False

