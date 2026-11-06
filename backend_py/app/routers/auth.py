"""
CivicConnect AI - Authentication Router.

Endpoints:
- POST /api/auth/register : Citizen self-registration
- POST /api/auth/login : Citizen single-step login
- POST /api/auth/staff-login : Staff/Admin step 1 (password -> tempToken)
- POST /api/auth/mfa-verify : Staff/Admin step 2 (tempToken + TOTP code -> accessToken)
- GET  /api/auth/me : Current authenticated session
- POST /api/auth/logout : Session invalidation and cookie clearing
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.auth.auth_service import (
    AuthService,
    AuthError,
    InvalidCredentialsError,
    RolePortalMismatchError,
    MfaVerificationError,
)
from app.auth.dependencies import get_current_user_optional
from app.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    StaffLoginRequest,
    MfaVerifyRequest,
)

auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@auth_router.post("/register", status_code=status.HTTP_201_CREATED)
def register_citizen(
    payload: UserRegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Citizen self-service sign up. Strictly enforces the Citizen role."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    try:
        user, token = AuthService.register_citizen(
            db=db,
            name=payload.name,
            email=payload.email,
            password=payload.password,
            ip_address=client_ip,
        )
    except AuthError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    response.set_cookie(
        key="civicfix_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=8 * 3600,
    )

    return {
        "message": "Citizen account registered successfully.",
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }


@auth_router.post("/login")
def login_citizen(
    payload: UserLoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Citizen sign in with email and password."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    try:
        user, token = AuthService.login_citizen(
            db=db,
            email=payload.email,
            password=payload.password,
            ip_address=client_ip,
        )
    except RolePortalMismatchError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except InvalidCredentialsError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except AuthError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    response.set_cookie(
        key="civicfix_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=8 * 3600,
    )

    return {
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        },
    }


@auth_router.post("/staff-login")
def staff_login_step1(
    payload: StaffLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Staff/Admin login step 1: verifies password and returns temporary MFA token."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    try:
        result = AuthService.initiate_staff_login(
            db=db,
            email=payload.email,
            password=payload.password,
            ip_address=client_ip,
        )
        return result
    except RolePortalMismatchError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except InvalidCredentialsError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except AuthError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@auth_router.post("/mfa-verify")
def staff_login_step2_mfa(
    payload: MfaVerifyRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Staff/Admin login step 2: verifies 6-digit TOTP code and returns 8-hour access token."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    try:
        user, token = AuthService.complete_mfa_login(
            db=db,
            temp_token=payload.tempToken,
            code=payload.code,
            ip_address=client_ip,
        )
    except MfaVerificationError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))
    except AuthError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    response.set_cookie(
        key="civicfix_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=8 * 3600,
    )

    return {
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "departmentId": user.department_id,
            "departmentName": user.department_name,
        },
    }


@auth_router.get("/me")
def get_current_user_profile(
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Retrieve profile of the currently logged-in user session."""
    if not current_user:
        return {"user": None}

    return {
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role,
            "departmentId": current_user.department_id,
            "departmentName": current_user.department_name,
            "mfaEnabled": current_user.mfa_enabled,
            "lastLogin": current_user.last_login.isoformat() if current_user.last_login else None,
        }
    }


@auth_router.post("/logout")
def logout(response: Response):
    """Clear session authentication cookies."""
    response.delete_cookie(key="civicfix_token")
    response.delete_cookie(key="access_token")
    return {"message": "Signed out successfully."}

