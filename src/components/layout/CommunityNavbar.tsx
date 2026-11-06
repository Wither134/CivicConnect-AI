import React, { useState, useEffect } from 'react';
import { useAuth, UserRole } from '../../context/AuthContext.js';
import { isDemoRoleSwitcherEnabled } from '../../config/security.js';
import { apiRequest } from '../../api/client.js';
import {
  Bell,
  Plus,
  User,
  LogOut,
  Shield,
  ChevronDown,
  CheckCircle,
  Clock,
  MessageSquare,
  FileText,
  Heart
} from 'lucide-react';

export interface NavbarProps {
  currentRoute: string;
  navigate: (route: string) => void;
}

export const CommunityNavbar: React.FC<NavbarProps> = ({ currentRoute, navigate }) => {
  const { user, isAuthenticated, logout, switchRoleDemo } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [realNotifications, setRealNotifications] = useState<any[]>([]);
  const [realUnreadCount, setRealUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (isAuthenticated) {
      apiRequest('/notifications')
        .then((data) => {
          if (data && Array.isArray(data.notifications)) {
            setRealNotifications(data.notifications);
            setRealUnreadCount(data.unreadCount ?? data.notifications.filter((n: any) => !n.isRead).length);
          }
        })
        .catch(() => {});
    } else {
      setRealNotifications([]);
      setRealUnreadCount(0);
    }
  }, [isAuthenticated, currentRoute]);

  const handleNotificationClick = async (notif: any) => {
    setShowNotifications(false);
    if (!notif.isRead && notif.id && !notif.id.startsWith('notif-')) {
      try {
        await apiRequest(`/notifications/${notif.id}/read`, { method: 'POST' });
        setRealNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
        setRealUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {}
    }
    if (notif.reportId) {
      navigate(`/report-details?id=${notif.reportId}`);
    } else {
      navigate('/my-activity');
    }
  };

  // Fallback demo notifications if user is not authenticated or has none yet
  const fallbackNotifications = [
    {
      id: 'notif-1',
      title: 'Official update on your report',
      message: 'Streetlight pole #42 on 5th Main marked "In Progress" by Electrical Dept.',
      time: '15m ago',
      isRead: false
    },
    {
      id: 'notif-2',
      title: 'Community support received',
      message: '14 neighbours supported your pothole report on MG Road.',
      time: '2h ago',
      isRead: false
    },
    {
      id: 'notif-3',
      title: 'Resolution verified',
      message: 'Water pipeline leak on Indira Nagar confirmed resolved by moderator.',
      time: '1d ago',
      isRead: true
    }
  ];

  const activeNotifications = isAuthenticated && realNotifications.length > 0 ? realNotifications : fallbackNotifications;
  const unreadCount = isAuthenticated && realNotifications.length > 0 ? realUnreadCount : fallbackNotifications.filter((n) => !n.isRead).length;

  return (
    <header className="sticky top-0 z-40 w-full flex flex-col bg-white">
      {/* Dev-Only Demo Role Preview Bar (Strictly gated by VITE_ENABLE_DEMO_ROLE_SWITCHER in dev mode) */}
      {isDemoRoleSwitcherEnabled() && (
        <div className="bg-[#9A3412] text-amber-100 px-4 py-1.5 text-xs flex items-center justify-between border-b border-amber-600/40 overflow-x-auto gap-3">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-extrabold text-amber-200 flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded text-[11px] tracking-wide uppercase">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              DEMO PREVIEW MODE
            </span>
            <span className="hidden sm:inline text-amber-100/90 text-[11px]">
              Visual layout preview only · Backend operations require authentic login credentials
            </span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <button
              onClick={() => switchRoleDemo('visitor')}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                !isAuthenticated ? 'bg-white text-[#9A3412] font-bold shadow-xs' : 'bg-black/20 text-white hover:bg-black/40'
              }`}
            >
              Visitor
            </button>
            <button
              onClick={() => switchRoleDemo('citizen')}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                user?.role === 'citizen' ? 'bg-white text-[#9A3412] font-bold shadow-xs' : 'bg-black/20 text-white hover:bg-black/40'
              }`}
            >
              Resident Preview
            </button>
            <button
              onClick={() => switchRoleDemo('staff')}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                user?.role === 'staff' ? 'bg-white text-[#9A3412] font-bold shadow-xs' : 'bg-black/20 text-white hover:bg-black/40'
              }`}
            >
              Field Staff Preview
            </button>
            <button
              onClick={() => switchRoleDemo('admin')}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                user?.role === 'admin' ? 'bg-white text-[#9A3412] font-bold shadow-xs' : 'bg-black/20 text-white hover:bg-black/40'
              }`}
            >
              Moderator Preview
            </button>
            <button
              onClick={() => switchRoleDemo('super_admin')}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                user?.role === 'super_admin' ? 'bg-white text-[#9A3412] font-bold shadow-xs' : 'bg-black/20 text-white hover:bg-black/40'
              }`}
            >
              Super Admin Preview
            </button>
          </div>
        </div>
      )}

      {/* Main Clean White Navbar */}
      <nav className="h-18 px-4 sm:px-8 border-b border-[#EAF2EB] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-8 lg:gap-10">
          {/* Logo */}
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="w-10 h-10 rounded-xl gradient-green flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <span className="font-serif font-bold text-2xl leading-none text-[#FF873E]">C</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-extrabold text-xl tracking-tight text-[#174B38] leading-none">
                Community<span className="text-[#FF873E]">Connect</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[#7D8981] font-semibold mt-0.5">
                Civic Resolution Platform
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1 lg:gap-2 text-[14px] font-semibold text-[#25312B]">
            <button
              onClick={() => navigate('/')}
              className={`px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                currentRoute === '/'
                  ? 'text-[#174B38] bg-[#EAF2EB]/60 font-bold'
                  : 'text-[#7D8981] hover:text-[#174B38] hover:bg-[#F5F7F1]'
              }`}
            >
              Home
            </button>

            <button
              onClick={() => navigate('/explore')}
              className={`px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                currentRoute === '/explore'
                  ? 'text-[#174B38] bg-[#EAF2EB]/60 font-bold'
                  : 'text-[#7D8981] hover:text-[#174B38] hover:bg-[#F5F7F1]'
              }`}
            >
              Explore Reports
            </button>

            <button
              onClick={() => navigate('/community')}
              className={`px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                currentRoute === '/community'
                  ? 'text-[#174B38] bg-[#EAF2EB]/60 font-bold'
                  : 'text-[#7D8981] hover:text-[#174B38] hover:bg-[#F5F7F1]'
              }`}
            >
              Community
            </button>

            <button
              onClick={() => navigate('/impact')}
              className={`px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                currentRoute === '/impact'
                  ? 'text-[#174B38] bg-[#EAF2EB]/60 font-bold'
                  : 'text-[#7D8981] hover:text-[#174B38] hover:bg-[#F5F7F1]'
              }`}
            >
              Impact Stories
            </button>

            {isAuthenticated && (
              <button
                onClick={() => navigate('/my-activity')}
                className={`px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                  currentRoute === '/my-activity'
                    ? 'text-[#174B38] bg-[#EAF2EB]/60 font-bold'
                    : 'text-[#7D8981] hover:text-[#174B38] hover:bg-[#F5F7F1]'
                }`}
              >
                My Activity
              </button>
            )}

            {(user?.role === 'staff' || user?.role === 'admin' || user?.role === 'super_admin') && (
              <button
                onClick={() => {
                  if (user?.role === 'staff') navigate('/staff/assignments');
                  else navigate('/admin/review-queue');
                }}
                className={`px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                  currentRoute.startsWith('/admin') || currentRoute.startsWith('/staff')
                    ? 'text-[#B93E16] bg-[#FFF1E6] font-bold'
                    : 'text-[#E65D25] hover:bg-[#FFF1E6]'
                }`}
              >
                Admin Workspace
              </button>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3.5">
          {/* Prominent Green "Report a Problem" Button */}
          <button
            onClick={() => {
              if (!isAuthenticated) navigate('/login');
              else navigate('/report');
            }}
            className="hidden sm:inline-flex items-center gap-2 bg-[#174B38] hover:bg-[#11392A] text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#FF873E]" strokeWidth={2.5} />
            <span>Report a Problem</span>
          </button>

          {/* Notification Icon with Unread Count */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2.5 text-[#25312B] hover:text-[#174B38] hover:bg-[#F5F7F1] rounded-full transition-colors relative cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-[#25312B]" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#E65D25] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-[#EAF2EB] shadow-panel z-50 p-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#F5F7F1]">
                  <h3 className="font-display font-bold text-sm text-[#25312B]">Notifications</h3>
                  <span className="text-[11px] font-semibold text-[#174B38] bg-[#EAF2EB] px-2 py-0.5 rounded-full">
                    {unreadCount} new updates
                  </span>
                </div>
                <div className="mt-2 divide-y divide-[#F5F7F1] max-h-72 overflow-y-auto">
                  {activeNotifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`py-3 p-2 rounded-xl transition-colors cursor-pointer ${
                        !n.isRead ? 'bg-[#FFF8EE] hover:bg-[#FDEBC8]/60 font-medium' : 'hover:bg-[#F5F7F1]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-[#25312B]">
                        <span className="flex items-center gap-1.5">
                          {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-[#E65D25]" />}
                          {n.title}
                        </span>
                        <span className="text-[10px] text-[#7D8981] font-mono font-normal">
                          {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (n.time || '')}
                        </span>
                      </div>
                      <p className="text-xs text-[#7D8981] mt-1 leading-relaxed">{n.message || n.description}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    navigate('/my-activity');
                  }}
                  className="w-full mt-3 pt-2 border-t border-[#F5F7F1] text-center text-xs font-semibold text-[#174B38] hover:text-[#287A58] cursor-pointer"
                >
                  View full activity history →
                </button>
              </div>
            )}
          </div>

          {/* User Avatar & Dropdown */}
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1.5 hover:bg-[#F5F7F1] rounded-full transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-[#EAF2EB] border-2 border-[#174B38] flex items-center justify-center text-[#174B38] font-bold text-sm">
                  {user.name.charAt(0)}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#7D8981]" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-[#EAF2EB] shadow-panel z-50 p-2 text-sm">
                  <div className="p-3 border-b border-[#F5F7F1]">
                    <p className="font-bold text-[#25312B]">{user.name}</p>
                    <p className="text-xs text-[#7D8981] truncate">{user.email}</p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#EAF2EB] text-[#174B38]">
                      {user.role}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate('/my-activity');
                    }}
                    className="w-full px-3 py-2 text-left rounded-lg hover:bg-[#F5F7F1] flex items-center gap-2 text-[#25312B] cursor-pointer mt-1"
                  >
                    <User className="w-4 h-4 text-[#7D8981]" />
                    My Activity
                  </button>

                  {(user.role === 'staff' || user.role === 'admin' || user.role === 'super_admin') && (
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        if (user.role === 'staff') navigate('/staff/assignments');
                        else navigate('/admin/review-queue');
                      }}
                      className="w-full px-3 py-2 text-left rounded-lg hover:bg-[#FFF1E6] flex items-center gap-2 text-[#E65D25] font-semibold cursor-pointer"
                    >
                      <Shield className="w-4 h-4 text-[#E65D25]" />
                      Administration
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      logout();
                      navigate('/');
                    }}
                    className="w-full px-3 py-2 text-left rounded-lg hover:bg-[#FBE4E4] flex items-center gap-2 text-[#8F1D1D] font-medium cursor-pointer mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-semibold text-[#174B38] hover:text-[#287A58] px-4 py-2 rounded-full hover:bg-[#F5F7F1] transition-colors cursor-pointer"
            >
              Sign in
            </button>
          )}
        </div>
      </nav>
    </header>
  );
};

