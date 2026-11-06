import React from 'react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { IconShield, IconLock, IconArrowLeft } from '../../components/common/Icons.js';
import { useAuth } from '../../context/AuthContext.js';

export interface Forbidden403ScreenProps {
  navigate: (route: string) => void;
  requiredRole?: string;
}

export const Forbidden403Screen: React.FC<Forbidden403ScreenProps> = ({ navigate, requiredRole }) => {
  const { user } = useAuth();

  const getHomeRoute = () => {
    if (!user) return '/';
    if (user.role === 'citizen') return '/my-reports';
    if (user.role === 'staff') return '/staff/assignments';
    if (user.role === 'admin' || user.role === 'super_admin') return '/admin/review-queue';
    return '/';
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center bg-white border border-[#E9DFD3] rounded-[14px]">
        <div className="w-14 h-14 rounded-full bg-[#FFF1E6] border border-[#F4A582] flex items-center justify-center text-[#B03A0C] mx-auto mb-4">
          <IconLock size={26} />
        </div>

        <h1 className="text-2xl font-serif font-bold text-[#1E1B18] tracking-tight">
          403: You don't have access
        </h1>

        <p className="mt-3 text-sm text-[#6A5D52] leading-relaxed">
          Your current account role <strong className="text-[#1E1B18]">({user ? user.role : 'visitor'})</strong> does not have permission to view this operational zone.
          {requiredRole && <span> Required privilege level: <code className="bg-[#FAF5EE] px-1.5 py-0.5 rounded border border-[#E9DFD3] text-[#B03A0C]">{requiredRole}</code>.</span>}
        </p>

        <div className="mt-6 p-3 bg-[#FAF5EE] rounded-[8px] border border-[#E9DFD3] text-xs text-[#6A5D52] text-left">
          <span className="font-semibold text-[#1E1B18] block mb-1">Enforced Role Boundaries:</span>
          Citizens can only track their own reports. Staff view assigned queues. Administrative commands require designated credentials.
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button
            variant="primary"
            fullWidth
            onClick={() => navigate('/staff/login')}
          >
            Sign in as Admin / Staff
          </Button>

          <Button
            variant="outline"
            fullWidth
            onClick={() => navigate('/')}
          >
            Public Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
};

