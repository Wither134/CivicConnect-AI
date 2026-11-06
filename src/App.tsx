import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { CommunityNavbar } from './components/layout/CommunityNavbar.js';
import { CommunityFooter } from './components/layout/CommunityFooter.js';

// Screens
import { CommunityHomeScreen } from './screens/CommunityHome/CommunityHomeScreen.js';
import { ExploreReportsScreen } from './screens/ExploreReports/ExploreReportsScreen.js';
import { ReportProblemScreen } from './screens/ReportProblem/ReportProblemScreen.js';
import { ReportDetailsScreen } from './screens/ReportDetails/ReportDetailsScreen.js';
import { CommunityHubScreen } from './screens/CommunityHub/CommunityHubScreen.js';
import { ImpactStoriesScreen } from './screens/ImpactStories/ImpactStoriesScreen.js';
import { MyActivityScreen } from './screens/MyActivity/MyActivityScreen.js';

// Auth & Admin Screens (Preserved from PS-14 backend)
import { LoginScreen } from './screens/Screen0_Auth/LoginScreen.js';
import { StaffLoginScreen } from './screens/Screen0_Auth/StaffLoginScreen.js';
import { StaffAssignmentsScreen } from './screens/Screen4_StaffAssignments/StaffAssignmentsScreen.js';
import { AdminReviewQueueScreen } from './screens/Screen5_AdminReviewQueue/AdminReviewQueueScreen.js';
import { SuperAdminSettingsScreen } from './screens/Screen6_SuperAdmin/SuperAdminSettingsScreen.js';
import { Forbidden403Screen } from './screens/Screen7_ErrorStates/Forbidden403Screen.js';
import { SessionExpiredModal } from './screens/Screen7_ErrorStates/SessionExpiredModal.js';
import { DemoTourModal } from './components/common/DemoTourModal.js';
import { isDemoRoleSwitcherEnabled } from './config/security.js';

function MainRouter() {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Hash-based / history router for reliable deep navigation
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    const hash = window.location.hash.replace(/^#/, '');
    return hash || window.location.pathname || '/';
  });

  const [forbiddenReason, setForbiddenReason] = useState<string>('');
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);
  const [selectedReportId, setSelectedReportId] = useState<string>('rep-123');

  const navigate = (path: string) => {
    window.location.hash = path;
    setCurrentRoute(path);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '');
      setCurrentRoute(hash || '/');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Strict route guarding: enforce permission matrix
  const checkRoutePermissions = (path: string): boolean => {
    const role = user ? user.role : 'visitor';

    if (path.startsWith('/staff/assignments')) {
      if (role !== 'staff' && role !== 'admin' && role !== 'super_admin') {
        setForbiddenReason('Staff or Administrator credentials');
        return false;
      }
    }

    if (path.startsWith('/admin')) {
      if (role !== 'admin' && role !== 'super_admin') {
        setForbiddenReason('Administrator or Moderator credentials');
        return false;
      }
    }

    if (path.startsWith('/superadmin')) {
      if (role !== 'super_admin') {
        setForbiddenReason('Super Administrator credentials');
        return false;
      }
    }

    if (path.startsWith('/my-activity')) {
      if (!isAuthenticated) {
        return false;
      }
    }

    return true;
  };

  const renderView = () => {
    if (isLoading) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-[#7D8981]">
            <svg className="animate-spin h-5 w-5 text-[#FF873E]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Loading CommunityConnect...</span>
          </div>
        </div>
      );
    }

    if (!checkRoutePermissions(currentRoute)) {
      if (!isAuthenticated) {
        if (
          currentRoute.startsWith('/admin') ||
          currentRoute.startsWith('/superadmin') ||
          currentRoute.startsWith('/staff')
        ) {
          return <StaffLoginScreen navigate={navigate} />;
        }
        return <LoginScreen navigate={navigate} />;
      }
      return <Forbidden403Screen navigate={navigate} requiredRole={forbiddenReason} />;
    }

    // Extract path without query parameters
    const basePath = currentRoute.split('?')[0];

    switch (basePath) {
      case '/':
        return <CommunityHomeScreen navigate={navigate} />;
      case '/explore':
        return <ExploreReportsScreen navigate={navigate} onSelectReport={setSelectedReportId} />;
      case '/report':
        return <ReportProblemScreen navigate={navigate} />;
      case '/report-details':
      case '/tracking':
      case '/track': {
        const queryParams = currentRoute.includes('?')
          ? new URLSearchParams(currentRoute.split('?')[1])
          : null;
        const targetId = queryParams?.get('id') || selectedReportId;
        return <ReportDetailsScreen navigate={navigate} reportId={targetId} />;
      }
      case '/community':
        return <CommunityHubScreen navigate={navigate} />;
      case '/impact':
        return <ImpactStoriesScreen navigate={navigate} />;
      case '/my-activity':
      case '/my-reports':
        return <MyActivityScreen navigate={navigate} />;
      case '/login':
        return <LoginScreen navigate={navigate} />;
      case '/staff/login':
      case '/staff-login':
        return <StaffLoginScreen navigate={navigate} />;
      case '/staff/assignments':
        return <StaffAssignmentsScreen navigate={navigate} />;
      case '/admin/review-queue':
        return <AdminReviewQueueScreen navigate={navigate} />;
      case '/admin/audit-log':
      case '/superadmin/settings':
        return <SuperAdminSettingsScreen navigate={navigate} />;
      case '/403':
        return <Forbidden403Screen navigate={navigate} requiredRole={forbiddenReason} />;
      default:
        return <CommunityHomeScreen navigate={navigate} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <CommunityNavbar currentRoute={currentRoute} navigate={navigate} />

      {/* Floating Demo Tour Trigger (Strictly developer preview opt-in only) */}
      {isDemoRoleSwitcherEnabled() && (
        <div className="fixed bottom-5 left-5 z-40">
          <button
            onClick={() => setIsTourOpen(true)}
            className="bg-[#9A3412] text-white hover:bg-[#7C2D12] border border-amber-600 px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg hover:scale-105 transition-all cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
            <span>Developer Preview Tour</span>
          </button>
        </div>
      )}

      <main className="flex-1">{renderView()}</main>

      <CommunityFooter navigate={navigate} />

      {/* Global Modals */}
      <SessionExpiredModal navigate={navigate} />
      {isDemoRoleSwitcherEnabled() && (
        <DemoTourModal isOpen={isTourOpen} onClose={() => setIsTourOpen(false)} navigate={navigate} />
      )}
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MainRouter />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
