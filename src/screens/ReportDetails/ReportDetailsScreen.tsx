import React, { useState, useEffect } from 'react';
import {
  ThumbsUp,
  MapPin,
  Clock,
  ArrowLeft,
  Share2,
  CheckCircle2,
  MessageSquare,
  AlertTriangle,
  Send,
  Camera,
  Shield,
  UserCheck,
  RotateCw,
  FileCheck2,
  XCircle,
  Eye,
  Check
} from 'lucide-react';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';

export interface ReportDetailsScreenProps {
  navigate: (route: string) => void;
  reportId?: string;
}

export const ReportDetailsScreen: React.FC<ReportDetailsScreenProps> = ({ navigate, reportId }) => {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [report, setReport] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [supportCount, setSupportCount] = useState<number>(24);

  // Discussion state
  const [comments, setComments] = useState<any[]>([
    {
      id: 'c1',
      userName: 'Anita R.',
      time: '2 hours ago',
      text: 'This intersection is pitch black at 8 PM. Two cyclists had near misses this week!'
    },
    {
      id: 'c2',
      userName: 'Kavita D.',
      time: '5 hours ago',
      text: 'Thanks for reporting Ramesh! Upvoting so the electrical department prioritizes the cable replacement.'
    }
  ]);
  const [newComment, setNewComment] = useState('');

  // Extract ID reliably from: 1) reportId prop, 2) hash query params, 3) search query params
  const getActiveReportId = (): string => {
    if (reportId && reportId !== 'rep-123') return reportId;

    // 1. Hash query parameters: #/report-details?id=...
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const q = new URLSearchParams(hash.split('?')[1]);
      const hId = q.get('id');
      if (hId) return hId;
    }
    // 2. Search query parameters: ?id=...
    if (window.location.search) {
      const s = new URLSearchParams(window.location.search);
      const sId = s.get('id');
      if (sId) return sId;
    }
    // 3. Prop fallback
    if (reportId) return reportId;

    return 'rep-123';
  };

  const loadReport = () => {
    const activeId = getActiveReportId();
    setIsRefreshing(true);
    setErrorMessage(null);

    apiRequest(`/reports/${activeId}`)
      .then((data) => {
        const reportData = data?.report || (data?.id ? data : null);
        if (reportData) {
          setReport(reportData);
          setTimeline(data.timeline || reportData.timeline || []);
          setImages(data.images || reportData.images || []);
          setActivePhotoIdx(0);
          if (typeof reportData.supportVotesCount === 'number') {
            setSupportCount(reportData.supportVotesCount);
          }
          if (typeof reportData.hasSupported === 'boolean') {
            setIsSupported(reportData.hasSupported);
          }
        } else {
          setErrorMessage('Report not found or has been removed.');
        }
      })
      .catch((err: any) => {
        setErrorMessage(err.message || 'Unable to load report details. Please try again.');
      })
      .finally(() => {
        setIsLoading(false);
        setIsRefreshing(false);
      });
  };

  useEffect(() => {
    loadReport();
  }, [reportId]);

  // Resolution Lifecycle Stages
  const STAGES = [
    { key: 'submitted', label: 'Submitted', stageNum: 1 },
    { key: 'under_review', label: 'Under Review', stageNum: 2 },
    { key: 'verified', label: 'Verified', stageNum: 3 },
    { key: 'in_progress', label: 'In Progress', stageNum: 4 },
    { key: 'work_completed', label: 'Work Completed', stageNum: 5 },
    { key: 'resolved', label: 'Resolved', stageNum: 6 },
  ];

  const getStageIndex = (status: string): number => {
    switch (status) {
      case 'submitted': return 1;
      case 'under_review': return 2;
      case 'verified': return 3;
      case 'assigned':
      case 'in_progress': return 4;
      case 'work_completed': return 5;
      case 'resolved': return 6;
      case 'rejected': return -1;
      default: return 1;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-[#EAF2EB] text-[#174B38] border border-[#91B69C]/40';
      case 'under_review':
        return 'bg-[#FFF1E6] text-[#B93E16] border border-[#F4A582]/40';
      case 'verified':
        return 'bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE]';
      case 'assigned':
        return 'bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]';
      case 'in_progress':
        return 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]';
      case 'work_completed':
        return 'bg-[#FAF5EE] text-[#B93E16] border-2 border-[#B93E16] font-extrabold';
      case 'resolved':
        return 'bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] font-extrabold';
      case 'rejected':
        return 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]';
      default:
        return 'bg-[#EAF2EB] text-[#174B38]';
    }
  };

  const handleSupportToggle = () => {
    setIsSupported(!isSupported);
    setSupportCount(isSupported ? supportCount - 1 : supportCount + 1);
    showToast(
      !isSupported
        ? 'Report supported! Community voices signal citizen priority.'
        : 'Support removed.',
      'success'
    );
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const commentObj = {
      id: `c-${Date.now()}`,
      userName: user ? user.name : 'Resident Neighbour',
      time: 'Just now',
      text: newComment.trim()
    };
    setComments([commentObj, ...comments]);
    setNewComment('');
    showToast('Your comment was posted to the discussion thread.', 'success');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#EAF2EB] border-t-[#E65D25] animate-spin" />
        <p className="text-sm font-semibold text-[#25312B]">Loading report details...</p>
        <p className="text-xs text-[#7D8981]">Retrieving community data & official audit trail</p>
      </div>
    );
  }

  // Error state
  if (errorMessage || !report) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#EAF2EB] shadow-card p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-[#FFF1E6] text-[#E65D25] flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-[#25312B]">Report Details Unavailable</h2>
            <p className="text-xs sm:text-sm text-[#7D8981] mt-2 leading-relaxed">
              {errorMessage || 'The requested problem report could not be found or you may need permission.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => navigate('/my-activity')}
              className="flex-1 bg-[#174B38] hover:bg-[#11392A] text-white py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer"
            >
              My Activity
            </button>
            <button
              onClick={() => navigate('/explore')}
              className="flex-1 bg-[#F7F7F1] hover:bg-[#EAF2EB] text-[#25312B] py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer"
            >
              Explore Reports
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentStage = getStageIndex(report.status);

  return (
    <div className="min-h-screen bg-[#F7F7F1] py-8 px-4 sm:px-8 max-w-6xl mx-auto space-y-6">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/my-activity')}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#174B38] hover:text-[#287A58] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Activity</span>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={loadReport}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#174B38] hover:text-[#287A58] bg-white border border-[#EAF2EB] hover:bg-[#EAF2EB] px-3 py-1.5 rounded-full transition-all cursor-pointer shadow-2xs"
            title="Refresh latest updates"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Status</span>
          </button>

          <span className="text-xs font-mono font-bold bg-[#FAF5EE] text-[#7D8981] px-3 py-1.5 rounded-full border border-[#EAF2EB]">
            {report.referenceNumber}
          </span>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              showToast('Link copied to clipboard!', 'info');
            }}
            className="p-2 text-[#7D8981] hover:text-[#25312B] hover:bg-[#EAF2EB] rounded-full transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Timeline Stepper Card */}
      <div className="bg-white rounded-3xl border border-[#EAF2EB] p-6 sm:p-8 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF873E] bg-[#FFF1E6] px-3 py-0.5 rounded-full">
              Live Governance Stepper
            </span>
            <h2 className="text-xl font-serif font-bold text-[#25312B] mt-1.5">
              Resolution Progress Tracking
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#7D8981]">Current Status:</span>
            <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${getStatusBadgeColor(report.status)}`}>
              {report.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {report.status === 'rejected' ? (
          <div className="p-4 rounded-2xl bg-[#FEE2E2] border border-[#FCA5A5] flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#991B1B] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-[#991B1B]">Complaint Rejected</h4>
              <p className="text-xs text-[#7F1D1D] mt-1">
                {report.rejectionReason || 'This complaint could not be verified or does not fall under municipal jurisdiction.'}
              </p>
            </div>
          </div>
        ) : (
          <div>
            {/* 6-step desktop stepper */}
            <div className="hidden md:grid grid-cols-6 gap-2 relative">
              {STAGES.map((s) => {
                const isDone = s.stageNum < currentStage || (s.stageNum === 6 && currentStage === 6);
                const isCurrent = s.stageNum === currentStage && currentStage !== 6;

                return (
                  <div key={s.key} className="flex flex-col items-center text-center relative group">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                        isDone
                          ? 'bg-[#174B38] text-white shadow-xs'
                          : isCurrent
                          ? 'bg-[#E65D25] text-white ring-4 ring-[#FF873E]/25 animate-pulse scale-105'
                          : 'bg-[#F7F7F1] border-2 border-[#EAF2EB] text-[#7D8981]'
                      }`}
                    >
                      {isDone ? <Check className="w-4 h-4 stroke-[3]" /> : s.stageNum}
                    </div>
                    <span
                      className={`mt-2 text-xs font-bold ${
                        isCurrent
                          ? 'text-[#E65D25]'
                          : isDone
                          ? 'text-[#174B38]'
                          : 'text-[#7D8981]'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mobile linear progress bar */}
            <div className="md:hidden space-y-2">
              <div className="w-full bg-[#EAF2EB] h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#174B38] h-full transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, (Math.max(1, currentStage) / 6) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-[#7D8981] text-right font-medium">
                Stage {currentStage > 0 ? currentStage : 1} of 6
              </p>
            </div>

            {/* Stage Distinction Banners */}
            {report.status === 'work_completed' && (
              <div className="mt-5 p-4 rounded-2xl bg-[#FAF5EE] border border-[#E9DFD3] flex items-start gap-3">
                <Clock className="w-5 h-5 text-[#B93E16] shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-[#B93E16] uppercase tracking-wider">
                    Work Completed · Awaiting Independent Sign-Off
                  </p>
                  <p className="text-[#6A5D52] mt-1 leading-relaxed">
                    The assigned technician has reported work finished and uploaded completion proof. Under municipal two-person verification governance, a <strong>separate authorized administrator</strong> must verify the repairs before this report can be officially marked <strong>Resolved</strong>.
                  </p>
                </div>
              </div>
            )}

            {report.status === 'resolved' && (
              <div className="mt-5 p-4 rounded-2xl bg-[#EAF2EB] border border-[#91B69C] flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#174B38] shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-[#174B38] uppercase tracking-wider">
                    Verified & Officially Resolved
                  </p>
                  <p className="text-[#25312B] mt-1 leading-relaxed">
                    This issue has been independently inspected and officially closed. Proof of completion has been recorded to the municipal public audit register.
                    {report.reviewerName && <span> (Verified by: <strong>{report.reviewerName}</strong>)</span>}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Photos, Description, Discussion */}
        <div className="lg:col-span-8 space-y-8">
          {/* Main Card */}
          <div className="bg-white rounded-3xl border border-[#EAF2EB] overflow-hidden shadow-card p-6 sm:p-8">
            {/* Large Issue Photograph */}
            <div className="h-72 sm:h-96 rounded-2xl overflow-hidden relative mb-4">
              <img
                src={
                  images[activePhotoIdx]?.url ||
                  'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1000&q=80'
                }
                alt={report.title}
                className="w-full h-full object-cover"
              />
              <span
                className={`absolute top-4 right-4 text-xs font-bold px-3.5 py-1 rounded-full shadow-md uppercase tracking-wider ${getStatusBadgeColor(report.status)}`}
              >
                {report.status.replace('_', ' ')}
              </span>

              {report.isOwner && (
                <span className="absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full bg-[#174B38] text-white shadow-md flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  Your Submitted Report
                </span>
              )}
            </div>

            {/* Thumbnail switcher if multiple photos */}
            {images.length > 1 && (
              <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={img.id || idx}
                    type="button"
                    onClick={() => setActivePhotoIdx(idx)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer flex-shrink-0 ${
                      activePhotoIdx === idx
                        ? 'border-[#E65D25] ring-2 ring-[#FF873E]/40 scale-105'
                        : 'border-[#EAF2EB] opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
                <span className="text-[11px] text-[#7D8981] ml-2">
                  Photo {activePhotoIdx + 1} of {images.length}
                </span>
              </div>
            )}

            {/* Title and Category */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#E65D25] bg-[#FFF1E6] px-3 py-0.5 rounded-full">
                  {report.categoryName}
                </span>
                <span className="text-xs text-[#7D8981] flex items-center gap-1 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  Reported {new Date(report.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {report.updatedAt && (
                  <span className="text-xs text-[#7D8981] font-mono border-l border-[#EAF2EB] pl-2">
                    Updated {new Date(report.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#25312B]">
                {report.title}
              </h1>

              <p className="mt-4 text-sm sm:text-base text-[#25312B] leading-relaxed">
                {report.description}
              </p>
            </div>

            {/* Location & Support Counter */}
            <div className="mt-6 pt-6 border-t border-[#F5F7F1] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-[#7D8981]">
                <MapPin className="w-4 h-4 text-[#174B38]" />
                <span className="font-semibold text-[#25312B]">{report.ward}</span>
                <span>({report.addressHint})</span>
              </div>

              <button
                onClick={handleSupportToggle}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all cursor-pointer ${
                  isSupported
                    ? 'bg-[#E65D25] text-white shadow-md'
                    : 'bg-[#FFF1E6] text-[#E65D25] hover:bg-[#FFE3D1]'
                }`}
              >
                <ThumbsUp className={`w-4 h-4 ${isSupported ? 'fill-white' : ''}`} />
                <span>Support Issue ({supportCount})</span>
              </button>
            </div>
          </div>

          {/* Community Discussion Section */}
          <div className="bg-white rounded-3xl border border-[#EAF2EB] shadow-card p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-[#25312B] flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#174B38]" />
                <span>Community Discussion ({comments.length})</span>
              </h3>
              <span className="text-xs text-[#7D8981]">Open to all verified residents</span>
            </div>

            {/* Post new comment */}
            <form onSubmit={handlePostComment} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Join the discussion or add additional context..."
                className="flex-1 h-11 px-4 rounded-xl border border-[#EAF2EB] bg-[#F7F7F1]/50 text-xs sm:text-sm text-[#25312B] focus:outline-none focus:border-[#174B38]"
              />
              <button
                type="submit"
                className="bg-[#174B38] hover:bg-[#11392A] text-white px-5 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post</span>
              </button>
            </form>

            {/* Comments List */}
            <div className="space-y-4 pt-2 divide-y divide-[#F5F7F1]">
              {comments.map((c) => (
                <div key={c.id} className="pt-3 first:pt-0">
                  <div className="flex items-center justify-between text-xs font-bold text-[#25312B] mb-1">
                    <span className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-full bg-[#EAF2EB] text-[#174B38] text-[10px] flex items-center justify-center font-bold">
                        {c.userName.charAt(0)}
                      </div>
                      {c.userName}
                    </span>
                    <span className="text-[10px] text-[#7D8981] font-normal">{c.time}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#7D8981] pl-7.5 leading-relaxed">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Status Timeline & Official Updates */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl border border-[#EAF2EB] shadow-card p-6">
            <h3 className="font-display font-bold text-base text-[#25312B] mb-1">
              Official Resolution Timeline
            </h3>
            <p className="text-xs text-[#7D8981] mb-6">
              Official audit log verified by municipal departments.
            </p>

            {/* Chronological Steps */}
            <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#EAF2EB]">
              {timeline.length === 0 ? (
                <p className="text-xs text-[#7D8981]">No history entries recorded yet.</p>
              ) : (
                timeline.map((step, idx) => (
                  <div key={step.id || idx} className="relative">
                    <div className="absolute -left-[24px] top-1 w-6 h-6 rounded-full bg-[#EAF2EB] border-2 border-[#174B38] flex items-center justify-center text-[#174B38]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#287A58]" />
                    </div>
                    <div className="bg-[#F7F7F1] p-3.5 rounded-xl border border-[#EAF2EB] space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-[#25312B]">
                        <span className="capitalize text-[#174B38]">
                          {step.toStatus ? step.toStatus.replace('_', ' ') : 'Updated'}
                        </span>
                        <span className="text-[10px] text-[#7D8981] font-mono">
                          {step.createdAt ? new Date(step.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-xs text-[#25312B] font-medium leading-relaxed bg-white/70 p-2 rounded-lg border border-[#EAF2EB]/60">
                        "{step.note}"
                      </p>
                      {step.actorName && (
                        <p className="text-[10px] text-[#7D8981]">
                          Action by: <strong className="text-[#25312B]">{step.actorName}</strong> ({step.role})
                        </p>
                      )}
                      {step.proofImageUrl && (
                        <div className="pt-1">
                          <span className="text-[10px] font-bold text-[#174B38] block mb-1">Attached Completion Proof:</span>
                          <img src={step.proofImageUrl} alt="Proof" className="w-20 h-20 rounded-lg object-cover border border-[#91B69C]" />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Department Information Card */}
          <div className="bg-[#EAF2EB]/60 rounded-3xl border border-[#91B69C]/40 p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#174B38]">
              <Shield className="w-4 h-4" />
              <span>Assigned Department</span>
            </div>
            <p className="text-xs font-semibold text-[#25312B]">
              {report.departmentName || 'General Municipal Services'}
            </p>
            <p className="text-xs text-[#7D8981] leading-relaxed">
              Standard municipal SLA target: {report.priority === 'critical' ? '24' : report.priority === 'high' ? '72' : '120'} hours for {report.priority || 'medium'} priority incidents.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

