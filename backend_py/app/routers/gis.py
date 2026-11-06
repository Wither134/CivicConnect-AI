"""
CivicConnect AI - Geographic Information System (GIS) & Hotspot Analytics Router.

Endpoints:
- GET /api/gis/hotspots : Scikit-Learn DBSCAN density clustering of civic problem clusters
- GET /api/gis/nearby : Proximity spatial search around a geographic coordinate
"""

import math
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Report
from app.ml.hotspots import detect_hotspots, haversine_dist

gis_router = APIRouter(prefix="/api/gis", tags=["GIS & Analytics"])


@gis_router.get("/hotspots")
def get_hotspot_clusters(
    eps_meters: float = Query(650.0, ge=100.0, le=5000.0),
    min_samples: int = Query(2, ge=2, le=50),
    db: Session = Depends(get_db),
):
    """
    Run local offline DBSCAN spatial density clustering on active incident reports.
    Identifies geographic recurring hotspots, dominant incident categories, and spatial radius.
    """
    stmt = (
        select(Report)
        .where(Report.deleted_at.is_(None))
        .where(Report.status.notin_(["resolved", "rejected"]))
    )
    reports = db.execute(stmt).scalars().all()

    clusters = detect_hotspots(reports, eps_meters=eps_meters, min_samples=min_samples)

    result = []
    for c in clusters:
        result.append({
            "clusterId": c.cluster_id,
            "centroidLat": c.centroid_lat,
            "centroidLng": c.centroid_lng,
            "radiusMeters": round(c.radius_meters, 1),
            "reportCount": c.report_count,
            "dominantCategory": c.dominant_category,
            "categoryBreakdown": c.category_breakdown,
            "highestPriority": c.highest_priority,
            "description": c.description,
            "reportCodes": c.report_codes,
        })

    return {
        "clusterCount": len(result),
        "clusters": result,
    }


@gis_router.get("/nearby")
def get_nearby_reports(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lng: float = Query(..., ge=-180.0, le=180.0),
    radius_km: float = Query(2.0, ge=0.1, le=50.0),
    db: Session = Depends(get_db),
):
    """Search for incident reports within radius_km from a given coordinate."""
    stmt = select(Report).where(Report.deleted_at.is_(None))
    all_reports = db.execute(stmt).scalars().all()

    radius_meters = radius_km * 1000.0
    nearby = []

    for r in all_reports:
        r_lat = r.exact_lat or r.coarsened_lat
        r_lng = r.exact_lng or r.coarsened_lng
        if r_lat is not None and r_lng is not None:
            dist = haversine_dist(lat, lng, r_lat, r_lng)
            if dist <= radius_meters:
                nearby.append({
                    "id": r.id,
                    "referenceNumber": r.reference_number,
                    "title": r.title,
                    "category": r.category_name,
                    "status": r.status,
                    "priority": r.priority,
                    "coarsenedLat": r.coarsened_lat,
                    "coarsenedLng": r.coarsened_lng,
                    "distanceMeters": round(dist, 1),
                })

    nearby.sort(key=lambda x: x["distanceMeters"])
    return {"count": len(nearby), "reports": nearby}

