import React from 'react';
import { IconLock } from './Icons.js';

export interface LockBannerProps {
  isLockedByOther: boolean;
  lockOwner?: string | null;
  lockExpiresAt?: string | null;
  className?: string;
}

export const LockBanner: React.FC<LockBannerProps> = ({
  isLockedByOther,
  lockOwner,
  lockExpiresAt,
  className = ''
}) => {
  if (!isLockedByOther) return null;

  return (
    <div
      className={`bg-[#FFF1E6] border border-[#F4A582] rounded-[10px] p-3.5 flex items-start sm:items-center gap-3 text-[#B03A0C] ${className}`}
      role="alert"
    >
      <div className="p-1.5 bg-white rounded-full border border-[#F4A582] flex-shrink-0">
        <IconLock size={16} className="text-[#B03A0C]" />
      </div>
      <div className="text-[13px] flex-1">
        <span className="font-semibold">{lockOwner || 'Another team member'}</span> is currently reviewing this report.
        <span className="text-[#6A5D52] block sm:inline sm:ml-1.5">
          Editing is temporarily disabled to prevent conflicting updates. You have read-only access.
        </span>
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-white border border-[#F4A582] rounded-[4px] self-start sm:self-auto">
        Read-Only
      </span>
    </div>
  );
};

