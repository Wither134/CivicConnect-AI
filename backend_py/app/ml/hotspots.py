"""
Local Geographic Hotspot Detection using Scikit-Learn DBSCAN.

Clusters civic complaints using spatial coordinates and the Haversine metric.
Identifies recurring geographical problem clusters, dominant incident categories,
and cluster radius without external geocoding APIs.
"""

from dataclasses import dataclass
import math
from typing import Optional, Sequence
import numpy as np
from sklearn.cluster import DBSCAN


@dataclass
class HotspotCluster:
    cluster_id: int
    centroid_lat: float
    centroid_lng: float
    radius_meters: float
    report_count: int
    dominant_category: str
    category_breakdown: dict[str, int]
    report_codes: list[str]
    report_ids: list[int]
    highest_priority: str
    description: str


def haversine_dist(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in meters between two lat/lng pairs."""
    r = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2.0) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2.0) ** 2
    return r * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def detect_hotspots(
    reports: Sequence[object],
    eps_meters: float = 650.0,
    min_samples: int = 2,
) -> list[HotspotCluster]:
    """
    Run DBSCAN clustering on complaints with valid coordinates.
    Returns detected geographic hotspots.
    """
    # Filter reports with valid coordinates
    valid_reports = []
    for r in reports:
        lat = getattr(r, "latitude", None)
        lng = getattr(r, "longitude", None)
        if (
            lat is not None
            and lng is not None
            and not math.isnan(lat)
            and not math.isnan(lng)
        ):
            valid_reports.append(r)

    # Need at least min_samples with coordinates to form any cluster
    if len(valid_reports) < min_samples:
        return []

    # Extract coordinates array
    coords = np.array(
        [[getattr(r, "latitude"), getattr(r, "longitude")] for r in valid_reports]
    )

    # Convert coordinates to radians for the Haversine metric
    coords_rad = np.radians(coords)
    kms_per_radian = 6371.0
    eps_rad = (eps_meters / 1000.0) / kms_per_radian

    try:
        db = DBSCAN(eps=eps_rad, min_samples=min_samples, metric="haversine")
        labels = db.fit_predict(coords_rad)
    except Exception:
        return []

    unique_labels = set(labels)
    clusters: list[HotspotCluster] = []

    priority_rank = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1}

    for label in unique_labels:
        # Ignore noise points (label -1)
        if label == -1:
            continue

        cluster_indices = np.where(labels == label)[0]
        cluster_reports = [valid_reports[i] for i in cluster_indices]

        # Calculate centroid
        c_lats = [getattr(r, "latitude") for r in cluster_reports]
        c_lngs = [getattr(r, "longitude") for r in cluster_reports]
        mean_lat = float(np.mean(c_lats))
        mean_lng = float(np.mean(c_lngs))

        # Calculate radius (max distance of a cluster point from centroid)
        max_dist = 0.0
        for r in cluster_reports:
            d = haversine_dist(mean_lat, mean_lng, getattr(r, "latitude"), getattr(r, "longitude"))
            if d > max_dist:
                max_dist = d
        radius = max(50.0, round(max_dist, 1))

        # Category breakdown
        cat_counts: dict[str, int] = {}
        highest_prio = "Low"
        highest_prio_score = 0

        for r in cluster_reports:
            cat_val = getattr(r, "category_name", None) or getattr(r, "category", None)
            cat = cat_val.name if hasattr(cat_val, "name") else str(cat_val or "Uncategorized")
            cat_counts[cat] = cat_counts.get(cat, 0) + 1

            prio = getattr(r, "priority", None) or "Low"
            p_score = priority_rank.get(prio, 1)
            if p_score > highest_prio_score:
                highest_prio_score = p_score
                highest_prio = prio

        # Dominant category
        dominant_cat = max(cat_counts.items(), key=lambda x: x[1])[0]

        rep_codes = [getattr(r, "report_code", f"ID-{getattr(r, 'id', '')}") for r in cluster_reports]
        rep_ids = [getattr(r, "id", 0) for r in cluster_reports]

        desc = (
            f"Geographic hotspot with {len(cluster_reports)} incidents "
            f"clustered within ~{int(radius)}m. Primary issue: {dominant_cat}."
        )

        clusters.append(
            HotspotCluster(
                cluster_id=int(label),
                centroid_lat=round(mean_lat, 5),
                centroid_lng=round(mean_lng, 5),
                radius_meters=radius,
                report_count=len(cluster_reports),
                dominant_category=dominant_cat,
                category_breakdown=cat_counts,
                report_codes=rep_codes,
                report_ids=rep_ids,
                highest_priority=highest_prio,
                description=desc,
            )
        )

    # Sort clusters by incident count descending
    clusters.sort(key=lambda c: c.report_count, reverse=True)
    return clusters
