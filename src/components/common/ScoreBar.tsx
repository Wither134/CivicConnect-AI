import React from 'react';

export interface ScoreBreakdown {
  safetyRisk: number;
  supporters: number;
  mainRoad: number;
  age: number;
}

export interface ScoreBarProps {
  score: number; // 0-100
  breakdown?: ScoreBreakdown;
}

export const ScoreBar: React.FC<ScoreBarProps> = ({
  score = 68,
  breakdown = { safetyRisk: 25, supporters: 20, mainRoad: 15, age: 8 }
}) => {
  const getScoreColor = (val: number) => {
    if (val >= 80) return 'text-[#8F1D1D]';
    if (val >= 60) return 'text-[#B03A0C]';
    if (val >= 40) return 'text-[#6B3E00]';
    return 'text-[#2B3A67]';
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-[#6A5D52]">Priority Score</span>
        <span className="text-[15px] font-semibold text-[#1E1B18]">
          <span className={`text-[17px] font-serif ${getScoreColor(score)}`}>{score}</span>
          <span className="text-[12px] text-[#6A5D52] font-normal"> / 100</span>
        </span>
      </div>

      {/* Segmented bar 6px high */}
      <div className="h-[6px] w-full bg-[#EFE6DA] rounded-[3px] flex overflow-hidden">
        <div
          style={{ width: `${breakdown.safetyRisk}%` }}
          className="bg-[#B03A0C] h-full"
          title={`Safety Risk: ${breakdown.safetyRisk}`}
        />
        <div
          style={{ width: `${breakdown.supporters}%` }}
          className="bg-[#F4A582] h-full"
          title={`Supporters: ${breakdown.supporters}`}
        />
        <div
          style={{ width: `${breakdown.mainRoad}%` }}
          className="bg-[#D9C9B8] h-full"
          title={`Main Road: ${breakdown.mainRoad}`}
        />
        <div
          style={{ width: `${breakdown.age}%` }}
          className="bg-[#6A5D52] h-full"
          title={`Age: ${breakdown.age}`}
        />
      </div>

      {/* Legend / Breakdown labels */}
      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-[#6A5D52]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-[2px] bg-[#B03A0C]" />
          <span>Safety risk ({breakdown.safetyRisk})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-[2px] bg-[#F4A582]" />
          <span>Supporters ({breakdown.supporters})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-[2px] bg-[#D9C9B8]" />
          <span>Main road ({breakdown.mainRoad})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-[2px] bg-[#6A5D52]" />
          <span>Age ({breakdown.age})</span>
        </div>
      </div>
    </div>
  );
};

