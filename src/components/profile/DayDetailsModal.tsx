/**
 * Details of one day (payments, package attendance, single sessions).
 */
import React from 'react';
import type { ProfileSectionVM } from '../../hooks/useProfileSection';

export const DayDetailsModal: React.FC<{ vm: ProfileSectionVM }> = ({ vm }) => {
  const { selectedDayKey, setSelectedDayKey, getDailyDetailsList } = vm;
  return (
    <>
      {/* 8. Detailed Daily Statistics Modal */}
      {selectedDayKey && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card-bg rounded-lg p-5 w-full max-w-lg relative h-[80vh] flex flex-col border border-theme">
            <button
              onClick={() => setSelectedDayKey(null)}
              className="absolute top-4 left-4 text-muted hover:text-main input-bg p-1 rounded-full border border-theme"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
            <h3 className="text-lg font-bold text-primary mb-4 glow-text pr-8">
              معاملات يوم: {new Date(selectedDayKey).toLocaleDateString('ar-EG', {
                weekday: 'long',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </h3>
            
            <div className="overflow-y-auto pr-1 flex-1 space-y-3 block">
              {getDailyDetailsList()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
