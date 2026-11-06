"""
Master Incident Intelligence Pipeline.

Orchestrates local complaint classification, duplicate detection,
explainable priority scoring, extractive summarization, and action recommendations.
"""

from dataclasses import asdict, dataclass
import json
from typing import Any, Optional, Sequence

from app.ml.classifier import get_classifier
from app.ml.duplicate_detector import get_duplicate_detector
from app.ml.recommender import get_recommended_actions
from app.ml.scorer import calculate_priority_score
from app.ml.summarizer import generate_extractive_summary


@dataclass
class IncidentAnalysisResult:
    predicted_category: str
    category_confidence: float
    category_method: str
    is_category_agreement: bool
    priority_level: str
    priority_score: float
    urgency: int
    impact: int
    recurrence: int
    frequency: int
    formula_str: str
    explanation: str
    factor_reasons: list[str]
    extractive_summary: str
    recommended_actions: list[str]
    is_duplicate: bool
    duplicate_of_id: Optional[int]
    duplicate_of_code: Optional[str]
    duplicate_of_title: Optional[str]
    duplicate_similarity: float
    duplicate_distance_meters: Optional[float]
    duplicate_rationale: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def run_incident_intelligence(
    title: str,
    description: str,
    category: Optional[str],
    location: Optional[str],
    latitude: Optional[float],
    longitude: Optional[float],
    existing_reports: Sequence[object],
    target_report_id: Optional[int] = None,
) -> IncidentAnalysisResult:
    """
    Run full local intelligence pipeline for a civic complaint.
    """
    # 1. Local Text Classification
    classifier = get_classifier()
    class_res = classifier.classify(title, description, category)

    # 2. Local Duplicate Detection
    detector = get_duplicate_detector()
    dup_res = detector.find_duplicate(
        target_title=title,
        target_description=description,
        target_lat=latitude,
        target_lng=longitude,
        existing_reports=existing_reports,
        target_report_id=target_report_id,
    )

    # Count how many reports are related to this duplicate
    duplicate_count = 0
    if dup_res.is_likely_duplicate and dup_res.original_report_id:
        duplicate_count = sum(
            1 for r in existing_reports
            if getattr(r, "duplicate_of", None) == dup_res.original_report_id
            or getattr(r, "id", None) == dup_res.original_report_id
        )

    # 3. Explainable Priority Scoring
    effective_category = category or class_res.predicted_category
    score_res = calculate_priority_score(
        title=title,
        description=description,
        category=effective_category,
        location=location,
        all_reports=existing_reports,
        duplicate_count=duplicate_count,
        is_duplicate=dup_res.is_likely_duplicate,
    )

    # 4. Local Extractive Summarization
    summary = generate_extractive_summary(title, description, max_sentences=2)

    # 5. Rule-Based Action Recommendations
    actions = get_recommended_actions(
        category=effective_category,
        priority_level=score_res.priority_level,
        title=title,
        description=description,
    )

    return IncidentAnalysisResult(
        predicted_category=class_res.predicted_category,
        category_confidence=class_res.confidence,
        category_method=class_res.method,
        is_category_agreement=class_res.is_agreement,
        priority_level=score_res.priority_level,
        priority_score=score_res.priority_score,
        urgency=score_res.urgency,
        impact=score_res.impact,
        recurrence=score_res.recurrence,
        frequency=score_res.frequency,
        formula_str=score_res.formula_str,
        explanation=score_res.explanation,
        factor_reasons=score_res.factor_reasons,
        extractive_summary=summary,
        recommended_actions=actions,
        is_duplicate=dup_res.is_likely_duplicate,
        duplicate_of_id=dup_res.original_report_id,
        duplicate_of_code=dup_res.original_report_code,
        duplicate_of_title=dup_res.original_report_title,
        duplicate_similarity=dup_res.similarity_score,
        duplicate_distance_meters=dup_res.distance_meters,
        duplicate_rationale=dup_res.rationale,
    )


def apply_analysis_to_report(report: Any, analysis: IncidentAnalysisResult) -> None:
    """
    Populate SQLAlchemy Report model fields with the analysis results.
    """
    report.priority = analysis.priority_level
    report.urgency = analysis.urgency
    report.impact = analysis.impact
    report.ai_summary = analysis.extractive_summary

    # Encode structured explanation + recommendations as JSON in ai_explanation
    # so both human text and structured payload are preserved cleanly.
    explanation_payload = {
        "priority_score": analysis.priority_score,
        "priority_level": analysis.priority_level,
        "predicted_category": analysis.predicted_category,
        "category_confidence": analysis.category_confidence,
        "formula": analysis.formula_str,
        "factor_reasons": analysis.factor_reasons,
        "recommended_actions": analysis.recommended_actions,
        "is_duplicate": analysis.is_duplicate,
        "duplicate_of_code": analysis.duplicate_of_code,
        "duplicate_of_id": analysis.duplicate_of_id,
        "duplicate_similarity": analysis.duplicate_similarity,
        "duplicate_distance_meters": analysis.duplicate_distance_meters,
        "duplicate_rationale": analysis.duplicate_rationale,
        "narrative": analysis.explanation,
    }
    report.ai_explanation = json.dumps(explanation_payload)

    # Link duplicate_of foreign key if detected
    if analysis.is_duplicate and analysis.duplicate_of_id:
        report.duplicate_of = analysis.duplicate_of_id
