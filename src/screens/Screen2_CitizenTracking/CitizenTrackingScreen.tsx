import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Pill } from '../../components/common/Pill.js';
import { Timeline } from '../../components/common/Timeline.js';
import { MapPreview } from '../../components/common/MapPreview.js';
import {
  IconArrowLeft,
  IconMapPin,
  IconClock,
  IconPlus,
  IconAlertTriangle,
  IconCheck,
  IconChevronRight
} from '../../components/common/Icons.js';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';

export interface CitizenTrackingScreenProps {
  navigate: (route: string) => void;
}

export const CitizenTrackingScreen: React.FC<CitizenTrackingScreenProps> = ({ navigate }) => {
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>('rep-123');
  const [selectedReportDetail, setSelectedReportDetail] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch my reports
  useEffect(() => {
    setIsLoading(true);
    apiRequest('/reports/my-reports')
      .then((data) => {
        if (data.reports) {
          setReports(data.reports);
          if (data.reports.length > 0) {
            // Default to rep-123 if present, else first
            const has123 = data.reports.find((r: any) => r.id === 'rep-123' || r.referenceNumber === 'CPR-2026-000123');
            setSelectedReportId(has123 ? has123.id : data.reports[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Fetch single report details & timeline
  useEffect(() => {
    if (!selectedReportId) return;
    apiRequest(`/reports/${selectedReportId}`)
      .then((data) => {
        if (data.report) {
          setSelectedReportDetail(data.report);
          setTimeline(data.timeline || []);
          setImages(data.images || []);
        }
      })
      .catch(() => {});
  }, [selectedReportId]);

  // Stage calculation for 5-segment progress bar:
  // Stage 1: Submitted
  // Stage 2: Verified
  // Stage 3: Assigned / In progress
  // Stage 4: Work completed
  // Stage 5: Resolved
  const getStageNumber = (status: string) => {
    switch (status) {
      case 'submitted':
      case 'under_review':
        return 1;
      case 'verified':
        return 2;
      case 'assigned':
      case 'in_progress':
        return 3;
      case 'work_completed':
        return 4;
      case 'resolved':
        return 5;
      default:
        return 1;
    }
  };

  const stage = selectedReportDetail ? getStageNumber(selectedReportDetail.status) : 3;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-[#1E1B18]">My Reports & Resolution Tracking</h1>
          <p className="text-xs text-[#6A5D52] mt-1">
            Track real-time progress and moderator updates for your submitted civic requests.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<IconPlus size={15} />}
          onClick={() => navigate('/report')}
        >
          Report an issue
        </Button>
      </div>

      {reports.length === 0 && !isLoading ? (
        // Empty State: "You haven't reported anything yet" and a "Report an issue" button
        <Card className="text-center py-16 px-6 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-full bg-[#FFF1E6] border border-[#F4A582] flex items-center justify-center text-[#B03A0C] mx-auto mb-4">
            <IconAlertTriangle size={24} />
          </div>
          <h2 className="text-lg font-serif font-semibold text-[#1E1B18]">
            You haven't reported anything yet
          </h2>
          <p className="mt-2 text-sm text-[#6A5D52] max-w-sm mx-auto">
            See an unlit streetlight, a deep pothole, or an overflowing waste bin? Submit a report to alert your local municipality.
          </p>
          <div className="mt-6">
            <Button variant="primary" onClick={() => navigate('/report')}>
              Report an issue
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: List of reports */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6A5D52]">
              Submitted Issues ({reports.length})
            </h2>
            <div className="space-y-2.5">
              {reports.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedReportId(r.id)}
                  className={`p-4 rounded-[12px] border cursor-pointer transition-colors ${
                    selectedReportId === r.id
                      ? 'bg-white border-[#B03A0C] ring-1 ring-[#B03A0C]'
                      : 'bg-white border-[#E9DFD3] hover:border-[#D9C9B8]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-medium text-[#6A5D52]">{r.referenceNumber}</span>
                    <Pill variant={r.status} dot={false} />
                  </div>
                  <h3 className="text-sm font-semibold text-[#1E1B18] line-clamp-1">{r.title}</h3>
                  <div className="mt-2 flex items-center justify-between text-xs text-[#6A5D52]">
                    <span>{r.categoryName}</span>
                    <span className="flex items-center gap-1">
                      {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      <IconChevronRight size={13} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Detail View (ID CPR-2026-000123) */}
          {selectedReportDetail && (
            <div className="lg:col-span-8 space-y-6">
              <Card className="p-6">
                {/* Reference ID and Status Pills */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EFE6DA]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#6A5D52] bg-[#FAF5EE] px-2.5 py-1 rounded-[6px] border border-[#E9DFD3]">
                      {selectedReportDetail.referenceNumber}
                    </span>
                    <Pill variant={selectedReportDetail.status} />
                    <Pill variant={selectedReportDetail.priority} />
                  </div>
                  <span className="text-xs text-[#6A5D52] font-mono">
                    Updated {new Date(selectedReportDetail.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>

                {/* Title */}
                <div className="mt-4">
                  <h2 className="text-xl font-serif font-semibold text-[#1E1B18]">
                    {selectedReportDetail.title}
                  </h2>
                  <p className="mt-2 text-sm text-[#1E1B18] leading-relaxed">
                    {selectedReportDetail.description}
                  </p>
                </div>

                {/* 5-segment progress bar & caption */}
                <div className="mt-6 pt-5 border-t border-[#EFE6DA]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#1E1B18] uppercase tracking-wider">
                      Resolution Progress
                    </span>
                    <span className="text-xs font-semibold text-[#B03A0C]">
                      Stage {stage} of 5 · Expected fix by 8 Nov
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 h-[6px]">
                    {[1, 2, 3, 4, 5].map((seg) => (
                      <div
                        key={seg}
                        className={`rounded-[3px] transition-colors ${
                          seg <= stage
                            ? stage === 5
                              ? 'bg-[#0F766E]'
                              : 'bg-[#B03A0C]'
                            : 'bg-[#E9DFD3]'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-5 text-[10px] text-[#6A5D52] text-center font-medium">
                    <span className={stage >= 1 ? 'text-[#1E1B18] font-semibold' : ''}>Submitted</span>
                    <span className={stage >= 2 ? 'text-[#1E1B18] font-semibold' : ''}>Verified</span>
                    <span className={stage >= 3 ? 'text-[#1E1B18] font-semibold' : ''}>In Progress</span>
                    <span className={stage >= 4 ? 'text-[#1E1B18] font-semibold' : ''}>Work Done</span>
                    <span className={stage >= 5 ? 'text-[#0F766E] font-semibold' : ''}>Resolved</span>
                  </div>
                </div>

                {/* Approximate Location Card */}
                <div className="mt-6 pt-5 border-t border-[#EFE6DA]">
                  <h3 className="text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-2">
                    Approximate Location
                  </h3>
                  <div className="p-3 bg-[#FAF5EE] border border-[#E9DFD3] rounded-[10px] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-white rounded-full border border-[#D9C9B8] text-[#B03A0C]">
                        <IconMapPin size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1E1B18]">{selectedReportDetail.ward}</p>
                        <p className="text-xs text-[#6A5D52]">{selectedReportDetail.addressHint}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/')}
                    >
                      View on map
                    </Button>
                  </div>
                </div>

                {/* Read-Only Timeline */}
                <div className="mt-8 pt-6 border-t border-[#EFE6DA]">
                  <h3 className="text-xs font-semibold text-[#1E1B18] uppercase tracking-wider mb-4">
                    Audit & Activity Timeline
                  </h3>
                  <Timeline items={timeline} currentStatus={selectedReportDetail.status} />
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

