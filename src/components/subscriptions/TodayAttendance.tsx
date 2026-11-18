/**
 * Everyone who attended today.
 */
import React from 'react';
import { SINGLE_SESSION } from '../../lib/subscription';
import type { ActiveSectionVM } from '../../hooks/useActiveSection';

export const TodayAttendance: React.FC<{ vm: ActiveSectionVM }> = ({ vm }) => {
  const { onRemoveAttendance, getTodayDate, getTodaySessionNumberText, filteredAttendedToday } = vm;
  return (
    <>
        {/* Today's Attendance List */}
        <div className="mb-6">
        <h3 className="text-lg font-bold text-success mb-3 border-b border-theme pb-2 flex items-center gap-1.5 glow-text-success">
          <span>🟢</span> حضور اليوم كله ({filteredAttendedToday.length})
        </h3>
        {filteredAttendedToday.length === 0 ? (
          <div className="text-center text-muted py-6 border border-dashed border-theme rounded-lg bg-black/10">
            لا توجد تسجيلات حضور اليوم تطابق البحث.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredAttendedToday.map(player => {
              const sessionText = getTodaySessionNumberText(player);
              const isMonthly = player.subType && player.subType !== SINGLE_SESSION;
              return (
                <div
                  key={player.id}
                  className={`card-bg rounded-lg p-3 relative overflow-hidden border ${
                    isMonthly ? 'border-emerald-500/20 bg-emerald-950/5' : 'border-theme/40'
                  }`}
                >
                  <div
                    className="absolute top-0 right-0 w-1 h-full bg-emerald-500"
                  ></div>
                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <h4 className="font-bold text-emerald-400 text-xs">
                        #{player.number} | {player.name}
                      </h4>
                      <div className="text-[10px] text-muted mt-1 flex gap-1.5">
                        <span className="input-bg border border-theme px-1.5 py-0.5 rounded">
                          {player.sport || 'العام'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded ${isMonthly ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                          {player.subType}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1.5">
                      <span className="text-xs font-bold text-emerald-400">
                        {sessionText}
                      </span>
                      <button
                        onClick={() => onRemoveAttendance(player.id, getTodayDate())}
                        className="text-danger hover:bg-danger/20 px-2 py-1 rounded text-[10px] border border-danger/30 hover:border-danger transition-all whitespace-nowrap"
                      >
                        إلغاء الحضور ❌
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};
