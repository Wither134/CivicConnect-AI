import React from 'react';
import { Card } from './Card.js';

export interface StatTileProps {
  label: string;
  value: string | number;
  subtext?: string;
  isAlert?: boolean;
  alertText?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  subtext,
  isAlert = false,
  alertText,
  icon,
  className = ''
}) => {
  return (
    <Card
      padding="md"
      className={`relative ${
        isAlert ? 'border-[#FBE4E4] bg-[#FFF8F8]' : 'bg-white border-[#E9DFD3]'
      } ${className}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-medium text-[#6A5D52] tracking-wide uppercase">
            {label}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-[32px] font-serif leading-none tracking-tight ${
                isAlert ? 'text-[#8F1D1D]' : 'text-[#1E1B18]'
              }`}
            >
              {value}
            </span>
            {alertText && (
              <span className="text-[11px] font-semibold text-[#8F1D1D] bg-[#FBE4E4] px-2 py-0.5 rounded-[20px]">
                {alertText}
              </span>
            )}
          </div>
          {subtext && <p className="mt-2 text-[12px] text-[#6A5D52]">{subtext}</p>}
        </div>
        {icon && <div className="text-[#6A5D52] p-1.5">{icon}</div>}
      </div>
    </Card>
  );
};

