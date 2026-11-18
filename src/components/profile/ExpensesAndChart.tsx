/**
 * Other expenses (with types) + profit chart.
 */
import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);
import { OTHER_EXPENSE } from '../../lib/subscription';
import type { ProfileSectionVM } from '../../hooks/useProfileSection';

export const ExpensesAndChart: React.FC<{ vm: ProfileSectionVM }> = ({ vm }) => {
  const { settings, onDeleteExpense, onSaveSettings, expDesc, setExpDesc, expAmount, setExpAmount, expDate, setExpDate, expCategory, setExpCategory, newCategory, setNewCategory, showNewCategory, setShowNewCategory, expenseCategories, currentMonthExpenses, totalCurrentMonthExpenses, handleSubmitExpense, chartDataValues, lineChartData, lineChartOptions } = vm;
  return (
    <>
      {/* Grid 2: Expenses & Profit Chart Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start animate-fadeIn">
        {/* 3. General Operational Expenses Form & Logs */}
        <div className="card-bg rounded-lg p-5 border-t-2 border-orange-500 relative h-full">
          <h2 className="text-lg font-bold text-orange-500 mb-4 flex items-center">
            💸 المصروفات الخارجية والتشغيل
          </h2>
          <div className="mb-2">
            <label className="text-xs text-muted font-bold block mb-1">نوع المصروف</label>
            <div className="flex gap-2">
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
                className="flex-1 input-bg rounded-md px-3 py-2 text-sm border border-theme"
              >
                {expenseCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewCategory(v => !v)}
                className="input-bg border border-theme rounded-md px-3 text-xs font-bold text-orange-400 whitespace-nowrap"
              >
                + نوع جديد
              </button>
            </div>
            {showNewCategory && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="اسم النوع (مثال: إعلانات)"
                  className="flex-1 input-bg rounded-md px-3 py-2 text-sm border border-theme"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const name = newCategory.trim();
                    if (!name) return;
                    if (!expenseCategories.includes(name)) {
                      await onSaveSettings({ ...settings, expenseCategories: [...expenseCategories, name] });
                    }
                    setExpCategory(name);
                    setNewCategory('');
                    setShowNewCategory(false);
                  }}
                  className="bg-orange-500 text-white rounded-md px-3 text-xs font-bold"
                >
                  حفظ
                </button>
              </div>
            )}
          </div>
          <form onSubmit={handleSubmitExpense} className="flex gap-2 mb-3">
            <input
              type="text"
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              placeholder="وصف (اختياري)"
              className="w-1/2 input-bg rounded-md px-3 py-2 text-sm border border-theme"
            />
            <input
              type="number"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              placeholder="المبلغ"
              className="w-1/4 input-bg rounded-md px-3 py-2 text-sm border border-theme"
            />
            <button
              type="submit"
              className="w-1/4 bg-orange-500/20 hover:bg-orange-500 text-orange-400 hover:text-white border border-orange-500/50 font-bold rounded-md text-sm shadow-md active:scale-95 transition-all"
            >
              إضافة
            </button>
          </form>
          <input
            type="date"
            value={expDate}
            onChange={(e) => setExpDate(e.target.value)}
            className="w-full input-bg rounded-md px-3 py-2 text-sm border border-theme mb-4 text-muted"
          />
          
          <div className="border-t border-theme/50 pt-3">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-primary">سجل مصروفات الشهر الحالي:</span>
              <span className="text-sm font-bold text-orange-400 bg-orange-400/10 px-2 py-1 rounded">
                {totalCurrentMonthExpenses} ج.م
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto pr-1 space-y-2">
              {currentMonthExpenses.length === 0 ? (
                <div className="text-xs text-muted text-center py-4 border border-dashed border-theme rounded">
                  لا توجد مصروفات تشغيلية مسجلة هذا الشهر.
                </div>
              ) : (
                currentMonthExpenses.map(h => (
                  <div
                    key={h.timestamp}
                    className="input-bg rounded p-2 flex justify-between items-center border border-orange-500/20 hover:border-orange-500/50 transition-colors"
                  >
                    <div>
                      <span className="text-sm font-bold text-main block">{h.desc}</span>
                      <span className="text-[10px] text-muted">
                        <span className="text-orange-400 font-bold">{h.category || OTHER_EXPENSE}</span> · {h.date}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-orange-400 font-bold text-sm">{h.cost} ج</span>
                      <button
                        onClick={() => onDeleteExpense(h.timestamp)}
                        className="text-danger hover:text-white bg-danger/10 hover:bg-danger p-1.5 rounded text-xs transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 5. Profit Line Chart Graph */}
        <div className="card-bg rounded-lg p-5 border-t-2 border-theme relative h-full">
          <h2 className="text-lg font-bold text-primary mb-4 flex items-center glow-text">
            <svg className="w-5 h-5 ml-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
            </svg>
            منحنى الأرباح والتحسن
          </h2>
          <div className="w-full input-bg p-2 rounded-lg border border-theme">
            {chartDataValues.length > 0 ? (
              <Line data={lineChartData} options={lineChartOptions} />
            ) : (
              <div className="text-center text-muted py-6">لا يوجد تقارير كافية لرسم المنحنى.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
