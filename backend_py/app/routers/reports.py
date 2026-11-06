"""
CivicConnect AI - Incident Reports Router.

Endpoints:
- POST /api/reports/check-duplicate : Advisory near-duplicate detection before submission
- POST /api/reports : Submit civic complaint (ML analysis, rate-limit, SLA calculation, photo attachments)
- GET  /api/reports : Public explore feed with filtering & pagination
- GET  /api/reports/my-reports : Citizen's submitted complaints
- GET  /api/reports/{id} : Full incident details with timeline, proof photos, and support votes
- POST /api/reports/{id}/support : Toggle community upvote
- GET  /api/reports/{id}/comments : Discussion comments
- POST /api/reports/{id}/comments : Add comment to incident discussion
"""

from datetime import datetime, timezone
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Report,
    ReportImage,
    StatusHistory,
    SupportVote,
    ReportComment,
    Category,
    Department,
    User,
)
from app.auth.dependencies import get_current_user, get_current_user_optional
from app.governance.abuse_prevention import (
    check_citizen_daily_limit,
    coarsen_coordinates,
    scan_text_for_moderation,
)
from app.governance.sla_engine import SlaEngine
from app.governance.lock_manager import LockManager
from app.governance.audit_logger import AuditLogger
from app.ml.pipeline import run_incident_intelligence
from app.schemas import (
    ReportCreateRequest,
    ReportCommentCreateRequest,
)

reports_router = APIRouter(prefix="/api/reports", tags=["Reports"])


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@reports_router.post("/check-duplicate")
def check_duplicate_preflight(
    payload: dict[str, Any],
    db: Session = Depends(get_db),
):
    """
    Advisory duplicate check before final report submission.
    Uses hybrid spatial Haversine and TF-IDF cosine similarity.
    """
    lat = payload.get("lat")
    lng = payload.get("lng")
    title = payload.get("title", "")
    description = payload.get("description", "")
    category_name = payload.get("categoryName") or payload.get("category", "")

    if not lat or not lng:
        return {"duplicates": []}

    try:
        f_lat = float(lat)
        f_lng = float(lng)
    except (ValueError, TypeError):
        return {"duplicates": []}

    # Retrieve existing active reports
    stmt = (
        select(Report)
        .where(Report.deleted_at.is_(None))
        .where(Report.status.notin_(["resolved", "rejected"]))
        .limit(200)
    )
    existing_reports = db.execute(stmt).scalars().all()

    analysis = run_incident_intelligence(
        title=title,
        description=description,
        category=category_name,
        location="User Submission",
        latitude=f_lat,
        longitude=f_lng,
        existing_reports=existing_reports,
    )

    duplicates = []
    if analysis.is_duplicate and analysis.duplicate_of_id:
        parent = db.get(Report, analysis.duplicate_of_id)
        if parent:
            duplicates.append({
                "id": parent.id,
                "referenceNumber": parent.reference_number,
                "title": parent.title,
                "categoryName": parent.category_name,
                "similarityScore": int(analysis.duplicate_similarity * 100),
                "distanceMeters": int(analysis.duplicate_distance_meters or 50),
                "rationale": analysis.duplicate_rationale,
            })

    return {"duplicates": duplicates}


CATEGORY_ALIASES: dict[str, str] = {
    "cat-streetlight": "cat-lights",
    "cat-lights": "cat-lights",
    "cat-road": "cat-potholes",
    "cat-potholes": "cat-potholes",
    "cat-waste": "cat-waste",
    "cat-water": "cat-water",
    "cat-drain": "cat-water",
    "cat-infra": "cat-potholes",
    "cat-parks": "cat-parks",
    "cat-other": "cat-potholes",
}


@reports_router.post("", status_code=status.HTTP_201_CREATED)
def submit_report(
    payload: ReportCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit a new civic problem report.
    Integrates ML classification, duplicate detection, priority scoring, SLA computation, and image attachments.
    """
    if current_user.role == "staff":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff members cannot submit citizen reports directly (use citizen portal or admin desk).",
        )

    # 1. Citizen Daily Rate Limiting (Anti-Spam)
    if current_user.role == "citizen":
        rate_check = check_citizen_daily_limit(db, citizen_id=current_user.id, limit=5)
        if not rate_check["allowed"]:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Daily submission limit reached (5 reports/day). Try again in {rate_check['reset_hours']} hours.",
            )

    # 2. Resolve Category & Department
    category = None
    if payload.category_id:
        target_cat_id = CATEGORY_ALIASES.get(payload.category_id.strip().lower(), payload.category_id.strip())
        category = db.get(Category, target_cat_id)
    if not category and payload.category_name:
        category = db.execute(
            select(Category).where(Category.name.ilike(f"%{payload.category_name.strip()}%"))
        ).scalars().first()

    if not category:
        category = db.execute(select(Category)).scalars().first()
        if not category:
            dept = Department(code="GEN", name="General Administration")
            db.add(dept)
            db.commit()
            category = Category(name="General Civic Issue", department_id=dept.id, default_priority="medium")
            db.add(category)
            db.commit()

    # 3. Advisory Content Moderation
    mod_check = scan_text_for_moderation(f"{payload.title} {payload.description}")

    # 4. Run Offline AI/ML Intelligence Pipeline
    f_lat = payload.exact_lat or 12.9716
    f_lng = payload.exact_lng or 77.5946

    existing_active = db.execute(
        select(Report).where(Report.deleted_at.is_(None)).limit(150)
    ).scalars().all()

    ai_analysis = run_incident_intelligence(
        title=payload.title,
        description=payload.description,
        category=category.name,
        location=payload.ward or "Ward 45",
        latitude=f_lat,
        longitude=f_lng,
        existing_reports=existing_active,
    )

    # 5. Coordinate Coarsening (Public Privacy)
    c_lat, c_lng = coarsen_coordinates(f_lat, f_lng, precision=2)

    # 6. SLA Deadlines Calculation
    effective_priority = ai_analysis.priority_level.lower() if ai_analysis.priority_level else (category.default_priority or "medium")
    due_dates = SlaEngine.calculate_due_dates(utc_now(), effective_priority)

    # 7. Generate Reference Number
    count_stmt = select(func.count(Report.id))
    total_existing = db.execute(count_stmt).scalar() or 0
    ref_number = f"CPR-2026-{str(total_existing + 1).zfill(6)}"

    reporter_display_name = "Anonymous Resident" if payload.is_anonymous else current_user.name

    # 8. Create Report Model
    new_report = Report(
        reference_number=ref_number,
        title=payload.title.strip(),
        description=payload.description.strip(),
        category_id=category.id,
        category_name=category.name,
        department_id=category.department_id,
        department_name=category.department.name if category.department else "General Services",
        priority=effective_priority,
        priority_score=ai_analysis.priority_score,
        score_breakdown={
            "urgency": ai_analysis.urgency,
            "impact": ai_analysis.impact,
            "recurrence": ai_analysis.recurrence,
            "frequency": ai_analysis.frequency,
            "formula": ai_analysis.formula_str,
            "reasons": ai_analysis.factor_reasons,
        },
        status="submitted",
        version=1,
        reporter_id=current_user.id,
        reporter_name=reporter_display_name,
        exact_lat=f_lat,
        exact_lng=f_lng,
        coarsened_lat=c_lat or 12.97,
        coarsened_lng=c_lng or 77.59,
        ward=payload.ward or "Ward 45 (Central Zone)",
        address_hint=payload.address_hint or "Near municipal point",
        response_due_at=due_dates["response_due_at"],
        resolution_due_at=due_dates["resolution_due_at"],
        ai_summary=ai_analysis.extractive_summary,
        ai_category_confidence=ai_analysis.category_confidence,
        ai_sop_recommendations=ai_analysis.recommended_actions,
        created_at=utc_now(),
        updated_at=utc_now(),
    )

    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    # 9. Attach Images
    if payload.images:
        for idx, url in enumerate(payload.images):
            img = ReportImage(
                report_id=new_report.id,
                url=url,
                file_size_bytes=1000000,
                mime_type="image/jpeg",
                exif_stripped=True,
                uploaded_by_id=current_user.id,
                uploaded_by_role=current_user.role,
                is_proof=False,
                created_at=utc_now(),
            )
            db.add(img)

    # 10. Initial Status History Entry
    history = StatusHistory(
        report_id=new_report.id,
        actor_id=current_user.id,
        actor_name=current_user.name,
        role=current_user.role,
        from_status="submitted",
        to_status="submitted",
        note="Report submitted by citizen. Status is Unverified until reviewed by municipal moderator.",
        created_at=utc_now(),
    )
    db.add(history)
    db.commit()

    # 11. Administrative Audit Entry
    client_ip = request.client.host if request.client else "127.0.0.1"
    AuditLogger.log(
        db=db,
        actor_id=current_user.id,
        actor_email=current_user.email,
        actor_name=current_user.name,
        actor_role=current_user.role,
        action="REPORT_SUBMITTED",
        target_type="report",
        target_id=new_report.id,
        ip_address=client_ip,
        details={
            "referenceNumber": new_report.reference_number,
            "category": new_report.category_name,
            "priority": new_report.priority,
            "isSpamFlagged": mod_check["is_flagged"],
        },
    )

    return {
        "message": "Report submitted successfully. It will be reviewed by municipal moderators.",
        "report": {
            "id": new_report.id,
            "referenceNumber": new_report.reference_number,
            "title": new_report.title,
            "status": new_report.status,
            "priority": new_report.priority,
            "categoryName": new_report.category_name,
            "createdAt": new_report.created_at.isoformat(),
        },
    }


@reports_router.get("")
def list_reports(
    tab: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    ward: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    Public explore feed of civic incidents with multi-facet filters.
    Coordinates returned are coarsened for public privacy protection.
    """
    stmt = select(Report).where(Report.deleted_at.is_(None))

    if category and category.lower() != "all":
        stmt = stmt.where(Report.category_name.ilike(f"%{category}%"))

    if ward and ward.lower() != "all":
        stmt = stmt.where(Report.ward.ilike(f"%{ward}%"))

    if status_filter and status_filter.lower() != "all":
        stmt = stmt.where(Report.status == status_filter.lower())

    if search:
        search_term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            Report.title.ilike(search_term)
            | Report.reference_number.ilike(search_term)
            | Report.ward.ilike(search_term)
            | Report.category_name.ilike(search_term)
        )

    stmt = stmt.order_by(Report.created_at.desc()).offset(offset).limit(limit)
    reports = db.execute(stmt).scalars().all()

    items = []
    for r in reports:
        lock_status = LockManager.get_lock_status(r)
        items.append({
            "id": r.id,
            "referenceNumber": r.reference_number,
            "title": r.title,
            "description": r.description,
            "categoryName": r.category_name,
            "priority": r.priority,
            "priorityScore": r.priority_score,
            "status": r.status,
            "ward": r.ward,
            "addressHint": r.address_hint,
            "coarsenedLat": r.coarsened_lat,
            "coarsenedLng": r.coarsened_lng,
            "createdAt": r.created_at.isoformat() if r.created_at else None,
            "resolutionDueAt": r.resolution_due_at.isoformat() if r.resolution_due_at else None,
            "slaCountdown": SlaEngine.format_countdown(r.resolution_due_at),
            "isLocked": lock_status["is_locked"],
            "lockOwner": lock_status["locked_by_name"],
            "imagesCount": len(r.images),
            "supportVotesCount": len(r.support_votes),
        })

    return {"reports": items}


@reports_router.get("/my-reports")
def get_my_reports(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all reports submitted by the currently logged-in citizen with latest status notes."""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    stmt = (
        select(Report)
        .where(Report.reporter_id == current_user.id)
        .where(Report.deleted_at.is_(None))
        .order_by(Report.created_at.desc())
    )
    my_reports = db.execute(stmt).scalars().all()

    items = []
    for r in my_reports:
        latest_history = r.timeline[-1] if r.timeline else None
        items.append({
            "id": r.id,
            "referenceNumber": r.reference_number,
            "title": r.title,
            "description": r.description,
            "categoryName": r.category_name,
            "priority": r.priority,
            "status": r.status,
            "ward": r.ward,
            "addressHint": r.address_hint,
            "createdAt": r.created_at.isoformat() if r.created_at else None,
            "updatedAt": r.updated_at.isoformat() if r.updated_at else None,
            "resolutionDueAt": r.resolution_due_at.isoformat() if r.resolution_due_at else None,
            "workCompletedAt": r.work_completed_at.isoformat() if r.work_completed_at else None,
            "resolvedAt": r.resolved_at.isoformat() if r.resolved_at else None,
            "workCompleterName": r.work_completer_name,
            "reviewerName": r.reviewer_name,
            "slaCountdown": SlaEngine.format_countdown(r.resolution_due_at),
            "imagesCount": len(r.images),
            "supportVotesCount": len(r.support_votes),
            "latestNote": latest_history.note if latest_history else None,
            "latestActorRole": latest_history.role if latest_history else None,
            "latestActorName": latest_history.actor_name if latest_history else None,
            "timelineCount": len(r.timeline),
        })

    return {"reports": items}


@reports_router.get("/{report_id}")
def get_report_detail(
    report_id: str,
    response: Response,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Detailed incident report inspection.
    Includes proof photos, full status timeline, and role-based GPS coordinate disclosure.
    Accepts either UUID ID or reference number (e.g. CPR-2026-000017).
    Enforces citizen privacy by masking reporter identities from non-authorized viewers.
    """
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    report = db.get(Report, report_id)
    if not report:
        report = db.execute(
            select(Report).where(
                (Report.reference_number == report_id) |
                (Report.reference_number.ilike(report_id))
            )
        ).scalars().first()

    if not report or report.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    is_owner = current_user is not None and report.reporter_id == current_user.id
    is_staff_or_admin = current_user is not None and current_user.role in ("admin", "super_admin", "staff")

    # Role-based coordinate and identity visibility:
    # Exact coordinates visible only to Admin, Super Admin, Assigned Staff, or the Reporter
    can_see_exact = False
    if current_user:
        if current_user.role in ("admin", "super_admin"):
            can_see_exact = True
        elif current_user.role == "staff" and report.assignee_id == current_user.id:
            can_see_exact = True
        elif is_owner:
            can_see_exact = True

    # Privacy Protection: non-owner citizens and visitors cannot see another citizen's private identity
    reporter_display_name = report.reporter_name if (is_owner or is_staff_or_admin) else "Verified Resident"
    reporter_display_id = report.reporter_id if (is_owner or is_staff_or_admin) else None

    # Role-based coordinate visibility:
    # Exact coordinates visible only to Admin, Super Admin, Assigned Staff, or the Reporter
    can_see_exact = False
    if current_user:
        if current_user.role in ("admin", "super_admin"):
            can_see_exact = True
        elif current_user.role == "staff" and report.assignee_id == current_user.id:
            can_see_exact = True
        elif is_owner:
            can_see_exact = True

    lock_status = LockManager.get_lock_status(report)
    is_locked_by_other = (
        lock_status["is_locked"]
        and current_user is not None
        and lock_status["locked_by_id"] != current_user.id
    )

    has_supported = False
    if current_user:
        vote_stmt = select(SupportVote).where(
            SupportVote.report_id == report.id, SupportVote.user_id == current_user.id
        )
        has_supported = db.execute(vote_stmt).scalar_one_or_none() is not None

    images_list = [
        {
            "id": img.id,
            "url": img.url,
            "thumbnailUrl": img.thumbnail_url or img.url,
            "isProof": img.is_proof,
            "exifStripped": img.exif_stripped,
            "caption": img.caption,
        }
        for img in report.images
    ]

    timeline_list = [
        {
            "id": h.id,
            "actorId": h.actor_id,
            "actorName": h.actor_name,
            "role": h.role,
            "fromStatus": h.from_status,
            "toStatus": h.to_status,
            "note": h.note,
            "proofImageId": h.proof_image_id,
            "proofImageUrl": h.proof_image_url,
            "createdAt": h.created_at.isoformat() if h.created_at else None,
        }
        for h in report.timeline
    ]

    report_dict = {
        "id": report.id,
        "referenceNumber": report.reference_number,
        "title": report.title,
        "description": report.description,
        "categoryId": report.category_id,
        "categoryName": report.category_name,
        "departmentId": report.department_id,
        "departmentName": report.department_name,
        "priority": report.priority,
        "priorityScore": report.priority_score,
        "scoreBreakdown": report.score_breakdown,
        "status": report.status,
        "version": report.version,
        "reporterId": reporter_display_id,
        "reporterName": reporter_display_name,
        "isOwner": is_owner,
        "assigneeId": report.assignee_id,
        "assigneeName": report.assignee_name,
        "workCompleterId": report.work_completer_id,
        "workCompleterName": report.work_completer_name,
        "reviewerId": report.reviewer_id,
        "reviewerName": report.reviewer_name,
        "exactLat": report.exact_lat if can_see_exact else None,
        "exactLng": report.exact_lng if can_see_exact else None,
        "coarsenedLat": report.coarsened_lat,
        "coarsenedLng": report.coarsened_lng,
        "ward": report.ward,
        "addressHint": report.address_hint,
        "createdAt": report.created_at.isoformat() if report.created_at else None,
        "updatedAt": report.updated_at.isoformat() if report.updated_at else None,
        "responseDueAt": report.response_due_at.isoformat() if report.response_due_at else None,
        "resolutionDueAt": report.resolution_due_at.isoformat() if report.resolution_due_at else None,
        "firstRespondedAt": report.first_responded_at.isoformat() if report.first_responded_at else None,
        "workCompletedAt": report.work_completed_at.isoformat() if report.work_completed_at else None,
        "resolvedAt": report.resolved_at.isoformat() if report.resolved_at else None,
        "slaCountdown": SlaEngine.format_countdown(report.resolution_due_at),
        "isLocked": lock_status["is_locked"],
        "lockOwner": lock_status["locked_by_name"],
        "isLockedByOther": is_locked_by_other,
        "aiSummary": report.ai_summary,
        "aiCategoryConfidence": report.ai_category_confidence,
        "aiSopRecommendations": report.ai_sop_recommendations,
        "supportVotesCount": len(report.support_votes),
        "commentsCount": len(report.comments),
        "hasSupported": has_supported,
        "images": images_list,
        "timeline": timeline_list,
    }

    # Return unified payload with both direct fields and nested report key for full frontend compatibility
    return {
        **report_dict,
        "report": report_dict,
        "images": images_list,
        "timeline": timeline_list,
    }


@reports_router.post("/{report_id}/support")
def toggle_support_vote(
    report_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle community upvote on an incident."""
    report = db.get(Report, report_id)
    if not report or report.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    vote_stmt = select(SupportVote).where(
        SupportVote.report_id == report_id, SupportVote.user_id == current_user.id
    )
    existing_vote = db.execute(vote_stmt).scalar_one_or_none()

    if existing_vote:
        db.delete(existing_vote)
        db.commit()
        has_voted = False
    else:
        new_vote = SupportVote(report_id=report_id, user_id=current_user.id)
        db.add(new_vote)
        db.commit()
        has_voted = True

    count_stmt = select(func.count(SupportVote.id)).where(SupportVote.report_id == report_id)
    total_votes = db.execute(count_stmt).scalar() or 0

    return {
        "report_id": report_id,
        "total_votes": total_votes,
        "has_voted": has_voted,
    }


@reports_router.get("/{report_id}/comments")
def get_comments(
    report_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve discussion comments for a report."""
    stmt = (
        select(ReportComment)
        .where(ReportComment.report_id == report_id)
        .order_by(ReportComment.created_at.asc())
    )
    comments = db.execute(stmt).scalars().all()

    return {
        "comments": [
            {
                "id": c.id,
                "userId": c.user_id,
                "userName": c.user_name,
                "text": c.text,
                "createdAt": c.created_at.isoformat(),
            }
            for c in comments
        ]
    }


@reports_router.post("/{report_id}/comments", status_code=status.HTTP_201_CREATED)
def add_comment(
    report_id: str,
    payload: ReportCommentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Post a citizen comment on a report."""
    report = db.get(Report, report_id)
    if not report or report.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    comment = ReportComment(
        report_id=report.id,
        user_id=current_user.id,
        user_name=current_user.name,
        text=payload.text.strip(),
        created_at=utc_now(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return {
        "id": comment.id,
        "userId": comment.user_id,
        "userName": comment.user_name,
        "text": comment.text,
        "createdAt": comment.created_at.isoformat(),
    }
