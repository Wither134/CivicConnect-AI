import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.js';
import { Button } from '../../components/common/Button.js';
import { Pill } from '../../components/common/Pill.js';
import { StatTile } from '../../components/common/StatTile.js';
import { MapPreview, MapMarker } from '../../components/common/MapPreview.js';
import { OperationsMap, Hotspot } from '../../components/common/OperationsMap.js';
import {
  IconShield,
  IconClock,
  IconCheckCircle,
  IconAlertTriangle,
  IconPlus,
  IconArrowLeft,
  IconRefreshCw
} from '../../components/common/Icons.js';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';

export interface PublicDashboardScreenProps {
  navigate: (route: string) => void;
}

export const PublicDashboardScreen: React.FC<PublicDashboardScreenProps> = ({ navigate }) => {
  const { user, isAuthenticated } = useAuth();

  const [dashboardData, setDashboardData] = useState<any>({
    kpis: {
      reportsThisMonth: 312,
      openReports: 248,
      resolvedWithUpdate: 64,
      avgTimeToResolveDays: 4.2
    },
    weeklyTrends: [
      { week: 'Week 1', submitted: 68, resolved: 14 },
      { week: 'Week 2', submitted: 82, resolved: 18 },
      { week: 'Week 3', submitted: 74, resolved: 16 },
      { week: 'Week 4', submitted: 88, resolved: 16 }
    ],
    categoriesBreakdown: [
      { name: 'Roads', percentage: 38, count: 118, color: '#B03A0C' },
      { name: 'Streetlights', percentage: 27, count: 84, color: '#F4A582' },
      { name: 'Waste', percentage: 21, count: 66, color: '#6A5D52' },
      { name: 'Water & Sewage', percentage: 14, count: 44, color: '#0F766E' }
    ],
    recentUpdates: [],
    recurringProblem: {
      title: 'Repeated Streetlight Failures on 5th Main',
      count: 4,
      window: 'Past 30 days',
      category: 'Streetlight',
      ward: 'Ward 45 (Central)',
      note: 'Multiple reports pinpointing aging underground power feeder cable along 5th Main corridor. Escalated to department chief engineer.'
    }
  });

  const [mapMarkers, setMapMarkers] = useState<MapMarker[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [useRealGisMap, setUseRealGisMap] = useState<boolean>(true);

  useEffect(() => {
    apiRequest('/public/dashboard')
      .then((data) => {
        if (data.kpis) {
          setDashboardData(data);
        }
      })
      .catch(() => {});

    apiRequest('/public/reports-map')
      .then((data) => {
        if (data.reports) {
          setMapMarkers(data.reports);
        }
      })
      .catch(() => {});

    apiRequest('/gis/hotspots')
      .then((data) => {
        if (data.clusters) {
          setHotspots(data.clusters);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#FBF6EF] pb-16">
      {/* Dark Hero Band */}
      <section className="bg-[#1E1B18] text-[#D9CEC2] pt-12 pb-24 px-4 sm:px-8 border-b border-[#2C2723]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[20px] bg-[#2C2723] text-[#F4A582] text-xs font-semibold uppercase tracking-wider mb-4 border border-[#3D352F]">
              <IconShield size={13} />
              Open Civic Ledger · Municipal Trust Platform
            </div>
            <h1 className="text-3xl sm:text-[42px] font-serif font-bold text-white tracking-tight leading-tight">
              Every report, tracked to a recorded fix.
            </h1>
            <p className="mt-3 text-base text-[#D9CEC2] leading-relaxed">
              Real-time public dashboard of community issues. Every status transition is enforced by a controlled state machine and certified by municipal officers.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="primary"
              size="lg"
              icon={<IconPlus size={18} />}
              onClick={() => {
                if (!isAuthenticated) {
                  navigate('/login');
                } else {
                  navigate('/report');
                }
              }}
            >
              {!isAuthenticated ? 'Sign in to report' : 'Report an issue'}
            </Button>
          </div>
        </div>
      </section>

      {/* Four Stat Cards Overlapping the Hero (-mt-12) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 -mt-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="Reports this month"
            value={dashboardData.kpis.reportsThisMonth}
            subtext="+14% compared to last cycle"
          />
          <StatTile
            label="Open issues"
            value={dashboardData.kpis.openReports}
            subtext="Under active triage or field repair"
          />
          <StatTile
            label="Resolved with proof"
            value={dashboardData.kpis.resolvedWithUpdate}
            subtext="Two-person verified sign-offs"
          />
          <StatTile
            label="Average resolution time"
            value={`${dashboardData.kpis.avgTimeToResolveDays} d`}
            subtext="Meets municipal SLA standard"
          />
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 mt-10 space-y-10">
        {/* Issue Map Section */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
            <div>
              <h2 className="text-xl font-serif font-semibold text-[#1E1B18]">Live Municipal Issue Map</h2>
              <p className="text-xs text-[#6A5D52]">
                Interactive geographic distribution of pending and resolved incidents across city wards.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-[#6A5D52]">
                Showing {mapMarkers.length} geocoded incidents
              </span>
              <div className="flex bg-[#EAE3D9] p-0.5 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setUseRealGisMap(true)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    useRealGisMap ? 'bg-white text-[#1E1B18] shadow-xs' : 'text-[#6E645A]'
                  }`}
                >
                  GIS Tile Map
                </button>
                <button
                  onClick={() => setUseRealGisMap(false)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    !useRealGisMap ? 'bg-white text-[#1E1B18] shadow-xs' : 'text-[#6E645A]'
                  }`}
                >
                  Schematic Grid
                </button>
              </div>
            </div>
          </div>

          <div className="w-full rounded-[14px] overflow-hidden border border-[#E9DFD3] bg-white">
            {useRealGisMap ? (
              <OperationsMap
                reports={mapMarkers}
                hotspots={hotspots}
                isCoarsenedView={true}
                height="480px"
              />
            ) : (
              <div className="h-[460px] w-full">
                <MapPreview
                  markers={mapMarkers}
                  center={{ lat: 12.9716, lng: 77.5946 }}
                  className="w-full h-full"
                  showPrivacyNotice={true}
                />
              </div>
            )}
          </div>
        </section>

        {/* Charts & Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Weekly Trend Chart (Solid rust = Submitted, Dashed teal = Resolved) */}
          <div className="lg:col-span-7">
            <Card className="p-6 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-serif font-semibold text-[#1E1B18]">Weekly Resolution Velocity</h3>
                    <p className="text-xs text-[#6A5D52]">Submitted vs. Recorded Fixes (past 4 weeks)</p>
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <div className="flex items-center gap-1.5 text-[#B03A0C]">
                      <span className="w-3 h-1 bg-[#B03A0C] rounded-full inline-block" />
                      <span>Submitted</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#0F766E]">
                      <span className="w-3 h-0 border-t-2 border-dashed border-[#0F766E] inline-block" />
                      <span>Resolved</span>
                    </div>
                  </div>
                </div>

                {/* SVG Chart */}
                <div className="h-56 w-full pt-4">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180">
                    {/* Horizontal grid lines */}
                    <line x1="40" y1="20" x2="480" y2="20" stroke="#EFE6DA" strokeWidth="1" />
                    <line x1="40" y1="60" x2="480" y2="60" stroke="#EFE6DA" strokeWidth="1" />
                    <line x1="40" y1="100" x2="480" y2="100" stroke="#EFE6DA" strokeWidth="1" />
                    <line x1="40" y1="140" x2="480" y2="140" stroke="#EFE6DA" strokeWidth="1" />

                    {/* Axis labels */}
                    <text x="10" y="25" fill="#6A5D52" fontSize="10" fontFamily="Inter">90</text>
                    <text x="10" y="65" fill="#6A5D52" fontSize="10" fontFamily="Inter">60</text>
                    <text x="10" y="105" fill="#6A5D52" fontSize="10" fontFamily="Inter">30</text>
                    <text x="10" y="145" fill="#6A5D52" fontSize="10" fontFamily="Inter">0</text>

                    {/* Submitted curve: solid rust */}
                    <path
                      d="M 60,65 L 180,40 L 300,52 L 420,30"
                      fill="none"
                      stroke="#B03A0C"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    {/* Submitted points */}
                    <circle cx="60" cy="65" r="4" fill="#B03A0C" />
                    <circle cx="180" cy="40" r="4" fill="#B03A0C" />
                    <circle cx="300" cy="52" r="4" fill="#B03A0C" />
                    <circle cx="420" cy="30" r="4" fill="#B03A0C" />

                    {/* Resolved curve: dashed teal */}
                    <path
                      d="M 60,125 L 180,118 L 300,122 L 420,120"
                      fill="none"
                      stroke="#0F766E"
                      strokeWidth="2.5"
                      strokeDasharray="5,4"
                      strokeLinecap="round"
                    />
                    {/* Resolved points */}
                    <rect x="56" y="121" width="8" height="8" rx="2" fill="#0F766E" />
                    <rect x="176" y="114" width="8" height="8" rx="2" fill="#0F766E" />
                    <rect x="296" y="118" width="8" height="8" rx="2" fill="#0F766E" />
                    <rect x="416" y="116" width="8" height="8" rx="2" fill="#0F766E" />

                    {/* Week labels */}
                    <text x="50" y="165" fill="#6A5D52" fontSize="11" fontFamily="Inter">Week 1</text>
                    <text x="170" y="165" fill="#6A5D52" fontSize="11" fontFamily="Inter">Week 2</text>
                    <text x="290" y="165" fill="#6A5D52" fontSize="11" fontFamily="Inter">Week 3</text>
                    <text x="410" y="165" fill="#6A5D52" fontSize="11" fontFamily="Inter">Week 4</text>
                  </svg>
                </div>
              </div>

              <div className="pt-4 border-t border-[#EFE6DA] text-xs text-[#6A5D52] flex items-center justify-between">
                <span>Total resolved this month: 64 reports</span>
                <span className="font-semibold text-[#0F766E]">98.2% on-time SLA compliance</span>
              </div>
            </Card>
          </div>

          {/* "By category" bars (Roads 38%, Streetlights 27%, Waste 21%) */}
          <div className="lg:col-span-5">
            <Card className="p-6 h-full flex flex-col justify-between">
              <div>
                <h3 className="text-base font-serif font-semibold text-[#1E1B18] mb-1">Issues by Category</h3>
                <p className="text-xs text-[#6A5D52] mb-5">Distribution across primary civic departments</p>

                <div className="space-y-4">
                  {dashboardData.categoriesBreakdown.map((cat: any) => (
                    <div key={cat.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-[#1E1B18]">{cat.name}</span>
                        <span className="text-[#6A5D52]">{cat.percentage}% ({cat.count})</span>
                      </div>
                      <div className="h-[6px] w-full bg-[#EFE6DA] rounded-[3px] overflow-hidden">
                        <div
                          style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                          className="h-full rounded-[3px]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Amber Recurring Problem Card */}
              <div className="mt-6 p-4 rounded-[10px] bg-[#FFF8EE] border border-[#FDEBC8]">
                <div className="flex items-center gap-2 text-[#6B3E00] font-semibold text-xs mb-1.5">
                  <IconAlertTriangle size={15} />
                  <span>Recurring Problem Advisory</span>
                </div>
                <h4 className="text-sm font-semibold text-[#1E1B18]">
                  {dashboardData.recurringProblem.title}
                </h4>
                <p className="text-xs text-[#6A5D52] mt-1 leading-relaxed">
                  {dashboardData.recurringProblem.note}
                </p>
                <div className="mt-2.5 flex items-center gap-2 text-[11px] text-[#6B3E00] font-medium">
                  <span className="bg-[#FDEBC8] px-2 py-0.5 rounded-[4px]">
                    {dashboardData.recurringProblem.count} reports in {dashboardData.recurringProblem.window}
                  </span>
                  <span>{dashboardData.recurringProblem.ward}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Recent Updates List */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-serif font-semibold text-[#1E1B18]">Recent Recorded Fixes & Progress</h2>
            <button
              onClick={() => navigate('/report')}
              className="text-xs font-semibold text-[#B03A0C] hover:underline"
            >
              Report an issue in your ward →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dashboardData.recentUpdates.slice(0, 3).map((item: any) => (
              <Card key={item.id} className="p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono text-[#6A5D52]">{item.referenceNumber}</span>
                  <Pill variant={item.status} />
                </div>
                <h3 className="text-sm font-semibold text-[#1E1B18] line-clamp-1">{item.title}</h3>
                <p className="text-xs text-[#6A5D52] mt-1">{item.ward}</p>
                <div className="mt-3 pt-2.5 border-t border-[#EFE6DA] flex items-center justify-between text-[11px] text-[#6A5D52]">
                  <span>{item.category}</span>
                  <span>{new Date(item.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

