"""
Explainable Civic Priority Scoring Engine.

Implements the transparent municipal heuristic:
Priority Score = (0.35 × Urgency) + (0.30 × Impact) + (0.20 × Recurrence) + (0.15 × Frequency)

Normalized on a 0–100 scale:
- 75–100: Critical
- 50–74:  High
- 25–49:  Medium
- 0–24:   Low

Runs completely offline. Prototype engineering heuristic for decision support;
requires municipal operational validation.
"""

from dataclasses import dataclass
import re
from typing import Optional, Sequence

# Severity keyword lexicon for Urgency
CRITICAL_HAZARD_KEYWORDS = [
    "severe", "collapse", "hazard", "danger", "burst", "gas leak", "live wire",
    "electrocution", "open manhole", "deep pothole", "imminent", "submerged",
    "unconscious", "explosion", "toxic", "crater"
]

HIGH_HAZARD_KEYWORDS = [
    "overflowing", "waterlogging", "flood", "flooding", "blocked drain",
    "broken main", "sewage", "traffic signal", "road damage", "accident",
    "fallen tree", "spill", "unmarked", "foul smell", "health risk"
]

MODERATE_KEYWORDS = [
    "pothole", "streetlight", "garbage", "trash", "waste", "dump",
    "flickering", "dark road", "cleaning", "debris", "leakage"
]

# High-impact location / infrastructure keywords
HIGH_IMPACT_LOCATIONS = [
    "main road", "highway", "arterial", "junction", "intersection",
    "hospital", "school", "bus stop", "metro", "market", "station",
    "railway", "footpath", "sidewalk", "commercial", "pedestrian"
]

MEDIUM_IMPACT_LOCATIONS = [
    "cross road", "street", "residential", "lane", "colony", "layout",
    "society", "apartment", "ward", "block", "circle"
]


@dataclass
class ScoreBreakdown:
    priority_level: str  # 'Critical' | 'High' | 'Medium' | 'Low'
    priority_score: float  # 0.0 to 100.0
    urgency: int  # 0 to 100
    impact: int  # 0 to 100
    recurrence: int  # 0 to 100
    frequency: int  # 0 to 100
    formula_str: str
    explanation: str
    factor_reasons: list[str]


def compute_urgency(title: str, description: str, category: Optional[str]) -> tuple[int, list[str]]:
    """Determine Urgency (0–100) based on hazard lexicon matching."""
    text = f"{title} {description} {category or ''}".lower()
    reasons = []

    matched_critical = [kw for kw in CRITICAL_HAZARD_KEYWORDS if re.search(r"\b" + re.escape(kw) + r"\b", text)]
    matched_high = [kw for kw in HIGH_HAZARD_KEYWORDS if re.search(r"\b" + re.escape(kw) + r"\b", text)]
    matched_moderate = [kw for kw in MODERATE_KEYWORDS if re.search(r"\b" + re.escape(kw) + r"\b", text)]

    if matched_critical:
        score = min(100, 80 + len(matched_critical) * 7)
        reasons.append(f"Immediate safety hazard keywords detected: {', '.join(matched_critical[:3])}")
    elif matched_high:
        score = min(80, 58 + len(matched_high) * 6)
        reasons.append(f"High operational disruption keywords: {', '.join(matched_high[:3])}")
    elif matched_moderate:
        score = min(55, 35 + len(matched_moderate) * 5)
        reasons.append(f"Standard civic maintenance issue: {', '.join(matched_moderate[:3])}")
    else:
        score = 25
        reasons.append("Routine civic inquiry without explicit hazard indicators")

    return score, reasons


def compute_impact(location_text: Optional[str], description: str) -> tuple[int, list[str]]:
    """Determine Public Impact (0–100) based on location exposure."""
    combined = f"{location_text or ''} {description}".lower()
    reasons = []

    matched_high_loc = [kw for kw in HIGH_IMPACT_LOCATIONS if re.search(r"\b" + re.escape(kw) + r"\b", combined)]
    matched_med_loc = [kw for kw in MEDIUM_IMPACT_LOCATIONS if re.search(r"\b" + re.escape(kw) + r"\b", combined)]

    if matched_high_loc:
        score = min(100, 80 + len(matched_high_loc) * 8)
        reasons.append(f"Affects arterial or high-density transit hub: {', '.join(matched_high_loc[:2])}")
    elif matched_med_loc:
        score = min(75, 52 + len(matched_med_loc) * 6)
        reasons.append(f"Affects residential ward or neighborhood: {', '.join(matched_med_loc[:2])}")
    else:
        score = 35
        reasons.append("Localized scope without verified arterial transit overlap")

    return score, reasons


def compute_recurrence(
    duplicate_count: int, is_duplicate: bool
) -> tuple[int, list[str]]:
    """Determine Recurrence (0–100) based on number of duplicate/repeated complaints."""
    reasons = []
    if duplicate_count >= 4:
        score = 100
        reasons.append(f"Severe recurrence: {duplicate_count} duplicate complaints filed for this problem")
    elif duplicate_count >= 2:
        score = 75
        reasons.append(f"Repeated issue: {duplicate_count} matching complaints logged in system")
    elif duplicate_count == 1 or is_duplicate:
        score = 50
        reasons.append("Identified duplicate of an active municipal ticket")
    else:
        score = 15
        reasons.append("First occurrence logged (unique report)")

    return score, reasons


def compute_frequency(
    category: Optional[str], all_reports: Sequence[object]
) -> tuple[int, list[str]]:
    """Determine Frequency (0–100) based on active complaints in the same category."""
    reasons = []
    if not category:
        return 25, ["Category unassigned; baseline category density applied"]

    cat_clean = category.lower().strip()
    active_in_cat = 0
    for r in all_reports:
        cat_val = getattr(r, "category_name", None) or getattr(r, "category", None)
        cat_str = cat_val.name if hasattr(cat_val, "name") else str(cat_val or "")
        if cat_str and cat_str.lower().strip() == cat_clean:
            status_str = str(getattr(r, "status", "")).lower()
            if status_str != "resolved":
                active_in_cat += 1

    if active_in_cat >= 5:
        score = 90
        reasons.append(f"High category density: {active_in_cat} active incidents in {category}")
    elif active_in_cat >= 3:
        score = 65
        reasons.append(f"Elevated frequency: {active_in_cat} open {category} reports")
    elif active_in_cat >= 1:
        score = 40
        reasons.append(f"Moderate category activity: {active_in_cat} open tickets")
    else:
        score = 20
        reasons.append("Low category frequency across the municipality")

    return score, reasons


def calculate_priority_score(
    title: str,
    description: str,
    category: Optional[str],
    location: Optional[str],
    all_reports: Sequence[object],
    duplicate_count: int = 0,
    is_duplicate: bool = False,
) -> ScoreBreakdown:
    """
    Calculate the explainable Priority Score:
    Score = (0.35 × Urgency) + (0.30 × Impact) + (0.20 × Recurrence) + (0.15 × Frequency)
    """
    urgency, urg_reasons = compute_urgency(title, description, category)
    impact, imp_reasons = compute_impact(location, description)
    recurrence, rec_reasons = compute_recurrence(duplicate_count, is_duplicate)
    frequency, freq_reasons = compute_frequency(category, all_reports)

    # Calculate weighted priority score
    raw_score = (
        (0.35 * urgency)
        + (0.30 * impact)
        + (0.20 * recurrence)
        + (0.15 * frequency)
    )
    score = round(max(0.0, min(100.0, raw_score)), 1)

    # Classify priority level
    if score >= 75.0:
        level = "Critical"
    elif score >= 50.0:
        level = "High"
    elif score >= 25.0:
        level = "Medium"
    else:
        level = "Low"

    factor_reasons = urg_reasons + imp_reasons + rec_reasons + freq_reasons

    formula_str = (
        f"Score {score}/100 = (0.35 × {urgency} Urgency) + (0.30 × {impact} Impact) + "
        f"(0.20 × {recurrence} Recurrence) + (0.15 × {frequency} Frequency)"
    )

    explanation = (
        f"Assessed as {level} Priority ({score}/100) using the municipal dispatch heuristic: "
        f"{'; '.join(factor_reasons)}. "
        f"[Note: Prototype engineering heuristic for decision support; requires field confirmation.]"
    )

    return ScoreBreakdown(
        priority_level=level,
        priority_score=score,
        urgency=urgency,
        impact=impact,
        recurrence=recurrence,
        frequency=frequency,
        formula_str=formula_str,
        explanation=explanation,
        factor_reasons=factor_reasons,
    )
