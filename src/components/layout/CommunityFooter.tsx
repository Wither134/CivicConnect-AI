import React from 'react';
import { Shield, Lock, Heart } from 'lucide-react';

export interface FooterProps {
  navigate: (route: string) => void;
}

export const CommunityFooter: React.FC<FooterProps> = ({ navigate }) => {
  return (
    <footer className="mt-auto bg-[#174B38] text-white/80 border-t border-[#287A58]/50 py-12 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8 text-xs">
        {/* Brand column */}
        <div className="space-y-2 max-w-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-green flex items-center justify-center text-white border border-[#287A58]">
              <span className="font-serif font-bold text-lg text-[#FF873E]">C</span>
            </div>
            <span className="font-display font-bold text-lg text-white">CommunityConnect</span>
          </div>
          <p className="text-white/70 leading-relaxed">
            Report it. Track it. See it fixed. Connecting residents and municipal departments for transparent civic resolutions.
          </p>
          <p className="text-[#91B69C] flex items-center gap-1.5 pt-1">
            <Shield className="w-3.5 h-3.5 text-[#FF873E]" />
            <span>Public locations are coarsened for citizen privacy.</span>
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center gap-6 sm:gap-8 font-semibold text-white/90">
          <button
            onClick={() => navigate('/')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Home
          </button>
          <button
            onClick={() => navigate('/explore')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Explore Reports
          </button>
          <button
            onClick={() => navigate('/community')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Community
          </button>
          <button
            onClick={() => navigate('/impact')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Impact Stories
          </button>
          <button
            onClick={() => navigate('/my-activity')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            My Activity
          </button>
          {/* Link to Staff & Admin login */}
          <button
            onClick={() => navigate('/staff/login')}
            className="flex items-center gap-1 text-[#FF873E] hover:text-white border border-[#FF873E]/40 hover:border-white px-3 py-1.5 rounded-full transition-all cursor-pointer"
          >
            <Lock className="w-3 h-3" />
            <span>Staff Portal (MFA)</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-[#287A58]/30 flex flex-col sm:flex-row items-center justify-between text-[11px] text-white/60 gap-4">
        <p>© 2026 CommunityConnect Platform. Hackathon PS-14.</p>
        <p className="flex items-center gap-1">
          Built with community accountability & transparency.
        </p>
      </div>
    </footer>
  );
};

