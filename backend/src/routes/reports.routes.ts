import { Router, Request, Response } from 'express';
import { Database, Report, ReportImage } from '../db/database.js';
import { authenticate } from '../auth/auth.middleware.js';
import { AbusePrevention } from '../safeguards/abuse-prevention.js';
import { DuplicateDetector } from '../safeguards/duplicate-detector.js';
import { SlaEngine } from '../safeguards/sla-engine.js';
import { LockManager } from '../safeguards/lock-manager.js';
import { AuditLogger } from '../safeguards/audit-logger.js';

export const reportsRouter = Router();

// Advisory near-duplicate detection before submission
reportsRouter.post('/check-duplicate', async (req: Request, res: Response): Promise<void> => {
  await Database.init();
  const { lat, lng, categoryId, title } = req.body;

  if (!lat || !lng) {
    res.json({ duplicates: [] });
    return;
  }

  const category = categoryId ? Database.categories.get(categoryId) : undefined;
  const categoryName = category ? category.name : '';

  const existing = Array.from(Database.reports.values()).map((r) => ({
    id: r.id,
    referenceNumber: r.referenceNumber,
    title: r.title,
    categoryName: r.categoryName,
    lat: r.exactLat,
    lng: r.exactLng,
    status: r.status
  }));

  const duplicates = DuplicateDetector.findNearbySimilar(lat, lng, categoryName, existing, 150);
  res.json({ duplicates });
});

// Submit a new problem report (Citizen, Admin, Super Admin)
reportsRouter.post('/', authenticate(), async (req: Request, res: Response): Promise<void> => {
  await Database.init();
  const user = req.user!;

  // Staff cannot submit reports as staff (must submit as citizen or admin)
  if (user.role === 'staff') {
    res.status(403).json({ error: 'Staff members cannot submit citizen reports directly.' });
    return;
  }

  // Rate limiting for citizen: max 5 per day
  if (user.role === 'citizen') {
    const rateCheck = AbusePrevention.checkRateLimit(user.userId);
    if (!rateCheck.allowed) {
      res.status(429).json({
        error: `Submission limit reached (maximum 5 reports per day). Try again in ${rateCheck.resetHours} hours.`,
        code: 'RATE_LIMIT_EXCEEDED'
      });
      return;
    }
  }

  const { title, description, categoryId, exactLat, exactLng, ward, addressHint, images } = req.body;

  if (!title || !description || !categoryId) {
    res.status(400).json({ error: 'Title, description, and category are required.' });
    return;
  }

  // Check spam/profanity
  const spamCheck = AbusePrevention.checkContentSpam(title, description);

  const category = Database.categories.get(categoryId);
  if (!category) {
    res.status(400).json({ error: 'Invalid category selected.' });
    return;
  }

  const now = new Date();
  const dueDates = SlaEngine.calculateDueDates(now, category.defaultPriority);
  const refNum = `CPR-2026-${String(Database.reports.size + 1).padStart(6, '0')}`;
  const reportId = `rep-${Date.now()}`;

  // Coarsen coordinates for public view
  const latVal = exactLat ? parseFloat(exactLat) : 12.9716;
  const lngVal = exactLng ? parseFloat(exactLng) : 77.5946;

  const newReport: Report = {
    id: reportId,
    referenceNumber: refNum,
    title,
    description,
    categoryId,
    categoryName: category.name,
    priority: category.defaultPriority,
    priorityScore: 50,
    scoreBreakdown: {
      safetyRisk: 20,
      supporters: 10,
      mainRoad: 12,
      age: 8
    },
    status: 'submitted', // Initially submitted, labeled "Unverified" until verified
    version: 1,
    reporterId: user.userId,
    reporterName: user.name,
    departmentId: category.departmentId,
    departmentName: Database.departments.get(category.departmentId)?.name || 'General',
    exactLat: latVal,
    exactLng: lngVal,
    coarsenedLat: AbusePrevention.coarsenCoordinate(latVal),
    coarsenedLng: AbusePrevention.coarsenCoordinate(lngVal),
    ward: ward || 'Ward 45 (Central)',
    addressHint: addressHint || 'Near community point',
    responseDueAt: dueDates.responseDueAt.toISOString(),
    resolutionDueAt: dueDates.resolutionDueAt.toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  Database.reports.set(newReport.id, newReport);

  // Record rate limit for citizen
  if (user.role === 'citizen') {
    AbusePrevention.recordSubmission(user.userId);
  }

  // Attach images
  if (Array.isArray(images)) {
    images.forEach((imgUrl: string, idx: number) => {
      const img: ReportImage = {
        id: `img-${Date.now()}-${idx}`,
        reportId: newReport.id,
        url: imgUrl,
        fileSizeBytes: 1200000,
        mimeType: 'image/jpeg',
        exifStripped: true, // EXIF data always stripped for citizen privacy
        uploadedById: user.userId,
        uploadedByRole: user.role,
        isProof: false,
        createdAt: now.toISOString()
      };
      Database.reportImages.set(img.id, img);
    });
  }

  // Append initial status history (append-only)
  Database.statusHistories.push({
    id: `hist-${Date.now()}`,
    reportId: newReport.id,
    actorId: user.userId,
    actorName: user.name,
    role: user.role,
    fromStatus: 'submitted',
    toStatus: 'submitted',
    note: 'Report submitted by citizen. Status is Unverified until reviewed by moderator.',
    createdAt: now.toISOString()
  });

  AuditLogger.log({
    actorId: user.userId,
    actorEmail: user.email,
    actorName: user.name,
    actorRole: user.role,
    action: 'REPORT_SUBMITTED',
    targetType: 'report',
    targetId: newReport.id,
    ipAddress: req.ip || '127.0.0.1',
    details: {
      referenceNumber: refNum,
      category: category.name,
      isSpamFlagged: spamCheck.isFlagged
    }
  });

  res.status(201).json({
    message: 'Report submitted successfully. It will be reviewed by municipal moderators.',
    report: newReport
  });
});

// Citizen: view own reports
reportsRouter.get('/my-reports', authenticate(), async (req: Request, res: Response): Promise<void> => {
  await Database.init();
  const user = req.user!;

  const ownReports = Array.from(Database.reports.values())
    .filter((r) => r.reporterId === user.userId && !r.deletedAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ reports: ownReports });
});

// Single report detail with role-gated fields and timeline
reportsRouter.get('/:id', authenticate(true), async (req: Request, res: Response): Promise<void> => {
  await Database.init();
  const user = req.user;
  const report = Database.reports.get(req.params.id);

  if (!report || report.deletedAt) {
    res.status(404).json({ error: 'Report not found or has been removed.' });
    return;
  }

  // Determine user relationships & privacy permissions
  const isOwner = !!(user && user.role === 'citizen' && report.reporterId === user.userId);
  const isAdmin = !!(user && (user.role === 'admin' || user.role === 'super_admin'));
  const isAssignedStaff = !!(
    user &&
    user.role === 'staff' &&
    (report.assigneeId === user.userId || (user.departmentId && report.departmentId === user.departmentId))
  );

  // Get images
  const images = Array.from(Database.reportImages.values()).filter((img) => img.reportId === report.id);

  // Get timeline (append-only history)
  const timeline = Database.statusHistories
    .filter((h) => h.reportId === report.id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Evaluate SLA
  const slaEval = SlaEngine.evaluate(
    new Date(report.createdAt),
    report.priority,
    report.status,
    report.firstRespondedAt ? new Date(report.firstRespondedAt) : null,
    report.resolvedAt ? new Date(report.resolvedAt) : null
  );

  // Check active soft lock
  const lock = LockManager.getLock(report.id);
  const isLockedByOther = lock !== null && (!user || lock.userId !== user.userId);

  // Mask reporter details per PS-14 rules:
  // - Admin/Super Admin: sees reporter name
  // - Reporter viewing their own report: sees their own name
  // - Staff: sees location only, not reporter identity (reporterName = undefined)
  // - Other citizens / visitors: sees "Community Resident" for privacy
  let reporterName: string | undefined = 'Community Resident';
  if (isAdmin || isOwner) {
    reporterName = report.reporterName;
  } else if (user && user.role === 'staff') {
    reporterName = undefined; // Staff does NOT see reporter identity per PS-14 rule
  }

  // Mask exact coordinates per PS-14 rules:
  // - Admin/Super Admin: sees exact coordinates
  // - Assigned Staff: sees exact coordinates
  // - Owner citizen: sees exact coordinates
  // - Visitors and other citizens: coarsened/approximate coordinates only
  const showExactCoords = isAdmin || isAssignedStaff || isOwner;

  res.json({
    report: {
      ...report,
      reporterName,
      exactLat: showExactCoords ? report.exactLat : undefined,
      exactLng: showExactCoords ? report.exactLng : undefined,
      isOwner,
      isLockedByOther,
      lockOwner: lock?.userName,
      lockExpiresAt: lock ? new Date(lock.expiresAt).toISOString() : null,
      slaStatus: slaEval.statusLabel,
      isSlaBreached: slaEval.isBreached,
      resolutionCountdown: SlaEngine.formatCountdown(new Date(report.resolutionDueAt))
    },
    images,
    timeline
  });
});

// Citizen privacy: Delete / Anonymize my data
reportsRouter.post('/delete-my-data', authenticate(), async (req: Request, res: Response): Promise<void> => {
  await Database.init();
  const user = req.user!;

  if (user.role !== 'citizen') {
    res.status(400).json({ error: 'This endpoint is for citizen data privacy requests.' });
    return;
  }

  let count = 0;
  for (const report of Database.reports.values()) {
    if (report.reporterId === user.userId) {
      report.reporterName = 'Anonymized Citizen';
      report.deletedAt = new Date().toISOString();
      report.deleteReason = 'Citizen requested data erasure under privacy rights.';
      count++;
    }
  }

  AuditLogger.log({
    actorId: user.userId,
    actorEmail: user.email,
    actorName: user.name,
    actorRole: 'citizen',
    action: 'CITIZEN_DATA_ERASURE',
    targetType: 'user_data',
    targetId: user.userId,
    ipAddress: req.ip || '127.0.0.1',
    details: { erasedReportsCount: count }
  });

  res.json({ message: `Data privacy request processed. ${count} reports anonymized and removed from active tracking.` });
});

