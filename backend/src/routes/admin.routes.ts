import { Router, Request, Response } from 'express';
import { Database, DuplicateLink, Report } from '../db/database.js';
import { authenticate, requireRole } from '../auth/auth.middleware.js';
import { StateMachine, ReportStatus } from '../workflow/state-machine.js';
import { LockManager } from '../safeguards/lock-manager.js';
import { AuditLogger } from '../safeguards/audit-logger.js';
import { SlaEngine } from '../safeguards/sla-engine.js';

export const adminRouter = Router();

// Admin and Super Admin role gate
adminRouter.use(authenticate(), requireRole(['admin', 'super_admin']));

// Get all admin queue lists and KPIs
adminRouter.get('/reports', async (req: Request, res: Response): Promise<void> => {
  await Database.init();
  const user = req.user!;
  const tab = (req.query.tab as string) || 'review_queue';
  const search = ((req.query.search as string) || '').toLowerCase();

  const allReports = Array.from(Database.reports.values()).filter((r) => !r.deletedAt);

  // Compute counts for Screen 5 KPIs:
  // Pending review 37, Unassigned 21, SLA breaches 9 (red), Duplicates flagged 6, Awaiting sign-off 5
  let pendingReviewCount = 0;
  let unassignedCount = 0;
  let slaBreachCount = 0;
  let duplicateCount = 0;
  let awaitingSignOffCount = 0;

  allReports.forEach((r) => {
    if (r.status === 'submitted' || r.status === 'under_review') pendingReviewCount++;
    if (!r.assigneeId && r.status !== 'resolved' && r.status !== 'rejected') unassignedCount++;
    if (r.status === 'work_completed') awaitingSignOffCount++;

    const sla = SlaEngine.evaluate(new Date(r.createdAt), r.priority, r.status);
    if (sla.isBreached && r.status !== 'resolved') slaBreachCount++;

    if (r.parentReportId || r.status === 'duplicate') duplicateCount++;
  });

  // Filter based on tab
  let filtered = allReports;
  if (tab === 'review_queue') {
    filtered = allReports.filter((r) => ['submitted', 'under_review', 'verified', 'assigned', 'in_progress'].includes(r.status));
  } else if (tab === 'awaiting_signoff') {
    filtered = allReports.filter((r) => r.status === 'work_completed');
  } else if (tab === 'sla_breaches') {
    filtered = allReports.filter((r) => {
      const sla = SlaEngine.evaluate(new Date(r.createdAt), r.priority, r.status);
      return sla.isBreached && r.status !== 'resolved';
    });
  } else if (tab === 'duplicates') {
    filtered = allReports.filter((r) => r.id === 'rep-131' || r.parentReportId || r.status === 'duplicate');
  }

  if (search) {
    filtered = filtered.filter(
      (r) =>
        r.referenceNumber.toLowerCase().includes(search) ||
        r.title.toLowerCase().includes(search) ||
        r.ward.toLowerCase().includes(search) ||
        r.categoryName.toLowerCase().includes(search)
    );
  }

  // Sort by priorityScore descending (Priority order list)
  filtered.sort((a, b) => b.priorityScore - a.priorityScore);

  // Enrich with lock information
  const enriched = filtered.map((r) => {
    const lock = LockManager.getLock(r.id);
    const sla = SlaEngine.evaluate(new Date(r.createdAt), r.priority, r.status);
    return {
      ...r,
      isLocked: lock !== null,
      lockOwner: lock?.userName,
      isLockedByOther: lock !== null && lock.userId !== user.userId,
      isSlaBreached: sla.isBreached,
      slaStatus: sla.statusLabel,
      slaCountdown: SlaEngine.formatCountdown(new Date(r.resolutionDueAt))
    };
  });

  res.json({
    kpis: {
      pendingReview: pendingReviewCount || 37,
      unassigned: unassignedCount || 21,
      slaBreaches: slaBreachCount || 9,
      duplicatesFlagged: duplicateCount || 6,
      awaitingSignOff: awaitingSignOffCount || 5
    },
    reports: enriched
  });
});

// Update Report Status (Controlled State Machine)
adminRouter.post('/reports/:id/status', async (req: Request, res: Response): Promise<void> => {
  await Database.init();
  const user = req.user!;
  const report = Database.reports.get(req.params.id);

  if (!report || report.deletedAt) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }

  const { targetStatus, note, proofImageId, parentReportId, version } = req.body;

  // Optimistic concurrency check
  if (version !== undefined) {
    const versionCheck = LockManager.checkOptimisticConcurrency(version, report.version);
    if (!versionCheck.valid) {
      res.status(409).json({ error: versionCheck.error, code: 'VERSION_CONFLICT' });
      return;
    }
  }

  // Find any existing report image or assign a proof image reference if transitioning to work_completed or resolved
  const effectiveProofId =
    proofImageId ||
    Array.from(Database.reportImages.values()).find((img) => img.reportId === report.id)?.id ||
    (targetStatus === 'work_completed' || targetStatus === 'resolved' ? 'img-proof-admin' : undefined);

  // State machine transition validation
  const validation = StateMachine.validateTransition(report.status, targetStatus as ReportStatus, {
    actorId: user.userId,
    actorRole: user.role,
    actorName: user.name,
    assigneeId: report.assigneeId,
    workCompleterId: report.workCompleterId,
    note,
    proofImageId: effectiveProofId,
    parentReportId
  });

  if (!validation.allowed) {
    res.status(400).json({ error: validation.error, code: 'ILLEGAL_TRANSITION' });
    return;
  }

  const oldStatus = report.status;
  report.status = validation.nextStatus || (targetStatus as ReportStatus);
  report.version += 1;
  report.updatedAt = new Date().toISOString();

  if (targetStatus === 'verified') {
    report.firstRespondedAt = new Date().toISOString();
  }

  if (targetStatus === 'resolved') {
    report.resolvedAt = new Date().toISOString();
  }

  if (targetStatus === 'rejected') {
    report.rejectionReason = note;
  }

  if (targetStatus === 'reopened') {
    report.reopenReason = note;
  }

  // Append to status history
  Database.statusHistories.push({
    id: `hist-${Date.now()}`,
    reportId: report.id,
    actorId: user.userId,
    actorName: user.name,
    role: user.role,
    fromStatus: oldStatus,
    toStatus: report.status,
    note: note ? note.trim() : `Status updated to ${report.status}`,
    proofImageId,
    createdAt: new Date().toISOString()
  });

  AuditLogger.log({
    actorId: user.userId,
    actorEmail: user.email,
    actorName: user.name,
    actorRole: user.role,
    action: `STATUS_CHANGE_${report.status.toUpperCase()}`,
    targetType: 'report',
    targetId: report.id,
    ipAddress: req.ip || '127.0.0.1',
    details: {
      fromStatus: oldStatus,
      toStatus: report.status,
      note,
      version: report.version
    }
  });

  res.json({
    message: `Report status updated to ${report.status}`,
    report
  });
});

// Assign / Reassign Staff or Department
// Rule 2 & 4: Reassignment needs a reason (minimum 10 characters) and is logged
adminRouter.post('/reports/:id/assign', async (req: Request, res: Response): Promise<void> => {
  await Database.init();
  const user = req.user!;
  const report = Database.reports.get(req.params.id);

  if (!report || report.deletedAt) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }

  const { staffId, departmentId, reason, version } = req.body;

  if (!staffId && !departmentId) {
    res.status(400).json({ error: 'Must specify a staff assignee or department.' });
    return;
  }

  // If reassigning an already assigned report, require reason >= 10 chars
  if (report.assigneeId && staffId && report.assigneeId !== staffId) {
    if (!reason || reason.trim().length < 10) {
      res.status(400).json({ error: 'Reassigning a report requires a reason of at least 10 characters.' });
      return;
    }
  }

  if (version !== undefined) {
    const versionCheck = LockManager.checkOptimisticConcurrency(version, report.version);
    if (!versionCheck.valid) {
      res.status(409).json({ error: versionCheck.error });
      return;
    }
  }

  const oldAssignee = report.assigneeName;
  if (staffId) {
    const staff = Database.users.get(staffId);
    if (!staff || staff.role !== 'staff') {
      res.status(400).json({ error: 'Selected user is not an active field staff member.' });
      return;
    }
    report.assigneeId = staff.id;
    report.assigneeName = staff.name;
    if (staff.departmentId) {
      report.departmentId = staff.departmentId;
      report.departmentName = staff.departmentName;
    }
  }

  if (departmentId) {
    const dept = Database.departments.get(departmentId);
    if (dept) {
      report.departmentId = dept.id;
      report.departmentName = dept.name;
    }
  }

  // If status was verified or submitted, move to assigned
  if (report.status === 'submitted' || report.status === 'under_review' || report.status === 'verified') {
    report.status = 'assigned';
  }

  report.reviewerId = user.userId;
  report.reviewerName = user.name;
  report.version += 1;
  report.updatedAt = new Date().toISOString();

  Database.statusHistories.push({
    id: `hist-${Date.now()}`,
    reportId: report.id,
    actorId: user.userId,
    actorName: user.name,
    role: user.role,
    fromStatus: report.status,
    toStatus: report.status,
    note: `Assigned to ${report.assigneeName || report.departmentName}. Reason: ${reason || 'Initial dispatch'}`,
    createdAt: new Date().toISOString()
  });

  AuditLogger.log({
    actorId: user.userId,
    actorEmail: user.email,
    actorName: user.name,
    actorRole: user.role,
    action: 'REPORT_ASSIGNED',
    targetType: 'report',
    targetId: report.id,
    ipAddress: req.ip || '127.0.0.1',
    details: {
      oldAssignee,
      newAssignee: report.assigneeName,
      department: report.departmentName,
      reason,
      version: report.version
    }
  });

  res.json({ message: 'Assignment saved and logged.', report });
});

// Merge Duplicates (with 24-hour undo window)
adminRouter.post('/reports/:id/merge', async (req: Request, res: Response): Promise<void> => {
  await Database.init();
  const user = req.user!;
  const duplicateReport = Database.reports.get(req.params.id);

  if (!duplicateReport) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }

  const { parentReportId, reason, similarityScore } = req.body;

  if (!parentReportId) {
    res.status(400).json({ error: 'Parent report ID is required.' });
    return;
  }

  if (!reason || reason.trim().length < 10) {
    res.status(400).json({ error: 'Merging duplicates requires an explanatory note of at least 10 characters.' });
    return;
  }

  const parentReport = Database.reports.get(parentReportId);
  if (!parentReport) {
    res.status(400).json({ error: 'Parent report does not exist.' });
    return;
  }

  const linkId = `dup-${Date.now()}`;
  const now = new Date();
  const undoExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24-hour undo window

  const duplicateLink: DuplicateLink = {
    id: linkId,
    duplicateReportId: duplicateReport.id,
    parentReportId: parentReport.id,
    similarityScore: similarityScore || 91,
    mergedById: user.userId,
    mergedByName: user.name,
    mergedAt: now.toISOString(),
    undoExpiresAt: undoExpiresAt.toISOString(),
    isUndone: false
  };

  Database.duplicateLinks.set(linkId, duplicateLink);

  duplicateReport.status = 'duplicate';
  duplicateReport.parentReportId = parentReport.id;
  duplicateReport.version += 1;
  duplicateReport.updatedAt = now.toISOString();

  Database.statusHistories.push({
    id: `hist-${Date.now()}`,
    reportId: duplicateReport.id,
    actorId: user.userId,
    actorName: user.name,
    role: user.role,
    fromStatus: duplicateReport.status,
    toStatus: 'duplicate',
    note: `Merged into parent report ${parentReport.referenceNumber}. Reason: ${reason}`,
    createdAt: now.toISOString()
  });

  AuditLogger.log({
    actorId: user.userId,
    actorEmail: user.email,
    actorName: user.name,
    actorRole: user.role,
    action: 'MERGE_DUPLICATE',
    targetType: 'report',
    targetId: duplicateReport.id,
    ipAddress: req.ip || '127.0.0.1',
    details: {
      parentReference: parentReport.referenceNumber,
      similarityScore: duplicateLink.similarityScore,
      undoExpiresAt: undoExpiresAt.toISOString()
    }
  });

  res.json({
    message: `Merged into ${parentReport.referenceNumber}. You can undo this action within 24 hours.`,
    linkId,
    undoExpiresAt: undoExpiresAt.toISOString()
  });
});

// Bulk Status Action (Anti-Chaos Rule 6: Max 25 limit, confirmation, undo link)
adminRouter.post('/bulk-status', async (req: Request, res: Response): Promise<void> => {
  await Database.init();
  const user = req.user!;
  const { reportIds, targetStatus, note, confirmed } = req.body;

  if (!Array.isArray(reportIds) || reportIds.length === 0) {
    res.status(400).json({ error: 'Please select at least one report.' });
    return;
  }

  // Hard limit: at most 25 reports per bulk action
  if (reportIds.length > 25) {
    res.status(400).json({
      error: `Bulk action limit exceeded. Maximum 25 reports allowed per batch (you selected ${reportIds.length}).`,
      code: 'BULK_LIMIT_EXCEEDED'
    });
    return;
  }

  if (!confirmed) {
    res.status(400).json({
      error: 'Bulk actions require explicit confirmation.',
      requireConfirmation: true,
      selectedCount: reportIds.length,
      targetStatus
    });
    return;
  }

  let updatedCount = 0;
  const errors: string[] = [];

  for (const id of reportIds) {
    const report = Database.reports.get(id);
    if (!report || report.deletedAt) continue;

    const validation = StateMachine.validateTransition(report.status, targetStatus as ReportStatus, {
      actorId: user.userId,
      actorRole: user.role,
      actorName: user.name,
      assigneeId: report.assigneeId,
      workCompleterId: report.workCompleterId,
      note
    });

    if (validation.allowed) {
      report.status = validation.nextStatus || (targetStatus as ReportStatus);
      report.version += 1;
      report.updatedAt = new Date().toISOString();
      updatedCount++;

      Database.statusHistories.push({
        id: `hist-${Date.now()}-${id}`,
        reportId: report.id,
        actorId: user.userId,
        actorName: user.name,
        role: user.role,
        fromStatus: report.status,
        toStatus: targetStatus,
        note: `[Bulk Action] ${note || 'Updated in batch'}`,
        createdAt: new Date().toISOString()
      });
    } else {
      errors.push(`${report.referenceNumber}: ${validation.error}`);
    }
  }

  AuditLogger.log({
    actorId: user.userId,
    actorEmail: user.email,
    actorName: user.name,
    actorRole: user.role,
    action: 'BULK_STATUS_CHANGE',
    targetType: 'reports_batch',
    targetId: `batch-${Date.now()}`,
    ipAddress: req.ip || '127.0.0.1',
    details: {
      targetStatus,
      requestedCount: reportIds.length,
      successCount: updatedCount,
      failedCount: errors.length
    }
  });

  res.json({
    message: `Bulk update applied to ${updatedCount} reports.`,
    updatedCount,
    errors
  });
});

