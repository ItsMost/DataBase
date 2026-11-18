/**
 * Collapsible archive of today's single sessions.
 */
import React from 'react';
import type { ActiveSectionVM } from '../../hooks/useActiveSection';

export const DailyArchive: React.FC<{ vm: ActiveSectionVM }> = ({ vm }) => {
  const { onCancelSubscription, checkExpiration, showDailyArchive, setShowDailyArchive, handleEditSubscription, handleRenewSubscription, dailySubscribers } = vm;
  return (
    <>
      {/* Collapsible Archive for Daily Sessions */}
      <div className="mt-6 border-t border-theme/30 pt-4">
        <button
          type="button"
          onClick={() => setShowDailyArchive(!showDailyArchive)}
          className="w-full flex justify-between items-center bg-primary/10 hover:bg-primary/20 text-primary-light border border-primary/30 rounded-lg px-4 py-3 text-sm font-bold transition-all shadow-sm"
        >
          <span className="flex items-center gap-2">
            <span>📦</span> أرشيف الحصص اليومية الفردية اليوم ({dailySubscribers.length})
          </span>
          <span>{showDailyArchive ? '🔼 إخفاء الأرشيف' : '🔽 عرض الأرشيف'}</span>
        </button>

        {showDailyArchive && (
          <div className="mt-4 space-y-3 transition-all duration-300">
            {dailySubscribers.length === 0 ? (
              <div className="text-center text-muted text-xs py-6 border border-dashed border-theme rounded-lg bg-black/10">
                لا توجد حصص فردية مسجلة اليوم.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dailySubscribers.map(player => {
                  const expInfo = checkExpiration(player);
                  const formattedStartDate = player.startDate
                    ? new Date(player.startDate).toLocaleDateString('en-GB')
                    : '-';
                  const isExpired = expInfo.isExpired;

                  return (
                    <div
                      key={player.id}
                      className={`card-bg rounded-lg p-3 relative overflow-hidden border ${
                        isExpired ? 'border-danger opacity-90' : 'border-theme/40'
                      }`}
                    >
                      <div
                        className="absolute top-0 right-0 w-1 h-full"
                        style={{
                          backgroundColor: isExpired ? 'var(--color-danger)' : 'var(--primary-light)',
                        }}
                      ></div>
                      
                      <div className="flex justify-between items-start text-xs">
                        <div>
                          <h4 className={`font-bold ${isExpired ? 'text-danger' : 'text-primary-light'} text-xs`}>
                            #{player.number} | {player.name}
                          </h4>
                          <div className="text-[10px] text-muted mt-1">
                            تاريخ اليوم: {formattedStartDate}
                          </div>
                        </div>
                        
                        <div className="text-right bg-black/20 p-1.5 rounded border border-theme/30 text-[10px]">
                          <div>دفع: <span className="text-success font-bold">{player.paid} ج</span></div>
                          <div>جيم: <span className="text-main">{player.cost} ج</span></div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="grid grid-cols-3 gap-1 mt-2.5 pt-2 border-t border-theme/20 text-[10px]">
                        <button
                          onClick={() => handleRenewSubscription(player)}
                          className="text-success hover:text-green-400 input-bg py-1 rounded border border-success/20 transition-all text-center font-bold"
                        >
                          ♻️ حصة جديدة
                        </button>
                        <button
                          onClick={() => handleEditSubscription(player)}
                          className="text-primary hover:text-primary-light input-bg py-1 rounded border border-theme/20 transition-all text-center"
                        >
                          ✏️ تعديل
                        </button>
                        <button
                          onClick={() => onCancelSubscription(player.id)}
                          className="text-danger hover:text-red-400 input-bg py-1 rounded border border-danger/20 transition-all text-center"
                        >
                          ❌ إلغاء الحصة
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
