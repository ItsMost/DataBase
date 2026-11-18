/**
 * All the logic of ProfileSection (state, effects, handlers, derived values).
 * Moved out of the component unchanged; the screen parts read what they need from it.
 */
import React, { useState } from 'react';
import type { Player, PersonalWalletEntry, AppSettings, HistoryEntry } from '../types';
import {
  getSettings,
  analyzePlayer,
  gymRateAt,
  localToday,
  EXTRA_PAYMENT,
  SINGLE_SESSION,
  getSessionCount,
  OTHER_EXPENSE,
  DEFAULT_EXPENSE_CATEGORIES,
} from '../lib/subscription';
import { computeFinancials, computeBreakdowns } from '../lib/reports';
import { MONTH_NAMES, EXPENSES_ID } from '../lib/constants';

export interface ProfileSectionProps {
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
  onRestorePlayer: (playerId: string) => Promise<void>;
}

export function useProfileSection(props: ProfileSectionProps) {
  const {
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
  onRestorePlayer,
} = props;

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
        const activeSub: HistoryEntry | null = dayInfo?.sub || null;

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

  return {
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
    onRestorePlayer,
    settings,
    showLockModal,
    setShowLockModal,
    lockConfirmText,
    setLockConfirmText,
    showSignOutConfirm,
    setShowSignOutConfirm,
    expDesc,
    setExpDesc,
    expAmount,
    setExpAmount,
    expDate,
    setExpDate,
    expCategory,
    setExpCategory,
    newCategory,
    setNewCategory,
    showNewCategory,
    setShowNewCategory,
    subTab,
    setSubTab,
    dailyDateFilter,
    setDailyDateFilter,
    walletDesc,
    setWalletDesc,
    walletAmount,
    setWalletAmount,
    walletDate,
    setWalletDate,
    capitalEntry,
    startingBalance,
    activeWalletEntries,
    totalExpenses,
    remainingBalance,
    handleUpdateStartingBalance,
    handleSubmitWalletExpense,
    selectedDayKey,
    setSelectedDayKey,
    excludeMonthlyDays,
    setExcludeMonthlyDays,
    monthNames,
    financials,
    breakdowns,
    todayKey,
    currentMonthKeyStr,
    expenseCategories,
    currentMonth,
    currentYear,
    systemPlayer,
    currentMonthExpenses,
    totalCurrentMonthExpenses,
    handleSubmitExpense,
    chartLabels,
    chartDataValues,
    lineChartData,
    lineChartOptions,
    getHeatmapGrid,
    getDailyDetailsList,
    getFilteredDailyKeys,
  };
}

export type ProfileSectionVM = ReturnType<typeof useProfileSection>;
