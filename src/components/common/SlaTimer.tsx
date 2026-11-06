import React from 'react';
import { IconClock, IconAlertTriangle } from './Icons.js';
import { Pill } from './Pill.js';

export interface SlaTimerProps {
  dueAt: string;
  isBreached?: boolean;
  className?: string;
  showIcon?: boolean;
}

export const SlaTimer: React.FC<SlaTimerProps> = ({
  dueAt,
  isBreached = false,
  className = '',
  showIcon = true
}) => {
  const calculateRemaining = () => {
    try {
      const target = new Date(dueAt).getTime();
      const now = Date.now();
      const diffMs = target - now;
      const absDiff = Math.abs(diffMs);
      const hours = Math.floor(absDiff / (1000 * 60 * 60));
      const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));

      if (diffMs < 0 || isBreached) {
        if (hours > 24) {
          const days = Math.floor(hours / 24);
          return { label: `Overdue by ${days}d`, breached: true };
        }
        return { label: `Overdue by ${hours}h ${minutes}m`, breached: true };
      } else {
        if (hours > 24) {
          const days = Math.floor(hours / 24);
          return { label: `Due in ${days}d`, breached: false };
        }
        return { label: `Due in ${hours}h ${minutes}m`, breached: false };
      }
    } catch {
      return { label: 'SLA Active', breached: isBreached };
    }
  };

  const { label, breached } = calculateRemaining();

  if (breached) {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <Pill variant="sla_breach" label="SLA Breach" dot={true} />
        <span className="text-[12px] font-medium text-[#8F1D1D] font-mono">{label}</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1 text-[12px] font-medium text-[#6A5D52] font-mono ${className}`}>
      {showIcon && <IconClock size={13} className="text-[#6A5D52]" />}
      <span>{label}</span>
    </div>
  );
};

