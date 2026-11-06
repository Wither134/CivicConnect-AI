import React from 'react';
import { IconShield, IconLock } from '../common/Icons.js';

export interface FooterProps {
  navigate: (route: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ navigate }) => {
  return (
    <footer className="mt-auto bg-[#1E1B18] text-[#D9CEC2] border-t border-[#2C2723] py-10 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm">
        <div className="flex flex-col items-center md:items-start gap-1">
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg font-bold text-white">CivicFix</span>
            <span className="text-xs px-2 py-0.5 rounded bg-[#2D2722] text-[#F4A582] font-mono">
              Hackathon PS-14
            </span>
          </div>
          <p className="text-xs text-[#8C8075]">
            Community problem reporting & resolution platform. Built with controlled state machine and append-only audit trail.
          </p>
          <p className="text-xs text-[#0F766E] flex items-center gap-1.5 mt-1">
            <IconShield size={13} />
            Privacy guarantee: Your name and exact address are never shown publicly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs text-[#8C8075]">
          <button
            onClick={() => navigate('/')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Public Dashboard
          </button>
          <button
            onClick={() => navigate('/report')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Report an Issue
          </button>
          {/* Linked only from the footer per specification */}
          <button
            onClick={() => navigate('/staff/login')}
            className="hover:text-[#F4A582] text-[#D9CEC2] font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-[#3D352F] px-3 py-1.5 rounded-[6px] hover:border-[#F4A582]"
          >
            <IconLock size={12} className="text-[#F4A582]" />
            Staff & Admin Sign In
          </button>
        </div>
      </div>
    </footer>
  );
};

