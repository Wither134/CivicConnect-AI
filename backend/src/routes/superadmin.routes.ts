import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Database, User } from '../db/database.js';
import { authenticate, requireRole } from '../auth/auth.middleware.js';
import { AuditLogger } from '../safeguards/audit-logger.js';
import { SLA_POLICIES, Priority } from '../safeguards/sla-engine.js';
import { UserRole } from '../workflow/state-machine.js';

export const superAdminRouter = Router();

// Super Admin ONLY role gate
superAdminRouter.use(authenticate(), requireRole(['super_admin']));

// Get all users
superAdminRouter.get('/users', async (req: Request, res: Response): Promise<void> => {
  await Database.init();
  const users = Array.from(Database.users.values()).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    departmentId: u.departmentId,
    departmentName: u.departmentName,
    mfaEnabled: u.mfaEnabled,
    status: u.status,
    lastLogin: u.lastLogin,
    createdAt: u.createdAt
  }));
  res.json({ users });
});

// Invite user (Staff / Admin only, Super Admin invites, invitee sets password & MFA on first sign in)
superAdminRouter.post('/users/invite', async (req: Request, res: Response): Promise<void> => {
  await Database.init();
  const user = req.user!;
  const { name, email, role, departmentId } = req.body;

  if (!name || !email || !role) {
    res.status(400).json({ error: 'Name, email, and role are required.' });
    return;
  }

  if (role !== 'staff' && role !== 'admin') {
    res.status(400).json({ error: 'Invited roles can only be Staff or Admin.' });
    return;
  }

  const existing = Array.from(Database.users.values()).find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
  if (existing) {
    res.status(400).json({ error: 'User with this email already exists.' });
    return;
  }

  const dept = departmentId ? Database.departments.get(departmentId) : undefined;
  const tempPassword = `Invite#${Math.floor(100000 + Math.random() * 900000)}`;
  const hash = await bcrypt.hash(tempPassword, 10);

  const newUser: User = {
    id: `usr-inv-${Date.now()}`,
    name,
    email: email.toLowerCase(),
    passwordHash: hash,
    role: role as UserRole,
    departmentId: dept?.id || null,
    departmentName: dept?.name || null,
    mfaEnabled: true, // MFA strictly required for Staff & Admin
    mfaSecret: 'JBSWY3DPEHPK3PXP',
    status: 'invited',
    createdAt: new Date().toISOString()
  };

  Database.users.set(newUser.id, newUser);

  AuditLogger.log({
    actorId: user.userId,
    actorEmail: user.email,
    actorName: user.name,
    actorRole: 'super_admin',
    action: 'INVITE_USER',
    targetType: 'user',
    targetId: newUser.id,
    ipAddress: req.ip || '127.0.0.1',
    details: {
      invitedEmail: newUser.email,
      assignedRole: newUser.role,
      department: newUser.departmentName
    }
  });

  res.status(201).json({
    message: `Invitation sent to ${email}. The user will set their password and enroll in MFA upon first sign-in.`,
    user: newUser
  });
});

// Change user role (requires reason, logged)
superAdminRouter.put('/users/:id/role', async (req: Request, res: Response): Promise<void> => {
  await Database.init();
  const user = req.user!;
  const targetUser = Database.users.get(req.params.id);

  if (!targetUser) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const { newRole, reason } = req.body;
  if (!newRole) {
    res.status(400).json({ error: 'New role is required.' });
    return;
  }

  if (!reason || reason.trim().length < 10) {
    res.status(400).json({ error: 'Changing a user role requires an audit justification of at least 10 characters.' });
    return;
  }

  const oldRole = targetUser.role;
  targetUser.role = newRole as UserRole;

  AuditLogger.log({
    actorId: user.userId,
    actorEmail: user.email,
    actorName: user.name,
    actorRole: 'super_admin',
    action: 'CHANGE_USER_ROLE',
    targetType: 'user',
    targetId: targetUser.id,
    ipAddress: req.ip || '127.0.0.1',
    details: {
      userEmail: targetUser.email,
      oldRole,
      newRole,
      reason
    }
  });

  res.json({ message: `Role changed from ${oldRole} to ${newRole}.`, user: targetUser });
});

// Deactivate / Reactivate user
superAdminRouter.put('/users/:id/status', async (req: Request, res: Response): Promise<void> => {
  await Database.init();
  const user = req.user!;
  const targetUser = Database.users.get(req.params.id);

  if (!targetUser) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const { status, reason } = req.body;
  if (!status || !['active', 'deactivated'].includes(status)) {
    res.status(400).json({ error: 'Valid status (active or deactivated) is required.' });
    return;
  }

  if (!reason || reason.trim().length < 10) {
    res.status(400).json({ error: 'Changing account status requires a reason of at least 10 characters.' });
    return;
  }

  const oldStatus = targetUser.status;
  targetUser.status = status;

  AuditLogger.log({
    actorId: user.userId,
    actorEmail: user.email,
    actorName: user.name,
    actorRole: 'super_admin',
    action: status === 'deactivated' ? 'DEACTIVATE_USER' : 'ACTIVATE_USER',
    targetType: 'user',
    targetId: targetUser.id,
    ipAddress: req.ip || '127.0.0.1',
    details: {
      userEmail: targetUser.email,
      oldStatus,
      newStatus: status,
      reason
    }
  });

  res.json({ message: `User status changed to ${status}.`, user: targetUser });
});

// Soft-delete report (Anti-Chaos Rule 5: No hard deletes, soft-delete only with reason)
superAdminRouter.delete('/reports/:id/soft-delete', async (req: Request, res: Response): Promise<void> => {
  await Database.init();
  const user = req.user!;
  const report = Database.reports.get(req.params.id);

  if (!report) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }

  const { reason } = req.body;
  if (!reason || reason.trim().length < 10) {
    res.status(400).json({ error: 'Soft-deleting a report requires a documented reason of at least 10 characters.' });
    return;
  }

  report.deletedAt = new Date().toISOString();
  report.deleteReason = reason.trim();
  report.updatedAt = new Date().toISOString();

  AuditLogger.log({
    actorId: user.userId,
    actorEmail: user.email,
    actorName: user.name,
    actorRole: 'super_admin',
    action: 'SOFT_DELETE_REPORT',
    targetType: 'report',
    targetId: report.id,
    ipAddress: req.ip || '127.0.0.1',
    details: {
      referenceNumber: report.referenceNumber,
      reason
    }
  });

  res.json({ message: `Report ${report.referenceNumber} has been soft-deleted and archived.` });
});

// SLA Policies
superAdminRouter.get('/sla-settings', (req: Request, res: Response): void => {
  res.json({ policies: SLA_POLICIES });
});

superAdminRouter.put('/sla-settings', (req: Request, res: Response): void => {
  const user = req.user!;
  const { priority, responseHours, resolutionHours } = req.body;

  if (SLA_POLICIES[priority as Priority]) {
    SLA_POLICIES[priority as Priority].responseTargetHours = responseHours;
    SLA_POLICIES[priority as Priority].resolutionTargetHours = resolutionHours;

    AuditLogger.log({
      actorId: user.userId,
      actorEmail: user.email,
      actorName: user.name,
      actorRole: 'super_admin',
      action: 'UPDATE_SLA_POLICY',
      targetType: 'sla_policy',
      targetId: priority,
      ipAddress: req.ip || '127.0.0.1',
      details: { priority, responseHours, resolutionHours }
    });

    res.json({ message: 'SLA policy updated successfully.', policies: SLA_POLICIES });
  } else {
    res.status(400).json({ error: 'Invalid priority level.' });
  }
});

