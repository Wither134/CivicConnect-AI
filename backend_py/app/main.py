"""
CivicConnect AI - Master FastAPI Application.

Tagline: Report. Collaborate. Resolve. Improve.

Binds:
- Database lifecycle & automatic seeder on startup
- Complete CORS middleware for local Vite and production clients
- All 9 governance & operational API routers (/api/*)
- Static client asset delivery & SPA fallback to React 19 frontend
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import os
from pathlib import Path
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine, SessionLocal
from app.seed import seed_database
from app.routers import (
    auth_router,
    public_router,
    reports_router,
    staff_router,
    admin_router,
    superadmin_router,
    locks_router,
    gis_router,
    audit_router,
    notifications_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: Initialize database schema and seed initial demo data."""
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_database(db)
    yield


app = FastAPI(
    title="CivicConnect AI API",
    description="Unified AI-Powered Civic Incident Reporting & Resolution Platform.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register All API Routers
app.include_router(auth_router)
app.include_router(public_router)
app.include_router(reports_router)
app.include_router(staff_router)
app.include_router(admin_router)
app.include_router(superadmin_router)
app.include_router(locks_router)
app.include_router(gis_router)
app.include_router(audit_router)
app.include_router(notifications_router)


# Health Check
@app.get("/api/health")
def health_check():
    """Service health and diagnostic status."""
    return {
        "status": "healthy",
        "service": "CivicConnect AI API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": engine.dialect.name,
    }


# Static Frontend Delivery (SPA Fallback)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DIST_DIR = BASE_DIR / "dist"
ASSETS_DIR = DIST_DIR / "assets"

if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa_or_fallback(full_path: str):
    """
    Serve static React SPA assets or fallback to index.html for client-side routing.
    Never intercepts /api/* calls.
    """
    if full_path.startswith("api/"):
        return JSONResponse(status_code=404, content={"error": "API endpoint not found"})

    target_file = DIST_DIR / full_path
    if target_file.is_file():
        return FileResponse(target_file)

    index_html = DIST_DIR / "index.html"
    if index_html.is_file():
        return FileResponse(index_html)

    return Response(
        content="CivicConnect AI FastAPI Server is running. Frontend static build pending.",
        media_type="text/plain",
    )

