import React, { useState, useEffect } from 'react';
import {
  FileText,
  ThumbsUp,
  MessageSquare,
  Bell,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  MapPin,
  TrendingUp,
  Award,
  RotateCw,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';

export interface MyActivityScreenProps {
  navigate: (route: string) => void;
}

export const MyActivityScreen: React.FC<MyActivityScreenProps> = ({ navigate }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'submitted' | 'supported' | 'comments' | 'notifications'>('submitted');
  const [myReports, setMyReports] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchActivityData = () => {
    setIsRefreshing(true);
    Promise.all([
      apiRequest('/reports/my-reports')
        .then((data) => {
          if (data && data.reports) {
            setMyReports(data.reports);
          }
        })
        .catch(() => {}),
      apiRequest('/notifications')
        .then((data) => {
          if (data && data.notifications) {
            setNotifications(data.notifications);
            setUnreadNotifCount(data.unreadCount || 0);
          }
        })
        .catch(() => {})
    ]).finally(() => {
      setIsLoading(false);
      setIsRefreshing(false);
    });
  };

  useEffect(() => {
    fetchActivityData();
  }, []);

  const getStatusBadgeStyle = (status: string) => {
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
        return 'bg-[#FAF5EE] text-[#B93E16] border-2 border-[#B93E16] font-bold';
      case 'resolved':
        return 'bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0] font-bold';
      case 'rejected':
        return 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]';
      default:
        return 'bg-[#EAF2EB] text-[#174B38]';
    }
  };

  const handleMarkNotifRead = async (id: string, reportId?: string) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadNotifCount((prev) => Math.max(0, prev - 1));
      if (reportId) {
        navigate(`/report-details?id=${reportId}`);
      }
    } catch {
      if (reportId) navigate(`/report-details?id=${reportId}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotifCount(0);
      showToast('All notifications marked as read', 'success');
    } catch {
      showToast('Failed to update notifications', 'error');
    }
  };

  const supportedMockReports = [
    {
      id: 'rep-092',
      referenceNumber: 'CPR-2026-000092',
      title: 'Open manhole near primary school',
      category: 'Drainage',
      ward: 'Ward 12 (North)',
      status: 'assigned',
      supportedAt: '3 days ago'
    },
    {
      id: 'rep-074',
      referenceNumber: 'CPR-2026-000074',
      title: 'Deep pothole on MG Road flyover ramp',
      category: 'Road',
      ward: 'Ward 18 (East)',
      status: 'in_progress',
      supportedAt: '1 week ago'
    }
  ];

  const myCommentsMock = [
    {
      id: 'comm-1',
      reportTitle: 'Streetlight out on 5th Main',
      referenceNumber: 'CPR-2026-000123',
      text: 'Thanks for replacing the fuse and luminaire so promptly! Corner is safe again.',
      time: 'Yesterday'
    },
    {
      id: 'comm-2',
      reportTitle: 'Open manhole near primary school',
      referenceNumber: 'CPR-2026-000092',
      text: 'Upvoting for priority dispatch so kids walking to Gate 2 are not at risk.',
      time: '4 days ago'
    }
  ];

  const notificationsMock = [
    {
      id: 'n1',
      title: 'Work Completed on CPR-2026-000123',
      text: 'Technician Arun K. has uploaded proof photos. Report awaiting administrator sign-off.',
      time: '2 hours ago',
      unread: true
    },
    {
      id: 'n2',
      title: '14 Neighbours Supported Your Report',
      text: 'Your Streetlight report on 5th Main is trending in Ward 45.',
      time: '1 day ago',
      unread: false
    },
    {
      id: 'n3',
      title: 'Status: In Progress',
      text: 'Electrical Department acknowledged report and assigned field truck #12.',
      time: '3 days ago',
      unread: false
    }
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F1] py-10 px-4 sm:px-8 max-w-7xl mx-auto space-y-8">
      {/* Profile Header */}
      <div className="bg-white rounded-3xl border border-[#EAF2EB] p-6 sm:p-8 shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#EAF2EB] text-[#174B38] font-serif font-bold text-2xl flex items-center justify-center border-2 border-[#174B38]">
            {user ? user.name.charAt(0) : 'R'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-serif font-bold text-[#25312B]">
                {user ? user.name : 'Ramesh Kumar'}
              </h1>
              <span className="text-xs font-bold text-[#174B38] bg-[#EAF2EB] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {user ? user.role : 'Resident'}
              </span>
            </div>
            <p className="text-xs text-[#7D8981] mt-1">{user ? user.email : 'ramesh.k@gmail.com'} · Resident since Jan 2026</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchActivityData}
            disabled={isRefreshing}
            className="bg-white border border-[#EAF2EB] hover:bg-[#EAF2EB] text-[#174B38] px-4 py-2.5 rounded-full text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
            title="Refresh my activity & notifications"
          >
            <RotateCw className={`w-3.5 h-3.5 text-[#174B38] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => navigate('/report')}
            className="bg-[#174B38] hover:bg-[#11392A] text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#FF873E]" strokeWidth={2.5} />
            <span>New Problem Report</span>
          </button>
        </div>
      </div>

      {/* Participation Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#EAF2EB] shadow-xs">
          <p className="text-xs font-bold text-[#7D8981] uppercase tracking-wider">Reports Filed</p>
          <p className="text-3xl font-display font-extrabold text-[#174B38] mt-2">
            {myReports.length || 3}
          </p>
          <p className="text-[11px] text-[#7D8981] mt-1">1 resolved with verified fix</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#EAF2EB] shadow-xs">
          <p className="text-xs font-bold text-[#7D8981] uppercase tracking-wider">Issues Supported</p>
          <p className="text-3xl font-display font-extrabold text-[#E65D25] mt-2">12</p>
          <p className="text-[11px] text-[#7D8981] mt-1">Community upvotes given</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#EAF2EB] shadow-xs">
          <p className="text-xs font-bold text-[#7D8981] uppercase tracking-wider">Comments Posted</p>
          <p className="text-3xl font-display font-extrabold text-[#287A58] mt-2">8</p>
          <p className="text-[11px] text-[#7D8981] mt-1">In discussion threads</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#EAF2EB] shadow-xs">
          <p className="text-xs font-bold text-[#7D8981] uppercase tracking-wider">Resolution Impact</p>
          <p className="text-3xl font-display font-extrabold text-[#174B38] mt-2">94%</p>
          <p className="text-[11px] text-[#287A58] font-semibold mt-1">Avg SLA response time: 2.1 days</p>
        </div>
      </div>

      {/* Activity Navigation Tabs */}
      <div className="flex border-b border-[#EAF2EB] gap-2 overflow-x-auto text-sm font-semibold">
        <button
          onClick={() => setActiveTab('submitted')}
          className={`py-3 px-4 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'submitted'
              ? 'border-[#174B38] text-[#174B38] font-bold'
              : 'border-transparent text-[#7D8981] hover:text-[#25312B]'
          }`}
        >
          My Reports ({myReports.length || 3})
        </button>

        <button
          onClick={() => setActiveTab('supported')}
          className={`py-3 px-4 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'supported'
              ? 'border-[#174B38] text-[#174B38] font-bold'
              : 'border-transparent text-[#7D8981] hover:text-[#25312B]'
          }`}
        >
          Reports I Supported ({supportedMockReports.length})
        </button>

        <button
          onClick={() => setActiveTab('comments')}
          className={`py-3 px-4 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'comments'
              ? 'border-[#174B38] text-[#174B38] font-bold'
              : 'border-transparent text-[#7D8981] hover:text-[#25312B]'
          }`}
        >
          Comments Posted ({myCommentsMock.length})
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`py-3 px-4 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'notifications'
              ? 'border-[#174B38] text-[#174B38] font-bold'
              : 'border-transparent text-[#7D8981] hover:text-[#25312B]'
          }`}
        >
          <span>Notifications</span>
          {unreadNotifCount > 0 ? (
            <span className="bg-[#E65D25] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {unreadNotifCount}
            </span>
          ) : (
            <span className="text-xs text-[#7D8981]">({notifications.length || notificationsMock.length})</span>
          )}
        </button>
      </div>

      {/* Tab 1: Submitted Reports */}
      {activeTab === 'submitted' && (
        <div className="space-y-4">
          {myReports.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-[#EAF2EB]">
              <p className="text-sm text-[#7D8981]">You haven't submitted any reports yet.</p>
              <button
                onClick={() => navigate('/report')}
                className="mt-4 bg-[#174B38] text-white px-5 py-2.5 rounded-full text-xs font-bold"
              >
                Submit your first report
              </button>
            </div>
          ) : (
            myReports.map((r) => (
              <div
                key={r.id}
                onClick={() => navigate(`/report-details?id=${r.id}`)}
                className="bg-white rounded-2xl border border-[#EAF2EB] p-5 hover:shadow-card transition-all cursor-pointer space-y-3"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono font-bold text-[#7D8981]">{r.referenceNumber}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[#EAF2EB] text-[#174B38] px-2 py-0.5 rounded-full">
                        {r.categoryName || 'Civic Issue'}
                      </span>
                      <span className="text-xs text-[#7D8981] font-mono">
                        Submitted: {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {r.updatedAt && (
                        <span className="text-xs text-[#287A58] font-mono font-semibold">
                          · Updated: {new Date(r.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display font-bold text-base text-[#25312B]">{r.title}</h3>
                    <p className="text-xs text-[#7D8981] mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {r.ward} {r.addressHint ? `(${r.addressHint})` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span
                      className={`text-xs px-3 py-1 rounded-full capitalize ${getStatusBadgeStyle(r.status)}`}
                    >
                      {r.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-bold text-[#174B38] flex items-center gap-1 group-hover:underline">
                      Track <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Latest Status Note Banner */}
                {r.latestNote && (
                  <div className="bg-[#FAF5EE] border-l-4 border-[#174B38] p-3 rounded-r-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-[#25312B] italic">
                      <strong className="text-[#174B38] not-italic">Latest update:</strong> "{r.latestNote}"
                    </p>
                    {r.latestActorName && (
                      <span className="text-[10px] text-[#7D8981] whitespace-nowrap">
                        — {r.latestActorName} ({r.latestActorRole || 'moderator'})
                      </span>
                    )}
                  </div>
                )}

                {/* Two-person governance indicators */}
                {r.status === 'work_completed' && (
                  <div className="bg-[#FFF1E6] border border-[#F4A582] p-2.5 rounded-xl text-xs text-[#B93E16] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-[#E65D25]" />
                    <span>
                      Field work reported finished by {r.workCompleterName || 'staff'}. Pending independent review and closure by municipal administrator.
                    </span>
                  </div>
                )}

                {r.status === 'resolved' && (
                  <div className="bg-[#D1FAE5] border border-[#A7F3D0] p-2.5 rounded-xl text-xs text-[#065F46] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[#059669]" />
                    <span>
                      Civic issue verified resolved & closed by {r.reviewerName || 'Municipal Administrator'}.
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Supported Reports */}
      {activeTab === 'supported' && (
        <div className="space-y-3">
          {supportedMockReports.map((r) => (
            <div
              key={r.id}
              onClick={() => navigate(`/report-details?id=${r.id}`)}
              className="bg-white rounded-2xl border border-[#EAF2EB] p-5 flex items-center justify-between hover:shadow-card transition-all cursor-pointer"
            >
              <div>
                <span className="text-xs font-mono text-[#7D8981]">{r.referenceNumber}</span>
                <h3 className="font-display font-bold text-base text-[#25312B]">{r.title}</h3>
                <p className="text-xs text-[#7D8981] mt-0.5">{r.ward} · Supported {r.supportedAt}</p>
              </div>
              <span className="text-xs font-bold text-[#E65D25] flex items-center gap-1 bg-[#FFF1E6] px-3 py-1 rounded-full">
                <ThumbsUp className="w-3.5 h-3.5 fill-[#E65D25]" /> Supported
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Comments */}
      {activeTab === 'comments' && (
        <div className="space-y-3">
          {myCommentsMock.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-[#EAF2EB] p-5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#174B38]">{c.reportTitle} ({c.referenceNumber})</span>
                <span className="text-[#7D8981] font-mono">{c.time}</span>
              </div>
              <p className="text-sm text-[#25312B] pl-2 border-l-2 border-[#174B38] italic">"{c.text}"</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Notifications */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#25312B]">Official Notifications & Progress Alerts</h3>
            {unreadNotifCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-bold text-[#174B38] hover:text-[#287A58] underline cursor-pointer"
              >
                Mark all as read
              </button>
            )}
          </div>

          {(notifications.length === 0 ? notificationsMock : notifications).map((n) => (
            <div
              key={n.id}
              onClick={() => handleMarkNotifRead(n.id, n.reportId)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer hover:shadow-card ${
                !n.isRead && n.unread !== false ? 'bg-[#FFF8EE] border-[#FDEBC8]' : 'bg-white border-[#EAF2EB]'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-[#25312B] mb-1">
                <span className="flex items-center gap-2">
                  {(!n.isRead && n.unread !== false) && <span className="w-2 h-2 rounded-full bg-[#E65D25]" />}
                  {n.title}
                </span>
                <span className="text-[#7D8981] font-normal font-mono text-[11px]">
                  {n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : (n.time || 'Recent')}
                </span>
              </div>
              <p className="text-xs text-[#7D8981] leading-relaxed">{n.message || n.text}</p>
              {n.reportId && (
                <div className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-[#174B38]">
                  <span>View Complaint Details & Timeline</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

