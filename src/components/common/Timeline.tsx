import React from 'react';
import { Pill } from './Pill.js';
import { IconCheck, IconClock, IconCamera } from './Icons.js';

export interface TimelineItem {
  id: string;
  actorName: string;
  role: string;
  fromStatus: string;
  toStatus: string;
  note: string;
  proofImageUrl?: string | null;
  createdAt: string;
}

export interface TimelineProps {
  items: TimelineItem[];
  currentStatus: string;
}

export const Timeline: React.FC<TimelineProps> = ({ items, currentStatus }) => {
  // If no items, show default placeholder
  if (!items || items.length === 0) {
    return <div className="text-sm text-[#6A5D52] py-3">No activity recorded yet.</div>;
  }

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#EFE6DA]">
      {items.map((item, idx) => {
        const isLatest = idx === items.length - 1;
        const isResolved = item.toStatus === 'resolved';

        return (
          <div key={item.id} className="relative group">
            {/* Step dot */}
            <div
              className={`absolute -left-[24px] top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                isResolved
                  ? 'bg-[#D8F0EA] border-[#0F766E] text-[#0F766E]'
                  : isLatest
                  ? 'bg-[#FFF1E6] border-[#B03A0C] text-[#B03A0C]'
                  : 'bg-white border-[#D9C9B8] text-[#6A5D52]'
              }`}
            >
              {isResolved ? (
                <IconCheck size={12} />
              ) : isLatest ? (
                <span className="w-2 h-2 rounded-full bg-[#B03A0C]" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-[#6A5D52]" />
              )}
            </div>

            <div className="bg-[#FAF5EE] border border-[#E9DFD3] rounded-[10px] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Pill variant={item.toStatus} dot={false} />
                  <span className="text-[13px] font-semibold text-[#1E1B18]">{item.actorName}</span>
                  <span className="text-[11px] text-[#6A5D52] uppercase tracking-wider font-medium">
                    ({item.role})
                  </span>
                </div>
                <span className="text-[12px] text-[#6A5D52] flex items-center gap-1 font-mono">
                  <IconClock size={13} />
                  {formatDate(item.createdAt)}
                </span>
              </div>

              {item.note && (
                <p className="mt-2 text-[13px] text-[#1E1B18] leading-relaxed">
                  {item.note}
                </p>
              )}

              {item.proofImageUrl && (
                <div className="mt-3 p-2 bg-white border border-[#E9DFD3] rounded-[8px] inline-block">
                  <div className="flex items-center gap-2 mb-1.5 text-[11px] font-semibold text-[#0B5D54]">
                    <IconCamera size={13} />
                    Verified Proof Attachment
                  </div>
                  <img
                    src={item.proofImageUrl}
                    alt="Work completion proof"
                    className="w-36 h-24 object-cover rounded-[6px] border border-[#E9DFD3]"
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Anticipated final step indicator if not yet resolved */}
      {currentStatus !== 'resolved' && (
        <div className="relative">
          <div className="absolute -left-[24px] top-1 w-6 h-6 rounded-full border-2 border-dashed border-[#D9C9B8] bg-white flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D9C9B8]" />
          </div>
          <div className="p-3 border border-dashed border-[#D9C9B8] rounded-[10px] bg-white/50 text-[12px] text-[#6A5D52]">
            <span className="font-medium text-[#1E1B18]">Resolution sign-off</span>: Shown only after an administrator reviews the proof and records the final update.
          </div>
        </div>
      )}
    </div>
  );
};

