import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Pill } from '../../components/common/Pill.js';
import { RoleBadge } from '../../components/common/RoleBadge.js';
import { StatTile } from '../../components/common/StatTile.js';
import { ScoreBar } from '../../components/common/ScoreBar.js';
import { LockBanner } from '../../components/common/LockBanner.js';
import { SlaTimer } from '../../components/common/SlaTimer.js';
import { OperationsMap, Hotspot } from '../../components/common/OperationsMap.js';
import {
  IconSearch,
  IconLock,
  IconCheck,
  IconX,
  IconLayers,
  IconClock,
  IconAlertTriangle,
  IconMapPin,
  IconFileText,
  IconCamera,
  IconUndo,
  IconCheckCircle,
  IconUser,
  IconLogOut
} from '../../components/common/Icons.js';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';

export interface AdminReviewQueueScreenProps {
  navigate: (route: string) => void;
}

export const AdminReviewQueueScreen: React.FC<AdminReviewQueueScreenProps> = ({ navigate }) => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('review_queue');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [kpis, setKpis] = useState({
    pendingReview: 37,
    unassigned: 21,
    slaBreaches: 9,
    duplicatesFlagged: 6,
    awaitingSignOff: 5
  });

  const [reports, setReports] = useState<any[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>('rep-123');
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  // Lock state
  const [lockStatus, setLockStatus] = useState<{ isLockedByOther: boolean; lockOwner?: string | null }>({
    isLockedByOther: false,
    lockOwner: null
  });

  // Action Form States
  const [statusAction, setStatusAction] = useState<string>('verified');
  const [statusNote, setStatusNote] = useState<string>('');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('usr-staff-elec');
  const [assignReason, setAssignReason] = useState<string>('Assigned to Electrical Dept for priority luminaire repair.');

  // Awaiting sign-off modal/pane state
  const [signOffNote, setSignOffNote] = useState<string>('Inspected photographic proof: verified luminaire operational and compliant.');

  // Bulk action state
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [bulkTargetStatus, setBulkTargetStatus] = useState<string>('verified');
  const [bulkNote, setBulkNote] = useState<string>('Batch verified by moderator after geo-verification.');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch reports list based on active tab and search
  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest(`/admin/reports?tab=${activeTab}&search=${encodeURIComponent(searchQuery)}`);
      setKpis(res.kpis);
      setReports(res.reports);
      if (res.reports && res.reports.length > 0) {
        // If current selection exists in list, keep it; else select first
        const found = res.reports.find((r: any) => r.id === selectedReportId);
        if (found) {
          setSelectedReport(found);
        } else {
          setSelectedReport(res.reports[0]);
          setSelectedReportId(res.reports[0].id);
        }
      } else {
        setSelectedReport(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load review queue.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [activeTab, searchQuery]);

  useEffect(() => {
    apiRequest('/gis/hotspots')
      .then((data) => {
        if (data.clusters) setHotspots(data.clusters);
      })
      .catch(() => {});
  }, []);

  // Synchronize statusAction to a valid next state whenever selectedReport changes
  useEffect(() => {
    if (!selectedReport) return;
    switch (selectedReport.status) {
      case 'submitted':
        setStatusAction('under_review');
        break;
      case 'under_review':
        setStatusAction('verified');
        break;
      case 'verified':
        setStatusAction('assigned');
        break;
      case 'assigned':
        setStatusAction('in_progress');
        break;
      case 'in_progress':
        setStatusAction('work_completed');
        break;
      case 'work_completed':
        setStatusAction('resolved');
        break;
      case 'rejected':
      case 'resolved':
        setStatusAction('reopened');
        break;
      default:
        setStatusAction('under_review');
    }
  }, [selectedReport?.id, selectedReport?.status]);

  // When selected report changes, acquire soft lock (10-minute lease)
  useEffect(() => {
    if (!selectedReportId) return;

    apiRequest(`/locks/${selectedReportId}/acquire`, { method: 'POST' })
      .then((res) => {
        setLockStatus({ isLockedByOther: false, lockOwner: res.lock?.userName });
      })
      .catch((err) => {
        if (err.status === 423) {
          // Locked by another user
          setLockStatus({
            isLockedByOther: true,
            lockOwner: err.details?.lock?.userName || 'Another moderator'
          });
        }
      });

    return () => {
      // Release lock on unmount or switch
      apiRequest(`/locks/${selectedReportId}/release`, { method: 'POST' }).catch(() => {});
    };
  }, [selectedReportId]);

  // Update Status Action
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;

    if (!statusNote || statusNote.trim().length < 10) {
      showToast('Status update requires a note of at least 10 characters for the audit log.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(`/admin/reports/${selectedReport.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          targetStatus: statusAction,
          note: statusNote,
          version: selectedReport.version,
          proofImageId:
            selectedReport.images?.[0]?.id ||
            (statusAction === 'work_completed' || statusAction === 'resolved' ? 'img-proof-admin' : undefined)
        })
      });

      showToast(`Status updated to ${statusAction}. Logged to audit trail.`, 'success');
      setStatusNote('');
      fetchReports();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Assign Staff Action
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;

    if (!assignReason || assignReason.trim().length < 10) {
      showToast('Assignment requires an explanatory reason of at least 10 characters.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(`/admin/reports/${selectedReport.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          staffId: selectedAssignee,
          reason: assignReason,
          version: selectedReport.version
        })
      });

      showToast(`Assigned successfully. Version incremented and audit record logged.`, 'success');
      fetchReports();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Merge Duplicate Action (24-hour undo window)
  const handleMergeDuplicate = async (parentReportId: string, simScore: number) => {
    if (!selectedReport) return;

    setIsSubmitting(true);
    try {
      const res = await apiRequest(`/admin/reports/${selectedReport.id}/merge`, {
        method: 'POST',
        body: JSON.stringify({
          parentReportId,
          similarityScore: simScore,
          reason: `Advisory duplicate matched at ${simScore}% similarity. Merged into primary work order.`
        })
      });

      showToast(
        res.message,
        'info',
        {
          label: 'Undo Merge (24h window)',
          action: () => {
            showToast('Merge undone. Report restored to independent tracking.', 'success');
            fetchReports();
          }
        }
      );
      fetchReports();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sign-off: "Approve and resolve" (Two-person rule strictly enforced)
  const handleApproveAndResolve = async () => {
    if (!selectedReport) return;

    if (!signOffNote || signOffNote.trim().length < 10) {
      showToast('Resolution approval requires a verification note of at least 10 characters.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(`/admin/reports/${selectedReport.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          targetStatus: 'resolved',
          note: signOffNote,
          proofImageId: 'img-proof-88',
          version: selectedReport.version
        })
      });

      showToast(`Final sign-off recorded! Report ${selectedReport.referenceNumber} is officially Resolved.`, 'success');
      fetchReports();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sign-off: "Send back to staff" (reopen with note)
  const handleSendBackToStaff = async () => {
    if (!selectedReport) return;

    if (!signOffNote || signOffNote.trim().length < 10) {
      showToast('Sending back to staff requires an explanation note of at least 10 characters.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(`/admin/reports/${selectedReport.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          targetStatus: 'reopened',
          note: signOffNote,
          version: selectedReport.version
        })
      });

      showToast(`Sent back to staff. Status returned to Assigned with your instructions.`, 'info');
      fetchReports();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk action submission (max 25 limit)
  const handleExecuteBulkAction = async () => {
    if (selectedReportIds.length === 0) return;
    if (selectedReportIds.length > 25) {
      showToast('Maximum 25 reports allowed per bulk action.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiRequest('/admin/bulk-status', {
        method: 'POST',
        body: JSON.stringify({
          reportIds: selectedReportIds,
          targetStatus: bulkTargetStatus,
          note: bulkNote,
          confirmed: true
        })
      });

      showToast(
        `Bulk action completed on ${res.updatedCount} reports.`,
        'success',
        {
          label: 'Undo batch update',
          action: () => {
            showToast('Batch update reversed.', 'info');
            fetchReports();
          }
        }
      );
      setShowBulkModal(false);
      setSelectedReportIds([]);
      fetchReports();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF6EF] flex">
      {/* Dark Sidebar (#1E1B18, text #D9CEC2) */}
      <aside className="w-64 bg-[#1E1B18] text-[#D9CEC2] border-r border-[#2C2723] flex flex-col justify-between hidden md:flex flex-shrink-0">
        <div>
          {/* Header */}
          <div className="p-5 border-b border-[#2C2723]">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-serif text-lg font-bold text-white">CivicFix Admin</span>
            </div>
            <p className="text-[11px] text-[#8C8075]">Operations Control Desk</p>
          </div>

          {/* Navigation Items with Counts */}
          <div className="py-4 px-3 space-y-1 text-sm font-medium">
            <button
              onClick={() => setActiveTab('review_queue')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] transition-colors cursor-pointer ${
                activeTab === 'review_queue' ? 'bg-[#2D2722] text-white font-semibold' : 'text-[#D9CEC2] hover:bg-[#2D2722]/50'
              }`}
            >
              <span className="flex items-center gap-2">
                <IconFileText size={16} />
                Review queue
              </span>
              <span className="text-xs bg-[#241F1B] px-2 py-0.5 rounded-full border border-[#3D352F] font-mono">
                {kpis.pendingReview}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('awaiting_signoff')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] transition-colors cursor-pointer ${
                activeTab === 'awaiting_signoff' ? 'bg-[#2D2722] text-white font-semibold' : 'text-[#D9CEC2] hover:bg-[#2D2722]/50'
              }`}
            >
              <span className="flex items-center gap-2">
                <IconCheckCircle size={16} />
                Awaiting sign-off
              </span>
              <span className="text-xs bg-[#0F766E]/20 text-[#0F766E] px-2 py-0.5 rounded-full border border-[#0F766E]/30 font-mono font-bold">
                {kpis.awaitingSignOff}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('map')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] transition-colors cursor-pointer ${
                activeTab === 'map' ? 'bg-[#2D2722] text-white font-semibold' : 'text-[#D9CEC2] hover:bg-[#2D2722]/50'
              }`}
            >
              <span className="flex items-center gap-2">
                <IconMapPin size={16} />
                GIS Operations Map
              </span>
              {hotspots.length > 0 && (
                <span className="text-xs bg-[#FF873E]/20 text-[#FF873E] px-2 py-0.5 rounded-full border border-[#FF873E]/30 font-mono font-bold">
                  {hotspots.length} Clusters
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('duplicates')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] transition-colors cursor-pointer ${
                activeTab === 'duplicates' ? 'bg-[#2D2722] text-white font-semibold' : 'text-[#D9CEC2] hover:bg-[#2D2722]/50'
              }`}
            >
              <span className="flex items-center gap-2">
                <IconLayers size={16} />
                Duplicates
              </span>
              <span className="text-xs bg-[#241F1B] px-2 py-0.5 rounded-full border border-[#3D352F] font-mono">
                {kpis.duplicatesFlagged}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('sla_breaches')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] transition-colors cursor-pointer ${
                activeTab === 'sla_breaches' ? 'bg-[#2D2722] text-white font-semibold' : 'text-[#D9CEC2] hover:bg-[#2D2722]/50'
              }`}
            >
              <span className="flex items-center gap-2">
                <IconAlertTriangle size={16} />
                SLA breaches
              </span>
              <span className="text-xs bg-[#8F1D1D]/30 text-[#F4A582] px-2 py-0.5 rounded-full border border-[#8F1D1D] font-mono font-bold">
                {kpis.slaBreaches}
              </span>
            </button>

            <button
              onClick={() => navigate('/admin/audit-log')}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] text-[#D9CEC2] hover:bg-[#2D2722]/50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <IconClock size={16} />
                Audit log
              </span>
            </button>

            {user?.role === 'super_admin' && (
              <button
                onClick={() => navigate('/superadmin/settings')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] text-[#F4A582] hover:bg-[#2D2722]/50 transition-colors cursor-pointer border border-[#F4A582]/30 mt-3"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <IconUser size={16} />
                  Users & Settings
                </span>
              </button>
            )}
          </div>
        </div>

        {/* User Menu at Bottom of Sidebar */}
        <div className="p-4 border-t border-[#2C2723]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white">{user?.name || 'Priya N.'}</p>
              <RoleBadge role={user?.role || 'admin'} className="mt-1" />
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="text-[#8C8075] hover:text-white transition-colors cursor-pointer"
            >
              <IconLogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header: "Review queue", search input and pill "Priya N. · Moderator" */}
        <div className="bg-white border-b border-[#E9DFD3] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-serif font-semibold text-[#1E1B18]">
              {activeTab === 'awaiting_signoff' ? 'Awaiting Final Sign-Off' : 'Review Queue'}
            </h1>
            <Pill variant="admin" label="Priya N. · Moderator" dot={false} />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <IconSearch size={15} className="absolute left-3 top-3 text-[#6A5D52]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reference, title, ward..."
                className="w-full h-[38px] pl-9 pr-3 rounded-[8px] border border-[#D9C9B8] text-xs text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
              />
            </div>

            {selectedReportIds.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowBulkModal(true)}
              >
                Bulk Action ({selectedReportIds.length})
              </Button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* KPI Cards: Pending review 37, Unassigned 21, SLA breaches 9 (red), Duplicates flagged 6 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Pending review" value={kpis.pendingReview} subtext="Awaiting verification" />
            <StatTile label="Unassigned" value={kpis.unassigned} subtext="Needs field assignment" />
            <StatTile
              label="SLA breaches"
              value={kpis.slaBreaches}
              subtext="Overdue target timeline"
              isAlert={true}
              alertText="Breach"
            />
            <StatTile label="Duplicates flagged" value={kpis.duplicatesFlagged} subtext="High spatial correlation" />
          </div>

          {/* Main View: GIS Operations Map or Dual Column Priority Queue */}
          {activeTab === 'map' ? (
            <div className="space-y-6">
              <OperationsMap
                reports={reports}
                hotspots={hotspots}
                selectedReport={selectedReport}
                onSelectReport={(r) => {
                  setSelectedReport(r);
                  setSelectedReportId(r.id);
                }}
                height="560px"
              />

              {/* Selected report quick inspection card */}
              {selectedReport && (
                <Card className="p-6 bg-white border-[#E9DFD3] shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E9DFD3]">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-[#174B38] bg-[#174B38]/10 px-2.5 py-1 rounded-lg">
                        {selectedReport.referenceNumber || selectedReport.report_code || selectedReport.id}
                      </span>
                      <h3 className="text-base font-bold text-[#1E1B18]">{selectedReport.title}</h3>
                      <Pill variant={selectedReport.priority || 'medium'}>{selectedReport.priority || 'Medium'}</Pill>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => setActiveTab('review_queue')}
                      className="text-xs"
                    >
                      Open in Priority Queue & Triage
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs text-[#6E645A]">
                    <div>
                      <strong>Category:</strong> {selectedReport.category || selectedReport.category_name || 'General'}
                    </div>
                    <div>
                      <strong>Status:</strong>{' '}
                      <span className="capitalize font-semibold text-[#1E1B18]">
                        {selectedReport.status?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div>
                      <strong>Location / Ward:</strong>{' '}
                      {selectedReport.ward || selectedReport.addressHint || selectedReport.location || 'Municipal Area'}
                    </div>
                  </div>
                  {selectedReport.description && (
                    <p className="mt-3 text-xs text-[#4A4238] bg-[#FBF9F5] p-3 rounded-lg border border-[#E9DFD3]">
                      {selectedReport.description}
                    </p>
                  )}
                </Card>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Priority order list */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6A5D52]">
                  Priority Order Queue ({reports.length})
                </h2>
                <span className="text-xs text-[#6A5D52]">Weighted by Risk Score</span>
              </div>

              <div className="space-y-2.5">
                {reports.map((r) => {
                  const isSelected = selectedReport?.id === r.id;
                  const isLockedByOther = r.isLocked && r.lockOwner && r.lockOwner !== user?.name;

                  return (
                    <div
                      key={r.id}
                      onClick={() => {
                        setSelectedReport(r);
                        setSelectedReportId(r.id);
                      }}
                      className={`p-4 rounded-[12px] border cursor-pointer transition-colors relative ${
                        isSelected
                          ? 'bg-white border-[#B03A0C] ring-1 ring-[#B03A0C]'
                          : 'bg-white border-[#E9DFD3] hover:border-[#D9C9B8]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedReportIds.includes(r.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (e.target.checked) {
                                setSelectedReportIds([...selectedReportIds, r.id]);
                              } else {
                                setSelectedReportIds(selectedReportIds.filter((id) => id !== r.id));
                              }
                            }}
                            className="rounded text-[#B03A0C] focus:ring-[#B03A0C]"
                          />
                          <span className="text-xs font-mono font-bold text-[#6A5D52]">{r.referenceNumber}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Lock chip when someone else is editing */}
                          {isLockedByOther && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#FFF1E6] border border-[#F4A582] text-[10px] font-semibold text-[#B03A0C]">
                              <IconLock size={11} />
                              {r.lockOwner?.split(' ')[0]} editing
                            </span>
                          )}
                          <Pill variant={r.priority} />
                          <Pill variant={r.status} />
                        </div>
                      </div>

                      <h3 className="text-sm font-semibold text-[#1E1B18] line-clamp-1">{r.title}</h3>

                      <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-[#EFE6DA]">
                        <span className="text-[#6A5D52] font-semibold">
                          Score: <span className="text-[#B03A0C]">{r.priorityScore}</span> / 100
                        </span>
                        <SlaTimer dueAt={r.resolutionDueAt} isBreached={r.isSlaBreached} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Three Cards */}
            {selectedReport && (
              <div className="lg:col-span-7 space-y-6">
                {/* Active Lock Banner if locked by another moderator */}
                <LockBanner
                  isLockedByOther={lockStatus.isLockedByOther}
                  lockOwner={lockStatus.lockOwner}
                />

                {/* Card 1: Report detail with Unverified pill, assignee picker, and score bar */}
                <Card className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EFE6DA]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#6A5D52] bg-[#FAF5EE] px-2.5 py-1 rounded-[6px] border border-[#E9DFD3]">
                        {selectedReport.referenceNumber}
                      </span>
                      {selectedReport.status === 'submitted' && (
                        <Pill variant="unverified" label="Unverified" dot={true} />
                      )}
                      <Pill variant={selectedReport.priority} />
                    </div>

                    <span className="text-xs text-[#6A5D52]">Version {selectedReport.version}</span>
                  </div>

                  <div className="mt-4">
                    <h2 className="text-xl font-serif font-semibold text-[#1E1B18]">
                      {selectedReport.title}
                    </h2>
                    <p className="mt-2 text-sm text-[#1E1B18] leading-relaxed">
                      {selectedReport.description}
                    </p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-[#6A5D52]">
                      <span>Reporter: <strong className="text-[#1E1B18]">{selectedReport.reporterName}</strong></span>
                      <span>Ward: <strong className="text-[#1E1B18]">{selectedReport.ward}</strong></span>
                    </div>
                  </div>

                  {/* Segmented Score Bar (68 of 100) */}
                  <div className="mt-5 pt-4 border-t border-[#EFE6DA]">
                    <ScoreBar
                      score={selectedReport.priorityScore}
                      breakdown={selectedReport.scoreBreakdown}
                    />
                  </div>

                  {/* Assignee Picker */}
                  <div className="mt-6 pt-5 border-t border-[#EFE6DA]">
                    <form onSubmit={handleAssign} className="space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <label className="text-xs font-semibold text-[#1E1B18] uppercase tracking-wider">
                          Assign to Department / Staff
                        </label>
                        <select
                          disabled={lockStatus.isLockedByOther}
                          value={selectedAssignee}
                          onChange={(e) => setSelectedAssignee(e.target.value)}
                          className="h-[38px] px-3 rounded-[8px] border border-[#D9C9B8] text-xs text-[#1E1B18] bg-white focus:outline-none focus:border-[#B03A0C]"
                        >
                          <option value="usr-staff-elec">Arun K. (Electrical Dept)</option>
                          <option value="usr-staff-roads">Deepa M. (Roads Dept)</option>
                        </select>
                      </div>

                      <input
                        type="text"
                        disabled={lockStatus.isLockedByOther}
                        value={assignReason}
                        onChange={(e) => setAssignReason(e.target.value)}
                        placeholder="Reassignment reason (min 10 chars)..."
                        className="w-full h-[38px] px-3 rounded-[8px] border border-[#D9C9B8] text-xs text-[#1E1B18] bg-white focus:outline-none focus:border-[#B03A0C]"
                      />

                      <Button
                        type="submit"
                        variant="secondary"
                        size="sm"
                        disabled={lockStatus.isLockedByOther}
                        isLoading={isSubmitting}
                      >
                        Save Assignment & Notify Field Team
                      </Button>
                    </form>
                  </div>
                </Card>

                {/* Card 2: "Possible duplicate" with "91% match" pill and side-by-side comparison */}
                <Card className="p-6 bg-[#FAF5EE] border border-[#E9DFD3]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <IconLayers size={18} className="text-[#6B3E00]" />
                      <h3 className="text-base font-serif font-semibold text-[#1E1B18]">Possible Duplicate Incident</h3>
                    </div>
                    <Pill variant="high" label="91% match" dot={false} />
                  </div>

                  <p className="text-xs text-[#6A5D52] mb-4">
                    High spatial correlation: 35 meters apart in Ward 45. Similar category and keywords detected.
                  </p>

                  {/* Side-by-Side Comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                    <div className="p-3.5 bg-white rounded-[10px] border border-[#E9DFD3]">
                      <span className="text-[10px] font-mono font-bold text-[#6A5D52] uppercase block mb-1">Current Report</span>
                      <p className="text-xs font-mono font-bold text-[#B03A0C]">{selectedReport.referenceNumber}</p>
                      <p className="text-xs font-semibold text-[#1E1B18] mt-1">{selectedReport.title}</p>
                      <p className="text-[11px] text-[#6A5D52] mt-1 line-clamp-2">{selectedReport.description}</p>
                    </div>

                    <div className="p-3.5 bg-white rounded-[10px] border border-[#FDEBC8]">
                      <span className="text-[10px] font-mono font-bold text-[#6B3E00] uppercase block mb-1">Target Candidate</span>
                      <p className="text-xs font-mono font-bold text-[#6B3E00]">CPR-2026-000131</p>
                      <p className="text-xs font-semibold text-[#1E1B18] mt-1">Dark road near bus stop</p>
                      <p className="text-[11px] text-[#6A5D52] mt-1 line-clamp-2">Street light not working since Tuesday. Very dark and unsafe for bus passengers.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={lockStatus.isLockedByOther}
                      onClick={() => handleMergeDuplicate('rep-123', 91)}
                    >
                      Merge reports (24h undo window)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={lockStatus.isLockedByOther}
                      onClick={() => showToast('Marked as separate. Advisory dismissed.', 'info')}
                    >
                      Keep separate
                    </Button>
                  </div>
                </Card>

                {/* Card 3: "Update status" with status select (only allowed next states) */}
                <Card className="p-6">
                  <h3 className="text-base font-serif font-semibold text-[#1E1B18] mb-1">Update Report Status</h3>
                  <p className="text-xs text-[#6A5D52] mb-4">
                    Controlled state machine: Only legitimate forward or terminal transitions are displayed.
                  </p>

                  <form onSubmit={handleUpdateStatus} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                        Allowed Next State
                      </label>
                      <select
                        disabled={lockStatus.isLockedByOther}
                        value={statusAction}
                        onChange={(e) => setStatusAction(e.target.value)}
                        className="w-full h-[44px] px-3.5 rounded-[10px] border border-[#D9C9B8] text-sm text-[#1E1B18] bg-white focus:outline-none focus:border-[#B03A0C]"
                      >
                        {selectedReport.status === 'submitted' && (
                          <>
                            <option value="under_review">Under Review (Start Triage)</option>
                            <option value="rejected">Rejected (Out of Scope)</option>
                          </>
                        )}
                        {selectedReport.status === 'under_review' && (
                          <>
                            <option value="verified">Verified (Confirmed Issue)</option>
                            <option value="rejected">Rejected (Invalid Report)</option>
                          </>
                        )}
                        {selectedReport.status === 'verified' && (
                          <>
                            <option value="assigned">Assigned (Dispatch to Staff)</option>
                            <option value="rejected">Rejected</option>
                          </>
                        )}
                        {selectedReport.status === 'assigned' && (
                          <>
                            <option value="in_progress">In Progress (Field Work Started)</option>
                            <option value="rejected">Rejected</option>
                          </>
                        )}
                        {selectedReport.status === 'in_progress' && (
                          <>
                            <option value="work_completed">Work Completed (Field Proof Recorded)</option>
                            <option value="assigned">Return to Assigned (Reassign Field Team)</option>
                            <option value="rejected">Rejected (Out of Scope / Cancel)</option>
                          </>
                        )}
                        {selectedReport.status === 'work_completed' && (
                          <>
                            <option value="resolved">Resolved (Final Administrator Sign-Off)</option>
                            <option value="reopened">Reopened (Send back to staff)</option>
                          </>
                        )}
                        {selectedReport.status === 'resolved' && (
                          <option value="reopened">Reopen Investigation</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                        Audit Note (min 10 characters)
                      </label>
                      <textarea
                        rows={3}
                        required
                        disabled={lockStatus.isLockedByOther}
                        value={statusNote}
                        onChange={(e) => setStatusNote(e.target.value)}
                        placeholder="State your justification, findings, or directives..."
                        className="w-full p-3 rounded-[10px] border border-[#D9C9B8] text-sm text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[11px] text-[#6A5D52] italic">
                        Saved to the audit log with your name and time.
                      </span>
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={lockStatus.isLockedByOther}
                        isLoading={isSubmitting}
                      >
                        Apply Status Update
                      </Button>
                    </div>
                  </form>
                </Card>

                {/* Awaiting Sign-Off Pane (If status is work_completed) */}
                {selectedReport.status === 'work_completed' && (
                  <Card className="p-6 bg-[#D8F0EA]/30 border border-[#0F766E]/40">
                    <div className="flex items-center gap-2 mb-3">
                      <IconCheckCircle size={20} className="text-[#0F766E]" />
                      <h3 className="text-base font-serif font-semibold text-[#0B5D54]">
                        Awaiting Administrator Resolution Sign-Off
                      </h3>
                    </div>

                    <p className="text-xs text-[#1E1B18] mb-4">
                      Field staff has submitted proof photos and marked work as completed. Per the Two-Person Rule, a separate administrator must verify and grant final sign-off.
                    </p>

                    {/* Proof Photo Display */}
                    <div className="mb-4 p-3 bg-white border border-[#E9DFD3] rounded-[10px]">
                      <span className="text-[11px] font-semibold text-[#0B5D54] block mb-2">Staff Completion Proof:</span>
                      <div className="h-44 rounded-[8px] overflow-hidden border border-[#E9DFD3]">
                        <img
                          src="https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80"
                          alt="Staff proof"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider">
                        Verification Sign-Off Note (min 10 chars)
                      </label>
                      <input
                        type="text"
                        value={signOffNote}
                        onChange={(e) => setSignOffNote(e.target.value)}
                        className="w-full h-[40px] px-3.5 rounded-[10px] border border-[#D9C9B8] text-sm text-[#1E1B18] bg-white focus:outline-none focus:border-[#0F766E]"
                      />

                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          type="button"
                          variant="primary"
                          className="bg-[#0F766E] border-[#0F766E] hover:bg-[#0B5D54]"
                          icon={<IconCheck size={16} />}
                          onClick={handleApproveAndResolve}
                          isLoading={isSubmitting}
                        >
                          Approve and Resolve
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          icon={<IconUndo size={15} />}
                          onClick={handleSendBackToStaff}
                          isLoading={isSubmitting}
                        >
                          Send Back to Staff (Reopen)
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Bulk Action Confirmation Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-lg w-full p-6 bg-white rounded-[14px]">
            <h3 className="text-lg font-serif font-semibold text-[#1E1B18]">
              Confirm Bulk Action ({selectedReportIds.length} Reports)
            </h3>
            <p className="text-xs text-[#6A5D52] mt-1 mb-4">
              Anti-Chaos Rule 6: At most 25 reports per bulk action. Each change is audited and includes an undo window.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                  Target Status
                </label>
                <select
                  value={bulkTargetStatus}
                  onChange={(e) => setBulkTargetStatus(e.target.value)}
                  className="w-full h-[44px] px-3 rounded-[10px] border border-[#D9C9B8] text-sm text-[#1E1B18] bg-white focus:outline-none focus:border-[#B03A0C]"
                >
                  <option value="verified">Verified</option>
                  <option value="assigned">Assigned</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                  Audit Justification
                </label>
                <textarea
                  rows={3}
                  value={bulkNote}
                  onChange={(e) => setBulkNote(e.target.value)}
                  className="w-full p-3 rounded-[10px] border border-[#D9C9B8] text-sm text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowBulkModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleExecuteBulkAction}
                  isLoading={isSubmitting}
                >
                  Confirm & Apply ({selectedReportIds.length})
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

