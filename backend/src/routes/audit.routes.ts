import { Router, Request, Response } from 'express';
import { AuditLogger } from '../safeguards/audit-logger.js';
import { authenticate, requireRole } from '../auth/auth.middleware.js';

export const auditRouter = Router();

// Both Admin and Super Admin have read access to the audit log
auditRouter.use(authenticate(), requireRole(['admin', 'super_admin']));

// Query audit log with filters
auditRouter.get('/logs', (req: Request, res: Response): void => {
  const { actorId, role, action, targetType, startDate, endDate } = req.query;

  const logs = AuditLogger.query({
    actorId: actorId as string,
    role: role as string,
    action: action as string,
    targetType: targetType as string,
    startDate: startDate as string,
    endDate: endDate as string
  });

  res.json({ logs });
});

// Export audit log to CSV format (Super Admin exportable)
auditRouter.get('/export', requireRole(['super_admin']), (req: Request, res: Response): void => {
  const { actorId, role, action, startDate, endDate } = req.query;

  const csv = AuditLogger.toCSV({
    actorId: actorId as string,
    role: role as string,
    action: action as string,
    startDate: startDate as string,
    endDate: endDate as string
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="civicfix_audit_${Date.now()}.csv"`);
  res.send(csv);
});

