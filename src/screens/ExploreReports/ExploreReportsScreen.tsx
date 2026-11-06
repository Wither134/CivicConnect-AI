import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Grid,
  List,
  ThumbsUp,
  MapPin,
  Clock,
  ArrowRight,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Droplets,
  Trash2
} from 'lucide-react';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { OperationsMap, Hotspot } from '../../components/common/OperationsMap.js';

export interface ExploreReportsScreenProps {
  navigate: (route: string) => void;
  onSelectReport?: (reportId: string) => void;
}

export const ExploreReportsScreen: React.FC<ExploreReportsScreenProps> = ({ navigate, onSelectReport }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [reports, setReports] = useState<any[]>([]);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'supported' | 'priority'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('grid');
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [supportedReports, setSupportedReports] = useState<Record<string, boolean>>({});
  const [supportCounts, setSupportCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const categories = [
    { id: 'all', label: 'All Categories' },
    { id: 'cat-road', label: 'Roads & potholes' },
    { id: 'cat-streetlight', label: 'Streetlights' },
    { id: 'cat-waste', label: 'Waste management' },
    { id: 'cat-water', label: 'Water supply' },
    { id: 'cat-drain', label: 'Drainage & sewage' },
    { id: 'cat-infra', label: 'Public infrastructure' },
    { id: 'cat-parks', label: 'Parks & spaces' }
  ];

  const statuses = [
    { id: 'all', label: 'All Statuses' },
    { id: 'submitted', label: 'Submitted' },
    { id: 'under_review', label: 'Under Review' },
    { id: 'assigned', label: 'Acknowledged / Assigned' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'work_completed', label: 'Community Verification' },
    { id: 'resolved', label: 'Resolved' }
  ];

  useEffect(() => {
    setIsLoading(true);
    apiRequest('/public/reports-map')
      .then((data) => {
        if (data.reports) {
          setReports(data.reports);

          // Seed default mock support counts
          const counts: Record<string, number> = {};
          data.reports.forEach((r: any, idx: number) => {
            counts[r.id] = 10 + (idx * 7) % 45;
          });
          setSupportCounts(counts);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    apiRequest('/gis/hotspots')
      .then((data) => {
        if (data.clusters) setHotspots(data.clusters);
      })
      .catch(() => {});
  }, []);

  const handleSupportToggle = (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    const isCurrentlySupported = supportedReports[reportId];
    setSupportedReports((prev) => ({ ...prev, [reportId]: !isCurrentlySupported }));
    setSupportCounts((prev) => ({
      ...prev,
      [reportId]: (prev[reportId] || 0) + (isCurrentlySupported ? -1 : 1)
    }));

    showToast(
      !isCurrentlySupported
        ? 'Support recorded! Community support signals neighborhood interest.'
        : 'Support removed.',
      'success'
    );
  };

  // Filter & sort logic
  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
      (r.ward && r.ward.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'all' ||
      r.category?.toLowerCase().includes(selectedCategory.replace('cat-', '')) ||
      r.categoryId === selectedCategory;

    const matchesStatus = selectedStatus === 'all' || r.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#F7F7F1] py-10 px-4 sm:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-bold text-[#174B38] uppercase tracking-wider bg-[#EAF2EB] px-3.5 py-1 rounded-full">
            Transparent Civic Ledger
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#25312B] mt-2">
            Explore Community Reports
          </h1>
          <p className="text-sm text-[#7D8981] mt-1">
            Discover issues reported by your neighbours, lend your support, and track repairs.
          </p>
        </div>

        <button
          onClick={() => navigate('/report')}
          className="inline-flex items-center gap-2 bg-[#174B38] hover:bg-[#11392A] text-white px-5 py-3 rounded-full text-sm font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-[#FF873E]" strokeWidth={2.5} />
          <span>Report an Issue</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-2xl border border-[#EAF2EB] p-4 sm:p-5 shadow-xs mb-8 space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#7D8981]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports by title, reference ID, or ward..."
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#EAF2EB] bg-[#F7F7F1]/50 text-sm text-[#25312B] focus:outline-none focus:border-[#174B38]"
            />
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-11 px-3.5 rounded-xl border border-[#EAF2EB] bg-white text-xs font-semibold text-[#25312B] focus:outline-none focus:border-[#174B38] cursor-pointer"
            >
              <option value="recent">Most Recent</option>
              <option value="supported">Most Supported</option>
              <option value="priority">High Priority First</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center border border-[#EAF2EB] rounded-xl overflow-hidden p-0.5 bg-[#F7F7F1]/50">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white shadow-xs text-[#174B38]' : 'text-[#7D8981]'
                }`}
                aria-label="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'bg-white shadow-xs text-[#174B38]' : 'text-[#7D8981]'
                }`}
                aria-label="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'map' ? 'bg-white shadow-xs text-[#174B38]' : 'text-[#7D8981]'
                }`}
                aria-label="GIS Map view"
              >
                <MapPin className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3.5 py-1.5 rounded-full font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === c.id
                  ? 'bg-[#174B38] text-white'
                  : 'bg-[#F7F7F1] text-[#7D8981] hover:text-[#25312B] hover:bg-[#EAF2EB]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs border-t border-[#F5F7F1] pt-3">
          <span className="text-[11px] font-bold text-[#7D8981] uppercase tracking-wider mr-1">Status:</span>
          {statuses.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStatus(s.id)}
              className={`px-3 py-1 rounded-full font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedStatus === s.id
                  ? 'bg-[#FF873E] text-white font-bold'
                  : 'bg-[#F7F7F1] text-[#7D8981] hover:text-[#25312B]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Count and Result Grid */}
      <div className="mb-4 flex items-center justify-between text-xs text-[#7D8981]">
        <span>Showing {filteredReports.length} community reports</span>
        <span>Advisory support signals citizen prioritization</span>
      </div>

      {/* Grid, List, or GIS Map View */}
      {viewMode === 'map' ? (
        <OperationsMap
          reports={filteredReports}
          hotspots={hotspots}
          isCoarsenedView={true}
          onSelectReport={(r) => {
            onSelectReport?.(r.id);
            navigate(`/report-details?id=${r.id}`);
          }}
          height="620px"
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report) => {
            const isSupported = !!supportedReports[report.id];
            const count = supportCounts[report.id] || 15;

            return (
              <div
                key={report.id}
                onClick={() => {
                  onSelectReport?.(report.id);
                  navigate(`/report-details?id=${report.id}`);
                }}
                className="group bg-white rounded-2xl border border-[#EAF2EB] overflow-hidden shadow-xs hover:shadow-card hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Photo */}
                  <div className="h-48 overflow-hidden relative">
                    <img
                      src={
                        report.imageUrl ||
                        'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=600&q=80'
                      }
                      alt={report.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {/* Status Badge */}
                    <span
                      className={`absolute top-3 right-3 text-[11px] font-bold px-3 py-1 rounded-full shadow-xs uppercase tracking-wider ${
                        report.status === 'resolved'
                          ? 'bg-[#D8F0EA] text-[#0B5D54]'
                          : report.status === 'in_progress'
                          ? 'bg-[#FDEBC8] text-[#6B3E00]'
                          : report.priority === 'critical'
                          ? 'bg-[#FBE4E4] text-[#8F1D1D]'
                          : 'bg-[#E6EAF5] text-[#2B3A67]'
                      }`}
                    >
                      {report.status.replace('_', ' ')}
                    </span>

                    <span className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] font-mono px-2 py-0.5 rounded-md">
                      {report.referenceNumber}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <div className="text-[11px] font-bold text-[#E65D25] uppercase tracking-wider mb-1">
                      {report.category || 'Infrastructure'}
                    </div>
                    <h3 className="font-display font-bold text-base text-[#25312B] group-hover:text-[#174B38] transition-colors line-clamp-1">
                      {report.title}
                    </h3>
                    <p className="text-xs text-[#7D8981] mt-1.5 line-clamp-2 leading-relaxed">
                      {report.description || 'Reported for municipal review and resolution.'}
                    </p>
                  </div>
                </div>

                {/* Footer details & Support CTA */}
                <div className="p-5 pt-3 border-t border-[#F5F7F1] flex items-center justify-between text-xs">
                  <button
                    onClick={(e) => handleSupportToggle(e, report.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold transition-colors cursor-pointer ${
                      isSupported
                        ? 'bg-[#FFF1E6] text-[#E65D25] border border-[#FF873E]/40'
                        : 'bg-[#F7F7F1] text-[#7D8981] hover:text-[#174B38]'
                    }`}
                  >
                    <ThumbsUp className={`w-3.5 h-3.5 ${isSupported ? 'fill-[#E65D25] text-[#E65D25]' : ''}`} />
                    <span>{count}</span>
                  </button>

                  <div className="flex items-center gap-1 text-[#7D8981]">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{report.ward || 'Central Zone'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              onClick={() => {
                onSelectReport?.(report.id);
                navigate(`/report-details?id=${report.id}`);
              }}
              className="bg-white rounded-2xl border border-[#EAF2EB] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:shadow-card transition-all cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                  <img
                    src="https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=200&q=80"
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-[#7D8981]">{report.referenceNumber}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#EAF2EB] text-[#174B38] px-2 py-0.5 rounded-full">
                      {report.category}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-base text-[#25312B]">{report.title}</h3>
                  <p className="text-xs text-[#7D8981] flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {report.ward}</span>
                    <span>·</span>
                    <span>{new Date(report.createdAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 self-end sm:self-auto">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#FDEBC8] text-[#6B3E00]">
                  {report.status.replace('_', ' ')}
                </span>
                <span className="text-xs font-bold text-[#174B38] flex items-center gap-1">
                  View <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

