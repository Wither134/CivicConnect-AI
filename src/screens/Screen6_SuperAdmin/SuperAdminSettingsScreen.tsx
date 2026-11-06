import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Pill } from '../../components/common/Pill.js';
import { RoleBadge } from '../../components/common/RoleBadge.js';
import {
  IconUsers,
  IconShield,
  IconLock,
  IconClock,
  IconSettings,
  IconPlus,
  IconDownload,
  IconSearch,
  IconAlertTriangle,
  IconCheck
} from '../../components/common/Icons.js';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';

export interface SuperAdminSettingsScreenProps {
  navigate: (route: string) => void;
}

export const SuperAdminSettingsScreen: React.FC<SuperAdminSettingsScreenProps> = ({ navigate }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'users' | 'sla' | 'audit' | 'departments'>('users');

  // Users Management State
  const [users, setUsers] = useState<any[]>([]);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteName, setInviteName] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<'staff' | 'admin'>('staff');
  const [inviteDept, setInviteDept] = useState<string>('dept-elec');

  // Role Change Modal
  const [showRoleModal, setShowRoleModal] = useState<boolean>(false);
  const [targetUser, setTargetUser] = useState<any | null>(null);
  const [newRole, setNewRole] = useState<string>('staff');
  const [roleReason, setRoleReason] = useState<string>('');

  // SLA Settings State
  const [slaPolicies, setSlaPolicies] = useState<any>({
    critical: { priority: 'critical', responseTargetHours: 4, resolutionTargetHours: 24 },
    high: { priority: 'high', responseTargetHours: 24, resolutionTargetHours: 72 },
    medium: { priority: 'medium', responseTargetHours: 72, resolutionTargetHours: 168 },
    low: { priority: 'low', responseTargetHours: 168, resolutionTargetHours: 336 }
  });

  // Audit Log State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditFilterAction, setAuditFilterAction] = useState<string>('');
  const [auditFilterRole, setAuditFilterRole] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch Users
  const fetchUsers = async () => {
    try {
      const res = await apiRequest('/superadmin/users');
      setUsers(res.users);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Fetch Audit Logs
  const fetchAuditLogs = async () => {
    try {
      const query = new URLSearchParams();
      if (auditFilterAction) query.append('action', auditFilterAction);
      if (auditFilterRole) query.append('role', auditFilterRole);

      const res = await apiRequest(`/audit/logs?${query.toString()}`);
      setAuditLogs(res.logs || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchUsers(), fetchAuditLogs()]).finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, auditFilterAction, auditFilterRole]);

  // Handle Invite User
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await apiRequest('/superadmin/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          role: inviteRole,
          departmentId: inviteDept
        })
      });

      showToast(res.message, 'success');
      setShowInviteModal(false);
      setInviteName('');
      setInviteEmail('');
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Role Change
  const handleChangeRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;

    if (!roleReason || roleReason.trim().length < 10) {
      showToast('Changing a user role requires an audit justification of at least 10 characters.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiRequest(`/superadmin/users/${targetUser.id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ newRole, reason: roleReason })
      });

      showToast(res.message, 'success');
      setShowRoleModal(false);
      setRoleReason('');
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Deactivate / Reactivate
  const handleToggleStatus = async (u: any) => {
    const nextStatus = u.status === 'active' ? 'deactivated' : 'active';
    const reason = prompt(
      `Please provide a documented reason to ${nextStatus === 'deactivated' ? 'deactivate' : 'activate'} ${u.name} (min 10 characters):`,
      'Routine administrative access adjustment.'
    );

    if (!reason || reason.trim().length < 10) {
      showToast('Status changes require a reason with at least 10 characters.', 'error');
      return;
    }

    try {
      const res = await apiRequest(`/superadmin/users/${u.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus, reason })
      });
      showToast(res.message, 'success');
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Export Audit CSV
  const handleExportAuditCSV = () => {
    window.open('/api/audit/export', '_blank');
  };

  return (
    <div className="min-h-screen bg-[#FBF6EF] pb-16">
      {/* Top Banner */}
      <div className="bg-white border-b border-[#E9DFD3] px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-serif font-semibold text-[#1E1B18]">Super Admin Control Panel</h1>
            <RoleBadge role="super_admin" />
          </div>
          <p className="text-xs text-[#6A5D52]">
            Full authorization: User provisioning, role assignment, SLA benchmarks, and immutable audit inspection.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#EFE6DA] gap-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'users'
              ? 'border-[#B03A0C] text-[#B03A0C]'
              : 'border-transparent text-[#6A5D52] hover:text-[#1E1B18]'
              }`}
          >
            User Management ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('sla')}
            className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'sla'
              ? 'border-[#B03A0C] text-[#B03A0C]'
              : 'border-transparent text-[#6A5D52] hover:text-[#1E1B18]'
              }`}
          >
            SLA Settings
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${activeTab === 'audit'
              ? 'border-[#B03A0C] text-[#B03A0C]'
              : 'border-transparent text-[#6A5D52] hover:text-[#1E1B18]'
              }`}
          >
            Audit Log (Append-Only)
          </button>
        </div>

        {/* TAB 1: USERS TABLE */}
        {activeTab === 'users' && (
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-serif font-semibold text-[#1E1B18]">Provisioned System Users</h2>
                <p className="text-xs text-[#6A5D52]">
                  Staff, Admin, and Super Admin accounts are created strictly by invitation. Roles cannot be self-selected.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={<IconPlus size={15} />}
                onClick={() => setShowInviteModal(true)}
              >
                Invite user
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#EFE6DA] text-[#6A5D52] uppercase font-semibold">
                    <th className="pb-3">Name & Email</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3">Department</th>
                    <th className="pb-3">MFA Status</th>
                    <th className="pb-3">Last Login</th>
                    <th className="pb-3">Account Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE6DA]">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#FAF5EE]">
                      <td className="py-3.5 pr-4">
                        <p className="font-semibold text-sm text-[#1E1B18]">{u.name}</p>
                        <p className="text-[#6A5D52] font-mono text-[11px]">{u.email}</p>
                      </td>
                      <td className="py-3.5 pr-4">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="py-3.5 pr-4 text-[#6A5D52]">
                        {u.departmentName || '—'}
                      </td>
                      <td className="py-3.5 pr-4">
                        {u.mfaEnabled ? (
                          <span className="inline-flex items-center gap-1 text-[#0B5D54] font-semibold bg-[#D8F0EA] px-2 py-0.5 rounded-[4px] text-[10px]">
                            <IconCheck size={11} /> Enrolled
                          </span>
                        ) : (
                          <span className="text-[#6A5D52] text-[11px]">Optional (Citizen)</span>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 text-[#6A5D52] font-mono text-[11px]">
                        {u.lastLogin
                          ? new Date(u.lastLogin).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : 'Never'}
                      </td>
                      <td className="py-3.5 pr-4">
                        <span
                          className={`px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase ${u.status === 'active'
                            ? 'bg-[#D8F0EA] text-[#0B5D54]'
                            : u.status === 'invited'
                              ? 'bg-[#FDEBC8] text-[#6B3E00]'
                              : 'bg-[#FBE4E4] text-[#8F1D1D]'
                            }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right space-x-2">
                        {u.role !== 'super_admin' && (
                          <>
                            <button
                              onClick={() => {
                                setTargetUser(u);
                                setNewRole(u.role);
                                setShowRoleModal(true);
                              }}
                              className="text-xs font-semibold text-[#B03A0C] hover:underline cursor-pointer"
                            >
                              Change role
                            </button>
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`text-xs font-semibold hover:underline cursor-pointer ${u.status === 'active' ? 'text-[#8F1D1D]' : 'text-[#0F766E]'
                                }`}
                            >
                              {u.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* TAB 2: SLA SETTINGS */}
        {activeTab === 'sla' && (
          <Card className="p-6">
            <h2 className="text-lg font-serif font-semibold text-[#1E1B18] mb-1">
              Municipal SLA Policies
            </h2>
            <p className="text-xs text-[#6A5D52] mb-6">
              Defined response and resolution target windows by severity tier.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#FFF8F8] border border-[#FBE4E4] rounded-[10px]">
                <div className="flex items-center justify-between mb-2">
                  <Pill variant="critical" label="Critical Severity" dot={true} />
                  <span className="text-xs font-bold text-[#8F1D1D]">Tier 1</span>
                </div>
                <div className="space-y-1.5 text-xs text-[#1E1B18]">
                  <p>Response Target: <strong>4 hours</strong></p>
                  <p>Resolution Target: <strong>24 hours</strong></p>
                </div>
                <p className="text-[11px] text-[#8F1D1D] mt-3">Examples: Live high voltage wires, open manholes on school paths.</p>
              </div>

              <div className="p-4 bg-[#FFFBF0] border border-[#FDEBC8] rounded-[10px]">
                <div className="flex items-center justify-between mb-2">
                  <Pill variant="high" label="High Priority" dot={true} />
                  <span className="text-xs font-bold text-[#6B3E00]">Tier 2</span>
                </div>
                <div className="space-y-1.5 text-xs text-[#1E1B18]">
                  <p>Response Target: <strong>24 hours</strong></p>
                  <p>Resolution Target: <strong>72 hours (3 days)</strong></p>
                </div>
                <p className="text-[11px] text-[#6B3E00] mt-3">Examples: Main road dark corridors, deep merge lane potholes.</p>
              </div>

              <div className="p-4 bg-[#F8FAFD] border border-[#E6EAF5] rounded-[10px]">
                <div className="flex items-center justify-between mb-2">
                  <Pill variant="medium" label="Medium Priority" dot={true} />
                  <span className="text-xs font-bold text-[#2B3A67]">Tier 3</span>
                </div>
                <div className="space-y-1.5 text-xs text-[#1E1B18]">
                  <p>Response Target: <strong>72 hours</strong></p>
                  <p>Resolution Target: <strong>7 days (168 hours)</strong></p>
                </div>
                <p className="text-[11px] text-[#2B3A67] mt-3">Examples: Overflowing marketplace bins, cracked sidewalk curbs.</p>
              </div>

              <div className="p-4 bg-[#FBF6EF] border border-[#E9DFD3] rounded-[10px]">
                <div className="flex items-center justify-between mb-2">
                  <Pill variant="neutral" label="Low Priority" dot={false} />
                  <span className="text-xs font-bold text-[#6A5D52]">Tier 4</span>
                </div>
                <div className="space-y-1.5 text-xs text-[#1E1B18]">
                  <p>Response Target: <strong>7 days</strong></p>
                  <p>Resolution Target: <strong>14 days (336 hours)</strong></p>
                </div>
                <p className="text-[11px] text-[#6A5D52] mt-3">Examples: Faded road divider paint, cosmetic landscaping requests.</p>
              </div>
            </div>
          </Card>
        )}

        {/* TAB 3: AUDIT LOG */}
        {activeTab === 'audit' && (
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-serif font-semibold text-[#1E1B18]">Append-Only Audit Trail</h2>
                <p className="text-xs text-[#6A5D52]">
                  Every privileged operation is permanently logged. Immutable: Super Admin cannot edit or delete audit entries.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={<IconDownload size={15} />}
                onClick={handleExportAuditCSV}
              >
                Export CSV
              </Button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <input
                  type="text"
                  value={auditFilterAction}
                  onChange={(e) => setAuditFilterAction(e.target.value)}
                  placeholder="Filter by action name (e.g. STATUS, LOGIN, ASSIGN)..."
                  className="w-full h-[38px] px-3 rounded-[8px] border border-[#D9C9B8] text-xs text-[#1E1B18] bg-white focus:outline-none focus:border-[#B03A0C]"
                />
              </div>
              <div>
                <select
                  value={auditFilterRole}
                  onChange={(e) => setAuditFilterRole(e.target.value)}
                  className="w-full h-[38px] px-3 rounded-[8px] border border-[#D9C9B8] text-xs text-[#1E1B18] bg-white focus:outline-none focus:border-[#B03A0C]"
                >
                  <option value="">All Roles</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="citizen">Citizen</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#EFE6DA] text-[#6A5D52] uppercase font-semibold">
                    <th className="pb-3">Timestamp</th>
                    <th className="pb-3">Actor</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3">Action</th>
                    <th className="pb-3">Target</th>
                    <th className="pb-3">IP Address</th>
                    <th className="pb-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE6DA]">
                  {auditLogs.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#FAF5EE]">
                      <td className="py-2.5 pr-3 font-mono text-[11px] text-[#6A5D52] whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td className="py-2.5 pr-3 font-semibold text-[#1E1B18] whitespace-nowrap">
                        {entry.actorName}
                      </td>
                      <td className="py-2.5 pr-3">
                        <RoleBadge role={entry.actorRole} />
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-[11px] font-bold text-[#B03A0C]">
                        {entry.action}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-[11px] text-[#6A5D52]">
                        {entry.targetType}: {entry.targetId}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-[11px] text-[#6A5D52]">
                        {entry.ipAddress}
                      </td>
                      <td className="py-2.5 text-[11px] text-[#1E1B18] max-w-xs truncate">
                        {JSON.stringify(entry.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Modal: Invite User */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-md w-full p-6 bg-white rounded-[14px]">
            <h3 className="text-lg font-serif font-semibold text-[#1E1B18]">
              Invite Department Officer or Moderator
            </h3>
            <p className="text-xs text-[#6A5D52] mt-1 mb-4">
              Invited user will set their password and enroll in mandatory MFA upon first login.
            </p>

            <form onSubmit={handleInviteUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Anand V."
                  className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D9C9B8] text-sm text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                  Official Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="anand.v@civicfix.org"
                  className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D9C9B8] text-sm text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                  Assigned Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D9C9B8] text-sm text-[#1E1B18] bg-white focus:outline-none focus:border-[#B03A0C]"
                >
                  <option value="staff">Staff (Field Technician / Department Worker)</option>
                  <option value="admin">Admin (Queue Moderator / Coordinator)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                  Department
                </label>
                <select
                  value={inviteDept}
                  onChange={(e) => setInviteDept(e.target.value)}
                  className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D9C9B8] text-sm text-[#1E1B18] bg-white focus:outline-none focus:border-[#B03A0C]"
                >
                  <option value="dept-elec">Electrical Dept.</option>
                  <option value="dept-roads">Roads Dept.</option>
                  <option value="dept-waste">Solid Waste Management</option>
                  <option value="dept-water">Water & Sewage Board</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                >
                  Send Invitation
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Change Role */}
      {showRoleModal && targetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-md w-full p-6 bg-white rounded-[14px]">
            <h3 className="text-lg font-serif font-semibold text-[#1E1B18]">
              Change Role for {targetUser.name}
            </h3>
            <p className="text-xs text-[#6A5D52] mt-1 mb-4">
              Anti-Chaos Rule 11: All role modifications require an explicit audit justification.
            </p>

            <form onSubmit={handleChangeRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                  New Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D9C9B8] text-sm text-[#1E1B18] bg-white focus:outline-none focus:border-[#B03A0C]"
                >
                  <option value="citizen">Citizen</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                  Audit Justification (min 10 characters)
                </label>
                <textarea
                  rows={3}
                  required
                  value={roleReason}
                  onChange={(e) => setRoleReason(e.target.value)}
                  placeholder="e.g. Promoted to regional triage coordinator."
                  className="w-full p-3 rounded-[10px] border border-[#D9C9B8] text-sm text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowRoleModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                >
                  Confirm Role Change
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

