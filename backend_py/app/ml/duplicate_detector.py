"""
Local Duplicate Complaint Detector.

Combines TF-IDF cosine text similarity with Haversine geographic distance
to detect duplicate civic complaints locally. Operates offline without external APIs.
"""

from dataclasses import dataclass
import math
from typing import Optional, Sequence
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two GPS coordinates in meters.
    """
    r_earth = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r_earth * c


@dataclass
class DuplicateMatch:
    is_likely_duplicate: bool
    similarity_score: float  # 0.0 to 1.0 (composite)
    text_similarity: float
    original_report_id: Optional[int]
    original_report_code: Optional[str]
    original_report_title: Optional[str]
    distance_meters: Optional[float]
    rationale: str


class DuplicateDetector:
    """Detects duplicate complaints against a reference list of existing reports."""

    def __init__(self, similarity_threshold: float = 0.65):
        self.similarity_threshold = similarity_threshold

    def find_duplicate(
        self,
        target_title: str,
        target_description: str,
        target_lat: Optional[float],
        target_lng: Optional[float],
        existing_reports: Sequence[object],
        target_report_id: Optional[int] = None,
    ) -> DuplicateMatch:
        """
        Compare target complaint against existing_reports.
        Returns the closest matching duplicate if similarity threshold is met.
        """
        # Filter candidate pool (exclude self if target_report_id matches)
        candidates = [
            r for r in existing_reports
            if target_report_id is None or getattr(r, "id", None) != target_report_id
        ]

        if not candidates:
            return DuplicateMatch(
                is_likely_duplicate=False,
                similarity_score=0.0,
                text_similarity=0.0,
                original_report_id=None,
                original_report_code=None,
                original_report_title=None,
                distance_meters=None,
                rationale="No earlier reports exist in the database for duplicate comparison.",
            )

        target_title_clean = target_title.strip()
        target_text = f"{target_title} {target_description}".strip()
        corpus_titles = [getattr(r, "title", "").strip() for r in candidates]
        corpus_full = [f"{getattr(r, 'title', '')} {getattr(r, 'description', '')}".strip() for r in candidates]

        # Vectorize using TF-IDF with sublinear scaling
        try:
            # Full text similarity
            vectorizer_full = TfidfVectorizer(
                ngram_range=(1, 2),
                stop_words="english",
                sublinear_tf=True,
            )
            tfidf_full = vectorizer_full.fit_transform([target_text] + corpus_full)
            full_sims = cosine_similarity(tfidf_full[0:1], tfidf_full[1:])[0]

            # Title similarity (captures exact issue identity)
            vectorizer_title = TfidfVectorizer(
                ngram_range=(1, 2),
                stop_words="english",
                sublinear_tf=True,
            )
            tfidf_title = vectorizer_title.fit_transform([target_title_clean] + corpus_titles)
            title_sims = cosine_similarity(tfidf_title[0:1], tfidf_title[1:])[0]
        except Exception:
            return DuplicateMatch(
                is_likely_duplicate=False,
                similarity_score=0.0,
                text_similarity=0.0,
                original_report_id=None,
                original_report_code=None,
                original_report_title=None,
                distance_meters=None,
                rationale="Could not compute text vectorization similarity.",
            )

        best_score = 0.0
        best_match_idx = -1
        best_text_sim = 0.0
        best_distance = None

        has_target_coords = (
            target_lat is not None
            and target_lng is not None
            and not math.isnan(target_lat)
            and not math.isnan(target_lng)
        )

        for idx, candidate in enumerate(candidates):
            raw_full_sim = float(full_sims[idx])
            raw_title_sim = float(title_sims[idx])

            # Blend title similarity (60%) and full description similarity (40%)
            raw_text_sim = max(raw_full_sim, (0.60 * raw_title_sim) + (0.40 * raw_full_sim))

            cand_lat = getattr(candidate, "latitude", None)
            cand_lng = getattr(candidate, "longitude", None)

            has_cand_coords = (
                cand_lat is not None
                and cand_lng is not None
                and not math.isnan(cand_lat)
                and not math.isnan(cand_lng)
            )

            distance = None
            composite_score = raw_text_sim

            if has_target_coords and has_cand_coords:
                distance = haversine_distance_meters(
                    target_lat, target_lng, cand_lat, cand_lng
                )

                # Geographic adjustment:
                if distance <= 150.0:
                    # Ultra-close proximity (< 150m): significant spatial boost
                    proximity_boost = 0.25 * (1.0 - (distance / 150.0))
                    composite_score = min(1.0, raw_text_sim + proximity_boost)
                elif distance <= 600.0:
                    # Same neighborhood (150m - 600m): moderate boost
                    proximity_boost = 0.12 * (1.0 - ((distance - 150.0) / 450.0))
                    composite_score = min(1.0, raw_text_sim + proximity_boost)
                elif distance > 3000.0:
                    # Geographically far apart (> 3km): penalty
                    composite_score = raw_text_sim * 0.70

            if composite_score > best_score:
                best_score = composite_score
                best_match_idx = idx
                best_text_sim = raw_text_sim
                best_distance = distance

        # When spatial proximity is verified (< 150m), threshold is 0.50; within 500m is 0.55; otherwise 0.60
        if best_distance is not None and best_distance <= 150.0:
            dynamic_threshold = 0.50
        elif best_distance is not None and best_distance <= 500.0:
            dynamic_threshold = 0.55
        else:
            dynamic_threshold = 0.60

        is_duplicate = best_score >= dynamic_threshold

        if is_duplicate and best_match_idx >= 0:
            matched_report = candidates[best_match_idx]
            rep_id = getattr(matched_report, "id", None)
            rep_code = getattr(matched_report, "report_code", f"ID-{rep_id}")
            rep_title = getattr(matched_report, "title", "Untitled Complaint")

            rationale_parts = [
                f"High semantic similarity ({round(best_text_sim * 100, 1)}% text overlap)",
            ]
            if best_distance is not None:
                rationale_parts.append(
                    f"located within {round(best_distance, 1)}m of earlier report {rep_code}"
                )
            else:
                rationale_parts.append("coordinates unavailable for spatial validation")

            return DuplicateMatch(
                is_likely_duplicate=True,
                similarity_score=round(best_score, 3),
                text_similarity=round(best_text_sim, 3),
                original_report_id=rep_id,
                original_report_code=rep_code,
                original_report_title=rep_title,
                distance_meters=round(best_distance, 1) if best_distance is not None else None,
                rationale=f"Likely duplicate of {rep_code}: {'; '.join(rationale_parts)}.",
            )

        return DuplicateMatch(
            is_likely_duplicate=False,
            similarity_score=round(best_score, 3) if best_match_idx >= 0 else 0.0,
            text_similarity=round(best_text_sim, 3) if best_match_idx >= 0 else 0.0,
            original_report_id=None,
            original_report_code=None,
            original_report_title=None,
            distance_meters=round(best_distance, 1) if best_distance is not None else None,
            rationale=f"No existing report exceeded the {int(dynamic_threshold * 100)}% similarity duplicate threshold.",
        )


_detector_instance: Optional[DuplicateDetector] = None


def get_duplicate_detector() -> DuplicateDetector:
    """Retrieve shared DuplicateDetector instance."""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = DuplicateDetector()
    return _detector_instance
