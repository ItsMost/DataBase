/**
 * Daily reports.
 */
import React from 'react';
import { gymRateAt } from '../../lib/subscription';
import type { ProfileSectionVM } from '../../hooks/useProfileSection';

export const DailyReports: React.FC<{ vm: ProfileSectionVM }> = ({ vm }) => {
  const { getTodayDate, settings, subTab, dailyDateFilter, setDailyDateFilter, setSelectedDayKey, excludeMonthlyDays, setExcludeMonthlyDays, financials, getFilteredDailyKeys } = vm;
  return (
    <>
        {/* Daily report lists */}
        {subTab === 'daily' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-xs text-muted w-full">آخر 5 أيام نشطة (اختر تاريخ لتفاصيل يوم محدد):</div>
            </div>
            
            <div className="flex items-center gap-2 mb-3">
              <input
                type="date"
                value={dailyDateFilter}
                onChange={(e) => setDailyDateFilter(e.target.value)}
                className="w-full input-bg rounded-lg px-3 py-2 text-sm border border-theme text-muted"
              />
              <button
                onClick={() => setDailyDateFilter('')}
                className="input-bg border border-theme text-primary px-3 py-2 rounded-lg text-xs hover:text-primary-light transition-colors whitespace-nowrap"
              >
                إلغاء الفلتر
              </button>
            </div>

            {getFilteredDailyKeys().length === 0 ? (
              <div className="text-center text-muted py-6 border border-dashed border-theme rounded-lg">
                لا توجد تقارير يومية مسجلة في هذا التاريخ.
              </div>
            ) : (
              getFilteredDailyKeys().map(key => {
                const stat = financials.dailyStats[key];
                const isToday = key === getTodayDate();

                const chronIdx = financials.chronologicalDailyKeys.indexOf(key);
                const prevKey = chronIdx > 0 ? financials.chronologicalDailyKeys[chronIdx - 1] : null;
                const prevStat = prevKey ? financials.dailyStats[prevKey] : null;

                let percentChangeHtml = null;
                if (prevStat && prevStat.profit > 0) {
                  const change = ((stat.profit - prevStat.profit) / prevStat.profit) * 100;
                  if (change > 0) {
                    percentChangeHtml = (
                      <span className="text-success text-[10px] font-bold bg-success/20 border border-success/30 px-1.5 py-0.5 rounded">
                        🔼 +{change.toFixed(1)}%
                      </span>
                    );
                  } else if (change < 0) {
                    percentChangeHtml = (
                      <span className="text-danger text-[10px] font-bold bg-danger/20 border border-danger/30 px-1.5 py-0.5 rounded">
                        🔽 {Math.abs(change).toFixed(1)}%
                      </span>
                    );
                  } else {
                    percentChangeHtml = <span className="text-muted text-[10px] font-bold">➖ 0%</span>;
                  }
                }

                const dateStr = stat.dateObj.toLocaleDateString('ar-EG', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                });

                const showOnlyDaily = excludeMonthlyDays[key] || false;
                const dispRevenue = showOnlyDaily ? stat.dailyRevenue : stat.revenue;
                // Gym money calculation: totalAttendances * 60 for All mode, dailyAttendances * 60 for Daily Sessions only mode
                const keyRate = gymRateAt(settings, key);
                const dispCost = showOnlyDaily ? (stat.dailyAttendances * keyRate) : (stat.totalAttendances * keyRate);
                const dispProfit = dispRevenue - dispCost;
                const dispPaymentCount = showOnlyDaily ? stat.dailyPaymentCount : stat.paymentCount;
                const dispAttendanceCount = showOnlyDaily ? stat.dailyAttendances : stat.totalAttendances;

                return (
                  <div
                    key={key}
                    onClick={() => setSelectedDayKey(key)}
                    className={`input-bg rounded-lg p-3 relative cursor-pointer hover:border-primary-light hover:scale-[1.01] transition-all border ${
                      isToday
                        ? 'border-primary border-2 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                        : showOnlyDaily
                        ? 'border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.15)] bg-amber-950/5'
                        : 'border-theme'
                    }`}
                  >
                    {isToday && <div className="absolute top-0 right-0 w-1 h-full bg-primary-light"></div>}
                    
                    <div className="flex justify-between items-center border-b border-theme/50 pb-2 mb-2">
                      <span className="text-primary font-bold text-sm flex items-center gap-1">
                        {isToday ? 'اليوم ' : ''}
                        {dateStr}
                        <svg className="w-4 h-4 text-primary-light opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                      </span>
                      <div className="flex items-center gap-1.5">
                        {percentChangeHtml}
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Stop event propagation so clicking here doesn't open the daily details modal
                            setExcludeMonthlyDays(prev => ({
                              ...prev,
                              [key]: !prev[key]
                            }));
                          }}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all active:scale-95 whitespace-nowrap ${
                            showOnlyDaily
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 hover:bg-amber-500/30 shadow-[0_0_6px_rgba(245,158,11,0.2)]'
                              : 'bg-primary/20 text-primary-light border-primary/50 hover:bg-primary/30 shadow-[0_0_6px_rgba(59,130,246,0.2)]'
                          }`}
                        >
                          {showOnlyDaily ? 'حصص فقط 🎯' : 'الكل 🌐'}
                        </button>
                      </div>
                    </div>
                    
                    <div className="text-[11px] text-muted mb-2 text-center bg-black/20 rounded py-1 border border-theme/50">
                      <span className="text-success font-semibold">{dispPaymentCount} دفعات فردية</span> |{' '}
                      <span className="text-primary-light font-semibold">{dispAttendanceCount} حضور إجمالي</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1 text-xs text-center">
                      <div>
                        <div className="text-muted mb-1 text-[10px]">إيرادات</div>
                        <div className="text-success font-bold">{dispRevenue} ج</div>
                        <div className="text-[8px] text-muted/80 mt-0.5 whitespace-nowrap">
                          {showOnlyDaily ? `حصص: ${stat.dailyRevenue}` : `شهري: ${stat.monthlyRevenue} | حصص: ${stat.dailyRevenue}`}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted mb-1 text-[10px]">جيم</div>
                        <div className="text-danger font-bold">{dispCost} ج</div>
                      </div>
                      <div>
                        <div className="text-primary mb-1 text-[10px]">صافي</div>
                        <div className={`font-bold glow-text ${showOnlyDaily ? 'text-amber-400' : 'text-primary-light'}`}>
                          {dispProfit} ج
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
    </>
  );
};
