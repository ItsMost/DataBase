import React, { useState, useEffect } from 'react';
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
import type { Player, HistoryEntry, PersonalWalletEntry, AppSettings } from '../types';
import {
  getSettings,
  analyzePlayer,
  gymRateAt,
  localToday,
  EXTRA_PAYMENT,
  SINGLE_SESSION,
  getSessionCount,
  DEFAULT_PLACE,
  OTHER_EXPENSE,
  DEFAULT_EXPENSE_CATEGORIES,
} from '../lib/subscription';
import { SettingsPanel } from './SettingsPanel';
import { computeFinancials, computeBreakdowns, fairMonthComparison, previousMonthKey } from '../lib/reports';
import { MONTH_NAMES, EXPENSES_ID } from '../lib/constants';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ProfileSectionProps {
  players: Player[];
  onSaveExpense: (desc: string, cost: number, date: string, category?: string) => Promise<void>;
  onDeleteExpense: (timestamp: number) => Promise<void>;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onImportJSON: () => void;
  onDeepRecover: () => Promise<void>;
  getTodayDate: () => string;
  walletEntries: PersonalWalletEntry[];
  onSaveWalletEntry: (entryData: Omit<PersonalWalletEntry, 'timestamp'>) => Promise<void>;
  onDeleteWalletEntry: (id: string) => Promise<void>;
  onDeletePlayerTransaction: (playerId: string, timestamp: number) => Promise<void>;
  lockedMonths: string[];
  currentMonthKey: string;
  onLockMonth: (monthKey: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onSaveSettings: (next: AppSettings) => Promise<void>;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  players,
  onSaveExpense,
  onDeleteExpense,
  onExportCSV,
  onExportJSON,
  onImportJSON,
  onDeepRecover,
  getTodayDate,
  walletEntries,
  onSaveWalletEntry,
  onDeleteWalletEntry,
  onDeletePlayerTransaction,
  lockedMonths,
  currentMonthKey,
  onLockMonth,
  onSignOut,
  onSaveSettings,
}) => {
  const settings = getSettings(players);
  // Advanced settings: month lock confirmation
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockConfirmText, setLockConfirmText] = useState('');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // Expense Form state
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(getTodayDate());
  const [expCategory, setExpCategory] = useState(OTHER_EXPENSE);
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);

  // Profile Tab state: 'monthly' or 'daily' or 'wallet'
  const [subTab, setSubTab] = useState<'monthly' | 'daily' | 'wallet'>('monthly');
  const [dailyDateFilter, setDailyDateFilter] = useState('');

  // Personal Wallet states
  const [walletDesc, setWalletDesc] = useState('');
  const [walletAmount, setWalletAmount] = useState('');
  const [walletDate, setWalletDate] = useState(getTodayDate());

  const capitalEntry = walletEntries.find(e => e.id === 'wallet_capital');
  const startingBalance = capitalEntry ? capitalEntry.amount : 0;

  const activeWalletEntries = walletEntries.filter(e => !e.isDeleted && e.id !== 'wallet_capital');
  const totalExpenses = activeWalletEntries.reduce((sum, e) => sum + e.amount, 0);
  const remainingBalance = startingBalance - totalExpenses;

  const handleUpdateStartingBalance = (val: number) => {
    onSaveWalletEntry({
      id: 'wallet_capital',
      desc: 'رصيد البداية',
      amount: val,
      type: 'income',
      date: getTodayDate(),
    });
  };

  const handleSubmitWalletExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletDesc.trim() || !walletAmount) return;

    onSaveWalletEntry({
      id: String(Date.now() + Math.random()),
      desc: walletDesc.trim(),
      amount: parseFloat(walletAmount),
      type: 'expense',
      date: walletDate,
    });

    setWalletDesc('');
    setWalletAmount('');
    setWalletDate(getTodayDate());
  };

  // Daily transaction detail modal state
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [excludeMonthlyDays, setExcludeMonthlyDays] = useState<{[dayKey: string]: boolean}>({});
  const monthNames = MONTH_NAMES;

  const financials = computeFinancials(players, settings);

  const breakdowns = computeBreakdowns(players, settings);

  const todayKey = localToday();
  const currentMonthKeyStr = todayKey.slice(0, 7);

  const expenseCategories = settings.expenseCategories || DEFAULT_EXPENSE_CATEGORIES;

  // --- Expenses lists computed for current month ---
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const systemPlayer = players.find(p => p.id === EXPENSES_ID);
  const currentMonthExpenses = systemPlayer?.history
    ? systemPlayer.history
        .filter(h => {
          const d = new Date(h.date);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .sort((a, b) => b.timestamp - a.timestamp)
    : [];

  const totalCurrentMonthExpenses = currentMonthExpenses.reduce((sum, h) => sum + (h.cost || 0), 0);

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("الرجاء إدخال مبلغ المصروف بشكل صحيح!");
      return;
    }

    await onSaveExpense(expDesc.trim() || expCategory, amount, expDate || getTodayDate(), expCategory);
    setExpDesc('');
    setExpAmount('');
  };

  // --- Profit line chart configuration ---
  const chartLabels = financials.chronologicalKeys.map(
    key => `${monthNames[financials.monthlyStats[key].monthIndex]} ${financials.monthlyStats[key].year}`
  );
  
  const chartDataValues = financials.chronologicalKeys.map(
    key => financials.monthlyStats[key].profit
  );

  const lineChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'صافي الربح',
        data: chartDataValues,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderWidth: 2,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#fff',
        pointRadius: 4,
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(150, 150, 150, 0.05)' },
        ticks: { color: '#9ca3af', font: { family: 'Cairo', size: 10 } },
      },
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af', font: { family: 'Cairo', size: 10 } },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        rtl: true,
        titleFont: { family: 'Cairo' },
        bodyFont: { family: 'Cairo' },
      },
    },
  };

  // --- Heatmap logic ---
  const getHeatmapGrid = () => {
    let maxProfitThisYear = 0;
    financials.chronologicalKeys.forEach(key => {
      const stat = financials.monthlyStats[key];
      if (stat.year === currentYear && stat.profit > maxProfitThisYear) {
        maxProfitThisYear = stat.profit;
      }
    });

    const cells = [];
    for (let i = 0; i < 12; i++) {
      const mKey = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
      const mStat = financials.monthlyStats[mKey];

      if (mStat && mStat.profit > 0) {
        const intensity = maxProfitThisYear > 0 ? mStat.profit / maxProfitThisYear : 0.5;
        const alpha = Math.max(0.3, intensity);
        cells.push(
          <div
            key={i}
            className="rounded p-2 flex flex-col justify-center items-center transition-all min-h-[60px]"
            style={{
              backgroundColor: `rgba(16, 185, 129, ${alpha})`,
              border: '1px solid rgba(16, 185, 129, 0.4)',
            }}
          >
            <span className="font-bold text-white text-[10px] drop-shadow-md">{monthNames[i]}</span>
            <span className="text-white font-bold text-xs drop-shadow-md mt-1">{mStat.profit} ج</span>
          </div>
        );
      } else {
        cells.push(
          <div
            key={i}
            className="input-bg rounded p-2 flex flex-col justify-center items-center opacity-50 border border-theme min-h-[60px]"
          >
            <span className="text-muted text-[10px]">{monthNames[i]}</span>
            <span className="text-muted text-xs mt-1">-</span>
          </div>
        );
      }
    }
    return cells;
  };

  // --- Daily Details Modal calculations ---
  const getDailyDetailsList = () => {
    if (!selectedDayKey) return null;
    const monthlyPaymentsList: React.ReactNode[] = [];
    const monthlyAttendancesList: React.ReactNode[] = [];
    const dailySessionsList: React.ReactNode[] = [];
    let totalMonthlyPayments = 0;
    let totalMonthlyAttendancesCost = 0;
    let totalDailyPayments = 0;

    const showOnlyDaily = excludeMonthlyDays[selectedDayKey] || false;
    const dayRate = gymRateAt(settings, selectedDayKey);

    players.forEach(p => {
      if (p.isSystem) {
        return; // Skip system players
      }

      // 1. Process payments (history entries) on this day:
      p.history?.forEach(h => {
        if (h.date === selectedDayKey) {
          const isDailySession = h.subType === SINGLE_SESSION;
          if (showOnlyDaily && !isDailySession) {
            return;
          }

          if (isDailySession) {
            // Daily session represents both payment and attendance
            const profit = (h.paid || 0) - dayRate;
            totalDailyPayments += h.paid || 0;
            dailySessionsList.push(
              <div
                key={h.timestamp}
                className="input-bg rounded-lg p-3 text-right shadow-sm border border-theme relative mb-3"
              >
                <button
                  onClick={() => {
                    onDeletePlayerTransaction(p.id, h.timestamp);
                    setSelectedDayKey(null);
                  }}
                  className="absolute top-3 left-3 text-danger hover:text-white bg-danger/10 hover:bg-danger px-2 py-1 rounded text-xs transition-all border border-danger/20"
                >
                  مسح 🗑️
                </button>
                <div className="border-b border-theme pb-2 mb-2 pr-24">
                  <div className="font-bold text-primary text-sm">
                    اللاعب: <span className="text-primary-light">[#{p.number}] {p.name}</span>
                  </div>
                  <span className="text-primary font-bold bg-primary-glow px-2 py-0.5 rounded text-[10px] mt-1 inline-block">
                    {h.subType}
                  </span>
                </div>
                <div className="flex justify-between text-xs px-1">
                  <div>
                    <span className="text-muted mb-1 block">المبلغ المدفوع</span>
                    <span className="text-success font-bold text-sm">{h.paid} ج</span>
                  </div>
                  <div>
                    <span className="text-muted mb-1 block">تكلفة الجيم</span>
                    <span className="text-danger font-bold text-sm">{dayRate} ج</span>
                  </div>
                  <div>
                    <span className="text-primary mb-1 block">صافي الربح</span>
                    <span className="text-primary-light font-bold text-sm">{profit} ج</span>
                  </div>
                </div>
              </div>
            );
          } else {
            // Monthly subscription payments (only payment recorded today, gym cost is charged on attendance)
            totalMonthlyPayments += h.paid || 0;
            monthlyPaymentsList.push(
              <div
                key={h.timestamp}
                className="input-bg rounded-lg p-3 text-right shadow-sm border border-theme relative mb-3"
              >
                <button
                  onClick={() => {
                    onDeletePlayerTransaction(p.id, h.timestamp);
                    setSelectedDayKey(null);
                  }}
                  className="absolute top-3 left-3 text-danger hover:text-white bg-danger/10 hover:bg-danger px-2 py-1 rounded text-xs transition-all border border-danger/20"
                >
                  مسح 🗑️
                </button>
                <div className="border-b border-theme pb-2 mb-2 pr-24">
                  <div className="font-bold text-primary text-sm">
                    اللاعب: <span className="text-primary-light">[#{p.number}] {p.name}</span>
                  </div>
                  <span className="text-primary font-bold bg-primary-glow px-2 py-0.5 rounded text-[10px] mt-1 inline-block">
                    {h.subType === EXTRA_PAYMENT ? `دفع ${h.desc || h.subType}` : `تفعيل اشتراك: ${h.subType}`}
                  </span>
                </div>
                <div className="flex justify-between text-xs px-1">
                  <div>
                    <span className="text-muted mb-1 block">المبلغ المدفوع</span>
                    <span className="text-success font-bold text-sm">{h.paid} ج</span>
                  </div>
                  <div>
                    <span className="text-muted mb-1 block">تكلفة الجيم</span>
                    <span className="text-danger font-bold text-sm">0 ج</span>
                  </div>
                  <div>
                    <span className="text-primary mb-1 block">صافي الربح</span>
                    <span className="text-primary-light font-bold text-sm">{h.paid} ج</span>
                  </div>
                </div>
              </div>
            );
          }
        }
      });

      // 2. Process attendances on this day:
      if (!showOnlyDaily && p.attendance?.includes(selectedDayKey)) {
        // Same classification as the reports (shared engine)
        const dayInfo = analyzePlayer(p, settings).attendance.get(selectedDayKey);
        const isMonthly = dayInfo?.kind === 'package';
        const activeSub: any = dayInfo?.sub || null;

        if (isMonthly && activeSub) {
          const sessionNumber = dayInfo?.sessionNumber ?? 1;
          const maxSessions = getSessionCount(activeSub.subType) || 'مفتوح';

          totalMonthlyAttendancesCost += dayRate;
          monthlyAttendancesList.push(
            <div
              key={`att-${p.id}`}
              className="input-bg rounded-lg p-3 text-right shadow-sm border border-theme relative mb-3 bg-blue-950/5 border-blue-900/20"
            >
              <div className="border-b border-theme pb-2 mb-2 pr-2">
                <div className="font-bold text-primary text-sm">
                  اللاعب: <span className="text-primary-light">[#{p.number}] {p.name}</span>
                </div>
                <span className="text-blue-400 font-bold bg-blue-950/40 border border-blue-900/30 px-2 py-0.5 rounded text-[10px] mt-1 inline-block">
                  حضور: الحصة {sessionNumber} من {maxSessions} ({activeSub.subType})
                </span>
              </div>
              <div className="flex justify-between text-xs px-1">
                <div>
                  <span className="text-muted mb-1 block">المبلغ المدفوع اليوم</span>
                  <span className="text-success font-bold text-sm">0 ج</span>
                </div>
                <div>
                  <span className="text-muted mb-1 block">تكلفة الجيم</span>
                  <span className="text-danger font-bold text-sm">{dayRate} ج</span>
                </div>
                <div>
                  <span className="text-primary mb-1 block">صافي الربح اليوم</span>
                  <span className="text-danger font-bold text-sm">-{dayRate} ج</span>
                </div>
              </div>
            </div>
          );
        }
      }
    });

    if (monthlyPaymentsList.length === 0 && monthlyAttendancesList.length === 0 && dailySessionsList.length === 0) {
      return <div className="text-center text-muted py-6">لا توجد تفاصيل أو معاملات مسجلة في هذا اليوم.</div>;
    }

    return (
      <div className="space-y-4">
        {/* Section 1: Monthly Subscription Payments */}
        {!showOnlyDaily && (
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-blue-900/20 border border-blue-500/30 px-3 py-2 rounded-lg">
              <span className="text-sm font-bold text-blue-400">💳 دفعات الاشتراكات الشهرية (تجديد/تفعيل)</span>
              <span className="bg-blue-900/60 text-blue-300 text-xs font-black px-2.5 py-1 rounded-full">
                إجمالي المحصل: {totalMonthlyPayments} ج.م
              </span>
            </div>
            {monthlyPaymentsList.length === 0 ? (
              <div className="text-center text-xs text-muted/60 py-3 border border-dashed border-blue-900/20 rounded-lg">
                لا توجد دفعات اشتراك شهري اليوم.
              </div>
            ) : (
              <div>{monthlyPaymentsList}</div>
            )}
          </div>
        )}

        {/* Section 2: Monthly Subscribers Attendance */}
        {!showOnlyDaily && (
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-cyan-900/20 border border-cyan-500/30 px-3 py-2 rounded-lg">
              <span className="text-sm font-bold text-cyan-400">👥 حضور المشتركين شهرياً اليوم</span>
              <span className="bg-cyan-900/60 text-cyan-300 text-xs font-black px-2.5 py-1 rounded-full">
                تكلفة الجيم الإجمالية: {totalMonthlyAttendancesCost} ج.م
              </span>
            </div>
            {monthlyAttendancesList.length === 0 ? (
              <div className="text-center text-xs text-muted/60 py-3 border border-dashed border-cyan-900/20 rounded-lg">
                لا يوجد حضور للمشتركين شهرياً اليوم.
              </div>
            ) : (
              <div>{monthlyAttendancesList}</div>
            )}
          </div>
        )}

        {/* Section 3: Daily Sessions */}
        <div className="space-y-2">
          <div className="flex justify-between items-center bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg">
            <span className="text-sm font-bold text-amber-400">🎯 حضور ودفعات الحصص اليومية</span>
            <span className="bg-amber-500/20 text-amber-400 text-xs font-black px-2.5 py-1 rounded-full">
              إجمالي المحصل: {totalDailyPayments} ج.م
            </span>
          </div>
          {dailySessionsList.length === 0 ? (
            <div className="text-center text-xs text-muted/60 py-3 border border-dashed border-theme rounded-lg">
              لا توجد دفعات أو حضور حصص يومية اليوم.
            </div>
          ) : (
            <div>{dailySessionsList}</div>
          )}
        </div>
      </div>
    );
  };

  const getFilteredDailyKeys = () => {
    if (dailyDateFilter) {
      return financials.reversedDailyKeys.includes(dailyDateFilter) ? [dailyDateFilter] : [];
    }
    return financials.reversedDailyKeys.slice(0, 5); // Default to last 5 active days
  };

  return (
    <div className="space-y-6">
      {/* Grid 1: Treasury & Backup / Scan Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start animate-fadeIn">
        {/* 1. Historical Treasury Stats */}
        <div className="card-bg rounded-lg p-5 border-t-2 border-primary relative overflow-hidden h-full">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary-glow rounded-full blur-3xl opacity-50"></div>
          <h2 className="text-lg font-bold text-primary mb-4 flex items-center glow-text relative z-10">
            👑 إجمالي الخزنة (كل الأوقات)
          </h2>
          <div className="grid grid-cols-2 gap-3 text-center relative z-10">
            <div className="input-bg p-3 rounded-lg border border-theme">
              <div className="text-[10px] text-muted mb-1">إجمالي الإيرادات</div>
              <div className="text-success font-bold text-base">{financials.allTimeRev} ج.م</div>
            </div>
            <div className="input-bg p-3 rounded-lg border border-theme">
              <div className="text-[10px] text-muted mb-1">نصيب الجيم / المكان</div>
              <div className="text-danger font-bold text-base">{financials.allTimeGymCost} ج.م</div>
            </div>
            <div className="col-span-2 input-bg p-3 rounded-lg border border-theme">
              <div className="text-[10px] text-muted mb-1">مصروفات تانية (مواصلات، أدوات، إيجار...)</div>
              <div className="text-orange-400 font-bold text-base">{financials.allTimeExtExp} ج.م</div>
            </div>
            <div className="col-span-2 bg-primary/10 p-4 rounded-lg border border-primary relative overflow-hidden shadow-[0_0_15px_rgba(59,130,246,0.2)] mt-1">
              <div className="text-xs text-primary-light mb-1 font-bold">صافي الربح التاريخي</div>
              <div className="text-primary-light font-bold text-3xl glow-text tracking-wider">
                {financials.netProfit} ج.م
              </div>
            </div>
          </div>
        </div>

        {/* Backup & Deep Scan Tools Column */}
        <div className="space-y-6">
          {/* 2. Backup & Excel Tools */}
          <div className="card-bg rounded-lg p-5 border-t-2 border-blue-500 relative">
            <h2 className="text-lg font-bold text-blue-500 mb-4 flex items-center">
              💾 النسخ الاحتياطي وتصدير الداتا
            </h2>
            <p className="text-xs text-main mb-4 leading-relaxed">
              فيه نسخة احتياطية أوتوماتيك كل أسبوع على السحابة (آخر 8 نسخ). وتقدر كمان تنزّل نسخة بنفسك من هنا.
            </p>
            <div className="flex gap-2 mb-3">
              <button
                onClick={onExportJSON}
                className="w-full bg-blue-500/20 text-blue-400 border border-blue-500/50 py-2 rounded-lg font-bold hover:bg-blue-500 hover:text-white transition-all shadow-[0_0_10px_rgba(59,130,246,0.3)]"
              >
                نسخ (Export)
              </button>
            </div>
            <button
              onClick={onExportCSV}
              className="w-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 py-3 rounded-lg font-bold hover:bg-emerald-500 hover:text-white transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)] flex justify-center items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              تصدير الداتا شيت إكسيل (Excel CSV)
            </button>
          </div>

        </div>
      </div>

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

      {/* 6. Calendar Heatmap */}
      <div className="card-bg rounded-lg p-5 mb-6 border-t-2 border-green-500 relative">
        <h2 className="text-lg font-bold text-green-500 mb-4 flex items-center">
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14v6m-3-3v3M8 9V7m-3 3v3m14-11a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14z"></path>
          </svg>
          الخريطة الحرارية لأرباح {currentYear} (Heatmap)
        </h2>
        <div id="heatmapGrid" className="grid grid-cols-4 gap-2 text-center text-xs">
          {getHeatmapGrid()}
        </div>
      </div>

      {/* 7. Comprehensive Monthly & Daily Financial Reports sub-tabs */}
      <div className="card-bg rounded-lg p-4 mb-6 border-t-2 border-theme relative">
        <h2 className="text-lg font-bold text-primary mb-4 flex items-center glow-text">
          <svg className="w-5 h-5 ml-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
          </svg>
          التقارير المالية والتحليل (History)
        </h2>
        <div className="flex border-b border-theme mb-4">
          <button
            onClick={() => setSubTab('monthly')}
            className={`w-1/3 py-2 text-center text-xs sm:text-sm font-bold transition-all rounded-t-lg ${
              subTab === 'monthly' ? 'tab-active' : 'tab-inactive'
            }`}
          >
            بالشهر
          </button>
          <button
            onClick={() => setSubTab('daily')}
            className={`w-1/3 py-2 text-center text-xs sm:text-sm font-bold transition-all rounded-t-lg ${
              subTab === 'daily' ? 'tab-active' : 'tab-inactive'
            }`}
          >
            باليوم
          </button>
          <button
            onClick={() => setSubTab('wallet')}
            className={`w-1/3 py-2 text-center text-xs sm:text-sm font-bold transition-all rounded-t-lg ${
              subTab === 'wallet' ? 'tab-active' : 'tab-inactive'
            }`}
          >
            💼 المحفظة
          </button>
        </div>

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
      </div>

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

      {/* Advanced settings */}
      <div className="card-bg rounded-lg p-5 border-t-2 border-slate-500 relative animate-fadeIn">
        <h2 className="text-lg font-bold text-main mb-4 flex items-center">⚙️ إعدادات متقدمة</h2>

        <SettingsPanel settings={settings} onSave={onSaveSettings} />

        <div className="input-bg rounded-lg border border-theme p-4 mb-4">
          <div className="font-black text-amber-400 mb-1">🔒 قفل الشهر ({currentMonthKey})</div>
          <p className="text-[11px] text-muted mb-3 leading-relaxed">
            قفل الشهر بيعلّم الشهر إنه مقفول وبس. مش بيمسح أي مدفوعات أو حضور أو اشتراكات، والتقارير الشهرية هتفضل شايفة أرقامه.
          </p>
          {lockedMonths.includes(currentMonthKey) ? (
            <div className="text-amber-400 text-sm font-black">الشهر ده مقفول بالفعل 🔒</div>
          ) : (
            <button
              onClick={() => {
                setLockConfirmText('');
                setShowLockModal(true);
              }}
              className="w-full bg-amber-500/20 text-amber-400 border border-amber-500/50 py-2 rounded-lg font-bold hover:bg-amber-500 hover:text-white transition-all"
            >
              قفل الشهر 🔒
            </button>
          )}
          {lockedMonths.length > 0 && (
            <div className="text-[11px] text-muted mt-3">
              الشهور المقفولة: {[...lockedMonths].sort().reverse().join('، ')}
            </div>
          )}
        </div>

        {/* Emergency tools (moved here from the backup section) */}
        <div className="input-bg rounded-lg border border-red-500/30 p-4 mb-4">
          <div className="font-black text-red-400 mb-1">🧰 أدوات الطوارئ</div>
          <p className="text-[11px] text-muted mb-3 leading-relaxed">
            قبل أي استرجاع بتتعمل نسخة احتياطية أوتوماتيك، وبيظهرلك كام لاعب هيتغير قبل التأكيد. مفيش لاعب بيتمسح.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onImportJSON}
              className="bg-green-500/20 text-green-400 border border-green-500/50 py-2 rounded-lg font-bold text-xs hover:bg-green-500 hover:text-white transition-all"
            >
              لصق (Import) 📥
            </button>
            <button
              onClick={onDeepRecover}
              className="bg-red-500/20 text-red-400 border border-red-500/50 py-2 rounded-lg font-bold text-xs hover:bg-red-500 hover:text-white transition-all"
            >
              الفحص العميق 🔄
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowSignOutConfirm(true)}
          className="w-full bg-danger/10 text-danger border border-danger/40 py-3 rounded-lg font-bold hover:bg-danger hover:text-white transition-all"
        >
          تسجيل خروج 🚪
        </button>
      </div>

      {showLockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card-bg rounded-lg p-6 w-full max-w-sm text-center border border-theme">
            <h3 className="text-xl font-bold text-amber-400 mb-2">قفل شهر {currentMonthKey}</h3>
            <p className="text-main text-sm mb-4">
              مفيش أي بيانات هتتمسح. اكتب كلمة <b className="text-amber-400">تأكيد</b> علشان تقفل الشهر.
            </p>
            <input
              type="text"
              value={lockConfirmText}
              onChange={(e) => setLockConfirmText(e.target.value)}
              placeholder="تأكيد"
              className="w-full input-bg rounded-lg px-3 py-2 text-sm border border-theme mb-4 text-center"
            />
            <div className="flex gap-3">
              <button
                disabled={lockConfirmText.trim() !== 'تأكيد'}
                onClick={async () => {
                  await onLockMonth(currentMonthKey);
                  setShowLockModal(false);
                  setLockConfirmText('');
                }}
                className="w-1/2 bg-amber-500 text-white font-bold rounded-md px-4 py-2 disabled:opacity-40"
              >
                قفل
              </button>
              <button
                onClick={() => setShowLockModal(false)}
                className="w-1/2 input-bg font-bold rounded-md px-4 py-2"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {showSignOutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card-bg rounded-lg p-6 w-full max-w-sm text-center border border-theme">
            <h3 className="text-xl font-bold text-danger mb-2">تسجيل خروج</h3>
            <p className="text-main text-sm mb-6">
              بياناتك هتفضل محفوظة على الجهاز. هتحتاج إنترنت علشان تدخل تاني.
            </p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  setShowSignOutConfirm(false);
                  await onSignOut();
                }}
                className="w-1/2 bg-danger text-white font-bold rounded-md px-4 py-2"
              >
                خروج
              </button>
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="w-1/2 input-bg font-bold rounded-md px-4 py-2"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
