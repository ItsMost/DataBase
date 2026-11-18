/**
 * Monthly profit heatmap.
 */
import React from 'react';
import type { ProfileSectionVM } from '../../hooks/useProfileSection';

export const ProfitHeatmap: React.FC<{ vm: ProfileSectionVM }> = ({ vm }) => {
  const { currentYear, getHeatmapGrid } = vm;
  return (
    <>
      {/* 6. Calendar Heatmap */}
      <div className="card-bg rounded-lg p-5 mb-6 border-t-2 border-green-500 relative">
        <h2 className="text-lg font-bold text-green-500 mb-4 flex items-center">
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14v6m-3-3v3M8 9V7m-3 3v3m14-11a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14z"></path>
          </svg>
          الخريطة الحرارية لأرباح {currentYear} (Heatmap)
        </h2>
        <div id="heatmapGrid" className="grid grid-cols-4 gap-2 text-center text-xs">
          {getHeatmapGrid()}
        </div>
      </div>
    </>
  );
};
