import test from 'node:test';
import assert from 'node:assert';
import { UserRole } from '../workflow/state-machine.js';

interface Capabilities {
  canViewPublicDashboard: boolean;
  canSubmitReport: boolean;
  canViewOwnReports: boolean;
  canViewAllReports: boolean;
  canViewAssignedReportsOnly: boolean;
  canVerifyCategorizePrioritize: boolean;
  canAssignStaff: boolean;
  canAddProgressAndProof: boolean;
  canMarkWorkCompleted: boolean;
  canSetResolved: boolean;
  canMergeAndReject: boolean;
  canSeeReporterIdentity: boolean;
  canSeeExactCoordinates: boolean;
  canManageUsersAndSettings: boolean;
  canReadAuditLog: boolean;
}

export function evaluateCapabilities(role: UserRole, isOwner = false, isAssigned = false): Capabilities {
  return {
    canViewPublicDashboard: true, // All roles
    canSubmitReport: ['citizen', 'admin', 'super_admin'].includes(role),
    canViewOwnReports: ['citizen', 'admin', 'super_admin'].includes(role) || isOwner,
    canViewAllReports: ['admin', 'super_admin'].includes(role),
    canViewAssignedReportsOnly: role === 'staff' && isAssigned,
    canVerifyCategorizePrioritize: ['admin', 'super_admin'].includes(role),
    canAssignStaff: ['admin', 'super_admin'].includes(role),
    canAddProgressAndProof: ['admin', 'super_admin'].includes(role) || (role === 'staff' && isAssigned),
    canMarkWorkCompleted: ['admin', 'super_admin'].includes(role) || (role === 'staff' && isAssigned),
    canSetResolved: ['admin', 'super_admin'].includes(role),
    canMergeAndReject: ['admin', 'super_admin'].includes(role),
    canSeeReporterIdentity: ['admin', 'super_admin'].includes(role) || (role === 'citizen' && isOwner),
    canSeeExactCoordinates: ['admin', 'super_admin'].includes(role) || (role === 'staff' && isAssigned) || (role === 'citizen' && isOwner),
    canManageUsersAndSettings: role === 'super_admin',
    canReadAuditLog: ['admin', 'super_admin'].includes(role)
  };
}

test('Permission Matrix: Every Row for Every Role', async (t) => {
  // Visitor tests
  await t.test('Visitor capabilities check', () => {
    const v = evaluateCapabilities('visitor');
    assert.strictEqual(v.canViewPublicDashboard, true, 'Visitor can view public dashboard');
    assert.strictEqual(v.canSubmitReport, false, 'Visitor cannot submit report');
    assert.strictEqual(v.canVerifyCategorizePrioritize, false, 'Visitor cannot verify or prioritize');
    assert.strictEqual(v.canAssignStaff, false, 'Visitor cannot assign staff');
    assert.strictEqual(v.canSetResolved, false, 'Visitor cannot set resolved');
    assert.strictEqual(v.canManageUsersAndSettings, false, 'Visitor cannot manage users');
    assert.strictEqual(v.canReadAuditLog, false, 'Visitor cannot read audit log');
  });

  // Citizen tests
  await t.test('Citizen capabilities check', () => {
    const c = evaluateCapabilities('citizen', true, false);
    assert.strictEqual(c.canViewPublicDashboard, true);
    assert.strictEqual(c.canSubmitReport, true, 'Citizen can submit report');
    assert.strictEqual(c.canViewOwnReports, true, 'Citizen can view own reports');
    assert.strictEqual(c.canViewAllReports, false, 'Citizen cannot view all reports');
    assert.strictEqual(c.canVerifyCategorizePrioritize, false, 'Citizen cannot verify or prioritize');
    assert.strictEqual(c.canAssignStaff, false, 'Citizen cannot assign');
    assert.strictEqual(c.canSetResolved, false, 'Citizen cannot resolve');
    assert.strictEqual(c.canMergeAndReject, false, 'Citizen cannot merge or reject');
    assert.strictEqual(c.canManageUsersAndSettings, false, 'Citizen cannot manage settings');
    assert.strictEqual(c.canReadAuditLog, false, 'Citizen cannot read audit log');
  });

  // Staff tests
  await t.test('Staff capabilities check', () => {
    const sAssigned = evaluateCapabilities('staff', false, true);
    const sUnassigned = evaluateCapabilities('staff', false, false);

    assert.strictEqual(sAssigned.canViewPublicDashboard, true);
    assert.strictEqual(sAssigned.canSubmitReport, false, 'Staff cannot submit reports (must use citizen portal or admin)');
    assert.strictEqual(sAssigned.canViewAssignedReportsOnly, true, 'Staff can view assigned report');
    assert.strictEqual(sUnassigned.canViewAssignedReportsOnly, false, 'Staff cannot view unassigned report');
    assert.strictEqual(sAssigned.canAddProgressAndProof, true, 'Staff can add proof to assigned job');
    assert.strictEqual(sAssigned.canMarkWorkCompleted, true, 'Staff can mark work completed on assigned job');
    assert.strictEqual(sAssigned.canSetResolved, false, 'Staff CANNOT set resolved');
    assert.strictEqual(sAssigned.canVerifyCategorizePrioritize, false, 'Staff CANNOT verify or prioritize');
    assert.strictEqual(sAssigned.canAssignStaff, false, 'Staff CANNOT assign');
    assert.strictEqual(sAssigned.canMergeAndReject, false, 'Staff CANNOT merge or reject');
    assert.strictEqual(sAssigned.canSeeReporterIdentity, false, 'Staff sees location only, not reporter identity');
    assert.strictEqual(sAssigned.canSeeExactCoordinates, true, 'Staff sees exact coordinates of assigned job');
    assert.strictEqual(sAssigned.canManageUsersAndSettings, false, 'Staff CANNOT manage users');
    assert.strictEqual(sAssigned.canReadAuditLog, false, 'Staff CANNOT read audit log');
  });

  // Admin tests
  await t.test('Admin capabilities check', () => {
    const a = evaluateCapabilities('admin');
    assert.strictEqual(a.canViewPublicDashboard, true);
    assert.strictEqual(a.canSubmitReport, true);
    assert.strictEqual(a.canViewAllReports, true, 'Admin can view all reports');
    assert.strictEqual(a.canVerifyCategorizePrioritize, true, 'Admin can verify and prioritize');
    assert.strictEqual(a.canAssignStaff, true, 'Admin can assign staff');
    assert.strictEqual(a.canSetResolved, true, 'Admin can give final sign-off');
    assert.strictEqual(a.canMergeAndReject, true, 'Admin can merge duplicates and reject');
    assert.strictEqual(a.canSeeReporterIdentity, true, 'Admin can see reporter identity');
    assert.strictEqual(a.canSeeExactCoordinates, true, 'Admin can see exact coordinates');
    assert.strictEqual(a.canManageUsersAndSettings, false, 'Admin CANNOT manage users or SLAs (Super Admin only)');
    assert.strictEqual(a.canReadAuditLog, true, 'Admin CAN read audit log');
  });

  // Super Admin tests
  await t.test('Super Admin capabilities check', () => {
    const sa = evaluateCapabilities('super_admin');
    assert.strictEqual(sa.canViewPublicDashboard, true);
    assert.strictEqual(sa.canSubmitReport, true);
    assert.strictEqual(sa.canViewAllReports, true);
    assert.strictEqual(sa.canVerifyCategorizePrioritize, true);
    assert.strictEqual(sa.canAssignStaff, true);
    assert.strictEqual(sa.canSetResolved, true);
    assert.strictEqual(sa.canMergeAndReject, true);
    assert.strictEqual(sa.canManageUsersAndSettings, true, 'Super Admin CAN manage users, roles, SLAs');
    assert.strictEqual(sa.canReadAuditLog, true, 'Super Admin CAN read audit log');
  });
});

