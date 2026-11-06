import React from 'react';
import {
  CheckCircle2,
  Calendar,
  Users,
  MapPin,
  ArrowRight,
  Sparkles,
  Award
} from 'lucide-react';

export interface ImpactStoriesScreenProps {
  navigate: (route: string) => void;
}

export const ImpactStoriesScreen: React.FC<ImpactStoriesScreenProps> = ({ navigate }) => {
  const stories = [
    {
      id: 'story-1',
      title: 'Dark Corridor to Safe Passage: 5th Main Streetlights Restored',
      category: 'Streetlight Infrastructure',
      ward: 'Ward 45 (Central Zone)',
      date: 'Completed 6 Nov 2026',
      communitySupport: '24 Residents Supported',
      beforeImg: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=600&q=80',
      afterImg: 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f7?auto=format&fit=crop&w=600&q=80',
      originalProblem:
        'Pole #42 suffered underground cable corrosion, leaving a 200m strip dark near a busy bus stop. Commuters and elderly pedestrians faced severe trip hazards.',
      resolution:
        'Within 48 hours of municipal triage, the Electrical Dept dispatched field technicians Arun K. and team with replacement 150W LED luminaires and insulated feeder wiring.',
      measurableImpact: '100% illumination restored across 200m corridor · 0 nighttime incidents reported since fix'
    },
    {
      id: 'story-2',
      title: 'School Safety Secured: St. Joseph Storm Drain Manhole Replaced',
      category: 'Public Safety & Drainage',
      ward: 'Ward 12 (North)',
      date: 'Completed 2 Nov 2026',
      communitySupport: '42 Parents & Teachers Supported',
      beforeImg: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80',
      afterImg: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80',
      originalProblem:
        'A cracked 90kg concrete slab fell directly into an open drainage pit outside Gate 2 where elementary students walk every morning.',
      resolution:
        'Roads Dept coordinator Deepa M. immediately cordoned off the pit, cast a steel-reinforced replacement cover, and seated it flush with the sidewalk asphalt.',
      measurableImpact: 'Eliminated hazardous fall pit for 650+ school children daily'
    },
    {
      id: 'story-3',
      title: 'Clean Sidewalks: Russell Market Waste Overflow Resolved',
      category: 'Solid Waste Management',
      ward: 'Ward 22 (Market Zone)',
      date: 'Completed 28 Oct 2026',
      communitySupport: '31 Market Vendors Supported',
      beforeImg: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=600&q=80',
      afterImg: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80',
      originalProblem:
        'Commercial vegetable waste overflowed municipal bins, attracting stray animals and blocking the pedestrian walkway.',
      resolution:
        'Waste management upgraded to two high-capacity compactor bins and revised the clearance schedule to twice daily.',
      measurableImpact: '3.2 tons of daily organic waste diverted and properly composted'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F1] py-10 px-4 sm:px-8 max-w-7xl mx-auto space-y-12">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <span className="text-xs font-bold text-[#E65D25] uppercase tracking-wider bg-[#FFF1E6] px-3.5 py-1 rounded-full">
          Verified Outcomes & Community Impact
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-[#25312B]">
          From Citizen Reports to Recorded Resolutions
        </h1>
        <p className="text-sm sm:text-base text-[#7D8981]">
          Explore real-world community transformations achieved when residents collaborate transparently with municipal departments.
        </p>
      </div>

      {/* Stories Stack */}
      <div className="space-y-10">
        {stories.map((story, idx) => (
          <div
            key={story.id}
            className="bg-white rounded-[28px] border border-[#EAF2EB] overflow-hidden shadow-card p-6 sm:p-10"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-[#F5F7F1]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#174B38] bg-[#EAF2EB] px-3 py-1 rounded-full">
                  {story.category}
                </span>
                <span className="text-xs text-[#7D8981] flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {story.ward}
                </span>
              </div>
              <span className="text-xs font-semibold text-[#287A58] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {story.date}
              </span>
            </div>

            <div className="mt-6">
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#25312B]">
                {story.title}
              </h2>
            </div>

            {/* Before and After Photography Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
              {/* Before Card */}
              <div className="rounded-2xl overflow-hidden border border-[#FBE4E4] bg-[#FFF8F8] relative">
                <div className="h-64 overflow-hidden relative">
                  <img
                    src={story.beforeImg}
                    alt="Before resolution"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-3 left-3 bg-[#8F1D1D] text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-xs uppercase tracking-wider">
                    Before Repair
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-xs font-bold text-[#8F1D1D] uppercase tracking-wider">The Problem</p>
                  <p className="text-xs text-[#25312B] mt-1 leading-relaxed">{story.originalProblem}</p>
                </div>
              </div>

              {/* After Card */}
              <div className="rounded-2xl overflow-hidden border border-[#D8F0EA] bg-[#F4FAF8] relative">
                <div className="h-64 overflow-hidden relative">
                  <img
                    src={story.afterImg}
                    alt="After resolution"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-3 left-3 bg-[#0F766E] text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-xs uppercase tracking-wider">
                    After Resolution
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-xs font-bold text-[#0F766E] uppercase tracking-wider">Recorded Fix</p>
                  <p className="text-xs text-[#25312B] mt-1 leading-relaxed">{story.resolution}</p>
                </div>
              </div>
            </div>

            {/* Measurable Impact Highlight */}
            <div className="p-4 rounded-2xl bg-[#EAF2EB] border border-[#91B69C]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-[#174B38] font-bold">
                <Award className="w-5 h-5 text-[#287A58] flex-shrink-0" />
                <span>Verified Community Impact:</span>
                <span className="font-semibold text-[#25312B]">{story.measurableImpact}</span>
              </div>
              <span className="text-[#174B38] font-semibold whitespace-nowrap bg-white/70 px-3 py-1 rounded-full">
                {story.communitySupport}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="text-center pt-6">
        <button
          onClick={() => navigate('/report')}
          className="bg-[#174B38] hover:bg-[#11392A] text-white px-8 py-4 rounded-full font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer inline-flex items-center gap-2"
        >
          <span>Have an issue in your street? Submit a Report</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

