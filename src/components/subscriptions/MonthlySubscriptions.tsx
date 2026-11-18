/**
 * Package subscribers: attendance progress, extra-session balance, renew / edit / cancel.
 */
import React from 'react';
import { ExtrasBalance } from './ExtrasBalance';
import type { ActiveSectionVM } from '../../hooks/useActiveSection';

export const MonthlySubscriptions: React.FC<{ vm: ActiveSectionVM }> = ({ vm }) => {
  const { onCancelSubscription, checkExpiration, onAddAttendance, onRemoveAttendance, getTodayDate, analysisOf, setPayDialogPlayerId, setExtrasAmount, attDates, handleEditSubscription, handleRenewSubscription, handleCustomAttendanceChange, getAttendanceStats, monthlySubscribers } = vm;
  return (
    <>
      {/* Monthly Subscriptions List */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-primary mb-3 border-b border-theme pb-2 flex items-center gap-1">
          <span>📅</span> الدفع بالشهر
        </h3>
        {monthlySubscribers.length === 0 ? (
          <div className="text-center text-muted py-6 border border-dashed border-theme rounded-lg">
            لا توجد اشتراكات شهرية مسجلة حالياً.
          </div>
        ) : (
          <div className="space-y-4">
            {monthlySubscribers.map(player => {
              const expInfo = checkExpiration(player);
              const { activeAttendances, maxSessions, extraSessions, percentage } = getAttendanceStats(player);
              const balance = analysisOf(player).balance;
              const formattedStartDate = player.startDate
                ? new Date(player.startDate).toLocaleDateString('en-GB')
                : '-';
              const isExpired = expInfo.isExpired;
              
              const attDate = attDates[player.id] || getTodayDate();

              return (
                <div
                  key={player.id}
                  className={`card-bg rounded-lg p-4 relative overflow-hidden ${
                    isExpired ? 'border-danger opacity-90' : ''
                  }`}
                >
                  <div
                    className="absolute top-0 right-0 w-1 h-full"
                    style={{
                      backgroundColor: isExpired ? 'var(--color-danger)' : 'var(--primary-light)',
                    }}
                  ></div>
                  
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className={`font-bold ${isExpired ? 'text-danger' : 'text-primary glow-text'} text-md`}>
                        #{player.number} | {player.name}
                      </h4>
                      <div className="text-xs text-muted mt-1 flex gap-2 flex-wrap">
                        <span className="input-bg border border-theme px-2 py-1 rounded">
                          البداية: {formattedStartDate}
                        </span>
                        <span
                          className={`${
                            isExpired ? 'text-danger bg-danger/20 border-danger' : 'text-main input-bg border-theme'
                          } border px-2 py-1 rounded`}
                        >
                          النهاية: {expInfo.endDateStr}
                        </span>
                      </div>
                      {isExpired && (
                        <div className="mt-2 inline-block bg-danger/20 text-danger text-xs px-2 py-1 rounded border border-danger animate-pulse">
                          ⚠️ منتهي من {expInfo.days} أيام
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right input-bg border border-theme p-2 rounded">
                      <div className="text-xs text-muted">
                        دفع: <span className="text-main font-bold">{player.paid} ج</span>
                      </div>
                      <div className="text-xs text-muted">
                        جيم: <span className="text-main">{player.cost} ج</span>
                      </div>
                      <div className="text-xs font-bold text-success mt-1">
                        مكسب: {((player.paid || 0) - (player.cost || 0))} ج
                      </div>
                    </div>
                  </div>

                  {/* Attendance Log Tracker */}
                  <div className="mt-3 pt-3 border-t border-theme">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-1">
                      <div className={`text-xs ${extraSessions > 0 ? 'text-amber-400 font-bold' : 'text-muted'}`}>
                        حضر: <span className={extraSessions > 0 ? 'text-amber-400 font-black' : 'text-primary font-bold'}>
                          {extraSessions > 0 && activeAttendances - extraSessions < maxSessions ? activeAttendances - extraSessions : activeAttendances}
                        </span> من {maxSessions}
                        {extraSessions > 0 && activeAttendances - extraSessions < maxSessions && (
                          <span className="text-amber-400 font-black"> + {extraSessions} زيادة</span>
                        )}
                        {analysisOf(player).status.endMode && (
                          <span className="text-muted font-normal mr-1">
                            ({analysisOf(player).status.endMode === 'month' ? 'بتخلص بالشهر' : 'بتخلص بالحصص'})
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 items-center w-full sm:w-auto">
                        <input
                          type="date"
                          value={attDate}
                          onChange={(e) => handleCustomAttendanceChange(player.id, e.target.value)}
                          className="input-bg text-[10px] py-1 px-1 rounded border border-theme w-24"
                        />
                        <button
                          onClick={() => onAddAttendance(player.id, attDate)}
                          className="btn-primary px-2 py-1 rounded text-[10px] whitespace-nowrap"
                        >
                          + تسجيل
                        </button>
                        <button
                          onClick={() => onRemoveAttendance(player.id, attDate)}
                          className="bg-danger/20 text-danger px-2 py-1 rounded text-[10px] border border-danger hover:bg-danger hover:text-white transition-all whitespace-nowrap"
                        >
                          - مسح
                        </button>
                      </div>
                    </div>
                    <div className="w-full input-bg rounded-full h-1.5 mt-2 relative overflow-hidden border border-theme">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: 'var(--primary)',
                          boxShadow: '0 0 8px var(--primary-glow)',
                        }}
                      ></div>
                    </div>
                  </div>

                  {balance.extraCount > 0 && (
                    <ExtrasBalance
                      count={balance.extraCount}
                      gym={balance.gymAdvanced}
                      onPay={() => {
                        setExtrasAmount('');
                        setPayDialogPlayerId(player.id);
                      }}
                    />
                  )}

                  {/* Renew, Edit, Cancel Sub actions */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-theme">
                    <button
                      onClick={() => handleRenewSubscription(player)}
                      className="text-success hover:text-green-400 input-bg py-1.5 text-xs rounded border border-success/30 transition-colors flex justify-center items-center gap-1"
                    >
                      ♻️ تجديد
                    </button>
                    <button
                      onClick={() => handleEditSubscription(player)}
                      className="text-primary hover:text-primary-light input-bg py-1.5 text-xs rounded border border-theme transition-colors flex justify-center items-center gap-1"
                    >
                      ✏️ تعديل
                    </button>
                    <button
                      onClick={() => onCancelSubscription(player.id)}
                      className="text-danger hover:text-red-400 input-bg py-1.5 text-xs rounded border border-danger/30 transition-colors flex justify-center items-center gap-1"
                    >
                      ❌ إلغاء
                    </button>
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
