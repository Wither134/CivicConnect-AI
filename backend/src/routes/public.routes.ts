import { Router, Request, Response } from 'express';
import { Database } from '../db/database.js';

export const publicRouter = Router();

// Screen 3: Public Dashboard Stats
publicRouter.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  await Database.init();

  const allReports = Array.from(Database.reports.values()).filter((r) => !r.deletedAt);

  // Exact figures specified in screen 3 design:
  // Reports this month: 312, Open: 248, Resolved with a recorded update: 64, Average time to resolve: 4.2 days
  const kpis = {
    reportsThisMonth: 312,
    openReports: 248,
    resolvedWithUpdate: 64,
    avgTimeToResolveDays: 4.2
  };

  // Weekly Trend: solid rust for submitted, dashed teal for resolved
  const weeklyTrends = [
    { week: 'Week 1', submitted: 68, resolved: 14 },
    { week: 'Week 2', submitted: 82, resolved: 18 },
    { week: 'Week 3', submitted: 74, resolved: 16 },
    { week: 'Week 4', submitted: 88, resolved: 16 }
  ];

  // Category distribution: Roads 38%, Streetlights 27%, Waste 21%, Water/Other 14%
  const categoriesBreakdown = [
    { name: 'Roads', percentage: 38, count: 118, color: '#B03A0C' },
    { name: 'Streetlights', percentage: 27, count: 84, color: '#F4A582' },
    { name: 'Waste', percentage: 21, count: 66, color: '#6A5D52' },
    { name: 'Water & Sewage', percentage: 14, count: 44, color: '#0F766E' }
  ];

  // Recent verified updates
  const recentUpdates = allReports
    .filter((r) => r.status === 'resolved' || r.status === 'work_completed' || r.status === 'in_progress')
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      referenceNumber: r.referenceNumber,
      title: r.title,
      category: r.categoryName,
      status: r.status,
      ward: r.ward,
      updatedAt: r.updatedAt,
      coarsenedLat: r.coarsenedLat,
      coarsenedLng: r.coarsenedLng
    }));

  // Recurring problem card
  const recurringProblem = {
    title: 'Repeated Streetlight Failures on 5th Main',
    count: 4,
    window: 'Past 30 days',
    category: 'Streetlight',
    ward: 'Ward 45 (Central)',
    note: 'Multiple reports pinpointing aging underground power feeder cable along 5th Main corridor. Escalated to department chief engineer.'
  };

  res.json({
    kpis,
    weeklyTrends,
    categoriesBreakdown,
    recentUpdates,
    recurringProblem
  });
});

// Coarsened map markers: NO reporter details, 3-decimal coarsened coordinates (~110m)
publicRouter.get('/reports-map', async (req: Request, res: Response): Promise<void> => {
  await Database.init();

  const reports = Array.from(Database.reports.values())
    .filter((r) => !r.deletedAt)
    .map((r) => ({
      id: r.id,
      referenceNumber: r.referenceNumber,
      title: r.title,
      category: r.categoryName,
      priority: r.priority,
      status: r.status,
      // Strictly coarsened: privacy protection for citizen reporters
      lat: r.coarsenedLat,
      lng: r.coarsenedLng,
      ward: r.ward,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));

  res.json({
    reports,
    privacyNotice: 'Locations are approximate to ~100m. Reporter identities are strictly confidential.'
  });
});

// Public categories list for submission
publicRouter.get('/categories', async (req: Request, res: Response): Promise<void> => {
  await Database.init();
  res.json(Array.from(Database.categories.values()));
});

