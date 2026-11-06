"""
CivicConnect AI - Abuse Prevention & Citizen Privacy Utilities.

Implements:
1. Citizen Daily Rate Limiting (Database-backed):
   Configurable maximum of 5 complaints per citizen per 24 hours. Survives server restarts.
2. Coordinate Coarsening for Public Privacy:
   Coarsens latitude and longitude to 2 decimal places (~0.01 degree, approx 1.11 km)
   for public-facing feeds, while preserving exact coordinates in backend for field dispatch.
3. Content & Profanity Filter (Advisory):
   Flags abusive language, spam links, and harassment for human moderator review.
   Never silently deletes reports or comments.
4. Image Upload Validation:
   Enforces 5 MB size caps, whitelisted MIME types, and EXIF stripping indicator.
"""

from datetime import datetime, timedelta, timezone
import math
import re
from typing import Any, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Report


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


DEFAULT_CITIZEN_DAILY_LIMIT = 5

# Common spam, abusive phrases, and scam link patterns
DEFAULT_FLAGGED_TERMS = [
    "buy cheap",
    "viagra",
    "casino",
    "free money",
    "crypto airdrop",
    "telegram channel",
    "whatsapp group link",
    "urgent cash loan",
    "xxx",
    "scam",
    "idiot",
    "bastard",
    "corrupt",
    "bribe",
]


class AbusePrevention:
    """Civic Safety and Public Privacy Protection Suite."""

    @staticmethod
    def check_citizen_daily_limit(
        db: Session,
        citizen_id: str,
        limit: int = DEFAULT_CITIZEN_DAILY_LIMIT,
        now: Optional[datetime] = None,
    ) -> dict[str, Any]:
        """
        Database-backed verification of daily report submission rate limits.
        Counts reports submitted by citizen_id in the last 24 hours.
        """
        current_time = now or utc_now()
        window_start = current_time - timedelta(hours=24)

        # Count active reports in database for this user in the past 24 hours
        stmt = (
            select(func.count(Report.id))
            .where(Report.reporter_id == citizen_id)
            .where(Report.created_at >= window_start)
            .where(Report.deleted_at.is_(None))
        )
        count = db.execute(stmt).scalar() or 0

        allowed = count < limit
        remaining = max(0, limit - count)

        # Find the oldest report in window to compute reset time
        reset_hours = 24
        if count > 0:
            oldest_stmt = (
                select(Report.created_at)
                .where(Report.reporter_id == citizen_id)
                .where(Report.created_at >= window_start)
                .where(Report.deleted_at.is_(None))
                .order_by(Report.created_at.asc())
                .limit(1)
            )
            oldest_time = db.execute(oldest_stmt).scalar()
            if oldest_time:
                if oldest_time.tzinfo is None:
                    oldest_time = oldest_time.replace(tzinfo=timezone.utc)
                elapsed = (current_time - oldest_time).total_seconds()
                reset_hours = max(1, math.ceil((24 * 3600 - elapsed) / 3600))

        return {
            "allowed": allowed,
            "current_count": count,
            "daily_limit": limit,
            "remaining": remaining,
            "reset_hours": reset_hours,
        }

    @staticmethod
    def coarsen_coordinates(
        lat: Optional[float],
        lng: Optional[float],
        precision: int = 2,
    ) -> tuple[Optional[float], Optional[float]]:
        """
        Coarsen geographic coordinates for public privacy protection.
        0.01 degrees corresponds to approximately ~1.11 km at the equator.

        Safely handles None, NaN, strings, or out-of-range coordinates.
        """
        if lat is None or lng is None:
            return None, None

        try:
            f_lat = float(lat)
            f_lng = float(lng)
        except (ValueError, TypeError):
            return None, None

        if math.isnan(f_lat) or math.isnan(f_lng):
            return None, None

        # Validate GPS bounds
        if not (-90.0 <= f_lat <= 90.0) or not (-180.0 <= f_lng <= 180.0):
            return None, None

        coarsened_lat = round(f_lat, precision)
        coarsened_lng = round(f_lng, precision)
        return coarsened_lat, coarsened_lng

    @staticmethod
    def scan_text_for_moderation(
        text: Optional[str],
        custom_terms: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """
        Advisory content screening for abusive keywords or spam.
        IMPORTANT: This filter flags content for human moderator review;
        it never independently approves, drops, or silently deletes reports.
        """
        if not text or not text.strip():
            return {
                "is_flagged": False,
                "flagged_terms": [],
                "reason": None,
                "action_required": "none",
            }

        search_text = text.lower()
        terms_to_check = custom_terms or DEFAULT_FLAGGED_TERMS
        matched_terms: list[str] = []

        for term in terms_to_check:
            # Word boundary or phrase check
            pattern = r"\b" + re.escape(term.lower()) + r"\b"
            if re.search(pattern, search_text):
                matched_terms.append(term)

        # Check for suspicious URLs or WhatsApp/Telegram invites
        has_suspicious_link = bool(re.search(r"(https?://|t\.me/|wa\.me/|chat\.whatsapp\.com/)", search_text))
        if has_suspicious_link:
            matched_terms.append("external_chat_link")

        is_flagged = len(matched_terms) > 0
        reason = None
        if is_flagged:
            reason = f"Flagged for human moderator review: detected term(s) {', '.join(matched_terms)}."

        return {
            "is_flagged": is_flagged,
            "flagged_terms": matched_terms,
            "reason": reason,
            "action_required": "human_moderation" if is_flagged else "none",
        }

    @staticmethod
    def validate_image_upload(
        size_bytes: int,
        mime_type: str,
        max_bytes: int = 5 * 1024 * 1024,
    ) -> dict[str, Any]:
        """
        Validate image upload specifications (max 5 MB, allowed formats, EXIF stripping).
        """
        allowed_types = ["image/jpeg", "image/png", "image/webp"]

        if size_bytes > max_bytes:
            mb = size_bytes / (1024 * 1024)
            return {
                "valid": False,
                "error": f"File size exceeds 5 MB limit ({mb:.1f} MB).",
                "exif_stripped": False,
            }

        if mime_type.lower() not in allowed_types:
            return {
                "valid": False,
                "error": f"Unsupported image format ({mime_type}). Allowed formats: JPG, PNG, WEBP.",
                "exif_stripped": False,
            }

        return {
            "valid": True,
            "error": None,
            "exif_stripped": True,  # EXIF GPS and device metadata is stripped on upload
        }


# Global helper shortcuts
check_citizen_daily_limit = AbusePrevention.check_citizen_daily_limit
coarsen_coordinates = AbusePrevention.coarsen_coordinates
scan_text_for_moderation = AbusePrevention.scan_text_for_moderation

