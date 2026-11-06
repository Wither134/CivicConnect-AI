import { Router, Request, Response } from 'express';
import { LockManager } from '../safeguards/lock-manager.js';
import { authenticate } from '../auth/auth.middleware.js';
import { Database } from '../db/database.js';

export const locksRouter = Router();

locksRouter.use(authenticate());

// Acquire or renew lock
locksRouter.post('/:reportId/acquire', (req: Request, res: Response): void => {
  const user = req.user!;
  const report = Database.reports.get(req.params.reportId);

  if (!report) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }

  const result = LockManager.acquireLock(
    report.id,
    user.userId,
    user.name,
    user.role,
    report.version
  );

  if (!result.success) {
    res.status(423).json({
      error: result.message,
      lock: result.lock,
      isLockedByOther: true
    });
    return;
  }

  res.json({
    message: result.message,
    lock: result.lock,
    isLockedByOther: false
  });
});

// Release lock
locksRouter.post('/:reportId/release', (req: Request, res: Response): void => {
  const user = req.user!;
  const released = LockManager.releaseLock(req.params.reportId, user.userId);
  res.json({ success: released });
});

// Get lock status
locksRouter.get('/:reportId/status', (req: Request, res: Response): void => {
  const user = req.user!;
  const lock = LockManager.getLock(req.params.reportId);
  res.json({
    isLocked: lock !== null,
    isLockedByOther: lock !== null && lock.userId !== user.userId,
    lock
  });
});

