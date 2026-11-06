"""
CivicConnect AI - Authentication Package.
"""

from app.auth.mfa_service import MfaService, DEMO_MFA_SECRET, DEMO_PASSCODES
from app.auth.auth_service import (
    AuthService,
    AuthError,
    InvalidCredentialsError,
    AccountDeactivatedError,
    RolePortalMismatchError,
    MfaVerificationError,
    TokenExpiredOrInvalidError,
)
from app.auth.dependencies import (
    get_current_user,
    get_current_user_optional,
    require_role,
    extract_token_from_request,
)

__all__ = [
    "MfaService",
    "DEMO_MFA_SECRET",
    "DEMO_PASSCODES",
    "AuthService",
    "AuthError",
    "InvalidCredentialsError",
    "AccountDeactivatedError",
    "RolePortalMismatchError",
    "MfaVerificationError",
    "TokenExpiredOrInvalidError",
    "get_current_user",
    "get_current_user_optional",
    "require_role",
    "extract_token_from_request",
]

