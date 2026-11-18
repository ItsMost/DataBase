/**
 * A player's payments history and attendance calendar.
 */
import React from 'react';
import type { Player } from '../../types';
import { dateKey } from '../../lib/dates';

interface HistoryModalProps {
  historyPlayer: Player;
  historyTab: 'payments' | 'calendar';
  setHistoryTab: (tab: 'payments' | 'calendar') => void;
  calCurrentDate: Date;
  setCalCurrentDate: (d: Date) => void;
  setHistoryPlayerId: (id: string | null) => void;
  handleDeleteHistoryEntry: (playerId: string, timestamp: number) => void;
  handleToggleCalendarDay: (playerId: string, dateStr: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  historyPlayer,
  historyTab,
  setHistoryTab,
  calCurrentDate,
  setCalCurrentDate,
  setHistoryPlayerId,
  handleDeleteHistoryEntry,
  handleToggleCalendarDay,
}) => {
  const getFormattedDate = dateKey;

  const getCalendarDays = () => {
    const p = historyPlayer;

    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    const cells = [];
    // Padding for empty days at start of month
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`}></div>);
    }

    const attendanceSet = new Set(p.attendance || []);
    for (let i = 1; i <= lastDate; i++) {
      const formattedDate = getFormattedDate(year, month, i);
      const isAttended = attendanceSet.has(formattedDate);
      const dayClass = isAttended
        ? "cal-attended hover:opacity-80 cursor-pointer"
        : "cal-empty input-bg border border-theme hover:bg-primary-glow/20 cursor-pointer transition-all";

      cells.push(
        <div
          key={i}
          className={`cal-day ${dayClass}`}
          onClick={() => handleToggleCalendarDay(historyPlayer.id, formattedDate)}
          title="اضغط لتسجيل/إلغاء الحضور"
        >
          {i}
        </div>
      );
    }
    return cells;
  };

  return (

        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card-bg rounded-lg p-5 w-full max-w-lg relative h-[85vh] flex flex-col border border-theme">
            <button
              onClick={() => setHistoryPlayerId(null)}
              className="absolute top-4 left-4 text-muted hover:text-main input-bg p-1 rounded-full border border-theme"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
            <h3 className="text-xl font-bold text-primary mb-1 glow-text">سجل اللاعب</h3>
            <p className="text-primary-light mb-4 text-sm font-bold">
              [#{historyPlayer.number}] {historyPlayer.name}
            </p>
            
            <div className="flex border-b border-theme mb-4">
              <button
                onClick={() => setHistoryTab('payments')}
                className={`w-1/2 py-2 text-center text-sm font-bold transition-all rounded-t-lg ${
                  historyTab === 'payments' ? 'tab-active' : 'tab-inactive'
                }`}
              >
                المدفوعات
              </button>
              <button
                onClick={() => setHistoryTab('calendar')}
                className={`w-1/2 py-2 text-center text-sm font-bold transition-all rounded-t-lg ${
                  historyTab === 'calendar' ? 'tab-active' : 'tab-inactive'
                }`}
              >
                أيام الحضور 📅
              </button>
            </div>

            {/* Payments Sub tab logs */}
            {historyTab === 'payments' && (
              <div className="overflow-y-auto pr-1 flex-1 space-y-3 block">
                {!historyPlayer.history || historyPlayer.history.length === 0 ? (
                  <div className="text-center text-muted py-6 border border-dashed border-theme rounded-lg">
                    لا يوجد سجل مدفوعات سابق للاعب.
                  </div>
                ) : (
                  [...historyPlayer.history].reverse().map(h => (
                    <div
                      key={h.timestamp}
                      className="input-bg rounded-lg p-3 text-right shadow-sm border border-theme relative mb-3"
                    >
                      <button
                        onClick={() => handleDeleteHistoryEntry(historyPlayer.id, h.timestamp)}
                        className="absolute top-3 left-3 text-danger hover:text-red-400 bg-danger/10 px-2 py-1 rounded text-xs transition-all border border-danger/20"
                      >
                        مسح 🗑️
                      </button>
                      <div className="flex justify-between items-center border-b border-theme pb-2 mb-2 pr-16">
                        <span className="text-primary font-bold bg-primary-glow px-2 py-1 rounded text-xs">
                          {h.subType}
                        </span>
                        <span className="text-muted text-xs flex items-center gap-1">
                          🕒 {new Date(h.date).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm px-1">
                        <div>
                          <span className="text-muted text-xs block mb-1">المبلغ</span>
                          <span className="text-success font-bold">{h.paid} ج</span>
                        </div>
                        <div>
                          <span className="text-muted text-xs block mb-1">الجيم</span>
                          <span className="text-danger font-bold">{h.cost} ج</span>
                        </div>
                        <div>
                          <span className="text-muted text-xs block mb-1">الربح</span>
                          <span className="text-primary font-bold glow-text">{(h.paid || 0) - (h.cost || 0)} ج</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Calendar attendance tracker sub tab */}
            {historyTab === 'calendar' && (
              <div className="overflow-y-auto pr-1 flex-1">
                <div className="input-bg rounded-lg p-4 border border-theme">
                  <div className="text-center text-[10px] text-primary mb-3 glow-text font-bold">
                    💡 اضغط على أي يوم لتسجيل أو إلغاء الحضور للّاعب
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <button
                      onClick={() => {
                        const newD = new Date(calCurrentDate);
                        newD.setMonth(newD.getMonth() - 1);
                        setCalCurrentDate(newD);
                      }}
                      className="text-primary hover:text-primary-light bg-transparent px-3 py-1 rounded border border-theme"
                    >
                      ◀
                    </button>
                    <span className="text-primary-light font-bold text-base glow-text">
                      {calCurrentDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      onClick={() => {
                        const newD = new Date(calCurrentDate);
                        newD.setMonth(newD.getMonth() + 1);
                        setCalCurrentDate(newD);
                      }}
                      className="text-primary hover:text-primary-light bg-transparent px-3 py-1 rounded border border-theme"
                    >
                      ▶
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted mb-2 font-bold">
                    <div>أحد</div><div>إثنين</div><div>ثلاثاء</div><div>أربعاء</div><div>خميس</div><div>جمعة</div><div>سبت</div>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {getCalendarDays()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
  );
};
