import React from 'react';

export interface RoleBadgeProps {
  role?: string;
  departmentName?: string | null;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role = 'citizen', departmentName, className = '' }) => {
  const normRole = (role || 'citizen').toLowerCase().replace(/\s+/g, '_');

  const roleConfigs: Record<string, { label: string; bg: string; text: string; border: string }> = {
    citizen: {
      label: 'Citizen',
      bg: 'bg-[#F0EAE1]',
      text: 'text-[#554B43]',
      border: 'border-[#E2D5C5]'
    },
    staff: {
      label: departmentName ? `Staff · ${departmentName}` : 'Staff',
      bg: 'bg-[#D8F0EA]',
      text: 'text-[#0B5D54]',
      border: 'border-[#B6E2D8]'
    },
    admin: {
      label: 'Admin · Moderator',
      bg: 'bg-[#FFF1E6]',
      text: 'text-[#B03A0C]',
      border: 'border-[#F8D2BA]'
    },
    super_admin: {
      label: 'Super Admin',
      bg: 'bg-[#1E1B18]',
      text: 'text-[#FFFFFF]',
      border: 'border-[#1E1B18]'
    }
  };

  const config = roleConfigs[normRole] || roleConfigs.citizen;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-[20px] text-[11px] font-semibold border tracking-wide whitespace-nowrap select-none ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      {config.label}
    </span>
  );
};

