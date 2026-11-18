import React, { useState, useEffect, useRef } from 'react';
import type { Player, ExpectedAttendee, EndMode } from '../types';
import {
  getSettings,
  analyzePlayer,
  suggestGymCost,
  isPackageType,
  formatDate,
  SINGLE_SESSION,
  ATTEND_ONLY_TYPES,
  DEFAULT_PLACE,
} from '../lib/subscription';
import { EndModePicker, GymCostField, PlaceField, usePlaceSuggestions } from './AccountingFields';
import { buildReminderMessage, whatsAppLink } from '../lib/messages';
import { diffDays, DEFAULT_INACTIVE_DAYS } from '../lib/subscription';

interface ActiveSectionProps {
  players: Player[];
  selectedPlayerId: string;
  setSelectedPlayerId: (id: string) => void;
  onSaveSubscription: (
    playerId: string,
    subData: {
      subType: string;
      startDate: string;
      paid: number;
      cost: number;
      endMode?: EndMode;
      place?: string;
      absorbedExtras?: { date: string; gym: number }[];
    },
    isEdit?: boolean
  ) => Promise<void>;
  onPayExtras: (playerId: string, amount: number, extraDates: string[], place?: string) => Promise<void>;
  payRequestPlayerId?: string | null; // open the payment choices for this player (from the roster card)
  onPayRequestHandled?: () => void;
  onCancelSubscription: (playerId: string) => Promise<void>;
  checkExpiration: (player: Player) => { isExpired: boolean; days: number; endDateStr: string };
  onAddAttendance: (playerId: string, dateStr: string) => Promise<void>;
  onRemoveAttendance: (playerId: string, dateStr: string) => Promise<void>;
  getTodayDate: () => string;
  searchQuery: string;
  groupFilter: string;
  dateFilter: string;
  expectedAttendees: ExpectedAttendee[];
  onAddExpectedAttendee: (attendee: Omit<ExpectedAttendee, 'id'>) => Promise<void>;
  onDeleteExpectedAttendee: (id: string) => Promise<void>;
  onApplyExpectedAttendee: (attendee: ExpectedAttendee) => Promise<void>;
  onSaveExpectedAttendee: (attendee: ExpectedAttendee) => Promise<void>;
  allGroups: string[];
}

export const ActiveSection: React.FC<ActiveSectionProps> = ({
  players,
  selectedPlayerId,
  setSelectedPlayerId,
  onSaveSubscription,
  onPayExtras,
  payRequestPlayerId,
  onPayRequestHandled,
  onCancelSubscription,
  checkExpiration,
  onAddAttendance,
  onRemoveAttendance,
  getTodayDate,
  searchQuery,
  groupFilter,
  dateFilter,
  expectedAttendees,
  onAddExpectedAttendee,
  onDeleteExpectedAttendee,
  onApplyExpectedAttendee,
  onSaveExpectedAttendee,
  allGroups,
}) => {
  // Subscription Form states
  const [subType, setSubType] = useState('حصة واحدة');
  const [startDate, setStartDate] = useState(getTodayDate());
  const [paid, setPaid] = useState('');
  const settings = getSettings(players);
  const analysisOf = (p: Player) => analyzePlayer(p, settings);
  const placeSuggestions = usePlaceSuggestions(players, expectedAttendees);

  const [cost, setCost] = useState(() => suggestGymCost(settings, 'حصة واحدة', 0));
  const [costTouched, setCostTouched] = useState(false); // coach typed the gym money himself
  const [endMode, setEndMode] = useState<EndMode>('sessions');
  const [place, setPlace] = useState(DEFAULT_PLACE);
  // Full renewal that starts at the first extra session (their gym money is deducted)
  const [absorbed, setAbsorbed] = useState<{ date: string; gym: number }[]>([]);
  const absorbedGym = absorbed.reduce((sum, x) => sum + x.gym, 0);
  const [editingMode, setEditingMode] = useState<string | null>(null); // PlayerId if editing current active sub

  // Payment choice dialog (full renewal / pay extras only)
  const [payDialogPlayerId, setPayDialogPlayerId] = useState<string | null>(null);
  const [extrasAmount, setExtrasAmount] = useState('');

  useEffect(() => {
    if (payRequestPlayerId) {
      setExtrasAmount('');
      setPayDialogPlayerId(payRequestPlayerId);
      onPayRequestHandled?.();
    }
  }, [payRequestPlayerId]);

  // Custom attendance date state per player
  const [attDates, setAttDates] = useState<{ [playerId: string]: string }>({});

  // Searchable player dropdown states
  const [playerSearch, setPlayerSearch] = useState('');
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Expected Today form states
  const [expName, setExpName] = useState('');
  const [selectedExpPlayerId, setSelectedExpPlayerId] = useState('');
  const [showDailyArchive, setShowDailyArchive] = useState(false);
  const [expGroup, setExpGroup] = useState('');
  const [expPaid, setExpPaid] = useState('');
  const [expSubType, setExpSubType] = useState('حصة واحدة');
  const [expTime, setExpTime] = useState('');
  const [expCost, setExpCost] = useState(() => suggestGymCost(settings, 'حصة واحدة', 0));
  const [expCostTouched, setExpCostTouched] = useState(false);
  const [expEndMode, setExpEndMode] = useState<EndMode>('sessions');
  const [expPlace, setExpPlace] = useState(DEFAULT_PLACE);
  const [showExpDropdown, setShowExpDropdown] = useState(false);
  const expDropdownRef = useRef<HTMLDivElement>(null);

  // Inline expected attendee editing states
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [editingExpTime, setEditingExpTime] = useState('');
  const [editingExpGroup, setEditingExpGroup] = useState('');
  const [editingExpPaid, setEditingExpPaid] = useState('');
  const [editingExpSubType, setEditingExpSubType] = useState('');
  const [editingExpCost, setEditingExpCost] = useState('');

  // Handle clicking outside the searchable dropdowns to close them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPlayerDropdown(false);
      }
      if (expDropdownRef.current && !expDropdownRef.current.contains(event.target as Node)) {
        setShowExpDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync playerSearch when selectedPlayerId changes
  useEffect(() => {
    if (selectedPlayerId) {
      const player = players.find(p => p.id === selectedPlayerId);
      if (player) {
        setPlayerSearch(`[#${player.number || '000'}] ${player.name}`);
      }
    } else {
      setPlayerSearch('');
    }
  }, [selectedPlayerId, players]);

  // Suggested gym/place money (rules live in the settings). The coach can override it.
  const gymRateNow = suggestGymCost(settings, SINGLE_SESSION, 0);
  useEffect(() => {
    if (costTouched) return;
    const suggested = suggestGymCost(settings, subType, parseFloat(paid) || 0, startDate || getTodayDate());
    setCost(Math.max(0, suggested - absorbedGym));
  }, [subType, paid, absorbedGym, costTouched, gymRateNow, JSON.stringify(settings.discountTiers), settings.discountThreshold]);

  useEffect(() => {
    if (expCostTouched) return;
    setExpCost(suggestGymCost(settings, expSubType, parseFloat(expPaid) || 0));
  }, [expSubType, expPaid, expCostTouched, gymRateNow, JSON.stringify(settings.discountTiers), settings.discountThreshold]);

  // Pre-fill if a player is selected via Roster "+ دفع" or if we are editing
  useEffect(() => {
    if (selectedPlayerId) {
      const player = players.find(p => p.id === selectedPlayerId);
      if (player && player.subType && editingMode === player.id) {
        const current = analysisOf(player).currentSub;
        setSubType(player.subType);
        setStartDate(player.startDate || getTodayDate());
        setPaid(player.paid ? String(player.paid) : '');
        setCost(player.cost ? player.cost : 0);
        setCostTouched(true); // keep the saved number while editing
        setEndMode(player.endMode || current?.endMode || 'sessions');
        setPlace(current?.place || DEFAULT_PLACE);
        setAbsorbed([]);
      } else if (absorbed.length === 0) {
        // Just standard "+ دفع" from roster card
        setStartDate(getTodayDate());
        setPaid('');
        setSubType('حصة واحدة');
      }
    }
  }, [selectedPlayerId, editingMode]);

  const handleSubmitSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerId) {
      alert("الرجاء اختيار لاعب أولاً!");
      return;
    }

    await onSaveSubscription(selectedPlayerId, {
      subType,
      startDate: startDate || getTodayDate(),
      paid: parseFloat(paid) || 0,
      cost: cost,
      endMode: isPackageType(subType) ? endMode : undefined,
      place,
      absorbedExtras: editingMode ? undefined : absorbed,
    }, !!editingMode);

    // Reset Form
    setSelectedPlayerId('');
    setPaid('');
    setSubType('حصة واحدة');
    setEditingMode(null);
    setCostTouched(false);
    setEndMode('sessions');
    setPlace(DEFAULT_PLACE);
    setAbsorbed([]);
  };

  const handleEditSubscription = (player: Player) => {
    setSelectedPlayerId(player.id);
    setEditingMode(player.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRenewSubscription = (player: Player) => {
    // If the player has unpaid extra sessions, ask how he pays first
    if (analysisOf(player).balance.extraCount > 0) {
      setExtrasAmount('');
      setPayDialogPlayerId(player.id);
      return;
    }
    startNormalRenewal(player);
  };

  const startNormalRenewal = (player: Player) => {
    setSelectedPlayerId(player.id);
    setEditingMode(null);
    setStartDate(getTodayDate());
    setPaid('');
    setSubType(player.subType || '8 حصص');
    setEndMode(player.endMode || 'sessions');
    setPlace(analysisOf(player).currentSub?.place || DEFAULT_PLACE);
    setCostTouched(false);
    setAbsorbed([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // (1) Full renewal: the extra sessions become the first sessions of the new package.
  const startFullRenewalWithExtras = (player: Player) => {
    const a = analysisOf(player);
    const extras = a.balance.extraDates.map(d => ({ date: d, gym: a.attendance.get(d)?.charge ?? 0 }));
    setSelectedPlayerId(player.id);
    setEditingMode(null);
    setStartDate(a.balance.oldestDate || getTodayDate());
    setPaid('');
    setSubType(isPackageType(player.subType) ? player.subType! : '8 حصص');
    setEndMode(player.endMode || 'sessions');
    setPlace(a.currentSub?.place || DEFAULT_PLACE);
    setCostTouched(false);
    setAbsorbed(extras);
    setPayDialogPlayerId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCustomAttendanceChange = (playerId: string, dateStr: string) => {
    setAttDates(prev => ({ ...prev, [playerId]: dateStr }));
  };

  // Attendance statistics from the shared engine
  const getAttendanceStats = (player: Player) => {
    const st = analysisOf(player).status;
    const maxSessions = st.totalSessions;
    const activeAttendances = st.attendedInSub;
    const percentage = maxSessions > 0 ? (st.usedSessions / maxSessions) * 100 : 0;
    return {
      activeAttendances,
      maxSessions,
      extraSessions: st.extraSessions,
      percentage: Math.min(percentage, 100),
    };
  };

  // Filter players with active subscriptions
  const filteredSubscribers = players.filter(p => {
    if (!p || p.isSystem || p.isDeleted) return false;
    
    const nameNumStr = (p.name || '').toLowerCase() + (p.number ? p.number.toString() : '');
    const matchesSearch = nameNumStr.includes(searchQuery.toLowerCase());
    
    const pGroup = p.sport || 'العام';
    const matchesGroup = groupFilter === 'All' || pGroup === groupFilter;
    
    let matchesDate = true;
    if (dateFilter) {
      const hasHist = p.history && p.history.some(h => h.date === dateFilter);
      const hasAtt = p.attendance && p.attendance.includes(dateFilter);
      matchesDate = !!(hasHist || hasAtt);
    }
    
    return matchesSearch && matchesGroup && matchesDate;
  });

  const monthlySubscribers = filteredSubscribers.filter(p => p.subType && p.subType !== 'حصة واحدة');
  const dailySubscribers = filteredSubscribers.filter(p => p.subType === 'حصة واحدة');

  // Subscription alerts, split in three groups (shared engine, no money logic here)
  const inactiveAfterDays = settings.inactiveAfterDays ?? DEFAULT_INACTIVE_DAYS;
  const todayStr = getTodayDate();
  const lastActivity = (p: Player): string => {
    const a = analysisOf(p);
    const dates = [
      a.status.endDate || '',
      ...(p.attendance || []),
      ...(p.history || []).map(h => h.date),
    ].filter(Boolean).sort();
    return dates[dates.length - 1] || '';
  };
  const activePlayers = players.filter(p => !p.isSystem && !p.isDeleted);

  // (2) "حضر زيادة وعليه فلوس": anyone with unpaid extra sessions, oldest first
  const playersWithExtras = activePlayers
    .filter(p => analysisOf(p).balance.extraCount > 0)
    .sort((a, b) => (analysisOf(a).balance.oldestDate || '').localeCompare(analysisOf(b).balance.oldestDate || ''));
  const outstandingGym = playersWithExtras.reduce((sum, p) => sum + analysisOf(p).balance.gymAdvanced, 0);

  // Ended packages without extras: (1) needs renewal (recent) or (3) inactive (old)
  const endedNoExtras = activePlayers
    .filter(p => {
      const a = analysisOf(p);
      return a.status.hasSubscription && !a.status.isSingle && a.status.isExpired && a.balance.extraCount === 0;
    })
    .map(p => ({ player: p, idle: Math.max(0, diffDays(lastActivity(p), todayStr)) }));
  const needsRenewal = endedNoExtras.filter(x => x.idle <= inactiveAfterDays).sort((a, b) => a.idle - b.idle);
  const inactivePlayers = endedNoExtras.filter(x => x.idle > inactiveAfterDays).sort((a, b) => a.idle - b.idle);
  const alertBadgeCount = needsRenewal.length + playersWithExtras.length;
  const [showInactive, setShowInactive] = useState(false);

  const getTodaySessionNumberText = (player: Player) => {
    const info = analysisOf(player).attendance.get(getTodayDate());
    if (!info || info.kind === 'single') return 'حصة فردية اليوم';
    if (info.kind === 'extra') return 'حصة زيادة ⚠️';
    return `الحصة رقم ${info.sessionNumber} من ${analysisOf(player).status.totalSessions || '-'}`;
  };

  const payDialogPlayer = payDialogPlayerId ? players.find(p => p.id === payDialogPlayerId) : undefined;

  const filteredAttendedToday = players.filter(p => {
    if (!p || p.isSystem || p.isDeleted) return false;
    
    // Attended today check
    const attToday = p.attendance && p.attendance.includes(getTodayDate());
    if (!attToday) return false;

    // Search query matching
    const nameNumStr = (p.name || '').toLowerCase() + (p.number ? p.number.toString() : '');
    const matchesSearch = nameNumStr.includes(searchQuery.toLowerCase());
    
    // Group filtering
    const pGroup = p.sport || 'العام';
    const matchesGroup = groupFilter === 'All' || pGroup === groupFilter;

    return matchesSearch && matchesGroup;
  });

  const getHourlySummary = () => {
    const counts: { [hour: string]: number } = {};
    const activeExpected = expectedAttendees.filter(att => !att.isDeleted);
    activeExpected.forEach(att => {
      if (att.time) {
        const hourStr = att.time.split(':')[0]; // e.g. "17"
        const hourNum = parseInt(hourStr);
        const ampm = hourNum >= 12 ? 'م' : 'ص';
        const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
        const displayHour = `${hour12}:00 ${ampm}`;
        counts[displayHour] = (counts[displayHour] || 0) + 1;
      } else {
        counts['غير محدد'] = (counts['غير محدد'] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([hour, count]) => `${count} لاعبين (${hour})`)
      .join(' | ');
  };

  const sortedExpected = expectedAttendees
    .filter(att => !att.isDeleted)
    .sort((a, b) => {
      const timeA = a.time || '23:59';
      const timeB = b.time || '23:59';
      return timeA.localeCompare(timeB);
    });

  // Payment reminder from the editable template (no player price in it)
  const getWhatsAppLink = (player: Player) => whatsAppLink(player.phone, buildReminderMessage(player, settings));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Alerts, Expected, Payment Forms (col-span-5) */}
      <div className="lg:col-span-5 space-y-6 lg:order-1">
      {/* 1. Subscription alerts (three groups) */}
      <div className="card-bg rounded-lg p-4 border border-danger/30 relative overflow-hidden">
        <h3 className="text-sm font-bold text-danger mb-3 flex items-center gap-1.5 glow-text">
          ⚠️ تنبيهات الاشتراكات
          <span className="bg-danger text-white text-[10px] font-black px-2 py-0.5 rounded-full">{alertBadgeCount}</span>
        </h3>

        {/* (1) Needs renewal */}
        <div className="mb-3">
          <div className="text-xs font-black text-danger mb-1.5">
            🔁 محتاج يجدد ({needsRenewal.length})
            <span className="text-muted font-normal mr-1">خلص من {inactiveAfterDays} يوم أو أقل ومحضرش بعدها</span>
          </div>
          {needsRenewal.length === 0 ? (
            <div className="text-[11px] text-muted">مفيش ✅</div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {needsRenewal.map(({ player: p }) => {
                const st = analysisOf(p).status;
                const waLink = getWhatsAppLink(p);
                return (
                  <div key={p.id} className="input-bg rounded p-2 flex justify-between items-center border border-danger/10 text-xs gap-2">
                    <div className="text-right">
                      <span className="font-bold text-main block">[#{p.number || '000'}] {p.name}</span>
                      <span className="text-danger text-[10px] font-semibold">
                        {st.endMode === 'sessions' ? 'خلصت حصصه' : 'خلص'} من {st.days} أيام ({p.subType})
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {waLink && (
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                          className="bg-danger/20 text-danger px-2 py-1.5 rounded border border-danger/30 font-bold whitespace-nowrap">
                          تذكير 💬
                        </a>
                      )}
                      <button onClick={() => startNormalRenewal(p)}
                        className="bg-success/20 text-success px-2 py-1.5 rounded border border-success/30 font-bold whitespace-nowrap">
                        تجديد ♻️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* (2) Extra sessions with money owed (the coach paid the gym for them) */}
        <div className="mb-3 border-t border-theme/40 pt-3">
          <div className="text-xs font-black text-amber-400 mb-1">💸 حضر زيادة وعليه فلوس ({playersWithExtras.length})</div>
          <div className="text-[11px] text-muted mb-1.5">
            الفلوس اللي برّه: دفعت للجيم بدالهم <b className="text-amber-400">{outstandingGym} ج</b> ولسه مرجعتش
          </div>
          {playersWithExtras.length === 0 ? (
            <div className="text-[11px] text-muted">مفيش حصص زيادة متأخرة ✅</div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {playersWithExtras.map(p => {
                const b = analysisOf(p).balance;
                const waLink = getWhatsAppLink(p);
                return (
                  <div key={p.id} className="input-bg rounded p-2 flex justify-between items-center border border-amber-500/20 text-xs gap-2">
                    <div className="text-right">
                      <span className="font-bold text-main block">[#{p.number || '000'}] {p.name}</span>
                      <span className="text-amber-400 text-[10px] font-bold">
                        {b.extraCount} حصص زيادة · من {formatDate(b.oldestDate || '')} · دفعت للجيم {b.gymAdvanced} ج
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {waLink && (
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                          className="bg-amber-500/10 text-amber-400 px-2 py-1.5 rounded border border-amber-500/30 font-bold whitespace-nowrap">
                          💬
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setExtrasAmount('');
                          setPayDialogPlayerId(p.id);
                        }}
                        className="bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-1.5 rounded font-bold whitespace-nowrap"
                      >
                        دفع 💰
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* (3) Inactive: collapsed by default */}
        <div className="border-t border-theme/40 pt-3">
          <button
            type="button"
            onClick={() => setShowInactive(v => !v)}
            className="w-full flex justify-between items-center text-xs font-black text-muted"
          >
            <span>💤 مش نشط ({inactivePlayers.length}) <span className="font-normal">أكتر من {inactiveAfterDays} يوم من غير حضور</span></span>
            <span>{showInactive ? 'إخفاء ▲' : 'عرض ▼'}</span>
          </button>
          {showInactive && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {inactivePlayers.length === 0 ? (
                <div className="text-[11px] text-muted">مفيش</div>
              ) : (
                inactivePlayers.map(({ player: p, idle }) => {
                  const waLink = getWhatsAppLink(p);
                  return (
                    <div key={p.id} className="input-bg rounded p-2 flex justify-between items-center border border-theme text-xs gap-2 opacity-80">
                      <div className="text-right">
                        <span className="font-bold text-main block">[#{p.number || '000'}] {p.name}</span>
                        <span className="text-muted text-[10px]">آخر نشاط من {idle} يوم ({p.subType})</span>
                      </div>
                      {waLink && (
                        <a href={waLink} target="_blank" rel="noopener noreferrer"
                          className="input-bg text-muted px-2 py-1.5 rounded border border-theme font-bold whitespace-nowrap">
                          تذكير 💬
                        </a>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {payDialogPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="card-bg rounded-lg p-5 w-full max-w-sm border border-theme text-right">
            <h3 className="text-lg font-bold text-primary mb-1">دفع: {payDialogPlayer.name}</h3>
            <p className="text-xs text-amber-400 font-bold mb-4">
              حضر {analysisOf(payDialogPlayer).balance.extraCount} حصص زيادة · دفعت للجيم بداله {analysisOf(payDialogPlayer).balance.gymAdvanced} ج
            </p>

            <button
              onClick={() => startFullRenewalWithExtras(payDialogPlayer)}
              className="w-full btn-primary font-bold rounded-md px-4 py-3 mb-1"
            >
              ♻️ تجديد اشتراك كامل
            </button>
            <p className="text-[10px] text-muted mb-4 leading-relaxed">
              الحصص الزيادة بتتحسب من الباقة الجديدة (البداية = أول حصة زيادة)، وفلوس الجيم بتاعتها بتتخصم من تكلفة الباقة.
            </p>

            <div className="border-t border-theme pt-3">
              <label className="text-xs text-muted font-bold block mb-1">دفع الحصص الزيادة بس — المبلغ اللي دفعه (ج)</label>
              <input
                type="number"
                value={extrasAmount}
                onChange={(e) => setExtrasAmount(e.target.value)}
                placeholder="اكتب المبلغ"
                className="w-full input-bg rounded-md px-3 py-2 text-sm border border-theme mb-2"
              />
              <button
                disabled={extrasAmount === '' || isNaN(parseFloat(extrasAmount))}
                onClick={async () => {
                  const b = analysisOf(payDialogPlayer).balance;
                  await onPayExtras(payDialogPlayer.id, parseFloat(extrasAmount) || 0, b.extraDates, analysisOf(payDialogPlayer).currentSub?.place);
                  setPayDialogPlayerId(null);
                  setExtrasAmount('');
                }}
                className="w-full bg-amber-500 text-white font-bold rounded-md px-4 py-2 disabled:opacity-40"
              >
                💰 دفع الحصص الزيادة بس
              </button>
            </div>

            <div className="flex gap-2 mt-3">
              {payDialogPlayer.subType && (
                <button
                  onClick={() => {
                    setPayDialogPlayerId(null);
                    startNormalRenewal(payDialogPlayer);
                  }}
                  className="w-1/2 input-bg font-bold rounded-md px-3 py-2 text-xs border border-theme"
                >
                  تجديد من النهارده
                </button>
              )}
              <button
                onClick={() => setPayDialogPlayerId(null)}
                className={`${payDialogPlayer.subType ? 'w-1/2' : 'w-full'} input-bg font-bold rounded-md px-3 py-2 text-xs border border-theme`}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Expected Today Panel */}
      <div className="card-bg rounded-lg p-5 border-t-2 border-primary relative">
        <h2 className="text-lg font-bold text-primary mb-3 flex items-center gap-1.5 glow-text pr-2">
          📋 المتوقع حضورهم اليوم ({expectedAttendees.length})
        </h2>
        <p className="text-xs text-muted mb-2 leading-relaxed pr-2">
          سجل اللاعبين المتوقع حضورهم اليوم لتسجيلهم الفعلي كلاعبين وتفعيل الدفع وتأكيد الحضور بضغطة واحدة.
        </p>

        {/* Hourly summary displays here if expected attendees exist */}
        {expectedAttendees.length > 0 && (
          <div className="text-[10px] sm:text-xs text-primary-light font-semibold bg-primary-glow/10 border border-theme/40 rounded px-3 py-2 text-center mb-4 dir-rtl leading-relaxed">
            📢 {getHourlySummary()}
          </div>
        )}

        {/* Expected Today Form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!expName.trim()) {
              alert("الرجاء اختيار لاعب من القائمة!");
              return;
            }

            // Enforce choosing a registered player
            const match = players.find(
              p => !p.isSystem && !p.isDeleted && (p.id === selectedExpPlayerId || p.name.trim().toLowerCase() === expName.trim().toLowerCase())
            );

            if (!match) {
              alert("⚠️ لا يمكن إضافة اسم غير مسجل! الرجاء كتابة اسم لاعب مسجل واختياره من القائمة بالقاعدة.");
              return;
            }

            await onAddExpectedAttendee({
              name: match.name,
              playerId: match.id,
              sport: expGroup.trim() || match.sport || 'العام',
              paid: parseFloat(expPaid) || 0,
              subType: expSubType,
              date: getTodayDate(),
              time: expTime,
              cost: ATTEND_ONLY_TYPES.includes(expSubType) ? undefined : expCost,
              endMode: isPackageType(expSubType) ? expEndMode : undefined,
              place: expPlace.trim() || DEFAULT_PLACE,
            });
            setExpName('');
            setSelectedExpPlayerId('');
            setExpPaid('');
            setExpGroup('');
            setExpTime('');
            setExpCostTouched(false);
            setExpEndMode('sessions');
            setExpPlace(DEFAULT_PLACE);
          }}
          className="space-y-3 border-b border-theme/30 pb-4 mb-4"
        >
          {/* Searchable Dropdown for Expected Player Name */}
          <div className="relative w-full text-right" ref={expDropdownRef}>
            <input
              type="text"
              value={expName}
              onFocus={() => setShowExpDropdown(true)}
              onChange={(e) => {
                setExpName(e.target.value);
                setShowExpDropdown(true);
                const match = players.find(p => !p.isSystem && !p.isDeleted && p.name === e.target.value);
                if (match) {
                  setSelectedExpPlayerId(match.id);
                  setExpGroup(match.sport || 'العام');
                  if (match.subType && match.subType !== 'حصة واحدة') {
                    setExpSubType('حضور فقط (مشترك شهرياً)');
                    setExpPaid('');
                  } else {
                    setExpSubType('حصة واحدة');
                  }
                } else {
                  setSelectedExpPlayerId('');
                }
              }}
              placeholder="🔍 ابحث عن اسم اللاعب بالقاعدة لاختياره..."
              className="w-full input-bg rounded-md px-3 py-2 text-sm border border-theme text-right"
              dir="rtl"
            />
            {showExpDropdown && (
              <div className="absolute z-50 w-full max-h-48 overflow-y-auto input-bg border border-theme rounded-md shadow-lg mt-1 pr-1">
                {players
                  .filter(p => !p.isSystem && !p.isDeleted)
                  .filter(p => {
                    const searchStr = `${p.name} ${p.number || ''}`.toLowerCase();
                    const typedText = expName.trim().toLowerCase();
                    return searchStr.includes(typedText);
                  })
                  .map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setExpName(p.name);
                        setSelectedExpPlayerId(p.id);
                        setExpGroup(p.sport || 'العام');
                        if (p.subType && p.subType !== 'حصة واحدة') {
                          setExpSubType('حضور فقط (مشترك شهرياً)');
                          setExpPaid('');
                        } else {
                          setExpSubType('حصة واحدة');
                        }
                        setShowExpDropdown(false);
                      }}
                      className="cursor-pointer px-4 py-2 hover:bg-primary-glow/20 transition-all text-right text-xs border-b border-theme/20 last:border-0"
                    >
                      <span className="text-primary-light font-bold">[#{p.number || '---'}]</span>{' '}
                      <span className="text-main">{p.name}</span>
                      {p.sport && <span className="text-muted text-[10px] mr-2">({p.sport})</span>}
                    </div>
                  ))}
                {players.filter(p => !p.isSystem && !p.isDeleted).filter(p => {
                  const searchStr = `${p.name} ${p.number || ''}`.toLowerCase();
                  const typedText = expName.trim().toLowerCase();
                  return searchStr.includes(typedText);
                }).length === 0 && (
                  <div className="text-muted text-xs text-center py-3">لا يوجد لاعب مطابق بالقاعدة.</div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={expGroup}
              onChange={(e) => setExpGroup(e.target.value)}
              placeholder="الجروب (اكتب أو اختر)"
              list="expGroupSuggestions"
              className="w-full input-bg rounded-md px-3 py-2 text-sm border border-theme text-right"
            />
            <datalist id="expGroupSuggestions">
              {allGroups.map((g, idx) => (
                <option key={idx} value={g} />
              ))}
            </datalist>

            <select
              value={expSubType}
              onChange={(e) => setExpSubType(e.target.value)}
              className="w-full input-bg rounded-md px-3 py-2 text-sm border border-theme"
            >
              <option value="حضور فقط (مشترك شهرياً)">حضور فقط (مشترك شهرياً)</option>
              <option value="حصة واحدة">حصة واحدة (دفع يومي)</option>
              <option value="8 حصص">8 حصص في الشهر</option>
              <option value="10 حصص">10 حصص في الشهر</option>
              <option value="12 حصة">12 حصة في الشهر</option>
              <option value="16 حصة">16 حصة في الشهر</option>
              <option value="20 حصة">20 حصة في الشهر</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="time"
              value={expTime}
              onChange={(e) => setExpTime(e.target.value)}
              className="w-full input-bg rounded-md px-3 py-2 text-sm border border-theme text-right text-muted"
            />
            <input
              type="number"
              value={expPaid}
              onChange={(e) => setExpPaid(e.target.value)}
              placeholder="سيدفع كام؟"
              className="w-full input-bg rounded-md px-3 py-2 text-sm border border-theme text-right"
            />
          </div>

          {isPackageType(expSubType) && (
            <EndModePicker value={expEndMode} onChange={setExpEndMode} />
          )}

          {!ATTEND_ONLY_TYPES.includes(expSubType) && (
            <div className="grid grid-cols-2 gap-2">
              <GymCostField
                value={expCost}
                onChange={(v) => {
                  setExpCost(v);
                  setExpCostTouched(true);
                }}
                onReset={() => setExpCostTouched(false)}
                touched={expCostTouched}
                compact
              />
              <PlaceField value={expPlace} onChange={setExpPlace} suggestions={placeSuggestions} listId="expPlaceList" compact />
            </div>
          )}

          <button
            type="submit"
            className="w-full btn-primary font-bold rounded-md text-xs py-3 shadow-md active:scale-95 transition-all"
          >
            + إضافة لقائمة المتوقع اليوم
          </button>
        </form>

        {/* Expected Today List */}
        <div className="max-h-60 overflow-y-auto pr-1 space-y-3">
          {expectedAttendees.length === 0 ? (
            <div className="text-xs text-muted text-center py-4 border border-dashed border-theme rounded">
              لا يوجد لاعبين متوقع حضورهم مسجلين اليوم.
            </div>
          ) : (
            sortedExpected.map(att => {
              const displayTime = (() => {
                if (!att.time) return '';
                const [hStr, mStr] = att.time.split(':');
                const hourNum = parseInt(hStr, 10);
                const ampm = hourNum >= 12 ? 'م' : 'ص';
                const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
                return `${hour12}:${mStr || '00'} ${ampm}`;
              })();

              const isEditing = editingExpId === att.id;

              return (
                <div
                  key={att.id}
                  className="input-bg rounded-lg p-3 border border-theme/60 flex flex-col gap-2 shadow-sm"
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="border-b border-theme/20 pb-2 flex justify-between items-center">
                        <span className="font-bold text-primary-light text-sm">{att.name} (تعديل)</span>
                        <span className="text-[10px] text-muted">{att.date}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[9px] text-muted block mb-0.5">موعد الحضور</label>
                          <input
                            type="time"
                            value={editingExpTime}
                            onChange={(e) => setEditingExpTime(e.target.value)}
                            className="w-full input-bg rounded px-2 py-1 border border-theme text-muted text-xs text-right"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted block mb-0.5">الجروب</label>
                          <input
                            type="text"
                            value={editingExpGroup}
                            onChange={(e) => setEditingExpGroup(e.target.value)}
                            className="w-full input-bg rounded px-2 py-1 border border-theme text-xs text-right"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[9px] text-muted block mb-0.5">نوع الاشتراك</label>
                          <select
                            value={editingExpSubType}
                            onChange={(e) => setEditingExpSubType(e.target.value)}
                            className="w-full input-bg rounded px-2 py-1 border border-theme text-xs"
                          >
                            <option value="حضور فقط (مشترك شهرياً)">حضور فقط (مشترك شهرياً)</option>
                            <option value="حصة واحدة">حصة واحدة (دفع يومي)</option>
                            <option value="8 حصص">8 حصص في الشهر</option>
                            <option value="10 حصص">10 حصص في الشهر</option>
                            <option value="12 حصة">12 حصة في الشهر</option>
                            <option value="16 حصة">16 حصة في الشهر</option>
                            <option value="20 حصة">20 حصة في الشهر</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] text-muted block mb-0.5">سيدفع</label>
                          <input
                            type="number"
                            value={editingExpPaid}
                            onChange={(e) => setEditingExpPaid(e.target.value)}
                            className="w-full input-bg rounded px-2 py-1 border border-theme text-xs text-right"
                          />
                        </div>
                      </div>

                      {!ATTEND_ONLY_TYPES.includes(editingExpSubType) && (
                        <div className="text-xs">
                          <label className="text-[9px] text-muted block mb-0.5">للجيم / المكان (ج)</label>
                          <input
                            type="number"
                            value={editingExpCost}
                            onChange={(e) => setEditingExpCost(e.target.value)}
                            className="w-full input-bg rounded px-2 py-1 border border-theme text-xs text-right"
                          />
                        </div>
                      )}

                      <div className="flex gap-2 pt-1 border-t border-theme/20">
                        <button
                          onClick={async () => {
                            await onSaveExpectedAttendee({
                              ...att,
                              time: editingExpTime,
                              sport: editingExpGroup,
                              paid: parseFloat(editingExpPaid) || 0,
                              subType: editingExpSubType,
                              cost: ATTEND_ONLY_TYPES.includes(editingExpSubType)
                                ? undefined
                                : (editingExpCost === ''
                                    ? suggestGymCost(settings, editingExpSubType, parseFloat(editingExpPaid) || 0)
                                    : parseFloat(editingExpCost) || 0),
                            });
                            setEditingExpId(null);
                          }}
                          className="w-1/2 bg-success text-white text-[11px] font-bold py-1.5 rounded hover:opacity-90 active:scale-95 transition-all border border-success/30 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                        >
                          حفظ التعديلات ✅
                        </button>
                        <button
                          onClick={() => setEditingExpId(null)}
                          className="w-1/2 bg-zinc-500/20 text-zinc-300 text-[11px] font-semibold py-1.5 rounded hover:bg-zinc-500 hover:text-white active:scale-95 transition-all border border-zinc-500/30"
                        >
                          إلغاء ✖️
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center border-b border-theme/20 pb-2">
                        <span className="font-bold text-primary-light text-sm">{att.name}</span>
                        <div className="flex gap-2 items-center">
                          {att.time && (
                            <span className="text-[10px] text-primary-light font-bold bg-primary-glow/20 px-2 py-0.5 rounded">
                              🕒 {displayTime}
                            </span>
                          )}
                          <span className="text-[10px] text-muted">{att.date}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <span className="text-muted block text-[10px]">الجروب</span>
                          <span className="text-main font-semibold">{att.sport}</span>
                        </div>
                        <div>
                          <span className="text-muted block text-[10px]">الاشتراك</span>
                          <span className="text-primary font-semibold">{att.subType}</span>
                        </div>
                        <div>
                          <span className="text-muted block text-[10px]">سيدفع</span>
                          <span className="text-success font-bold">{att.paid} ج</span>
                        </div>
                        {!ATTEND_ONLY_TYPES.includes(att.subType) && (
                          <div>
                            <span className="text-muted block text-[10px]">للجيم</span>
                            <span className="text-danger font-bold">
                              {typeof att.cost === 'number' ? att.cost : suggestGymCost(settings, att.subType, att.paid || 0)} ج
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => onApplyExpectedAttendee(att)}
                          className="w-1/3 bg-success text-white text-[10px] font-bold py-1.5 rounded hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-0.5 border border-success/30 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                        >
                          <span>تسجيل 🟢</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingExpId(att.id);
                            setEditingExpTime(att.time || '');
                            setEditingExpGroup(att.sport || '');
                            setEditingExpPaid(String(att.paid || 0));
                            setEditingExpSubType(att.subType || 'حصة واحدة');
                            setEditingExpCost(typeof att.cost === 'number' ? String(att.cost) : '');
                          }}
                          className="w-1/3 bg-primary/20 text-primary-light text-[10px] font-bold py-1.5 rounded hover:bg-primary hover:text-white active:scale-95 transition-all border border-primary/30"
                        >
                          تعديل ✏️
                        </button>
                        <button
                          onClick={() => att.id !== undefined && onDeleteExpectedAttendee(att.id)}
                          className="w-1/3 bg-danger/10 text-danger text-[10px] font-semibold py-1.5 rounded hover:bg-danger hover:text-white active:scale-95 transition-all border border-danger/20"
                        >
                          إلغاء 🗑️
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Payment / Sub Form */}
      <div className="card-bg rounded-lg p-5 mb-6 border-t-2 border-theme">
        <h2 className="text-lg font-bold text-primary mb-4 flex items-center">
          <svg className="w-5 h-5 ml-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          {editingMode ? 'تعديل الاشتراك والدفع الحالي' : 'تسجيل اشتراك ودفع'}
        </h2>
        <form onSubmit={handleSubmitSub} className="space-y-3">
          {/* Searchable Dropdown for Player Selection */}
          <div className="relative w-full text-right" ref={dropdownRef}>
            <input
              type="text"
              value={playerSearch}
              onFocus={() => setShowPlayerDropdown(true)}
              onChange={(e) => {
                setPlayerSearch(e.target.value);
                setShowPlayerDropdown(true);
                // Clear selected player if they type something custom, to prevent saving with wrong ID
                const match = players.find(
                  p => !p.isDeleted && `[#${p.number || '000'}] ${p.name}` === e.target.value
                );
                if (match) {
                  setSelectedPlayerId(match.id);
                } else {
                  setSelectedPlayerId('');
                }
              }}
              placeholder="🔍 ابحث عن اللاعب بالاسم أو الرقم لاختياره..."
              className="w-full input-bg rounded-md px-4 py-3 text-right text-sm"
              dir="rtl"
            />
            {showPlayerDropdown && (
              <div className="absolute z-50 w-full max-h-48 overflow-y-auto input-bg border border-theme rounded-md shadow-lg mt-1 pr-1">
                {players
                  .filter(p => !p.isSystem && !p.isDeleted)
                  .filter(p => {
                    const searchStr = `${p.name} ${p.number || ''}`.toLowerCase();
                    // If user typed some search keyword, filter by it. Otherwise show all.
                    const typedText = playerSearch.includes(']')
                      ? playerSearch.split(']').slice(1).join(' ').trim().toLowerCase()
                      : playerSearch.trim().toLowerCase();
                    return searchStr.includes(typedText);
                  })
                  .map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedPlayerId(p.id);
                        setPlayerSearch(`[#${p.number || '000'}] ${p.name}`);
                        setShowPlayerDropdown(false);
                        setEditingMode(null);
                      }}
                      className="cursor-pointer px-4 py-2 hover:bg-primary-glow/20 transition-all text-right text-sm border-b border-theme/20 last:border-0"
                    >
                      <span className="text-primary-light font-bold">[#{p.number || '---'}]</span>{' '}
                      <span className="text-main">{p.name}</span>
                    </div>
                  ))}
                {players.filter(p => !p.isSystem && !p.isDeleted).filter(p => {
                  const searchStr = `${p.name} ${p.number || ''}`.toLowerCase();
                  const typedText = playerSearch.includes(']')
                    ? playerSearch.split(']').slice(1).join(' ').trim().toLowerCase()
                    : playerSearch.trim().toLowerCase();
                  return searchStr.includes(typedText);
                }).length === 0 && (
                  <div className="text-muted text-xs text-center py-3">لا يوجد لاعب مطابق.</div>
                )}
              </div>
            )}
          </div>

          <select
            value={subType}
            onChange={(e) => setSubType(e.target.value)}
            className="w-full input-bg rounded-md px-4 py-3"
          >
            <option value="حصة واحدة">حصة واحدة (دفع يومي)</option>
            <option value="8 حصص">8 حصص في الشهر</option>
            <option value="10 حصص">10 حصص في الشهر</option>
            <option value="12 حصة">12 حصة في الشهر</option>
            <option value="16 حصة">16 حصة في الشهر</option>
            <option value="20 حصة">20 حصة في الشهر</option>
          </select>

          {isPackageType(subType) && (
            <EndModePicker value={endMode} onChange={setEndMode} />
          )}

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full input-bg rounded-md px-4 py-3"
          />

          {absorbed.length > 0 && (
            <div className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2 leading-relaxed">
              تجديد كامل: الباقة بتبدأ من أول حصة زيادة ({formatDate(absorbed[0].date)}) و{absorbed.length} حصص زيادة اتحسبوا منها.
              اتخصم {absorbedGym} ج من فلوس الجيم لأنك دفعتهم قبل كده.
              <button
                type="button"
                onClick={() => {
                  setAbsorbed([]);
                  setStartDate(getTodayDate());
                }}
                className="block mt-1 text-muted underline"
              >
                إلغاء الخصم والبدء من النهارده
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted font-bold block mb-1">دفع كام؟ (ج)</label>
              <input
                type="number"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
                placeholder="المبلغ"
                className="w-full input-bg rounded-md px-4 py-3"
              />
            </div>
            <GymCostField
              value={cost}
              onChange={(v) => {
                setCost(v);
                setCostTouched(true);
              }}
              onReset={() => setCostTouched(false)}
              touched={costTouched}
            />
          </div>

          <PlaceField value={place} onChange={setPlace} suggestions={placeSuggestions} listId="subPlaceList" />

          <button
            type="submit"
            className="w-full btn-primary font-bold rounded-md px-4 py-3 active:scale-95 transition-all"
          >
            {editingMode ? 'حفظ تعديلات الاشتراك ✏️' : 'تأكيد الدفع (ACCEPT)'}
          </button>
        </form>
      </div>

      </div>

      {/* Right Column: Attendance list, Monthly subs, Collapsible Archive (col-span-7) */}
      <div className="lg:col-span-7 space-y-6 lg:order-2">
        {/* Today's Attendance List */}
        <div className="mb-6">
        <h3 className="text-lg font-bold text-success mb-3 border-b border-theme pb-2 flex items-center gap-1.5 glow-text-success">
          <span>🟢</span> حضور اليوم كله ({filteredAttendedToday.length})
        </h3>
        {filteredAttendedToday.length === 0 ? (
          <div className="text-center text-muted py-6 border border-dashed border-theme rounded-lg bg-black/10">
            لا توجد تسجيلات حضور اليوم تطابق البحث.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredAttendedToday.map(player => {
              const sessionText = getTodaySessionNumberText(player);
              const isMonthly = player.subType && player.subType !== 'حصة واحدة';
              return (
                <div
                  key={player.id}
                  className={`card-bg rounded-lg p-3 relative overflow-hidden border ${
                    isMonthly ? 'border-emerald-500/20 bg-emerald-950/5' : 'border-theme/40'
                  }`}
                >
                  <div
                    className="absolute top-0 right-0 w-1 h-full bg-emerald-500"
                  ></div>
                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <h4 className="font-bold text-emerald-400 text-xs">
                        #{player.number} | {player.name}
                      </h4>
                      <div className="text-[10px] text-muted mt-1 flex gap-1.5">
                        <span className="input-bg border border-theme px-1.5 py-0.5 rounded">
                          {player.sport || 'العام'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded ${isMonthly ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                          {player.subType}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1.5">
                      <span className="text-xs font-bold text-emerald-400">
                        {sessionText}
                      </span>
                      <button
                        onClick={() => onRemoveAttendance(player.id, getTodayDate())}
                        className="text-danger hover:bg-danger/20 px-2 py-1 rounded text-[10px] border border-danger/30 hover:border-danger transition-all whitespace-nowrap"
                      >
                        إلغاء الحضور ❌
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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

      </div>
    </div>
  );
};

const ExtrasBalance: React.FC<{ count: number; gym: number; onPay: () => void }> = ({ count, gym, onPay }) => (
  <div className="mt-3 flex justify-between items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
    <div className="text-[11px] font-bold text-amber-400 leading-relaxed">
      <div>حضر {count} حصص زيادة</div>
      <div>دفعت للجيم بداله: {gym} ج</div>
    </div>
    <button
      onClick={onPay}
      className="bg-amber-500 text-white px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap active:scale-95"
    >
      دفع 💰
    </button>
  </div>
);
