import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { RosterSection } from './components/RosterSection';
import { ActiveSection } from './components/ActiveSection';
import { GroupsSection } from './components/GroupsSection';
import { ProfileSection } from './components/ProfileSection';
import { ForecastsSection } from './components/ForecastsSection';
import { DuplicateNamesAlert } from './components/DuplicateNamesAlert';
import { SidebarWidget, ExpectedSidebarWidget } from './components/layout/SidebarWidgets';
import { HistoryModal } from './components/modals/HistoryModal';
import { AppModals } from './components/modals/AppModals';
import { supabase } from './services/supabaseClient';
import { type ReceiptInfo } from './lib/messages';

import type { Player } from './types';
import { getSettings, analyzePlayer, computeMonthlyTotals } from './lib/subscription';
import { MONTH_NAMES, GROUPS_CONFIG_ID, MONTH_LOCKS_ID } from './lib/constants';
import { localToday } from './lib/dates';
import type { AppContextValue } from './hooks/appContext';
import { useAppData } from './hooks/useAppData';
import { usePlayers } from './hooks/usePlayers';
import { useSubscriptions } from './hooks/useSubscriptions';
import { useSettings } from './hooks/useSettings';
import { useWallet } from './hooks/useWallet';
import { useDataTools } from './hooks/useDataTools';

export const App: React.FC = () => {
  // Global View states
  const [mode, setMode] = useState(localStorage.getItem('sys_mode') || 'dark');
  const [activeTab, setActiveTab] = useState<'roster' | 'active' | 'groups' | 'profile' | 'forecasts'>('roster');
  
  // Data (Dexie + cloud + realtime) and sync status
  const { players, setPlayers, expectedAttendees, setExpectedAttendees, walletEntries, setWalletEntries, syncStatus, syncInfo } =
    useAppData();

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
    handleRestorePlayer,
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
        syncInfo={syncInfo}
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
                onRestorePlayer={handleRestorePlayer}
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

      {/* A. Player history (payments + attendance calendar) */}
      {historyPlayerId && historyPlayer && (
        <HistoryModal
          historyPlayer={historyPlayer}
          historyTab={historyTab}
          setHistoryTab={setHistoryTab}
          calCurrentDate={calCurrentDate}
          setCalCurrentDate={setCalCurrentDate}
          setHistoryPlayerId={setHistoryPlayerId}
          handleDeleteHistoryEntry={handleDeleteHistoryEntry}
          handleToggleCalendarDay={handleToggleCalendarDay}
        />
      )}

      {/* B-G. Delete / backup / import / receipt dialogs */}
      <AppModals
        players={players}
        appSettings={appSettings}
        playerToDeleteId={playerToDeleteId}
        setPlayerToDeleteId={setPlayerToDeleteId}
        handleDeletePlayer={handleDeletePlayer}
        showBackupModal={showBackupModal}
        setShowBackupModal={setShowBackupModal}
        backupText={backupText}
        handleCopyBackup={handleCopyBackup}
        handleDownloadBackupFile={handleDownloadBackupFile}
        showImportModal={showImportModal}
        setShowImportModal={setShowImportModal}
        importText={importText}
        setImportText={setImportText}
        handleExecuteImport={handleExecuteImport}
        handleFileUpload={handleFileUpload}
        importPreview={importPreview}
        setImportPreview={setImportPreview}
        importBusy={importBusy}
        handleConfirmImport={handleConfirmImport}
        receipt={receipt}
        setReceipt={setReceipt}
      />

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
