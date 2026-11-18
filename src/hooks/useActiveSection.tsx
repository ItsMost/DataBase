/**
 * All the logic of ActiveSection (state, effects, handlers, derived values).
 * Moved out of the component unchanged; the screen parts read what they need from it.
 */
import React, { useState, useEffect, useRef } from 'react';
import type { Player, ExpectedAttendee, EndMode } from '../types';
import {
  getSettings,
  analyzePlayer,
  suggestGymCost,
  isPackageType,
  SINGLE_SESSION,
  DEFAULT_PLACE,
} from '../lib/subscription';
import { usePlaceSuggestions } from './usePlaceSuggestions';
import { buildReminderMessage, whatsAppLink } from '../lib/messages';
import { diffDays, DEFAULT_INACTIVE_DAYS } from '../lib/subscription';

export interface ActiveSectionProps {
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

export function useActiveSection(props: ActiveSectionProps) {
  const {
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
} = props;

  // Subscription Form states
  const [subType, setSubType] = useState(SINGLE_SESSION);
  const [startDate, setStartDate] = useState(getTodayDate());
  const [paid, setPaid] = useState('');
  const settings = getSettings(players);
  const analysisOf = (p: Player) => analyzePlayer(p, settings);
  const placeSuggestions = usePlaceSuggestions(players, expectedAttendees);

  const [cost, setCost] = useState(() => suggestGymCost(settings, SINGLE_SESSION, 0));
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
      // Form state follows the chosen player / request on purpose (prefill).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExtrasAmount('');
      setPayDialogPlayerId(payRequestPlayerId);
      onPayRequestHandled?.();
    }
    // Runs only when these inputs change; adding the helpers would re-run it and overwrite the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [expSubType, setExpSubType] = useState(SINGLE_SESSION);
  const [expTime, setExpTime] = useState('');
  const [expCost, setExpCost] = useState(() => suggestGymCost(settings, SINGLE_SESSION, 0));
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
          // Form state follows the chosen player / request on purpose (prefill).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPlayerSearch(`[#${player.number || '000'}] ${player.name}`);
      }
    } else {
      setPlayerSearch('');
    }
  }, [selectedPlayerId, players]);

  // Suggested gym/place money (rules live in the settings). The coach can override it.
  const gymRateNow = suggestGymCost(settings, SINGLE_SESSION, 0);
  const discountKey = JSON.stringify(settings.discountTiers) + '|' + settings.discountThreshold;
  useEffect(() => {
    if (costTouched) return;
    const suggested = suggestGymCost(settings, subType, parseFloat(paid) || 0, startDate || getTodayDate());
    // The suggestion refreshes until the coach types his own number.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCost(Math.max(0, suggested - absorbedGym));
    // Runs only when these inputs change; adding the helpers would re-run it and overwrite the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subType, paid, absorbedGym, costTouched, gymRateNow, discountKey]);

  useEffect(() => {
    if (expCostTouched) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpCost(suggestGymCost(settings, expSubType, parseFloat(expPaid) || 0));
    // Runs only when these inputs change; adding the helpers would re-run it and overwrite the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expSubType, expPaid, expCostTouched, gymRateNow, discountKey]);

  // Pre-fill if a player is selected via Roster "+ دفع" or if we are editing
  useEffect(() => {
    if (selectedPlayerId) {
      const player = players.find(p => p.id === selectedPlayerId);
      if (player && player.subType && editingMode === player.id) {
        const current = analysisOf(player).currentSub;
          // Form state follows the chosen player / request on purpose (prefill).
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
        setSubType(SINGLE_SESSION);
      }
    }
    // Runs only when these inputs change; adding the helpers would re-run it and overwrite the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setSubType(SINGLE_SESSION);
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

  const monthlySubscribers = filteredSubscribers.filter(p => p.subType && p.subType !== SINGLE_SESSION);
  const dailySubscribers = filteredSubscribers.filter(p => p.subType === SINGLE_SESSION);

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
      .filter(([, count]) => count > 0)
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

  return {
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
    subType,
    setSubType,
    startDate,
    setStartDate,
    paid,
    setPaid,
    settings,
    analysisOf,
    placeSuggestions,
    cost,
    setCost,
    costTouched,
    setCostTouched,
    endMode,
    setEndMode,
    place,
    setPlace,
    absorbed,
    setAbsorbed,
    absorbedGym,
    editingMode,
    setEditingMode,
    payDialogPlayerId,
    setPayDialogPlayerId,
    extrasAmount,
    setExtrasAmount,
    attDates,
    setAttDates,
    playerSearch,
    setPlayerSearch,
    showPlayerDropdown,
    setShowPlayerDropdown,
    dropdownRef,
    expName,
    setExpName,
    selectedExpPlayerId,
    setSelectedExpPlayerId,
    showDailyArchive,
    setShowDailyArchive,
    expGroup,
    setExpGroup,
    expPaid,
    setExpPaid,
    expSubType,
    setExpSubType,
    expTime,
    setExpTime,
    expCost,
    setExpCost,
    expCostTouched,
    setExpCostTouched,
    expEndMode,
    setExpEndMode,
    expPlace,
    setExpPlace,
    showExpDropdown,
    setShowExpDropdown,
    expDropdownRef,
    editingExpId,
    setEditingExpId,
    editingExpTime,
    setEditingExpTime,
    editingExpGroup,
    setEditingExpGroup,
    editingExpPaid,
    setEditingExpPaid,
    editingExpSubType,
    setEditingExpSubType,
    editingExpCost,
    setEditingExpCost,
    gymRateNow,
    handleSubmitSub,
    handleEditSubscription,
    handleRenewSubscription,
    startNormalRenewal,
    startFullRenewalWithExtras,
    handleCustomAttendanceChange,
    getAttendanceStats,
    filteredSubscribers,
    monthlySubscribers,
    dailySubscribers,
    inactiveAfterDays,
    todayStr,
    lastActivity,
    activePlayers,
    playersWithExtras,
    outstandingGym,
    endedNoExtras,
    needsRenewal,
    inactivePlayers,
    alertBadgeCount,
    showInactive,
    setShowInactive,
    getTodaySessionNumberText,
    payDialogPlayer,
    filteredAttendedToday,
    getHourlySummary,
    sortedExpected,
    getWhatsAppLink,
  };
}

export type ActiveSectionVM = ReturnType<typeof useActiveSection>;
