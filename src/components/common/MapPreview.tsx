import React, { useState } from 'react';
import { Pill } from './Pill.js';
import { IconMapPin, IconShield } from './Icons.js';

export interface MapMarker {
  id: string;
  referenceNumber: string;
  title: string;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  lat: number;
  lng: number;
  ward?: string;
}

export interface MapPreviewProps {
  markers?: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  isMiniMap?: boolean;
  selectedMarkerId?: string;
  onSelectMarker?: (marker: MapMarker) => void;
  className?: string;
  showPrivacyNotice?: boolean;
}

export const MapPreview: React.FC<MapPreviewProps> = ({
  markers = [],
  center = { lat: 12.9716, lng: 77.5946 },
  isMiniMap = false,
  selectedMarkerId,
  onSelectMarker,
  className = '',
  showPrivacyNotice = true
}) => {
  const [activePin, setActivePin] = useState<MapMarker | null>(null);

  // SVG coordinate projection simulation
  // Center is mapped to 50%, 50%
  const projectToSvg = (lat: number, lng: number) => {
    const latSpan = 0.04;
    const lngSpan = 0.06;

    const x = ((lng - (center.lng - lngSpan / 2)) / lngSpan) * 100;
    const y = ((center.lat + latSpan / 2 - lat) / latSpan) * 100;

    return {
      x: Math.max(8, Math.min(92, x)),
      y: Math.max(8, Math.min(92, y))
    };
  };

  const getPinShape = (priority: string, status: string) => {
    if (status === 'resolved') {
      // Teal square
      return 'square';
    }
    if (priority === 'critical') {
      // Dark red circle
      return 'circle';
    }
    // In progress / High: amber diamond
    return 'diamond';
  };

  return (
    <div className={`relative overflow-hidden bg-[#F6EFE6] border border-[#E9DFD3] rounded-[14px] select-none ${className}`}>
      {/* Map Grid Pattern background */}
      <svg className="absolute inset-0 w-full h-full opacity-60" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="civic-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E5DACD" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#civic-grid)" />
        {/* Simulated Road corridors */}
        <path d="M -20,120 Q 200,80 500,260" fill="none" stroke="#E0D2C2" strokeWidth="12" strokeLinecap="round" />
        <path d="M 180,-20 L 180,400" fill="none" stroke="#E0D2C2" strokeWidth="8" />
        <path d="M 320,-20 L 320,400" fill="none" stroke="#E0D2C2" strokeWidth="8" />
        <path d="M -20,240 L 600,240" fill="none" stroke="#E0D2C2" strokeWidth="10" />
      </svg>

      {/* Cluster bubble simulation (Screen 3: cluster bubble "5") */}
      {!isMiniMap && (
        <div
          className="absolute z-10 flex items-center justify-center w-8 h-8 rounded-full bg-[#1E1B18] text-[#F4A582] text-[12px] font-bold border-2 border-white shadow-sm cursor-pointer"
          style={{ top: '38%', left: '46%' }}
          title="Cluster: 5 reports in Ward 45"
        >
          5
        </div>
      )}

      {/* Render Markers */}
      {markers.map((marker) => {
        const { x, y } = projectToSvg(marker.lat, marker.lng);
        const shape = getPinShape(marker.priority, marker.status);
        const isSelected = selectedMarkerId === marker.id || activePin?.id === marker.id;

        return (
          <div
            key={marker.id}
            onClick={() => {
              setActivePin(marker);
              onSelectMarker?.(marker);
            }}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-125 focus:outline-none"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {shape === 'circle' && (
              <div
                className={`w-6 h-6 rounded-full bg-[#8F1D1D] border-2 border-white flex items-center justify-center text-white ${
                  isSelected ? 'ring-2 ring-[#8F1D1D] ring-offset-2 scale-125' : ''
                }`}
                title={`${marker.referenceNumber}: ${marker.title} (Critical)`}
              >
                <span className="w-2 h-2 rounded-full bg-white" />
              </div>
            )}

            {shape === 'diamond' && (
              <div
                className={`w-6 h-6 bg-[#6B3E00] border-2 border-white rotate-45 flex items-center justify-center text-white ${
                  isSelected ? 'ring-2 ring-[#6B3E00] ring-offset-2 scale-125' : ''
                }`}
                title={`${marker.referenceNumber}: ${marker.title} (In Progress)`}
              >
                <span className="w-1.5 h-1.5 bg-[#FDEBC8] -rotate-45" />
              </div>
            )}

            {shape === 'square' && (
              <div
                className={`w-5 h-5 rounded-[3px] bg-[#0F766E] border-2 border-white flex items-center justify-center text-white ${
                  isSelected ? 'ring-2 ring-[#0F766E] ring-offset-2 scale-125' : ''
                }`}
                title={`${marker.referenceNumber}: ${marker.title} (Resolved)`}
              >
                <span className="w-1.5 h-1.5 bg-white rounded-full" />
              </div>
            )}
          </div>
        );
      })}

      {/* Active Pin Info Popover */}
      {activePin && (
        <div className="absolute bottom-10 left-4 right-4 sm:left-auto sm:right-4 sm:w-72 z-30 bg-white border border-[#E9DFD3] rounded-[10px] p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono font-medium text-[#6A5D52]">{activePin.referenceNumber}</span>
            <Pill variant={activePin.status} dot={false} />
          </div>
          <p className="text-[13px] font-semibold text-[#1E1B18] line-clamp-2">{activePin.title}</p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-[#6A5D52] pt-2 border-t border-[#EFE6DA]">
            <span>{activePin.ward || 'Central Zone'}</span>
            <span className="font-mono">{activePin.lat.toFixed(3)}, {activePin.lng.toFixed(3)}</span>
          </div>
        </div>
      )}

      {/* Map Legend (Screen 3: critical = dark red circles, in progress = amber diamonds, resolved = teal squares) */}
      {!isMiniMap && (
        <div className="absolute top-3 left-3 z-10 bg-white/95 border border-[#E9DFD3] rounded-[8px] p-2.5 text-[11px] text-[#1E1B18] space-y-1.5 backdrop-blur-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#8F1D1D] border border-white" />
            <span>Critical issue</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-[#6B3E00] rotate-45 border border-white" />
            <span>In progress / High</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-[2px] bg-[#0F766E] border border-white" />
            <span>Resolved</span>
          </div>
        </div>
      )}

      {/* Privacy Notice Banner */}
      {showPrivacyNotice && (
        <div className="absolute bottom-2 left-3 right-3 sm:right-auto z-10 bg-white/90 border border-[#E9DFD3] rounded-[6px] px-2.5 py-1 text-[11px] text-[#6A5D52] flex items-center gap-1.5">
          <IconShield size={12} className="text-[#0F766E]" />
          <span>Locations are approximate (~100m). Reporter identity is confidential.</span>
        </div>
      )}
    </div>
  );
};

