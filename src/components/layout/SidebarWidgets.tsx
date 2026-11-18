/**
 * Desktop side widgets: profit meter vs the best month, and today's expected attendance.
 */
import React from 'react';
import type { ExpectedAttendee } from '../../types';

interface SidebarWidgetProps {
  currentProfit: number;
  highestProfit: number;
  highestMonthLabel: string;
  currentMonthLabel: string;
}

export const SidebarWidget: React.FC<SidebarWidgetProps> = ({
  currentProfit,
  highestProfit,
  highestMonthLabel,
  currentMonthLabel
}) => {
  const target = highestProfit <= 0 ? 5000 : highestProfit;
  const pct = (currentProfit / target) * 100;
  const clampedPct = Math.min(100, Math.max(0, pct));
  const isRecordBroken = currentProfit > highestProfit && highestProfit > 0;

  let levelLabel = 'قليل ⚠️';
  let levelBadgeClass = 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50';
  let meterGradient = 'from-rose-500 to-orange-500';

  if (isRecordBroken) {
    levelLabel = 'رقم قياسي جديد! 🎉';
    levelBadgeClass = 'bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/50 animate-pulse';
    meterGradient = 'from-orange-500 via-amber-400 to-yellow-300 animate-pulse';
  } else if (pct >= 80) {
    levelLabel = 'ممتاز 🏆';
    levelBadgeClass = 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50';
    meterGradient = 'from-orange-500 to-emerald-500';
  } else if (pct >= 40) {
    levelLabel = 'متوسط ⚡';
    levelBadgeClass = 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50';
    meterGradient = 'from-orange-500 to-amber-500';
  }

  return (
    <div className={`card-bg rounded-2xl p-5 border border-theme transition-all duration-500 flex flex-col justify-between select-none ${isRecordBroken ? 'record-breaker-glow' : 'shadow-sm'}`}>
      <div className="text-center border-b border-theme/30 pb-3 mb-4">
        <h4 className="text-base font-black text-primary flex items-center justify-center gap-2 glow-text">
          <span>📊 مقياس الأداء المالي</span>
        </h4>
        <p className="text-[10px] text-muted mt-1 font-bold">مقارنة أرباح الشهر الحالي بأعلى شهر تاريخي</p>
      </div>

      <div className="flex gap-4 items-center justify-center mb-6">
        {/* Thermometer / Vertical bar meter */}
        <div className="relative flex flex-col items-center">
          <div className="text-[10px] text-muted font-bold mb-1">100%</div>
          <div className="w-6 bg-slate-100 dark:bg-slate-900/60 rounded-full h-48 border border-slate-200 dark:border-slate-800 relative flex flex-col justify-end overflow-hidden shadow-inner">
            <div 
              style={{ height: `${clampedPct}%` }}
              className={`w-full rounded-b-full bg-gradient-to-t ${meterGradient} transition-all duration-1000 ease-out`}
            />
            {/* Markers */}
            <div className="absolute bottom-[40%] left-0 right-0 border-t border-dashed border-slate-300 dark:border-slate-700/60 z-10" title="40% - متوسط" />
            <div className="absolute bottom-[80%] left-0 right-0 border-t border-dashed border-slate-300 dark:border-slate-700/60 z-10" title="80% - ممتاز" />
          </div>
          <div className="text-[10px] text-muted font-bold mt-1">0%</div>
        </div>

        {/* Text Details & Indicators */}
        <div className="flex-1 flex flex-col justify-center space-y-4">
          <div>
            <span className="text-[11px] text-muted block font-extrabold mb-0.5">أرباح ({currentMonthLabel})</span>
            <span className="text-2xl font-black text-main text-contrast-bold">
              {currentProfit} <span className="text-xs font-normal">ج.م</span>
            </span>
          </div>

          <div>
            <span className="text-[11px] text-muted block font-extrabold mb-0.5">الهدف (أعلى شهر)</span>
            <span className="text-lg font-black text-primary-light text-contrast-bold">
              {highestProfit > 0 ? highestProfit : '5000'} <span className="text-xs font-normal">ج.م</span>
            </span>
            {highestProfit > 0 && (
              <span className="text-[9px] text-muted block font-extrabold">({highestMonthLabel})</span>
            )}
          </div>

          <div>
            <span className="text-[11px] text-muted block font-extrabold mb-1">مستوى الأداء</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black inline-block ${levelBadgeClass}`}>
              {levelLabel}
            </span>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800/80 text-center shadow-inner">
            <span className="text-[10px] text-muted block font-extrabold">النسبة المحققة</span>
            <span className="text-base font-black text-primary glow-text">
              {pct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Helper descriptive text */}
      <div className="border-t border-theme/30 pt-3 text-center">
        {isRecordBroken ? (
          <div className="text-xs font-bold text-orange-500 animate-bounce">
            🎉 رائع! تم كسر الرقم القياسي السابق بزيادة <span className="underline">{currentProfit - highestProfit} ج.م</span>!
          </div>
        ) : (
          <div className="text-[11px] text-muted font-extrabold">
            متبقي <span className="text-primary font-black text-contrast-bold">{target - currentProfit} ج.م</span> لكسر الرقم القياسي
          </div>
        )}
      </div>
    </div>
  );
};

const formatTimeTo12Hr = (timeStr: string) => {
  if (!timeStr) return '--:--';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hrs = parseInt(parts[0], 10);
  const mins = parts[1];
  if (isNaN(hrs)) return timeStr;
  
  const ampm = hrs >= 12 ? 'م' : 'ص';
  hrs = hrs % 12;
  if (hrs === 0) hrs = 12;
  
  return `${hrs}:${mins} ${ampm}`;
};

interface ExpectedSidebarWidgetProps {
  expectedAttendees: ExpectedAttendee[];
}

export const ExpectedSidebarWidget: React.FC<ExpectedSidebarWidgetProps> = ({
  expectedAttendees
}) => {
  const activeAttendees = expectedAttendees.filter(att => !att.isDeleted);
  // Sort attendees chronologically by time
  const sortedAttendees = [...activeAttendees].sort((a, b) => {
    return (a.time || '').localeCompare(b.time || '');
  });

  return (
    <div className="card-bg rounded-2xl p-4 border border-theme shadow-sm flex flex-col select-none">
      <div className="flex justify-between items-center border-b border-theme/30 pb-2.5 mb-3">
        <h4 className="text-sm font-black text-primary flex items-center gap-1.5 glow-text">
          <span>📋 الحضور المتوقع اليوم</span>
        </h4>
        <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-black px-2 py-0.5 rounded-full">
          {activeAttendees.length}
        </span>
      </div>

      {sortedAttendees.length === 0 ? (
        <div className="text-center text-xs text-muted py-6 font-bold">
          لا يوجد لاعبين متوقعين اليوم بعد 📋
        </div>
      ) : (
        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
          {sortedAttendees.map((att) => (
            <div 
              key={att.id} 
              className="flex justify-between items-center py-2 px-2.5 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/80 hover:border-primary/20 hover:bg-primary-glow/5 transition-all"
            >
              <span className="text-xs font-bold text-main truncate max-w-[120px]" title={att.name}>
                {att.name}
              </span>
              <span className="text-[10px] font-black text-primary bg-primary-glow px-2 py-0.5 rounded-md border border-primary/10 flex items-center gap-1 whitespace-nowrap">
                🕒 {formatTimeTo12Hr(att.time || "")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
