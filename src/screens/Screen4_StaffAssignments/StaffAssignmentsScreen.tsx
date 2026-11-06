import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Pill } from '../../components/common/Pill.js';
import { RoleBadge } from '../../components/common/RoleBadge.js';
import { StatTile } from '../../components/common/StatTile.js';
import { SlaTimer } from '../../components/common/SlaTimer.js';
import { Timeline } from '../../components/common/Timeline.js';
import {
  IconCheck,
  IconClock,
  IconCamera,
  IconMapPin,
  IconAlertTriangle,
  IconPlus,
  IconCheckCircle,
  IconChevronRight,
  IconLogOut
} from '../../components/common/Icons.js';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';

export interface StaffAssignmentsScreenProps {
  navigate: (route: string) => void;
}

export const StaffAssignmentsScreen: React.FC<StaffAssignmentsScreenProps> = ({ navigate }) => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [kpis, setKpis] = useState({
    assignedToMe: 8,
    dueToday: 3,
    overdue: 1,
    completedThisWeek: 12
  });

  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [jobTimeline, setJobTimeline] = useState<any[]>([]);
  const [jobImages, setJobImages] = useState<any[]>([]);

  // Modals / Action States
  const [showCompleteModal, setShowCompleteModal] = useState<boolean>(false);
  const [completeNote, setCompleteNote] = useState<string>('');
  const [completeProofUrl, setCompleteProofUrl] = useState<string>(
    'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80'
  );

  const [showProgressNoteModal, setShowProgressNoteModal] = useState<boolean>(false);
  const [progressNoteText, setProgressNoteText] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const proofFileRef = useRef<HTMLInputElement>(null);

  const handleProofFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file (JPG or PNG).', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Proof photo must be under 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1600;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setCompleteProofUrl(canvas.toDataURL('image/jpeg', 0.88));
        } else {
          setCompleteProofUrl(e.target?.result as string);
        }
        showToast('Proof photo loaded from device. EXIF stripped.', 'success');
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Fetch jobs
  const fetchAssignments = async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest('/staff/assignments');
      setKpis(res.kpis);
      setJobs(res.jobs);
      if (res.jobs && res.jobs.length > 0) {
        setSelectedJob(res.jobs[0]);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load assignments.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  // Fetch single job detail
  useEffect(() => {
    if (!selectedJob) return;
    apiRequest(`/reports/${selectedJob.id}`)
      .then((data) => {
        setJobTimeline(data.timeline || []);
        setJobImages(data.images || []);
      })
      .catch(() => {});
  }, [selectedJob?.id]);

  // Start work action
  const handleStartWork = async () => {
    if (!selectedJob) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/staff/reports/${selectedJob.id}/start`, {
        method: 'POST',
        body: JSON.stringify({ version: selectedJob.version, note: 'Field technician commenced repair operations.' })
      });
      showToast(`Work started on ${selectedJob.referenceNumber}! Status is now In Progress.`, 'success');
      fetchAssignments();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Progress Note
  const handleAddProgressNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || progressNoteText.trim().length < 5) {
      showToast('Progress note must be at least 5 characters.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiRequest(`/staff/reports/${selectedJob.id}/progress-note`, {
        method: 'POST',
        body: JSON.stringify({ note: progressNoteText })
      });
      showToast('Progress note appended to report log.', 'success');
      setShowProgressNoteModal(false);
      setProgressNoteText('');
      fetchAssignments();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mark Work Completed (Requires note >= 10 chars + at least 1 photo)
  const handleMarkCompleted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!completeNote || completeNote.trim().length < 10) {
      showToast('Completion note must be at least 10 characters detailing the work done.', 'error');
      return;
    }

    if (!completeProofUrl) {
      showToast('At least one proof photo is required to mark work completed.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest(`/staff/reports/${selectedJob.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          note: completeNote,
          proofImageUrl: completeProofUrl,
          version: selectedJob.version
        })
      });

      showToast(
        'Work completed! An administrator will review your proof photos before final sign-off.',
        'success'
      );
      setShowCompleteModal(false);
      setCompleteNote('');
      fetchAssignments();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF6EF] pb-16">
      {/* Top Banner / Role identification */}
      <div className="bg-white border-b border-[#E9DFD3] px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-serif font-semibold text-[#1E1B18]">Staff Operations Portal</h1>
            <RoleBadge role="staff" departmentName={user?.departmentName || 'Electrical Dept.'} />
          </div>
          <div className="flex items-center gap-3 text-xs text-[#6A5D52]">
            <span>Signed in as <strong className="text-[#1E1B18]">{user?.name || 'Arun K.'}</strong></span>
            <button
              onClick={logout}
              className="text-[#8F1D1D] hover:underline font-semibold cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-6 space-y-6">
        {/* Summary KPI Cards */}
        {/* Assigned to me 8, Due today 3, Overdue 1 (red), Completed this week 12 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatTile
            label="Assigned to me"
            value={kpis.assignedToMe}
            subtext="Active field jobs"
          />
          <StatTile
            label="Due today"
            value={kpis.dueToday}
            subtext="Target completion before 18:00"
          />
          <StatTile
            label="Overdue SLA"
            value={kpis.overdue}
            subtext="Requires immediate intervention"
            isAlert={kpis.overdue > 0}
            alertText={kpis.overdue > 0 ? 'SLA Alert' : undefined}
          />
          <StatTile
            label="Completed this week"
            value={kpis.completedThisWeek}
            subtext="Awaiting admin sign-off or closed"
          />
        </div>

        {jobs.length === 0 && !isLoading ? (
          // Empty State
          <Card className="text-center py-16 px-6 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#E6EAF5] flex items-center justify-center text-[#2B3A67] mx-auto mb-3">
              <IconCheckCircle size={22} />
            </div>
            <h2 className="text-lg font-serif font-semibold text-[#1E1B18]">No jobs assigned right now</h2>
            <p className="mt-1 text-xs text-[#6A5D52]">
              All assigned service orders for your department queue are up to date. Check back when dispatchers assign new reports.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Job list sorted by priority and due time */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6A5D52]">
                  Assigned Jobs ({jobs.length})
                </h2>
                <span className="text-xs text-[#6A5D52]">Sorted by Priority & SLA</span>
              </div>

              <div className="space-y-2.5">
                {jobs.map((job) => {
                  const isSelected = selectedJob?.id === job.id;
                  return (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`p-4 rounded-[12px] border cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-white border-[#B03A0C] ring-1 ring-[#B03A0C]'
                          : 'bg-white border-[#E9DFD3] hover:border-[#D9C9B8]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-mono font-bold text-[#6A5D52]">{job.referenceNumber}</span>
                        <div className="flex items-center gap-1.5">
                          <Pill variant={job.priority} />
                          <Pill variant={job.status} />
                        </div>
                      </div>

                      <h3 className="text-sm font-semibold text-[#1E1B18] line-clamp-1">{job.title}</h3>

                      <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-[#EFE6DA]">
                        <span className="text-[#6A5D52] flex items-center gap-1">
                          <IconMapPin size={12} />
                          {job.ward}
                        </span>
                        <SlaTimer dueAt={job.resolutionDueAt} isBreached={job.isOverdue} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Job Detail */}
            {selectedJob && (
              <div className="lg:col-span-7 space-y-6">
                <Card className="p-6">
                  {/* Top Bar with Status and Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EFE6DA]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#6A5D52] bg-[#FAF5EE] px-2.5 py-1 rounded-[6px] border border-[#E9DFD3]">
                        {selectedJob.referenceNumber}
                      </span>
                      <Pill variant={selectedJob.status} />
                      <Pill variant={selectedJob.priority} />
                    </div>

                    <SlaTimer dueAt={selectedJob.resolutionDueAt} isBreached={selectedJob.isOverdue} />
                  </div>

                  {/* Title & Description */}
                  <div className="mt-4">
                    <h2 className="text-xl font-serif font-semibold text-[#1E1B18]">{selectedJob.title}</h2>
                    <p className="mt-2 text-sm text-[#1E1B18] leading-relaxed">
                      {selectedJob.description}
                    </p>
                  </div>

                  {/* Exact Location Card with map link */}
                  {/* Staff see exact location of assigned jobs only */}
                  <div className="mt-5 p-3.5 bg-[#FAF5EE] border border-[#E9DFD3] rounded-[10px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-white rounded-full border border-[#D9C9B8] text-[#B03A0C]">
                          <IconMapPin size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#6A5D52]">
                            Exact Job Coordinates (Staff View)
                          </p>
                          <p className="text-sm font-semibold text-[#1E1B18] mt-0.5">{selectedJob.ward}</p>
                          <p className="text-xs text-[#6A5D52]">{selectedJob.addressHint}</p>
                        </div>
                      </div>
                      {selectedJob.exactLat && (
                        <div className="text-right">
                          <span className="text-xs font-mono font-semibold text-[#1E1B18] block">
                            {selectedJob.exactLat.toFixed(6)}, {selectedJob.exactLng.toFixed(6)}
                          </span>
                          <a
                            href={`https://www.google.com/maps?q=${selectedJob.exactLat},${selectedJob.exactLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-[#B03A0C] font-semibold hover:underline inline-block mt-0.5"
                          >
                            Open in Maps ↗
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Citizen Attached Photos */}
                  {jobImages.length > 0 && (
                    <div className="mt-5">
                      <p className="text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-2">
                        Citizen Photos Attached
                      </p>
                      <div className="flex items-center gap-3 overflow-x-auto pb-1">
                        {jobImages.map((img) => (
                          <div key={img.id} className="w-28 h-24 rounded-[8px] overflow-hidden border border-[#E9DFD3] flex-shrink-0">
                            <img src={img.url} alt="Incident" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Staff Action Buttons */}
                  {/* Allowed: Start work (Assigned -> In progress), add progress note, Mark work completed */}
                  {/* Strictly disallowed: verify, reassign, prioritize, merge, reject, resolve */}
                  <div className="mt-8 pt-6 border-t border-[#EFE6DA] space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      {selectedJob.status === 'assigned' && (
                        <Button
                          variant="primary"
                          onClick={handleStartWork}
                          isLoading={isSubmitting}
                        >
                          Start Work (In Progress)
                        </Button>
                      )}

                      {selectedJob.status === 'in_progress' && (
                        <Button
                          variant="primary"
                          icon={<IconCheck size={16} />}
                          onClick={() => setShowCompleteModal(true)}
                        >
                          Mark Work Completed
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={() => setShowProgressNoteModal(true)}
                      >
                        Add Progress Note
                      </Button>
                    </div>

                    <p className="text-[11px] text-[#6A5D52] italic">
                      Staff guideline: An administrator reviews your proof photos and notes before this report is marked Resolved. Staff members cannot reject, merge, or resolve issues directly.
                    </p>
                  </div>

                  {/* Read-Only History Timeline */}
                  <div className="mt-8 pt-6 border-t border-[#EFE6DA]">
                    <h3 className="text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-4">
                      Job History & Notes
                    </h3>
                    <Timeline items={jobTimeline} currentStatus={selectedJob.status} />
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Mark Work Completed */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-lg w-full p-6 bg-white rounded-[14px]">
            <h3 className="text-lg font-serif font-semibold text-[#1E1B18]">
              Mark Work as Completed
            </h3>
            <p className="text-xs text-[#6A5D52] mt-1 mb-4">
              Requires a descriptive progress note (min 10 characters) and at least one proof photo.
            </p>

            <form onSubmit={handleMarkCompleted} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                  Resolution Note (min 10 chars)
                </label>
                <textarea
                  rows={3}
                  required
                  value={completeNote}
                  onChange={(e) => setCompleteNote(e.target.value)}
                  placeholder="e.g. Replaced faulty 150W luminaire with LED module. Tested circuit breaker and verified ground continuity."
                  className="w-full p-3 rounded-[10px] border border-[#D9C9B8] text-sm text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                  Proof Photo (From Camera or Local Device)
                </label>
                <input
                  type="file"
                  ref={proofFileRef}
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  className="hidden"
                  onChange={(e) => handleProofFileUpload(e.target.files)}
                />
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    required
                    value={completeProofUrl}
                    onChange={(e) => setCompleteProofUrl(e.target.value)}
                    placeholder="https://... or choose from device"
                    className="flex-1 h-[44px] px-3.5 rounded-[10px] border border-[#D9C9B8] text-sm text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    icon={<IconCamera size={16} />}
                    onClick={() => proofFileRef.current?.click()}
                  >
                    Upload File
                  </Button>
                </div>
                {completeProofUrl && (
                  <div className="h-32 w-full rounded-[8px] overflow-hidden border border-[#E9DFD3] relative group">
                    <img src={completeProofUrl} alt="Proof preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setCompleteProofUrl('')}
                      className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs hover:bg-black"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="p-3 bg-[#FAF5EE] rounded-[8px] border border-[#E9DFD3] text-xs text-[#6A5D52]">
                <strong className="text-[#1E1B18]">Two-Person Rule:</strong> Once submitted, your work order transitions to <em>Work Completed</em>. A moderator or administrator must inspect the proof before granting final <em>Resolved</em> status.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCompleteModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                >
                  Submit Completion Proof
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Add Progress Note */}
      {showProgressNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-md w-full p-6 bg-white rounded-[14px]">
            <h3 className="text-lg font-serif font-semibold text-[#1E1B18]">Add Field Progress Note</h3>
            <p className="text-xs text-[#6A5D52] mt-1 mb-4">
              Log an intermediate update to inform supervisors and citizens of your field status.
            </p>

            <form onSubmit={handleAddProgressNote} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-1.5">
                  Progress Note
                </label>
                <textarea
                  rows={4}
                  required
                  value={progressNoteText}
                  onChange={(e) => setProgressNoteText(e.target.value)}
                  placeholder="e.g. Arrived on site with boom truck. Traffic police coordinated lane closure."
                  className="w-full p-3 rounded-[10px] border border-[#D9C9B8] text-sm text-[#1E1B18] focus:outline-none focus:border-[#B03A0C]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowProgressNoteModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                >
                  Save Note
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

