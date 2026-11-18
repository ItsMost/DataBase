/**
 * Monthly reports (fair comparison for the running month, breakdowns).
 */
import React from 'react';
import { fairMonthComparison, previousMonthKey } from '../../lib/reports';
import type { ProfileSectionVM } from '../../hooks/useProfileSection';

export const MonthlyReports: React.FC<{ vm: ProfileSectionVM }> = ({ vm }) => {
  const { subTab, monthNames, financials, breakdowns, todayKey } = vm;
  return (
    <>
        {/* Monthly report lists */}
        {subTab === 'monthly' && (
          <div className="space-y-3">
            {financials.reversedKeys.length === 0 ? (
              <div className="text-center text-muted py-6 border border-dashed border-theme rounded-lg">
                لا يوجد تقارير شهرية حتى الآن.
              </div>
            ) : (
              financials.reversedKeys.map((key, index) => {
                const stat = financials.monthlyStats[key];
                const isCurrentMonth = index === 0;

                // Calculate percentage improvements
                const chronIdx = financials.chronologicalKeys.indexOf(key);
                const prevKey = chronIdx > 0 ? financials.chronologicalKeys[chronIdx - 1] : null;
                const prevStat = prevKey ? financials.monthlyStats[prevKey] : null;

                // Current month isn't finished: compare the same number of days of the month before
                const fairRaw = fairMonthComparison(financials.dailyStats, key, todayKey, !!financials.monthlyStats[previousMonthKey(key)]);
                const fair = fairRaw
                  ? {
                      ...fairRaw,
                      label: `أول ${fairRaw.days} يوم قصاد أول ${fairRaw.previousDays} يوم من ${monthNames[parseInt(fairRaw.previousKey.slice(5, 7), 10) - 1]}`,
                    }
                  : null;
                const baseProfit = fair ? fair.previous : prevStat?.profit ?? 0;
                const compareProfit = fair ? fair.current : stat.profit;
                const fairNote = fair ? (
                  <span className="block text-[9px] text-muted font-normal mt-0.5">{fair.label}</span>
                ) : null;

                let percentChangeHtml = null;
                if ((fair || prevStat) && baseProfit > 0) {
                  const change = ((compareProfit - baseProfit) / baseProfit) * 100;
                  if (change > 0) {
                    percentChangeHtml = (
                      <div className="text-success text-[10px] sm:text-xs font-bold mt-1 bg-success/20 px-2 py-1 rounded inline-block border border-success/30">
                        🔼 +{change.toFixed(1)}% تحسن
                        {fairNote}
                      </div>
                    );
                  } else if (change < 0) {
                    percentChangeHtml = (
                      <div className="text-danger text-[10px] sm:text-xs font-bold mt-1 bg-danger/20 px-2 py-1 rounded inline-block border border-danger/30">
                        🔽 {Math.abs(change).toFixed(1)}% تراجع
                        {fairNote}
                      </div>
                    );
                  } else {
                    percentChangeHtml = (
                      <div className="text-muted text-[10px] sm:text-xs font-bold mt-1 input-bg border border-theme px-2 py-1 rounded inline-block">
                        ➖ استقرار
                        {fairNote}
                      </div>
                    );
                  }
                } else if (!prevStat) {
                  percentChangeHtml = (
                    <div className="text-primary text-[10px] sm:text-xs font-bold mt-1 bg-primary-glow px-2 py-1 rounded inline-block border border-theme">
                      🚀 البداية
                    </div>
                  );
                }

                return (
                  <div
                    key={key}
                    className={`card-bg rounded-lg p-4 relative ${
                      isCurrentMonth ? 'border-primary border-2 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : ''
                    }`}
                  >
                    {isCurrentMonth && <div className="absolute top-0 right-0 w-1 h-full bg-primary-light"></div>}
                    <div className="flex justify-between items-start mb-2 border-b border-theme/50 pb-2">
                      <div>
                        <span className="text-primary font-bold text-base sm:text-lg block">
                          {monthNames[stat.monthIndex]} {stat.year}
                        </span>
                        {percentChangeHtml}
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <span className="text-muted text-[10px] input-bg border border-theme px-2 py-0.5 rounded">
                          {stat.count} إجمالي العمليات
                        </span>
                        <span className="text-blue-400 text-[10px] input-bg border border-blue-900/40 px-2 py-0.5 rounded">
                          {stat.monthSubCount || 0} اشتراك شهري
                        </span>
                        <span className="text-primary-light text-[10px] font-bold input-bg border border-theme px-2 py-0.5 rounded">
                          {stat.totalAttendances || 0} حضور إجمالي
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-sm text-center mt-3">
                      <div>
                        <div className="text-muted text-[10px] sm:text-xs mb-1">الإيرادات</div>
                        <div className="text-success font-bold">{stat.revenue} ج</div>
                      </div>
                      <div>
                        <div className="text-muted text-[10px] sm:text-xs mb-1">نصيب الجيم/المكان</div>
                        <div className="text-danger font-bold">{stat.cost} ج</div>
                      </div>
                      <div>
                        <div className="text-muted text-[10px] sm:text-xs mb-1">مصروفات تانية</div>
                        <div className="text-orange-400 font-bold">{stat.expenses || 0} ج</div>
                      </div>
                      <div>
                        <div className="text-primary font-bold text-[10px] sm:text-xs mb-1">الصافي</div>
                        <div className="text-primary-light font-bold glow-text text-sm sm:text-base">
                          {stat.profit} ج
                        </div>
                      </div>
                    </div>
                    {(breakdowns.multiplePlaces && breakdowns.gymByPlace[key]) || breakdowns.expByCat[key] ? (
                      <div className="mt-3 pt-2 border-t border-theme/40 space-y-1 text-[10px]">
                        {breakdowns.multiplePlaces && breakdowns.gymByPlace[key] && (
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-muted font-bold">نصيب كل مكان:</span>
                            {Object.entries(breakdowns.gymByPlace[key]).map(([place, v]) => (
                              <span key={place} className="input-bg border border-theme rounded px-1.5 py-0.5 text-danger font-bold">
                                {place}: {v} ج
                              </span>
                            ))}
                          </div>
                        )}
                        {breakdowns.expByCat[key] && (
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-muted font-bold">المصروفات التانية:</span>
                            {Object.entries(breakdowns.expByCat[key]).map(([cat, v]) => (
                              <span key={cat} className="input-bg border border-theme rounded px-1.5 py-0.5 text-orange-400 font-bold">
                                {cat}: {v} ج
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        )}
    </>
  );
};
