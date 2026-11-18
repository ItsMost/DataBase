/**
 * Payments, extra sessions, attendance and the "expected today" list.
 * Moved out of App.tsx without changing the logic.
 */
import type {
  Player,
  HistoryEntry,
  ExpectedAttendee,
  EndMode,
} from '../types';
import { db } from '../services/db';
import { syncPlayerToCloud, syncExpectedAttendeeToCloud, deleteExpectedAttendeeFromCloud } from '../services/sync';
import {
  SINGLE_SESSION,
  EXTRA_PAYMENT,
  DEFAULT_PLACE,
  ATTEND_ONLY_TYPES,
  suggestGymCost,
  isPackageType,
  packageStart,
} from '../lib/subscription';
import { ATTEND_ONLY_MONTHLY } from '../lib/constants';
import { localToday } from '../lib/dates';
import type { AppContextValue } from './appContext';

export function useSubscriptions(ctx: AppContextValue) {
  const { players, setPlayers, setExpectedAttendees, triggerToast, appSettings, setReceipt } = ctx;
  const getTodayDate = localToday;

  // Save Subscription Payment details
  const handleSaveSubscription = async (
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
    isEdit = false
  ) => {
    const p = await db.players.get(playerId);
    if (!p) return;

    const history = p.history ? [...p.history] : [];
    const endMode = isPackageType(subData.subType) ? (subData.endMode || 'sessions') : undefined;
    const place = (subData.place || '').trim() || DEFAULT_PLACE;

    // Index of the entry that represents the current subscription (never a "حصص زيادة" payment)
    let editIdx = -1;
    if (isEdit) {
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].subType !== EXTRA_PAYMENT) {
          editIdx = i;
          break;
        }
      }
    }

    if (isEdit && editIdx >= 0) {
      const old = history[editIdx];
      history[editIdx] = {
        ...old,
        // A full renewal keeps its payment day; only the counting start moves
        ...(old.coverFrom ? { coverFrom: subData.startDate } : { date: subData.startDate }),
        subType: subData.subType,
        paid: subData.paid,
        cost: subData.cost,
        desc: subData.subType,
        endMode,
        place,
        // Keep the original timestamp (and any absorbed extras) to preserve order
      };
    } else {
      const absorbing = !!(subData.absorbedExtras && subData.absorbedExtras.length > 0);
      const newHistoryEntry: HistoryEntry = {
        // Full renewal: money is recorded today (this month's report); sessions count from the first extra
        date: absorbing ? getTodayDate() : subData.startDate,
        subType: subData.subType,
        paid: subData.paid,
        cost: subData.cost,
        timestamp: Date.now(),
        desc: subData.subType,
        endMode,
        place,
      };
      if (absorbing) {
        newHistoryEntry.coverFrom = subData.startDate;
        newHistoryEntry.absorbedExtras = subData.absorbedExtras;
      }
      history.push(newHistoryEntry);
    }

    const attendance = p.attendance ? [...p.attendance] : [];
    if (subData.subType === SINGLE_SESSION) {
      if (!attendance.includes(subData.startDate)) {
        attendance.push(subData.startDate);
      }
    }

    const updatedPlayer: Player = {
      ...p,
      subType: subData.subType,
      startDate: subData.startDate,
      paid: subData.paid,
      cost: subData.cost,
      endMode,
      history,
      attendance,
    };

    await syncPlayerToCloud(updatedPlayer);
    const updatedList = await db.players.toArray();
    setPlayers(updatedList);
    triggerToast(isEdit ? "تم تعديل الاشتراك والدفعة بنجاح ✏️" : "تم تسجيل الدفع وتنشيط الاشتراك بنجاح ✅");
    if (!isEdit) {
      setReceipt({ playerId, amount: subData.paid, subType: subData.subType, date: history[history.length - 1].date });
    }
  };

  // Pay only the extra sessions: records a "حصص زيادة" payment and clears the balance.
  // Gym money for those sessions was already counted on the day they were attended, so cost = 0.
  const handlePayExtras = async (playerId: string, amount: number, extraDates: string[], place?: string) => {
    const p = await db.players.get(playerId);
    if (!p || extraDates.length === 0) return;

    const entry: HistoryEntry = {
      date: getTodayDate(),
      subType: EXTRA_PAYMENT,
      desc: `${EXTRA_PAYMENT} (${extraDates.length})`,
      paid: amount,
      cost: 0,
      timestamp: Date.now(),
      settledExtras: [...extraDates],
      place: (place || '').trim() || DEFAULT_PLACE,
    };

    await syncPlayerToCloud({ ...p, history: [...(p.history || []), entry] });
    const updatedList = await db.players.toArray();
    setPlayers(updatedList);
    triggerToast(`تم تسجيل دفع ${extraDates.length} حصص زيادة (${amount} ج) ✅`);
    setReceipt({ playerId, amount, subType: EXTRA_PAYMENT, date: entry.date });
  };

  // Cancel Active Subscription
  const handleCancelSubscription = async (playerId: string) => {
    const p = await db.players.get(playerId);
    if (!p) return;

    const updatedPlayer: Player = {
      ...p,
      subType: '',
      startDate: '',
      paid: 0,
      cost: 0,
    };

    await syncPlayerToCloud(updatedPlayer);
    const updatedList = await db.players.toArray();
    setPlayers(updatedList);
    triggerToast("تم إلغاء الاشتراك بنجاح وتصفير حالة الحصص", true);
  };

  // Attendance Controls
  const handleAddAttendance = async (playerId: string, dateStr: string) => {
    const p = await db.players.get(playerId);
    if (!p) return;

    const attendance = p.attendance ? [...p.attendance] : [];
    if (!attendance.includes(dateStr)) {
      attendance.push(dateStr);
      const updatedPlayer = { ...p, attendance };
      await syncPlayerToCloud(updatedPlayer);
      const updatedList = await db.players.toArray();
      setPlayers(updatedList);
      triggerToast(`تم تسجيل حضور يوم ${dateStr} 🟢`);
    } else {
      triggerToast("هذا اليوم مسجل مسبقاً للحضور!", true);
    }
  };

  const handleRemoveAttendance = async (playerId: string, dateStr: string) => {
    const p = await db.players.get(playerId);
    if (!p || !p.attendance) return;

    const attendance = p.attendance.filter(d => d !== dateStr);
    const updatedPlayer = { ...p, attendance };
    await syncPlayerToCloud(updatedPlayer);
    const updatedList = await db.players.toArray();
    setPlayers(updatedList);
    triggerToast(`تم إلغاء حضور يوم ${dateStr} 🔴`, true);
  };

  const handleDeletePlayerTransaction = async (playerId: string, timestamp: number) => {
    const p = await db.players.get(playerId);
    if (!p || !p.history) return;

    // 1. Filter out the transaction to delete from player history
    const history = p.history.filter(h => h.timestamp !== timestamp);
    
    // 2. Identify the deleted entry to see if we need to revert active subscription info
    const deletedEntry = p.history.find(h => h.timestamp === timestamp);
    
    let subType = p.subType;
    let startDate = p.startDate;
    let paid = p.paid;
    let cost = p.cost;
    let endMode = p.endMode;
    let attendance = p.attendance ? [...p.attendance] : [];

    // If we deleted the active subscription (usually matches current subscription parameters)
    const isCurrentSub = p.subType === deletedEntry?.subType && 
                         p.startDate === (deletedEntry ? packageStart(deletedEntry) : undefined) && 
                         p.paid === deletedEntry?.paid && 
                         p.cost === deletedEntry?.cost;

    const subEntries = history.filter(h => h.subType !== EXTRA_PAYMENT);
    if (isCurrentSub) {
      if (subEntries.length > 0) {
        // Revert to the previous subscription entry (skip "حصص زيادة" payments)
        const prevEntry = subEntries[subEntries.length - 1];
        subType = prevEntry.subType;
        startDate = packageStart(prevEntry);
        paid = prevEntry.paid;
        cost = prevEntry.cost;
        endMode = prevEntry.endMode;
      } else {
        // Reset if no history left
        subType = '';
        startDate = '';
        paid = 0;
        cost = 0;
      }
    }

    // 3. Revert attendance if it was a single session transaction
    if (deletedEntry?.subType === SINGLE_SESSION) {
      attendance = attendance.filter(date => date !== deletedEntry.date);
    }

    const updatedPlayer: Player = {
      ...p,
      subType,
      startDate,
      paid,
      cost,
      endMode,
      history,
      attendance,
      last_updated: Date.now(),
    };

    await syncPlayerToCloud(updatedPlayer);
    const updatedList = await db.players.toArray();
    setPlayers(updatedList);
    triggerToast("تم مسح المعاملة وتحديث بيانات اللاعب بنجاح ✅", true);
  };

  // --- Expected Attendees Actions ---
  const handleAddExpectedAttendee = async (attendee: Omit<ExpectedAttendee, 'id'>) => {
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
    const newAttendee: ExpectedAttendee = {
      ...attendee,
      id,
    };
    await syncExpectedAttendeeToCloud(newAttendee);
    const updated = await db.expectedToday.toArray();
    setExpectedAttendees(updated);
    triggerToast("تمت الإضافة للمتوقع حضورهم اليوم 📋");
  };

  const handleDeleteExpectedAttendee = async (id: string) => {
    await deleteExpectedAttendeeFromCloud(id);
    const updated = await db.expectedToday.toArray();
    setExpectedAttendees(updated);
    triggerToast("تم مسح اللاعب من المتوقع حضورهم", true);
  };

  const handleSaveExpectedAttendee = async (attendee: ExpectedAttendee) => {
    await syncExpectedAttendeeToCloud(attendee);
    const updated = await db.expectedToday.toArray();
    setExpectedAttendees(updated);
    triggerToast("تم تعديل موعد وبيانات اللاعب المتوقع بنجاح ✅");
  };

  const handleApplyExpectedAttendee = async (attendee: ExpectedAttendee) => {
    // 1. Check if player already exists in the real players database by ID or name
    let player: Player | undefined;
    if (attendee.playerId) {
      player = await db.players.get(attendee.playerId);
    }
    if (!player) {
      player = players.find(p => p.name.trim().toLowerCase() === attendee.name.trim().toLowerCase());
    }
    
    if (!player) {
      // Create a brand new player
      let maxNum = 0;
      players.filter(p => !p.isSystem).forEach(p => {
        const num = parseInt(p.number || '0', 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      });
      const newNum = String(maxNum + 1).padStart(3, '0');

      const newId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
      const newPlayer: Player = {
        id: newId,
        number: newNum,
        name: attendee.name,
        sport: attendee.sport || 'العام',
        attendance: [],
        history: [],
      };
      
      await db.players.put(newPlayer);
      player = newPlayer;
    }

    // 2. Register attendance or subscription / payment for them
    if (ATTEND_ONLY_TYPES.includes(attendee.subType)) {
      const attendance = player.attendance ? [...player.attendance] : [];
      if (!attendance.includes(attendee.date)) {
        attendance.push(attendee.date);
      }
      const updatedPlayer: Player = {
        ...player,
        attendance,
      };
      await syncPlayerToCloud(updatedPlayer);
    } else {
      const newHistoryEntry: HistoryEntry = {
        date: attendee.date,
        subType: attendee.subType,
        paid: attendee.paid,
        // Gym/place money typed by the coach; old expected rows fall back to the suggestion
        cost: typeof attendee.cost === 'number'
          ? attendee.cost
          : suggestGymCost(appSettings, attendee.subType, attendee.paid || 0, attendee.date),
        timestamp: Date.now(),
        desc: attendee.subType,
        endMode: isPackageType(attendee.subType) ? (attendee.endMode || 'sessions') : undefined,
        place: (attendee.place || '').trim() || DEFAULT_PLACE,
      };

      const attendance = player.attendance ? [...player.attendance] : [];
      if (!attendance.includes(attendee.date)) {
        attendance.push(attendee.date);
      }

      const updatedPlayer: Player = {
        ...player,
        subType: attendee.subType,
        startDate: attendee.date,
        paid: attendee.paid,
        cost: newHistoryEntry.cost,
        endMode: newHistoryEntry.endMode,
        history: player.history ? [...player.history, newHistoryEntry] : [newHistoryEntry],
        attendance,
      };
      await syncPlayerToCloud(updatedPlayer);
    }

    // 3. Remove from expectedToday
    if (attendee.id !== undefined) {
      await deleteExpectedAttendeeFromCloud(attendee.id);
    }

    // 4. Update states
    const updatedPlayers = await db.players.toArray();
    const updatedExpected = await db.expectedToday.toArray();
    
    setPlayers(updatedPlayers);
    setExpectedAttendees(updatedExpected);
    triggerToast(
      attendee.subType === ATTEND_ONLY_MONTHLY || attendee.subType === 'حضور فقط'
        ? `تم تسجيل حضور اللاعب [${attendee.name}] اليوم بنجاح 🟢`
        : `تم تسجيل الحضور وتفعيل الاشتراك للاعب [${attendee.name}] ✅`
    );
    if (!ATTEND_ONLY_TYPES.includes(attendee.subType) && player) {
      setReceipt({ playerId: player.id, amount: attendee.paid || 0, subType: attendee.subType, date: attendee.date });
    }
  };

  return {
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
  };
}
