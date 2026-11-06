import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { RoleBadge } from '../common/RoleBadge.js';
import { Button } from '../common/Button.js';
import { IconShield, IconPlus, IconLogOut, IconUser, IconBell } from '../common/Icons.js';
import { isDemoRoleSwitcherEnabled } from '../../config/security.js';

export interface NavbarProps {
  currentRoute: string;
  navigate: (route: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentRoute, navigate }) => {
  const { user, isAuthenticated, logout, switchRoleDemo } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full flex flex-col">
      {/* Dev-Only Demo Role Preview Bar (Strictly gated by VITE_ENABLE_DEMO_ROLE_SWITCHER in dev mode) */}
      {isDemoRoleSwitcherEnabled() && (
        <div className="bg-[#9A3412] border-b border-amber-600/40 px-4 py-1.5 text-xs text-amber-100 flex items-center justify-between overflow-x-auto gap-3">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-extrabold text-amber-200 flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded text-[11px] uppercase">
              <IconShield size={13} className="text-amber-400" />
              DEMO PREVIEW MODE
            </span>
            <span className="hidden sm:inline text-amber-100/90 text-[11px]">
              Visual layout preview only · Backend operations require authentic login credentials
            </span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <button
              onClick={() => switchRoleDemo('visitor')}
              className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium transition-colors ${
                !isAuthenticated ? 'bg-white text-[#9A3412] font-bold' : 'bg-black/20 text-white hover:bg-black/40'
              }`}
            >
              Visitor
            </button>
            <button
              onClick={() => switchRoleDemo('citizen')}
              className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium transition-colors ${
                user?.role === 'citizen' ? 'bg-white text-[#9A3412] font-bold' : 'bg-black/20 text-white hover:bg-black/40'
              }`}
            >
              Resident Preview
            </button>
            <button
              onClick={() => switchRoleDemo('staff')}
              className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium transition-colors ${
                user?.role === 'staff' ? 'bg-white text-[#9A3412] font-bold' : 'bg-black/20 text-white hover:bg-black/40'
              }`}
            >
              Field Staff Preview
            </button>
            <button
              onClick={() => switchRoleDemo('admin')}
              className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium transition-colors ${
                user?.role === 'admin' ? 'bg-white text-[#9A3412] font-bold' : 'bg-black/20 text-white hover:bg-black/40'
              }`}
            >
              Moderator Preview
            </button>
            <button
              onClick={() => switchRoleDemo('super_admin')}
              className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium transition-colors ${
                user?.role === 'super_admin' ? 'bg-white text-[#9A3412] font-bold' : 'bg-black/20 text-white hover:bg-black/40'
              }`}
            >
              Super Admin Preview
            </button>
          </div>
        </div>
      )}

      {/* Main Dark Nav Band (#1E1B18, text #D9CEC2, logo accent #F4A582) */}
      <nav className="bg-[#1E1B18] border-b border-[#2C2723] px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          {/* Logo */}
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2 cursor-pointer select-none group"
          >
            <div className="w-8 h-8 rounded-[8px] bg-[#B03A0C] border border-[#F4A582] flex items-center justify-center text-white">
              <span className="font-serif font-bold text-lg leading-none">C</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-xl font-bold tracking-tight text-white">CivicFix</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#F4A582]" />
            </div>
          </div>

          {/* Navigation Links based on role */}
          <div className="hidden md:flex items-center gap-1 text-[13px] font-medium text-[#D9CEC2]">
            <button
              onClick={() => navigate('/')}
              className={`px-3 py-1.5 rounded-[8px] transition-colors ${
                currentRoute === '/' ? 'text-white bg-[#2D2722]' : 'hover:text-white hover:bg-[#2D2722]/50'
              }`}
            >
              Public Dashboard
            </button>

            {user?.role === 'citizen' && (
              <button
                onClick={() => navigate('/my-reports')}
                className={`px-3 py-1.5 rounded-[8px] transition-colors ${
                  currentRoute === '/my-reports' ? 'text-white bg-[#2D2722]' : 'hover:text-white hover:bg-[#2D2722]/50'
                }`}
              >
                My Reports
              </button>
            )}

            {user?.role === 'staff' && (
              <button
                onClick={() => navigate('/staff/assignments')}
                className={`px-3 py-1.5 rounded-[8px] transition-colors ${
                  currentRoute === '/staff/assignments' ? 'text-white bg-[#2D2722]' : 'hover:text-white hover:bg-[#2D2722]/50'
                }`}
              >
                My Assignments
              </button>
            )}

            {(user?.role === 'admin' || user?.role === 'super_admin') && (
              <>
                <button
                  onClick={() => navigate('/admin/review-queue')}
                  className={`px-3 py-1.5 rounded-[8px] transition-colors ${
                    currentRoute.startsWith('/admin') ? 'text-white bg-[#2D2722]' : 'hover:text-white hover:bg-[#2D2722]/50'
                  }`}
                >
                  Review Queue
                </button>
                {user?.role === 'super_admin' && (
                  <button
                    onClick={() => navigate('/superadmin/settings')}
                    className={`px-3 py-1.5 rounded-[8px] transition-colors ${
                      currentRoute.startsWith('/superadmin') ? 'text-white bg-[#2D2722]' : 'hover:text-white hover:bg-[#2D2722]/50'
                    }`}
                  >
                    Users & Settings
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Nav Actions */}
        <div className="flex items-center gap-3">
          {/* Primary Action Button */}
          {(!user || user.role === 'citizen' || user.role === 'admin' || user.role === 'super_admin') && (
            <Button
              variant="primary"
              size="sm"
              icon={<IconPlus size={15} />}
              onClick={() => {
                if (!isAuthenticated) {
                  navigate('/login');
                } else {
                  navigate('/report');
                }
              }}
            >
              {!isAuthenticated ? 'Sign in to report' : 'Report an issue'}
            </Button>
          )}

          {/* User Profile or Sign in */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-[#2C2723]">
              <div className="flex flex-col items-end">
                <span className="text-[13px] font-semibold text-white leading-none">{user.name}</span>
                <div className="mt-1">
                  <RoleBadge role={user.role} departmentName={user.departmentName} />
                </div>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="p-2 text-[#D9CEC2] hover:text-white hover:bg-[#2D2722] rounded-[8px] transition-colors cursor-pointer"
              >
                <IconLogOut size={16} />
              </button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/login')}
              className="bg-[#2D2722] text-[#D9CEC2] border-[#3D352F] hover:bg-[#3D352F] hover:text-white"
            >
              Sign in
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
};

