import React from 'react';
import {
  Plus,
  Users,
  FileCheck2,
  CheckCircle2,
  MapPin,
  ArrowRight,
  ThumbsUp,
  MessageSquare,
  Shield,
  Lightbulb,
  Road,
  Trash2,
  Clock,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export interface HomeScreenProps {
  navigate: (route: string) => void;
}

export const CommunityHomeScreen: React.FC<HomeScreenProps> = ({ navigate }) => {
  const { isAuthenticated } = useAuth();

  const handleReportClick = () => {
    if (!isAuthenticated) navigate('/login');
    else navigate('/report');
  };

  return (
    <div className="min-h-screen bg-[#F7F7F1] text-[#25312B] pb-20">
      {/* =========================================================================
          SECTION 3.B: HERO SECTION
          Full-width orange-gradient banner directly below navigation
          ========================================================================= */}
      <section className="relative overflow-hidden gradient-hero text-white pt-12 pb-28 sm:pb-36 lg:pb-44 px-4 sm:px-8 lg:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Hero Content */}
          <div className="lg:col-span-7 z-10 space-y-6">
            {/* Small Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-semibold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-[#174B38]" />
              <span>Community Problem Reporting Platform</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-[68px] font-serif leading-[1.08] tracking-tight text-white drop-shadow-xs">
              Report it. Track it.<br />
              <span className="italic font-normal">See it fixed.</span>
            </h1>

            {/* Supporting Description */}
            <p className="text-lg sm:text-xl text-white/95 max-w-xl font-normal leading-relaxed">
              Streetlights, roads and waste, reported in minutes and followed to a recorded resolution.
            </p>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={handleReportClick}
                className="bg-[#174B38] hover:bg-[#11392A] text-white px-7 py-4 rounded-full font-bold text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2.5 cursor-pointer"
              >
                <Plus className="w-5 h-5 text-[#FF873E]" strokeWidth={2.5} />
                <span>Report a Problem</span>
              </button>

              <button
                onClick={() => navigate('/community')}
                className="bg-white/15 hover:bg-white/25 text-white border border-white/40 px-6 py-4 rounded-full font-bold text-base backdrop-blur-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Explore Community</span>
                <ArrowRight className="w-4 h-4 text-white/90" />
              </button>
            </div>
          </div>

          {/* Right Column: Neighbourhood Photograph with soft curved transitions */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              {/* Soft decorative glow */}
              <div className="absolute -inset-4 bg-white/15 rounded-[36px] blur-2xl transform rotate-1" />

              {/* Main Photo Card */}
              <div className="relative rounded-[28px] overflow-hidden border-4 border-white/30 shadow-2xl">
                <img
                  src="/community-volunteers-hero.jpg"
                  alt="Five community volunteers working together on a residential street to plant trees, clean spaces, and beautify their neighborhood"
                  className="w-full h-[360px] sm:h-[420px] object-cover object-right sm:object-center hover:scale-105 transition-transform duration-700"
                />
                {/* Soft warm blending with hero background & subtle bottom vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#E65D25]/25 via-transparent to-transparent pointer-events-none" />

                {/* Live Floating Badge */}
                <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md rounded-2xl p-3.5 border border-white/60 text-[#25312B] shadow-md flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#EAF2EB] text-[#174B38] flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-[#287A58]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#25312B]">Streetlight #42 Restored</p>
                      <p className="text-[11px] text-[#7D8981]">5th Main · Resolved with proof photo</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#287A58] bg-[#EAF2EB] px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Verified
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3.C: COMMUNITY STATISTICS PANEL
          Ivory panel overlapping the bottom edge of hero section (-mt-16)
          ========================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 -mt-14 sm:-mt-20 relative z-20">
        <div className="bg-[#FFFFFF] border border-[#EAF2EB] rounded-[24px] shadow-panel p-6 sm:p-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 divide-y sm:divide-y-0 sm:divide-x divide-[#F5F7F1]">
            {/* Stat 1 */}
            <div className="pt-4 sm:pt-0 sm:px-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF2EB] text-[#174B38] flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-[#174B38]" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-display font-extrabold text-[#174B38] leading-none">
                  12,450+
                </p>
                <p className="text-xs font-semibold text-[#7D8981] mt-1">Community Members</p>
              </div>
            </div>

            {/* Stat 2 */}
            <div className="pt-4 sm:pt-0 sm:px-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF2EB] text-[#174B38] flex items-center justify-center flex-shrink-0">
                <FileCheck2 className="w-6 h-6 text-[#174B38]" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-display font-extrabold text-[#174B38] leading-none">
                  8,230+
                </p>
                <p className="text-xs font-semibold text-[#7D8981] mt-1">Reports Submitted</p>
              </div>
            </div>

            {/* Stat 3 */}
            <div className="pt-4 sm:pt-0 sm:px-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF2EB] text-[#174B38] flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-[#287A58]" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-display font-extrabold text-[#287A58] leading-none">
                  7,120+
                </p>
                <p className="text-xs font-semibold text-[#7D8981] mt-1">Issues Resolved</p>
              </div>
            </div>

            {/* Stat 4 */}
            <div className="pt-4 sm:pt-0 sm:px-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#EAF2EB] text-[#174B38] flex items-center justify-center flex-shrink-0">
                <MapPin className="w-6 h-6 text-[#174B38]" />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-display font-extrabold text-[#174B38] leading-none">
                  48
                </p>
                <p className="text-xs font-semibold text-[#7D8981] mt-1">Communities Participating</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 3.D: THREE FEATURE CARDS
          Attractive cards with photo, green icon, heading, description, hover shadow
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 mt-16 sm:mt-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-[#E65D25] uppercase tracking-wider bg-[#FFF1E6] px-3.5 py-1 rounded-full">
            How CommunityConnect Works
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#25312B] mt-3">
            Civic action made collaborative and transparent.
          </h2>
          <p className="text-sm text-[#7D8981] mt-2">
            Every step connects you directly with department teams, keeping our streets well-lit, roads smooth, and neighbourhoods safe.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature Card 1 */}
          <div
            onClick={() => navigate('/report')}
            className="group bg-white rounded-[24px] border border-[#EAF2EB] overflow-hidden shadow-card hover:shadow-panel hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col"
          >
            <div className="h-52 overflow-hidden relative">
              <img
                src="https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80"
                alt="Potholes and streetlights reporting"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-4 left-4 w-11 h-11 rounded-2xl bg-[#174B38] text-white flex items-center justify-center shadow-md">
                <Plus className="w-5 h-5 text-[#FF873E]" strokeWidth={2.5} />
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-[#25312B] group-hover:text-[#174B38] transition-colors">
                  Report Local Issues
                </h3>
                <p className="text-sm text-[#7D8981] mt-2 leading-relaxed">
                  "From potholes to streetlights, make your voice count."
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#F5F7F1] flex items-center text-xs font-bold text-[#174B38] gap-1 group-hover:gap-2 transition-all">
                <span>Start a report</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Feature Card 2 */}
          <div
            onClick={() => navigate('/explore')}
            className="group bg-white rounded-[24px] border border-[#EAF2EB] overflow-hidden shadow-card hover:shadow-panel hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col"
          >
            <div className="h-52 overflow-hidden relative">
              <img
                src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=600&q=80"
                alt="Community neighbors discussing issues"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-4 left-4 w-11 h-11 rounded-2xl bg-[#174B38] text-white flex items-center justify-center shadow-md">
                <ThumbsUp className="w-5 h-5 text-[#FF873E]" />
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-[#25312B] group-hover:text-[#174B38] transition-colors">
                  Support Your Community
                </h3>
                <p className="text-sm text-[#7D8981] mt-2 leading-relaxed">
                  "Like, comment and support other reports."
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#F5F7F1] flex items-center text-xs font-bold text-[#174B38] gap-1 group-hover:gap-2 transition-all">
                <span>Explore & support reports</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Feature Card 3 */}
          <div
            onClick={() => navigate('/my-activity')}
            className="group bg-white rounded-[24px] border border-[#EAF2EB] overflow-hidden shadow-card hover:shadow-panel hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col"
          >
            <div className="h-52 overflow-hidden relative">
              <img
                src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80"
                alt="Tracking issue progress and resolution updates"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-4 left-4 w-11 h-11 rounded-2xl bg-[#174B38] text-white flex items-center justify-center shadow-md">
                <CheckCircle2 className="w-5 h-5 text-[#287A58]" />
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-[#25312B] group-hover:text-[#174B38] transition-colors">
                  Track Progress
                </h3>
                <p className="text-sm text-[#7D8981] mt-2 leading-relaxed">
                  "Get updates on issue resolution."
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#F5F7F1] flex items-center text-xs font-bold text-[#174B38] gap-1 group-hover:gap-2 transition-all">
                <span>View real-time timeline</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          RECENT REPORTS TEASER SECTION
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 mt-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#25312B]">
              Active Community Reports
            </h2>
            <p className="text-sm text-[#7D8981] mt-1">
              Browse issues reported near you, supported by fellow residents and tracked to resolution.
            </p>
          </div>
          <button
            onClick={() => navigate('/explore')}
            className="text-sm font-bold text-[#174B38] hover:text-[#287A58] flex items-center gap-1.5 cursor-pointer"
          >
            <span>View all 312 reports</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sample Active Card 1 */}
          <div
            onClick={() => navigate('/explore')}
            className="bg-white rounded-2xl border border-[#EAF2EB] overflow-hidden shadow-xs hover:shadow-card transition-all cursor-pointer p-4 flex flex-col justify-between"
          >
            <div>
              <div className="h-44 rounded-xl overflow-hidden mb-3 relative">
                <img
                  src="https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=500&q=80"
                  alt="Streetlight"
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2.5 right-2.5 bg-[#FDEBC8] text-[#6B3E00] text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  In Progress
                </span>
                <span className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-xs text-white text-[11px] px-2 py-0.5 rounded-md font-mono">
                  CPR-2026-000123
                </span>
              </div>
              <h3 className="font-display font-bold text-base text-[#25312B] line-clamp-1">
                Streetlight out on 5th Main
              </h3>
              <p className="text-xs text-[#7D8981] mt-1 line-clamp-2">
                Pole #42 has been dark for 3 days. Safety risk at night near the corner bus stop.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F5F7F1] flex items-center justify-between text-xs text-[#7D8981]">
              <span className="flex items-center gap-1 font-semibold text-[#174B38]">
                <ThumbsUp className="w-3.5 h-3.5 text-[#FF873E]" /> 24 supporters
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Ward 45
              </span>
            </div>
          </div>

          {/* Sample Active Card 2 */}
          <div
            onClick={() => navigate('/explore')}
            className="bg-white rounded-2xl border border-[#EAF2EB] overflow-hidden shadow-xs hover:shadow-card transition-all cursor-pointer p-4 flex flex-col justify-between"
          >
            <div>
              <div className="h-44 rounded-xl overflow-hidden mb-3 relative">
                <img
                  src="https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=500&q=80"
                  alt="Road Pothole"
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2.5 right-2.5 bg-[#FBE4E4] text-[#8F1D1D] text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  Critical
                </span>
                <span className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-xs text-white text-[11px] px-2 py-0.5 rounded-md font-mono">
                  CPR-2026-000092
                </span>
              </div>
              <h3 className="font-display font-bold text-base text-[#25312B] line-clamp-1">
                Open manhole near primary school
              </h3>
              <p className="text-xs text-[#7D8981] mt-1 line-clamp-2">
                Heavy concrete cover cracked and fell into storm drain right in front of school entrance.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F5F7F1] flex items-center justify-between text-xs text-[#7D8981]">
              <span className="flex items-center gap-1 font-semibold text-[#174B38]">
                <ThumbsUp className="w-3.5 h-3.5 text-[#FF873E]" /> 42 supporters
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Ward 12
              </span>
            </div>
          </div>

          {/* Sample Active Card 3 */}
          <div
            onClick={() => navigate('/explore')}
            className="bg-white rounded-2xl border border-[#EAF2EB] overflow-hidden shadow-xs hover:shadow-card transition-all cursor-pointer p-4 flex flex-col justify-between"
          >
            <div>
              <div className="h-44 rounded-xl overflow-hidden mb-3 relative">
                <img
                  src="https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=500&q=80"
                  alt="Resolved fix"
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2.5 right-2.5 bg-[#D8F0EA] text-[#0B5D54] text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  Resolved
                </span>
                <span className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-xs text-white text-[11px] px-2 py-0.5 rounded-md font-mono">
                  CPR-2026-000088
                </span>
              </div>
              <h3 className="font-display font-bold text-base text-[#25312B] line-clamp-1">
                Transformer wire on 9th Cross
              </h3>
              <p className="text-xs text-[#7D8981] mt-1 line-clamp-2">
                Snapped feeder line isolated, rewired, and grounded. Inspected and verified by municipal staff.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#F5F7F1] flex items-center justify-between text-xs text-[#7D8981]">
              <span className="flex items-center gap-1 font-semibold text-[#0B5D54]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#287A58]" /> Verified fix
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Ward 33
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          COMMUNITY CALLOUT BANNER
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 mt-20">
        <div className="rounded-[30px] gradient-green p-8 sm:p-12 text-white relative overflow-hidden shadow-card flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl z-10 space-y-3">
            <span className="text-xs font-bold text-[#FF873E] uppercase tracking-wider bg-white/10 px-3 py-1 rounded-full">
              Together for better neighbourhoods
            </span>
            <h3 className="text-3xl sm:text-4xl font-serif font-bold text-white leading-tight">
              Spot a hazard in your street today?
            </h3>
            <p className="text-sm sm:text-base text-white/90">
              Take a photo, describe what needs fixing, and our dispatchers will assign it directly to local municipal repair crews.
            </p>
          </div>

          <button
            onClick={handleReportClick}
            className="z-10 bg-[#FF873E] hover:bg-[#E65D25] text-white px-8 py-4 rounded-full font-bold text-base shadow-lg hover:shadow-xl hover:scale-105 transition-all cursor-pointer whitespace-nowrap"
          >
            Report an Issue Now
          </button>
        </div>
      </section>
    </div>
  );
};

