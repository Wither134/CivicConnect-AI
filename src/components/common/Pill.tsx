import React from 'react';

export type PillVariant =
  | 'critical'
  | 'high'
  | 'in_progress'
  | 'resolved'
  | 'under_review'
  | 'medium'
  | 'work_completed'
  | 'assigned'
  | 'unverified'
  | 'rejected'
  | 'duplicate'
  | 'sla_breach'
  | 'neutral';

export interface PillProps {
  variant?: PillVariant | string;
  label?: string;
  children?: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export const Pill: React.FC<PillProps> = ({
  variant = 'neutral',
  label,
  children,
  className = '',
  dot = false
}) => {
  // Exact color tokens from design system
  const variantStyles: Record<string, { bg: string; text: string; dotColor: string; defaultLabel: string }> = {
    critical: { bg: 'bg-[#FBE4E4]', text: 'text-[#8F1D1D]', dotColor: 'bg-[#8F1D1D]', defaultLabel: 'Critical' },
    high: { bg: 'bg-[#FDEBC8]', text: 'text-[#6B3E00]', dotColor: 'bg-[#6B3E00]', defaultLabel: 'High Priority' },
    in_progress: { bg: 'bg-[#FDEBC8]', text: 'text-[#6B3E00]', dotColor: 'bg-[#6B3E00]', defaultLabel: 'In Progress' },
    resolved: { bg: 'bg-[#D8F0EA]', text: 'text-[#0B5D54]', dotColor: 'bg-[#0B5D54]', defaultLabel: 'Resolved' },
    under_review: { bg: 'bg-[#E6EAF5]', text: 'text-[#2B3A67]', dotColor: 'bg-[#2B3A67]', defaultLabel: 'Under Review' },
    medium: { bg: 'bg-[#E6EAF5]', text: 'text-[#2B3A67]', dotColor: 'bg-[#2B3A67]', defaultLabel: 'Medium' },
    work_completed: { bg: 'bg-[#E6EAF5]', text: 'text-[#2B3A67]', dotColor: 'bg-[#2B3A67]', defaultLabel: 'Work Completed' },
    assigned: { bg: 'bg-[#E6EAF5]', text: 'text-[#2B3A67]', dotColor: 'bg-[#2B3A67]', defaultLabel: 'Assigned' },
    unverified: { bg: 'bg-[#F3ECE1]', text: 'text-[#755C43]', dotColor: 'bg-[#755C43]', defaultLabel: 'Unverified' },
    rejected: { bg: 'bg-[#FCE8E6]', text: 'text-[#9E1C14]', dotColor: 'bg-[#9E1C14]', defaultLabel: 'Rejected' },
    duplicate: { bg: 'bg-[#EFEFEF]', text: 'text-[#505050]', dotColor: 'bg-[#505050]', defaultLabel: 'Duplicate' },
    sla_breach: { bg: 'bg-[#FBE4E4]', text: 'text-[#8F1D1D]', dotColor: 'bg-[#8F1D1D]', defaultLabel: 'SLA Breach' },
    neutral: { bg: 'bg-[#EFE6DA]', text: 'text-[#6A5D52]', dotColor: 'bg-[#6A5D52]', defaultLabel: 'Status' }
  };

  const key = variant.toLowerCase().replace(/\s+/g, '_');
  const style = variantStyles[key] || variantStyles.neutral;
  const content = children || label || style.defaultLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[20px] text-[12px] font-semibold leading-none border border-transparent whitespace-nowrap select-none ${style.bg} ${style.text} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${style.dotColor}`} />}
      {content}
    </span>
  );
};

