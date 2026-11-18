import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { RosterSection } from './components/RosterSection';
import { ActiveSection } from './components/ActiveSection';
import { GroupsSection } from './components/GroupsSection';
import { ProfileSection } from './components/ProfileSection';
import { ForecastsSection } from './components/ForecastsSection';
import { DuplicateNamesAlert } from './components/DuplicateNamesAlert';
import { supabase } from './services/supabaseClient';
import { buildReceiptMessage, whatsAppLink, type ReceiptInfo } from './lib/messages';

import type { Player, ExpectedAttendee } from './types';
import { getSettings, analyzePlayer, computeMonthlyTotals } from './lib/subscription';
import { MONTH_NAMES, GROUPS_CONFIG_ID, MONTH_LOCKS_ID } from './lib/constants';
import { localToday, dateKey } from './lib/dates';
import type { AppContextValue } from './hooks/appContext';
import { useAppData } from './hooks/useAppData';
import { usePlayers } from './hooks/usePlayers';
import { useSubscriptions } from './hooks/useSubscriptions';
import { useSettings } from './hooks/useSettings';
import { useWallet } from './hooks/useWallet';
import { useDataTools } from './hooks/useDataTools';

interface SidebarWidgetProps {
  currentProfit: number;
  highestProfit: number;
  highestMonthLabel: string;
  currentMonthLabel: string;
}

const SidebarWidget: React.FC<SidebarWidgetProps> = ({
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

const ExpectedSidebarWidget: React.FC<ExpectedSidebarWidgetProps> = ({
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
                🕒 {formatTimeTo12Hr(att.time)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  // Global View states
  const [mode, setMode] = useState(localStorage.getItem('sys_mode') || 'dark');
  const [activeTab, setActiveTab] = useState<'roster' | 'active' | 'groups' | 'profile' | 'forecasts'>('roster');
  
  // Data (Dexie + cloud + realtime) and sync status
  const { players, setPlayers, expectedAttendees, setExpectedAttendees, walletEntries, setWalletEntries, syncStatus } =
    useAppData(activeTab);

  // Search & filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  
  // Roster / payment linking state
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [payRequestPlayerId, setPayRequestPlayerId] = useState<string | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  // Toast Notification state
  const [toastMessage, setToastMessage] = useState('');
  const [toastIsError, setToastIsError] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // History modal state
  const [historyPlayerId, setHistoryPlayerId] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<'payments' | 'calendar'>('payments');
  const [calCurrentDate, setCalCurrentDate] = useState(new Date());

  // Delete Confirmation state
  const [playerToDeleteId, setPlayerToDeleteId] = useState<string | null>(null);


  // WhatsApp receipt offered after a payment
  const [receipt, setReceipt] = useState<ReceiptInfo | null>(null);

  // 1. Load mode configuration
  useEffect(() => {
    document.body.setAttribute('data-mode', mode);
    localStorage.setItem('sys_mode', mode);
  }, [mode]);

  // Toast trigger helper
  const triggerToast = (message: string, isError = false) => {
    setToastMessage(message);
    setToastIsError(isError);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  const getTodayDate = localToday;

  const getFormattedDate = dateKey;

  // One expiry/status function for every tab (src/lib/subscription.ts)
  const appSettings = getSettings(players);
  const checkExpiration = (player: Player) => analyzePlayer(player, appSettings).status;

  // Shared state for the hooks below
  const ctx: AppContextValue = {
    players,
    setPlayers,
    expectedAttendees,
    setExpectedAttendees,
    walletEntries,
    setWalletEntries,
    triggerToast,
    appSettings,
    setReceipt,
    setEditingPlayer,
    playerToDeleteId,
    setPlayerToDeleteId,
    checkExpiration,
  };

  const {
    handleSavePlayer,
    handleDeletePlayer,
    handleSaveGroupConfig,
    handleDeleteGroupConfig,
    handleRenameGroupConfig,
    handleMovePlayerToGroup,
    handleToggleCalendarDay,
    handleDeleteHistoryEntry,
    handleSaveExpense,
    handleDeleteExpense,
    handleLockMonth,
  } = usePlayers(ctx);
  const {
    handleSaveSubscription,
    handlePayExtras,
    handleCancelSubscription,
    handleAddAttendance,
    handleRemoveAttendance,
    handleDeletePlayerTransaction,
    handleAddExpectedAttendee,
    handleDeleteExpectedAttendee,
    handleSaveExpectedAttendee,
    handleApplyExpectedAttendee,
  } = useSubscriptions(ctx);
  const { handleSaveSettings } = useSettings(ctx);
  const { handleSaveWalletEntry, handleDeleteWalletEntry } = useWallet(ctx);
  const {
    handleDeepRecover,
    handleExportCSV,
    handleExportJSON,
    handleCopyBackup,
    handleDownloadBackupFile,
    handleImportJSON,
    handleExecuteImport,
    handleConfirmImport,
    handleFileUpload,
    showBackupModal,
    setShowBackupModal,
    showImportModal,
    setShowImportModal,
    backupText,
    importText,
    setImportText,
    importPreview,
    setImportPreview,
    importBusy,
  } = useDataTools(ctx);

  // Sign out (local Dexie data stays on the device)
  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: 'local' });
  };


  // --- Shared computed stats for Header dashboard ---
  const monthlyTotals = computeMonthlyTotals(players, appSettings);
  const currentMonthKeyForStats = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const getCurrentMonthBenefit = () => {
    const m = monthlyTotals[currentMonthKeyForStats] || { revenue: 0, cost: 0, expenses: 0, profit: 0 };
    return {
      netProfit: m.revenue - m.cost - m.expenses,
      revenue: m.revenue,
      cost: m.cost,
      expenses: m.expenses,
    };
  };
  const monthNames = MONTH_NAMES;
  const monthBenefit = getCurrentMonthBenefit();
  const currentMonthLabel = monthNames[new Date().getMonth()];

  const getHighestMonthStats = () => {
    const monthlyStats = monthlyTotals;
    const currMonthKey = currentMonthKeyForStats;

    let highestProfit = 0;
    let highestMonthKey = 'لا يوجد';

    Object.entries(monthlyStats).forEach(([key, stat]) => {
      if (key !== currMonthKey && stat.profit > highestProfit) {
        highestProfit = stat.profit;
        highestMonthKey = key;
      }
    });

    let highestMonthLabel = 'لا يوجد';
    if (highestMonthKey !== 'لا يوجد') {
      const parts = highestMonthKey.split('-');
      if (parts.length === 2) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          highestMonthLabel = `${monthNames[monthIndex]} ${year}`;
        } else {
          highestMonthLabel = highestMonthKey;
        }
      } else {
        highestMonthLabel = highestMonthKey;
      }
    }

    return {
      highestProfit,
      highestMonthLabel,
    };
  };

  const highestStats = getHighestMonthStats();

  const getCalendarDays = () => {
    if (!historyPlayerId) return [];
    const p = players.find(x => x.id === historyPlayerId);
    if (!p) return [];

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
          onClick={() => handleToggleCalendarDay(historyPlayerId, formattedDate)}
          title="اضغط لتسجيل/إلغاء الحضور"
        >
          {i}
        </div>
      );
    }
    return cells;
  };

  const historyPlayer = players.find(x => x.id === historyPlayerId);

  // Compute group lists suggestions dynamically
  const defaultGroups = ['العام'];
  const currentGroups = players.filter(p => !p.isSystem && !p.isDeleted).map(p => p.sport || 'العام');

  // Load groups configurations
  const groupsConfigPlayer = players.find(p => p.id === GROUPS_CONFIG_ID);
  const groupsConfig = groupsConfigPlayer?.history || [];
  const configuredGroups = groupsConfig.map(h => h.desc);

  const allGroups = [...new Set([...defaultGroups, ...currentGroups, ...configuredGroups])];

  // Closed months (marker only — no data is removed)
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const lockedMonths = (players.find(p => p.id === MONTH_LOCKS_ID)?.history || []).map(h => h.desc);

  // Duplicate names among active players (warning only — never auto-deleted)
  const duplicateGroups = (() => {
    const map = new Map<string, Player[]>();
    players.forEach(p => {
      if (p.isSystem || p.isDeleted || !p.name) return;
      const key = p.name.trim().toLowerCase();
      if (!key) return;
      map.set(key, [...(map.get(key) || []), p]);
    });
    return [...map.values()].filter(list => list.length > 1);
  })();

  return (
    <div className="max-w-md md:max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto min-h-screen relative pb-28 md:pb-20 px-2 sm:px-4">
      {/* 1. Header controls (modes) */}
      <Header
        mode={mode}
        setMode={setMode}
        syncStatus={syncStatus}
      />

      {/* Mobile Bottom Navigation Bar (Floating) */}
      <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden bg-slate-900/90 dark:bg-slate-900/90 backdrop-blur-md border border-theme/80 rounded-2xl shadow-xl flex justify-around items-center py-2 px-1 select-none">
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-all ${
            activeTab === 'roster' ? 'text-primary animate-pulse' : 'text-muted'
          }`}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span className="text-[9px] font-bold">القاعدة</span>
        </button>

        <button
          onClick={() => setActiveTab('active')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-all ${
            activeTab === 'active' ? 'text-primary animate-pulse' : 'text-muted'
          }`}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span className="text-[9px] font-bold">الاشتراكات</span>
        </button>

        <button
          onClick={() => setActiveTab('groups')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-all ${
            activeTab === 'groups' ? 'text-primary animate-pulse' : 'text-muted'
          }`}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-[9px] font-bold">الجروبات</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-all ${
            activeTab === 'profile' ? 'text-primary animate-pulse' : 'text-muted'
          }`}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[9px] font-bold">البروفايل</span>
        </button>

        <button
          onClick={() => setActiveTab('forecasts')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-all ${
            activeTab === 'forecasts' ? 'text-primary animate-pulse' : 'text-muted'
          }`}
        >
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <span className="text-[9px] font-bold">التوقعات</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
        {/* Main Content Column */}
        <div className="col-span-1 lg:col-span-9 flex flex-col">
          {/* 2. Month overview treasury summary */}
          <div className="card-bg text-main mx-4 pt-5 pb-5 px-6 rounded-2xl text-center mb-6 mt-4 relative">
            <h1 className="text-xl font-black mb-2 glow-text tracking-wider text-primary">[ SYSTEM ]</h1>
            <p className="text-muted text-sm mb-1 flex items-center justify-center gap-2 font-bold">
              <span>أرباح شهر ({currentMonthLabel})</span>
              {lockedMonths.includes(currentMonthKey) && (
                <span className="text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5 text-[10px] font-black">
                  مقفول 🔒
                </span>
              )}
            </p>
            <div className="text-3xl font-black tracking-tight text-primary-light glow-text">
              {monthBenefit.netProfit} <span className="text-lg font-normal">ج.م</span>
            </div>
            
            <div className="text-[10px] sm:text-xs text-muted mt-3 flex justify-center gap-3 border-t border-theme/50 pt-2 font-bold">
              <span>إيرادات: <b className="text-success text-sm font-black">{monthBenefit.revenue} ج.م</b></span>
              <span>نصيب الجيم/المكان: <b className="text-danger text-sm font-black">{monthBenefit.cost} ج.م</b></span>
              <span>مصروفات تانية: <b className="text-orange-400 text-sm font-black">{monthBenefit.expenses} ج.م</b></span>
            </div>
          </div>

          {/* 3. Main Navigation Tab */}
          <div className="hidden md:flex tab-container-segmented rounded-xl p-1 mb-6 mx-4">
            <button
              onClick={() => setActiveTab('roster')}
              className={`w-1/5 py-2 text-center text-[10px] sm:text-xs transition-all rounded-lg ${
                activeTab === 'roster' ? 'tab-active-segmented' : 'tab-inactive-segmented'
              }`}
            >
              القاعدة
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`w-1/5 py-2 text-center text-[10px] sm:text-xs transition-all rounded-lg ${
                activeTab === 'active' ? 'tab-active-segmented' : 'tab-inactive-segmented'
              }`}
            >
              الاشتراكات
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`w-1/5 py-2 text-center text-[10px] sm:text-xs transition-all rounded-lg ${
                activeTab === 'groups' ? 'tab-active-segmented' : 'tab-inactive-segmented'
              }`}
            >
              الجروبات 👥
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-1/5 py-2 text-center text-[10px] sm:text-xs transition-all rounded-lg ${
                activeTab === 'profile' ? 'tab-active-segmented' : 'tab-inactive-segmented'
              }`}
            >
              البروفايل 👤
            </button>
            <button
              onClick={() => setActiveTab('forecasts')}
              className={`w-1/5 py-2 text-center text-[10px] sm:text-xs transition-all rounded-lg ${
                activeTab === 'forecasts' ? 'tab-active-segmented' : 'tab-inactive-segmented'
              }`}
            >
              التوقعات 🔮
            </button>
          </div>

          {/* 4. Shared Search Block */}
          {(activeTab === 'roster' || activeTab === 'active') && (
            <div className="mb-6 flex flex-col gap-2 px-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 ابحث عن لاعب بالاسم أو الرقم..."
                className="w-full input-bg rounded-lg px-3 py-3 transition-colors text-sm border border-theme"
              />
              <div className="flex gap-2">
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="w-1/2 input-bg rounded-lg px-2 py-3 text-sm border border-theme"
                >
                  <option value="All">كل الجروبات</option>
                  {allGroups.map((g, idx) => (
                    <option key={idx} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-1/2 input-bg rounded-lg px-2 py-3 text-sm border border-theme text-muted"
                />
              </div>
            </div>
          )}

          {/* 5. Sub-sections content rendering */}
          <div className="px-4">
            {activeTab === 'roster' && duplicateGroups.length > 0 && (
              <DuplicateNamesAlert
                groups={duplicateGroups}
                onDelete={setPlayerToDeleteId}
              />
            )}

            {activeTab === 'roster' && (
              <RosterSection
                players={players}
                searchQuery={searchQuery}
                groupFilter={groupFilter}
                dateFilter={dateFilter}
                onSavePlayer={handleSavePlayer}
                onEditSelect={setEditingPlayer}
                editingPlayer={editingPlayer}
                onDeletePlayer={setPlayerToDeleteId}
                onOpenPayment={(id) => {
                  setSelectedPlayerId(id);
                  setActiveTab('active');
                }}
                onOpenHistory={setHistoryPlayerId}
                checkExpiration={checkExpiration}
                allGroups={allGroups}
                onPayExtras={(id) => {
                  setPayRequestPlayerId(id);
                  setActiveTab('active');
                }}
              />
            )}

            {activeTab === 'active' && (
              <ActiveSection
                players={players}
                selectedPlayerId={selectedPlayerId}
                setSelectedPlayerId={setSelectedPlayerId}
                onSaveSubscription={handleSaveSubscription}
                onPayExtras={handlePayExtras}
                payRequestPlayerId={payRequestPlayerId}
                onPayRequestHandled={() => setPayRequestPlayerId(null)}
                onCancelSubscription={handleCancelSubscription}
                checkExpiration={checkExpiration}
                onAddAttendance={handleAddAttendance}
                onRemoveAttendance={handleRemoveAttendance}
                getTodayDate={getTodayDate}
                searchQuery={searchQuery}
                groupFilter={groupFilter}
                dateFilter={dateFilter}
                expectedAttendees={expectedAttendees}
                onAddExpectedAttendee={handleAddExpectedAttendee}
                onDeleteExpectedAttendee={handleDeleteExpectedAttendee}
                onApplyExpectedAttendee={handleApplyExpectedAttendee}
                onSaveExpectedAttendee={handleSaveExpectedAttendee}
                allGroups={allGroups}
              />
            )}

            {activeTab === 'groups' && (
              <GroupsSection
                players={players}
                groupsConfig={groupsConfig}
                onSaveGroupConfig={handleSaveGroupConfig}
                onDeleteGroupConfig={handleDeleteGroupConfig}
                onRenameGroupConfig={handleRenameGroupConfig}
                onMovePlayerToGroup={handleMovePlayerToGroup}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileSection
                players={players}
                onSaveExpense={handleSaveExpense}
                onDeleteExpense={handleDeleteExpense}
                onExportCSV={handleExportCSV}
                onExportJSON={handleExportJSON}
                onImportJSON={handleImportJSON}
                onDeepRecover={handleDeepRecover}
                getTodayDate={getTodayDate}
                walletEntries={walletEntries}
                onSaveWalletEntry={handleSaveWalletEntry}
                onDeleteWalletEntry={handleDeleteWalletEntry}
                onDeletePlayerTransaction={handleDeletePlayerTransaction}
                lockedMonths={lockedMonths}
                currentMonthKey={currentMonthKey}
                onLockMonth={handleLockMonth}
                onSignOut={handleSignOut}
                onSaveSettings={handleSaveSettings}
              />
            )}

            {activeTab === 'forecasts' && (
              <ForecastsSection
                players={players}
                expectedAttendees={expectedAttendees}
                getTodayDate={getTodayDate}
              />
            )}
          </div>
        </div>

        {/* Sidebar Widget (Desktop comparison money meter & Expected attendees, hidden on mobile) */}
        <div className="col-span-1 lg:col-span-3 hidden lg:block space-y-4">
          <SidebarWidget
            currentProfit={monthBenefit.netProfit}
            highestProfit={highestStats.highestProfit}
            highestMonthLabel={highestStats.highestMonthLabel}
            currentMonthLabel={currentMonthLabel}
          />
          <ExpectedSidebarWidget
            expectedAttendees={expectedAttendees}
          />
        </div>
      </div>

      {/* --- Overlay Modals --- */}

      {/* A. Global History Modal (Reversing history array exactly like native openHistory) */}
      {historyPlayerId && historyPlayer && (
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
      )}

      {/* B. Player Delete Confirmation Modal */}
      {playerToDeleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card-bg rounded-lg p-6 w-full max-w-sm text-center border border-theme">
            <h3 className="text-xl font-bold text-danger mb-2">تحذير النظام!</h3>
            <p className="text-main mb-6">هل أنت متأكد من حذف هذا اللاعب تماماً من القاعدة؟</p>
            <div className="flex gap-3">
              <button
                onClick={handleDeletePlayer}
                className="w-1/2 bg-danger text-danger border border-danger font-bold rounded-md px-4 py-2"
              >
                تأكيد
              </button>
              <button
                onClick={() => setPlayerToDeleteId(null)}
                className="w-1/2 input-bg font-bold rounded-md px-4 py-2"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* D. Backup/Export JSON Code Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card-bg rounded-lg p-5 w-full max-w-sm relative flex flex-col border border-theme">
            <button
              onClick={() => setShowBackupModal(false)}
              className="absolute top-4 left-4 text-muted hover:text-main input-bg p-1 rounded-full border border-theme"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
            <h3 className="text-lg font-bold text-blue-500 mb-2">حفظ النسخة الاحتياطية</h3>
            <p className="text-xs text-muted mb-4">يفضل استخدام (تنزيل ملف) والاحتفاظ به لحماية بياناتك بالكامل.</p>
            <textarea
              readOnly
              value={backupText}
              className="w-full h-24 input-bg rounded p-3 text-left text-xs mb-4 opacity-70"
              style={{ direction: 'ltr', resize: 'none' }}
            ></textarea>
            <div className="flex gap-2">
              <button
                onClick={handleCopyBackup}
                className="w-1/2 bg-blue-500/20 text-blue-400 font-bold rounded px-3 py-2 border border-blue-500/50 hover:bg-blue-500 hover:text-white transition-colors text-sm"
              >
                نسخ الكود 📋
              </button>
              <button
                onClick={handleDownloadBackupFile}
                className="w-1/2 bg-blue-500 text-white font-bold rounded px-3 py-2 shadow-lg text-sm"
              >
                تنزيل ملف 📁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* E. Import JSON Code Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card-bg rounded-lg p-5 w-full max-w-sm relative flex flex-col border border-theme">
            <button
              onClick={() => setShowImportModal(false)}
              className="absolute top-4 left-4 text-muted hover:text-main input-bg p-1 rounded-full border border-theme"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
            <h3 className="text-lg font-bold text-green-500 mb-2">استرجاع البيانات</h3>
            <p className="text-xs text-muted mb-4">اختر ملف النسخة الاحتياطية الذي قمت بتنزيله، أو الصق الكود هنا.</p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="أو الصق الكود هنا..."
              className="w-full h-24 input-bg rounded p-3 text-left text-xs mb-4"
              style={{ direction: 'ltr', resize: 'none' }}
            ></textarea>
            
            <input
              type="file"
              id="importFileInput"
              accept=".txt,.json"
              className="hidden"
              onChange={handleFileUpload}
            />
            
            <div className="flex gap-2">
              <button
                onClick={handleExecuteImport}
                className="w-1/2 bg-green-500/20 text-green-400 font-bold rounded px-3 py-2 border border-green-500/50 hover:bg-green-500 hover:text-white transition-colors text-sm"
              >
                لصق واسترجاع 🔄
              </button>
              <button
                onClick={() => document.getElementById('importFileInput')?.click()}
                className="w-1/2 bg-green-500 text-white font-bold rounded px-3 py-2 shadow-lg text-sm"
              >
                رفع الملف 📁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* F. Import confirmation */}
      {importPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card-bg rounded-lg p-5 w-full max-w-sm border border-theme text-right">
            <h3 className="text-lg font-bold text-green-500 mb-3">تأكيد الاسترجاع</h3>
            <div className="space-y-1 text-sm mb-3">
              <div>لاعيبة جديدة هتتضاف: <b className="text-success">{importPreview.newCount}</b></div>
              <div>لاعيبة هتتغير لنسخة الملف: <b className="text-amber-400">{importPreview.changedCount}</b></div>
              <div>زي ما هم: <b className="text-muted">{importPreview.unchangedCount}</b></div>
              <div>مش موجودين في الملف (هيفضلوا زي ما هم): <b className="text-main">{importPreview.notInFileCount}</b></div>
            </div>
            <p className="text-[11px] text-muted mb-4 leading-relaxed">
              قبل أي تغيير هتتعمل نسخة احتياطية أوتوماتيك. مفيش أي لاعب هيتمسح.
            </p>
            <div className="flex gap-2">
              <button
                disabled={importBusy}
                onClick={handleConfirmImport}
                className="w-1/2 bg-green-500 text-white font-bold rounded px-3 py-2 disabled:opacity-50"
              >
                {importBusy ? 'جاري...' : 'تأكيد الاسترجاع'}
              </button>
              <button
                disabled={importBusy}
                onClick={() => setImportPreview(null)}
                className="w-1/2 input-bg font-bold rounded px-3 py-2 border border-theme"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* G. WhatsApp receipt after a payment */}
      {receipt && (() => {
        const rp = players.find(p => p.id === receipt.playerId);
        if (!rp) return null;
        const text = buildReceiptMessage(rp, receipt, appSettings);
        const link = whatsAppLink(rp.phone, text);
        return (
          <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="card-bg rounded-lg p-5 w-full max-w-sm border border-theme text-right">
              <h3 className="text-lg font-bold text-success mb-2">🧾 إيصال الدفع: {rp.name}</h3>
              <pre className="input-bg rounded p-3 text-xs whitespace-pre-wrap font-sans border border-theme mb-4">{text}</pre>
              <div className="flex gap-2">
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setReceipt(null)}
                    className="w-1/2 text-white font-bold rounded px-3 py-2 text-center"
                    style={{ backgroundColor: '#16a34a' }}
                  >
                    إرسال واتساب 💬
                  </a>
                ) : (
                  <div className="w-1/2 text-[11px] text-muted text-center self-center">مفيش رقم موبايل للاعب</div>
                )}
                <button onClick={() => setReceipt(null)} className="w-1/2 input-bg font-bold rounded px-3 py-2 border border-theme">
                  قفل
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- Floating Toast Notification Alert --- */}
      <div
        className={`fixed bottom-5 left-1/2 transform -translate-x-1/2 w-[90%] max-w-sm text-center py-3 px-4 rounded-md z-50 border transition-all duration-300 ${
          showToast ? 'toast-active block' : 'toast-enter hidden'
        } ${
          toastIsError
            ? 'bg-danger text-white border-danger shadow-[0_0_15px_rgba(239,68,68,0.5)] font-bold'
            : 'card-bg text-primary-light border-theme shadow-[0_0_15px_var(--primary-glow)] font-bold'
        }`}
      >
        <span>{toastMessage}</span>
      </div>
    </div>
  );
};
export default App;
