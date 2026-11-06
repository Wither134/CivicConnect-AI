"""
CivicConnect AI - FastAPI Routers Package.
"""

from app.routers.auth import auth_router
from app.routers.reports import reports_router
from app.routers.admin import admin_router
from app.routers.staff import staff_router
from app.routers.locks import locks_router
from app.routers.public import public_router
from app.routers.gis import gis_router
from app.routers.audit import audit_router
from app.routers.superadmin import superadmin_router
from app.routers.notifications import notifications_router

__all__ = [
    "auth_router",
    "reports_router",
    "admin_router",
    "staff_router",
    "locks_router",
    "public_router",
    "gis_router",
    "audit_router",
    "superadmin_router",
    "notifications_router",
]

