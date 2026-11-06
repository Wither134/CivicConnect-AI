import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Layers,
  Flame,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Shield,
  Eye,
  ChevronRight
} from 'lucide-react';

export interface Hotspot {
  cluster_id: number;
  centroid_lat: number;
  centroid_lng: number;
  radius_meters: number;
  report_count: number;
  dominant_category: string;
  category_breakdown?: Record<string, number>;
}

export interface OperationsMapProps {
  reports: any[];
  hotspots?: Hotspot[];
  selectedReport?: any | null;
  onSelectReport?: (report: any) => void;
  height?: string;
  isCoarsenedView?: boolean;
  showHotspotControls?: boolean;
}

/**
 * Extracts valid numerical [lat, lng] from various report object shapes.
 */
function extractCoords(r: any): [number, number] | null {
  if (!r) return null;
  const lat = r.latitude ?? r.lat ?? r.exact_lat ?? r.coarsened_lat;
  const lng = r.longitude ?? r.lng ?? r.exact_lng ?? r.coarsened_lng;
  if (
    lat !== null &&
    lat !== undefined &&
    lng !== null &&
    lng !== undefined &&
    !isNaN(Number(lat)) &&
    !isNaN(Number(lng))
  ) {
    return [Number(lat), Number(lng)];
  }
  return null;
}

/**
 * Creates custom styled HTML DivIcon markers for Leaflet.
 */
function createCustomMarkerIcon(status: string, priority: string) {
  let colorClass = 'marker-pin--blue';
  const s = (status || '').toLowerCase();
  const p = (priority || '').toLowerCase();

  if (s === 'resolved') {
    colorClass = 'marker-pin--emerald';
  } else if (s === 'work_completed') {
    colorClass = 'marker-pin--teal';
  } else if (s === 'in_progress') {
    colorClass = 'marker-pin--amber';
  } else if (s === 'under_review' || s === 'assigned') {
    colorClass = 'marker-pin--purple';
  } else if (p === 'critical' || p === 'urgent' || p === 'high') {
    colorClass = 'marker-pin--rose';
  }

  const isPulsing = p === 'critical' || s === 'submitted';

  const html = `
    <div class="custom-leaflet-marker ${colorClass}">
      ${isPulsing ? '<div class="marker-pulse"></div>' : ''}
      <div class="marker-core">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="7"/>
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-leaflet-container',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16]
  });
}

/**
 * Helper component that controls map viewport / auto-fitting bounds.
 */
function MapBoundsController({
  points,
  selectedCoords
}: {
  points: [number, number][];
  selectedCoords?: [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedCoords) {
      map.flyTo(selectedCoords, 15, { duration: 1.0 });
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 14);
    } else if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [points, selectedCoords, map]);

  return null;
}

export const OperationsMap: React.FC<OperationsMapProps> = ({
  reports = [],
  hotspots = [],
  selectedReport = null,
  onSelectReport,
  height = '520px',
  isCoarsenedView = false,
  showHotspotControls = true
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [showHotspots, setShowHotspots] = useState(true);

  // Filter reports that have valid coordinates
  const validReports = useMemo(() => {
    return reports.filter((r) => {
      const coords = extractCoords(r);
      if (!coords) return false;

      const s = (r.status || '').toLowerCase();
      if (statusFilter === 'open') {
        return s === 'submitted' || s === 'under_review' || s === 'assigned';
      }
      if (statusFilter === 'in_progress') {
        return s === 'in_progress' || s === 'work_completed';
      }
      if (statusFilter === 'resolved') {
        return s === 'resolved';
      }
      return true;
    });
  }, [reports, statusFilter]);

  // Handle subtle coordinate jitter if multiple reports have identical coordinates
  const positionedReports = useMemo(() => {
    const counts: Record<string, number> = {};
    return validReports.map((r) => {
      const baseCoords = extractCoords(r)!;
      const key = `${baseCoords[0].toFixed(4)},${baseCoords[1].toFixed(4)}`;
      const idx = counts[key] || 0;
      counts[key] = idx + 1;

      let lat = baseCoords[0];
      let lng = baseCoords[1];
      if (idx > 0) {
        const angle = idx * (Math.PI / 3);
        const offset = 0.00035 * Math.sqrt(idx);
        lat += Math.cos(angle) * offset;
        lng += Math.sin(angle) * offset;
      }

      const priority = r.priority || (r.priority_level ? r.priority_level.toLowerCase() : 'medium');

      return {
        report: r,
        position: [lat, lng] as [number, number],
        priority,
        status: r.status || 'submitted'
      };
    });
  }, [validReports]);

  const allPoints = useMemo(() => positionedReports.map((p) => p.position), [positionedReports]);
  const selectedCoords = useMemo(() => extractCoords(selectedReport), [selectedReport]);

  const defaultCenter: [number, number] =
    allPoints.length > 0 ? allPoints[0] : [12.9716, 77.5946];

  return (
    <div className="relative rounded-[16px] overflow-hidden border border-[#E9DFD3] bg-white shadow-sm flex flex-col">
      {/* Top Map Toolbar */}
      <div className="px-4 py-3 bg-[#FBF9F5] border-b border-[#E9DFD3] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#174B38]/10 text-[#174B38] flex items-center justify-center">
            <Layers size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#1E1B18]">GIS Operations Map</h3>
              <span className="text-xs bg-[#174B38] text-white px-2 py-0.5 rounded-full font-bold">
                {positionedReports.length} Mappable
              </span>
            </div>
            {isCoarsenedView && (
              <p className="text-[11px] text-[#7D8981] flex items-center gap-1">
                <Shield size={12} className="text-[#287A58]" />
                Public Privacy Protection: Coordinates coarsened to ~1.1 km
              </p>
            )}
          </div>
        </div>

        {/* Filters & Hotspots Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-[#EAE3D9] p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'all' ? 'bg-white text-[#1E1B18] shadow-xs' : 'text-[#6E645A]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('open')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'open' ? 'bg-white text-[#1E1B18] shadow-xs' : 'text-[#6E645A]'
              }`}
            >
              Open
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'in_progress' ? 'bg-white text-[#1E1B18] shadow-xs' : 'text-[#6E645A]'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setStatusFilter('resolved')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === 'resolved' ? 'bg-white text-[#1E1B18] shadow-xs' : 'text-[#6E645A]'
              }`}
            >
              Resolved
            </button>
          </div>

          {showHotspotControls && hotspots.length > 0 && (
            <button
              onClick={() => setShowHotspots(!showHotspots)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
                showHotspots
                  ? 'bg-[#FF873E]/10 text-[#B93E16] border-[#FF873E]/30'
                  : 'bg-white text-[#7D8981] border-[#E9DFD3]'
              }`}
            >
              <Flame size={14} className={showHotspots ? 'text-[#FF873E]' : 'text-gray-400'} />
              <span>DBSCAN Hotspots ({hotspots.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Leaflet Map Canvas */}
      <div style={{ height }} className="relative w-full">
        {positionedReports.length === 0 && (
          <div className="absolute inset-0 z-[400] bg-white/70 backdrop-blur-xs flex items-center justify-center">
            <div className="text-center p-6 bg-white rounded-xl shadow-lg border border-[#E9DFD3]">
              <Layers className="w-10 h-10 text-[#7D8981] mx-auto mb-2" />
              <p className="text-sm font-bold text-[#1E1B18]">No Mappable Incidents Found</p>
              <p className="text-xs text-[#7D8981]">Adjust status filters or submit reports with coordinates.</p>
            </div>
          </div>
        )}

        <MapContainer
          center={defaultCenter}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapBoundsController points={allPoints} selectedCoords={selectedCoords} />

          {/* DBSCAN Hotspots Circles Layer */}
          {showHotspots &&
            hotspots.map((h) => (
              <Circle
                key={`hotspot-${h.cluster_id}`}
                center={[h.centroid_lat, h.centroid_lng]}
                radius={h.radius_meters || 650}
                pathOptions={{
                  color: '#EF4444',
                  fillColor: '#EF4444',
                  fillOpacity: 0.18,
                  weight: 2,
                  dashArray: '4, 4'
                }}
              >
                <Popup>
                  <div className="p-2 space-y-1">
                    <div className="flex items-center gap-1 text-[#EF4444] font-bold text-xs uppercase tracking-wider">
                      <Flame size={13} />
                      <span>Density Hotspot #{h.cluster_id + 1}</span>
                    </div>
                    <p className="text-xs font-bold text-[#1E1B18]">
                      {h.report_count} Incidents Clustered
                    </p>
                    <p className="text-[11px] text-[#7D8981]">
                      Primary: <span className="font-semibold text-[#1E1B18]">{h.dominant_category}</span>
                    </p>
                    <p className="text-[10px] text-[#A8A29E] font-mono">
                      Radius: ~{Math.round(h.radius_meters)}m (DBSCAN eps=650m)
                    </p>
                  </div>
                </Popup>
              </Circle>
            ))}

          {/* Incident Report Pins */}
          {positionedReports.map(({ report, position, priority, status }) => {
            const isSelected = selectedReport && String(selectedReport.id) === String(report.id);
            const refNum = report.reference_number || report.referenceNumber || report.report_code || `REP-${report.id}`;
            const catName = report.category_name || report.category?.name || report.category || 'General Civic';

            return (
              <Marker
                key={report.id}
                position={position}
                icon={createCustomMarkerIcon(status, priority)}
                eventHandlers={{
                  click: () => onSelectReport?.(report)
                }}
              >
                <Popup className="operations-map-popup">
                  <div className="space-y-2 p-1">
                    <div className="flex items-center justify-between gap-2 border-b pb-1.5">
                      <span className="font-mono text-xs font-bold text-[#174B38] bg-[#174B38]/10 px-2 py-0.5 rounded">
                        {refNum}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded ${
                          priority === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : priority === 'high'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {priority}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-[#1E1B18] line-clamp-1">
                      {report.title}
                    </h4>

                    {report.description && (
                      <p className="text-[11px] text-[#6E645A] line-clamp-2">
                        {report.description}
                      </p>
                    )}

                    <div className="text-[11px] text-[#7D8981] space-y-0.5 pt-1">
                      <div>
                        <strong>Category:</strong> {catName}
                      </div>
                      <div>
                        <strong>Status:</strong>{' '}
                        <span className="capitalize font-semibold text-[#1E1B18]">
                          {status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {(report.ward || report.address_hint || report.location) && (
                        <div>
                          <strong>Ward:</strong> {report.ward || report.address_hint || report.location}
                        </div>
                      )}
                    </div>

                    {onSelectReport && (
                      <button
                        onClick={() => onSelectReport(report)}
                        className="w-full mt-2 bg-[#174B38] text-white hover:bg-[#11392A] text-xs font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>Select for Dispatch</span>
                        <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Legend Overlay at bottom-left */}
        <div className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur-sm p-2.5 rounded-xl border border-[#E9DFD3] shadow-md text-[11px] space-y-1.5">
          <div className="font-bold text-[#1E1B18] mb-1">Status Pin Legend</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
              <span className="text-[#4A4238]">Critical / Submitted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
              <span className="text-[#4A4238]">Under Review</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
              <span className="text-[#4A4238]">In Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
              <span className="text-[#4A4238]">Resolved</span>
            </div>
          </div>
          {hotspots.length > 0 && (
            <div className="pt-1 border-t border-gray-100 flex items-center gap-1.5 text-[#EF4444]">
              <span className="w-2.5 h-2.5 rounded-full border border-dashed border-[#EF4444] bg-[#EF4444]/20" />
              <span className="font-medium">DBSCAN Hotspot Radius</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OperationsMap;

