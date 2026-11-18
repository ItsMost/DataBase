/**
 * Personal wallet report.
 */
import React from 'react';
import type { ProfileSectionVM } from '../../hooks/useProfileSection';

export const WalletReport: React.FC<{ vm: ProfileSectionVM }> = ({ vm }) => {
  const { onDeleteWalletEntry, subTab, walletDesc, setWalletDesc, walletAmount, setWalletAmount, walletDate, setWalletDate, startingBalance, activeWalletEntries, totalExpenses, remainingBalance, handleUpdateStartingBalance, handleSubmitWalletExpense } = vm;
  return (
    <>
        {/* Wallet Report view */}
        {subTab === 'wallet' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Wallet summary statistics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="input-bg p-4 rounded-xl border border-theme flex flex-col items-center justify-center text-center">
                <span className="text-[11px] text-muted font-black block mb-1.5">💵 رصيد البداية (رأس المال)</span>
                <div className="flex items-center justify-center gap-1.5">
                  <input
                    type="number"
                    value={startingBalance || ''}
                    placeholder="0"
                    onChange={(e) => handleUpdateStartingBalance(parseFloat(e.target.value) || 0)}
                    className="bg-transparent text-lg font-black text-main text-center outline-none border-b border-theme/60 focus:border-primary w-28 py-0.5"
                  />
                  <span className="text-xs text-muted font-bold">ج.م</span>
                </div>
              </div>
              
              <div className="input-bg p-4 rounded-xl border border-theme flex flex-col items-center justify-center text-center">
                <span className="text-[11px] text-muted font-black block mb-1.5">💸 إجمالي مصاريفي الشخصية</span>
                <div className="text-lg font-black text-danger">
                  {totalExpenses} <span className="text-xs font-bold text-muted">ج.م</span>
                </div>
              </div>

              <div className="sm:col-span-2 bg-primary/10 p-4 rounded-xl border border-primary text-center shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                <span className="text-xs text-primary-light font-black block mb-1.5">💼 المتبقي في محفظتي الخاصة</span>
                <div className="text-2xl font-black text-primary-light glow-text">
                  {remainingBalance} <span className="text-sm font-normal">ج.م</span>
                </div>
              </div>
            </div>

            {/* Form to add new personal expense */}
            <div className="input-bg p-4 rounded-xl border border-theme">
              <h4 className="text-xs font-black text-primary mb-3 flex items-center gap-1">
                <span>➕ تسجيل مصروف شخصي جديد</span>
              </h4>
              <form onSubmit={handleSubmitWalletExpense} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={walletDesc}
                  onChange={(e) => setWalletDesc(e.target.value)}
                  placeholder="الوصف (مثال: مواصلات)"
                  className="input-bg rounded-lg px-3 py-2 text-xs border border-theme font-bold w-full"
                  required
                />
                <input
                  type="number"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                  placeholder="المبلغ (ج.م)"
                  className="input-bg rounded-lg px-3 py-2 text-xs border border-theme font-bold w-full"
                  required
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={walletDate}
                    onChange={(e) => setWalletDate(e.target.value)}
                    className="input-bg rounded-lg px-3 py-2 text-xs border border-theme font-bold text-muted w-full"
                    required
                  />
                  <button
                    type="submit"
                    className="btn-primary font-black rounded-lg px-4 text-xs transition-all active:scale-95 whitespace-nowrap"
                  >
                    إضافة 💸
                  </button>
                </div>
              </form>
            </div>

            {/* Personal Expenses list */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-muted mb-2 border-b border-theme/20 pb-1 flex justify-between items-center">
                <span>📋 كشف مصاريفي الشخصية</span>
                <span className="bg-slate-100 dark:bg-slate-900 border border-theme text-[9px] font-black px-2 py-0.5 rounded-full">
                  {activeWalletEntries.length} مصروفات
                </span>
              </h4>

              {activeWalletEntries.length === 0 ? (
                <div className="text-center text-xs text-muted py-8 font-bold bg-slate-50/50 dark:bg-slate-900/10 border border-dashed border-theme rounded-xl">
                  لا توجد مصاريف شخصية مسجلة بعد.
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {[...activeWalletEntries]
                    .sort((a, b) => b.date.localeCompare(a.date) || b.timestamp - a.timestamp)
                    .map((entry) => (
                      <div 
                        key={entry.id} 
                        className="flex justify-between items-center py-2.5 px-3.5 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 border border-theme hover:border-danger/20 hover:bg-danger-glow/5 transition-all"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-black text-main">
                            {entry.desc}
                          </span>
                          <span className="text-[9px] text-muted font-bold">
                            التاريخ: {entry.date}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-danger bg-danger/10 border border-danger/20 px-2 py-0.5 rounded-md">
                            -{entry.amount} ج.م
                          </span>
                          <button
                            type="button"
                            onClick={() => onDeleteWalletEntry(entry.id)}
                            className="text-danger hover:text-red-400 p-1 bg-danger/5 hover:bg-danger/15 rounded-md border border-danger/10 transition-all text-xs"
                            title="مسح"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
    </>
  );
};
