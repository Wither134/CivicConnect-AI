"""
CivicConnect AI - Comprehensive Pydantic v2 Validation Schemas.

Defines schemas for:
- Authentication (Register, Login, MFA, User summaries, Session tokens)
- Incident Reports (Create, Update, Timeline, Proof images, Comments, Upvotes)
- Administrative Operations (Queue, Triage, Lock leases, Assignments, Duplicate Merging)
- Super Admin (Staff invitations, RBAC roles, Department thresholds)
- Public GIS & Hotspot Analytics
"""

from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field

EMAIL_REGEX = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


# ==========================================
# AUTHENTICATION SCHEMAS
# ==========================================

class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    email: str = Field(..., pattern=EMAIL_REGEX)
    password: str = Field(..., min_length=8, max_length=128)


class UserLoginRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)
    password: str


class StaffLoginRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)
    password: str


class StaffLoginStep1Response(BaseModel):
    requiresMfa: bool = True
    tempToken: str
    userSummary: dict[str, Any]


class MfaVerifyRequest(BaseModel):
    tempToken: str
    code: str = Field(..., min_length=6, max_length=6)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    role: str
    departmentId: Optional[str] = None
    departmentName: Optional[str] = None
    mfaEnabled: bool = False
    status: str = "active"
    lastLogin: Optional[datetime] = None
    createdAt: Optional[datetime] = None


class TokenResponse(BaseModel):
    token: str
    user: UserResponse
    message: Optional[str] = None


# ==========================================
# REPORT & EVIDENCE SCHEMAS
# ==========================================

class ReportImageCreate(BaseModel):
    url: str
    thumbnail_url: Optional[str] = None
    file_size_bytes: int = 1000000
    mime_type: str = "image/jpeg"
    is_proof: bool = False
    caption: Optional[str] = None


class ReportImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    report_id: str
    url: str
    thumbnail_url: Optional[str] = None
    file_size_bytes: int
    mime_type: str
    exif_stripped: bool = True
    is_proof: bool = False
    caption: Optional[str] = None
    created_at: Optional[datetime] = None


class StatusHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    report_id: str
    actor_id: str
    actor_name: str
    role: str
    from_status: str
    to_status: str
    note: str
    proof_image_id: Optional[str] = None
    proof_image_url: Optional[str] = None
    created_at: datetime


class ReportCommentCreateRequest(BaseModel):
    text: str = Field(..., min_length=3, max_length=2000)


class ReportCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    report_id: str
    user_id: str
    user_name: str
    text: str
    created_at: datetime


class SupportVoteResponse(BaseModel):
    report_id: str
    total_votes: int
    has_voted: bool


class ReportCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., min_length=15, max_length=5000)
    category_id: Optional[str] = Field(None, alias="categoryId")
    category_name: Optional[str] = Field(None, alias="categoryName")
    ward: Optional[str] = "Ward 45 (Central Zone)"
    address_hint: Optional[str] = Field("Near municipal point", alias="addressHint")
    exact_lat: Optional[float] = Field(None, alias="exactLat")
    exact_lng: Optional[float] = Field(None, alias="exactLng")
    images: Optional[List[str]] = Field(default_factory=list)  # URLs
    is_anonymous: Optional[bool] = Field(False, alias="isAnonymous")


class ReportListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    referenceNumber: str
    title: str
    description: str
    categoryName: str
    priority: str
    priorityScore: float
    status: str
    ward: str
    createdAt: datetime
    resolutionDueAt: Optional[datetime] = None
    isSlaBreached: bool = False
    slaCountdown: str = "No SLA"
    isLocked: bool = False
    lockOwner: Optional[str] = None
    isLockedByOther: bool = False
    imagesCount: int = 0
    supportVotesCount: int = 0


class ReportDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    referenceNumber: str
    title: str
    description: str
    categoryId: str
    categoryName: str
    departmentId: Optional[str] = None
    departmentName: Optional[str] = None
    priority: str
    priorityScore: float
    scoreBreakdown: Optional[dict[str, Any]] = None
    status: str
    version: int
    reporterId: str
    reporterName: str
    assigneeId: Optional[str] = None
    assigneeName: Optional[str] = None
    workCompleterId: Optional[str] = None
    workCompleterName: Optional[str] = None
    reviewerId: Optional[str] = None
    reviewerName: Optional[str] = None
    exactLat: Optional[float] = None
    exactLng: Optional[float] = None
    coarsenedLat: float
    coarsenedLng: float
    ward: str
    addressHint: str
    createdAt: datetime
    updatedAt: datetime
    responseDueAt: Optional[datetime] = None
    resolutionDueAt: Optional[datetime] = None
    firstRespondedAt: Optional[datetime] = None
    workCompletedAt: Optional[datetime] = None
    resolvedAt: Optional[datetime] = None
    isSlaBreached: bool = False
    slaCountdown: str = "No SLA"
    isLocked: bool = False
    lockOwner: Optional[str] = None
    isLockedByOther: bool = False
    aiSummary: Optional[str] = None
    aiCategoryConfidence: Optional[float] = None
    aiSopRecommendations: Optional[List[str]] = None
    images: List[ReportImageResponse] = Field(default_factory=list)
    timeline: List[StatusHistoryResponse] = Field(default_factory=list)
    supportVotesCount: int = 0
    commentsCount: int = 0
    hasSupported: bool = False


# ==========================================
# ADMINISTRATIVE ACTIONS
# ==========================================

class StatusUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    targetStatus: Optional[str] = None
    toStatus: Optional[str] = None
    note: str = Field(..., min_length=10)
    proofImageId: Optional[str] = None
    proofImageUrl: Optional[str] = None
    version: Optional[int] = None


class AssignStaffRequest(BaseModel):
    staffId: str
    reason: str = Field(..., min_length=10)
    version: int


class MergeDuplicateRequest(BaseModel):
    parentReportId: str
    similarityScore: float = 0.0
    reason: str = Field(..., min_length=10)


class BulkStatusUpdateRequest(BaseModel):
    reportIds: List[str] = Field(..., min_length=1, max_length=25)
    targetStatus: str
    note: str = Field(..., min_length=10)
    confirmed: bool = True


class LockAcquireResponse(BaseModel):
    success: bool
    message: str
    lock: Optional[dict[str, Any]] = None


# ==========================================
# SUPER ADMIN & SETTINGS
# ==========================================

class InviteStaffRequest(BaseModel):
    name: str = Field(..., min_length=2)
    email: str = Field(..., pattern=EMAIL_REGEX)
    role: str = Field(..., pattern="^(staff|admin|super_admin)$")
    department_id: Optional[str] = None
    temporary_password: Optional[str] = "CivicFix#2026"


class UpdateUserRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(citizen|staff|admin|super_admin)$")
    department_id: Optional[str] = None
    status: Optional[str] = "active"


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    description: str


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    department_id: str
    default_priority: str
    icon: str


class SlaPolicyConfigRequest(BaseModel):
    critical_hours: int = 24
    high_hours: int = 72
    medium_hours: int = 120
    low_hours: int = 240


# ==========================================
# PUBLIC GIS & COMMUNITY ANALYTICS
# ==========================================

class PublicReportMapItem(BaseModel):
    id: str
    referenceNumber: str
    title: str
    categoryName: str
    priority: str
    status: str
    coarsenedLat: float
    coarsenedLng: float
    ward: str
    createdAt: datetime


class PublicStatsResponse(BaseModel):
    totalReports: int
    resolvedReports: int
    inProgressReports: int
    pendingReviewReports: int
    averageResolutionHours: float
    communitySupportVotes: int


class HotspotClusterItem(BaseModel):
    cluster_id: int
    center_lat: float
    center_lng: float
    report_count: int
    primary_category: str
    urgency_level: str
    reports: List[dict[str, Any]] = Field(default_factory=list)

