import React from 'react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { IconClock } from '../../components/common/Icons.js';
import { useAuth } from '../../context/AuthContext.js';

export interface SessionExpiredModalProps {
  navigate: (route: string) => void;
}

export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({ navigate }) => {
  const { isSessionExpired, dismissSessionExpired, logout } = useAuth();

  if (!isSessionExpired) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="max-w-md w-full p-6 text-center bg-white border border-[#E9DFD3] rounded-[14px]">
        <div className="w-12 h-12 rounded-full bg-[#FFF1E6] text-[#B03A0C] border border-[#F4A582] flex items-center justify-center mx-auto mb-3">
          <IconClock size={24} />
        </div>

        <h3 className="text-xl font-serif font-semibold text-[#1E1B18]">
          Session Expired
        </h3>

        <p className="mt-2 text-xs text-[#6A5D52] leading-relaxed">
          Security Safeguard: You have been signed out due to 15 minutes of inactivity on a privileged staff or admin session.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              dismissSessionExpired();
              logout();
              navigate('/staff/login');
            }}
          >
            Sign in again
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              dismissSessionExpired();
              logout();
              navigate('/');
            }}
          >
            Go to Public Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
};

