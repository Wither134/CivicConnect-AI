"""
CivicConnect AI - FastAPI Authentication & RBAC Dependencies.

Implements:
1. get_current_user: Extract Bearer token or cookie, verify JWT, check 15-minute idle timeout for staff.
2. get_current_user_optional: Soft auth for public/explore routes.
3. require_role: Role-Based Access Control gate (citizen, staff, admin, super_admin).
"""

from datetime import datetime, timezone
from typing import Optional, Sequence
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.auth.auth_service import AuthService, TokenExpiredOrInvalidError


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

IDLE_TIMEOUT_SECONDS = 15 * 60  # 15 minutes of inactivity for staff/admin roles


def extract_token_from_request(request: Request, header_token: Optional[str]) -> Optional[str]:
    """Extract token from Authorization header or civicfix_token cookie."""
    if header_token:
        return header_token

    # Check cookies
    cookie_token = request.cookies.get("civicfix_token") or request.cookies.get("access_token")
    if cookie_token:
        return cookie_token

    # Check Authorization header directly if not caught by OAuth2PasswordBearer
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:].strip()

    return None


def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency: Resolves and verifies the authenticated User.
    Raises HTTP 401 if token is missing, expired, or invalid.
    """
    raw_token = extract_token_from_request(request, token)
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = AuthService.verify_token(raw_token)
    except TokenExpiredOrInvalidError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 15-minute idle timeout check for privileged staff/admin roles
    role = payload.get("role")
    if role in ("staff", "admin", "super_admin"):
        last_active_ms = payload.get("lastActive")
        if last_active_ms:
            now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
            elapsed_seconds = (now_ms - last_active_ms) / 1000.0
            if elapsed_seconds > IDLE_TIMEOUT_SECONDS:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={
                        "error": "Session expired due to 15 minutes of inactivity. Please sign in again.",
                        "code": "SESSION_IDLE_TIMEOUT",
                    },
                    headers={"WWW-Authenticate": "Bearer"},
                )

    user_id = payload.get("userId") or payload.get("sub")
    user = db.get(User, user_id)

    if not user or user.status == "deactivated":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User session not found or inactive.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_current_user_optional(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    FastAPI dependency: Resolves user if valid token present; returns None otherwise.
    Used on public endpoints that support personalized views when logged in.
    """
    raw_token = extract_token_from_request(request, token)
    if not raw_token:
        return None

    try:
        payload = AuthService.verify_token(raw_token)
        user_id = payload.get("userId") or payload.get("sub")
        user = db.get(User, user_id)
        if user and user.status != "deactivated":
            return user
    except Exception:
        pass

    return None


def require_role(allowed_roles: Sequence[str]):
    """
    Role-Based Access Control dependency factory.
    Enforces that current_user.role is one of allowed_roles.
    """
    def role_verifier(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            formatted_roles = " or ".join(allowed_roles)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": (
                        f"403 Forbidden: You do not have permission to access this resource. "
                        f"Required role: {formatted_roles}. Your role: {current_user.role}."
                    ),
                    "code": "ROLE_FORBIDDEN",
                },
            )
        return current_user

    return role_verifier

