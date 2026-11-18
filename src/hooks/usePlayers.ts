/**
 * Players, groups, attendance calendar, expenses and month lock.
 * Moved out of App.tsx without changing the logic.
 */
import type { Player, HistoryEntry } from '../types';
import { db } from '../services/db';
import { supabase } from '../services/supabaseClient';
import { syncPlayerToCloud, syncAllToCloud } from '../services/sync';
import { EXPENSES_ID, GROUPS_CONFIG_ID, MONTH_LOCKS_ID } from '../lib/constants';
import { localToday } from '../lib/dates';
import type { AppContextValue } from './appContext';

export function usePlayers(ctx: AppContextValue) {
  const { setPlayers, setExpectedAttendees, triggerToast, setEditingPlayer, playerToDeleteId, setPlayerToDeleteId } = ctx;
  const getTodayDate = localToday;

  // Save/Register Player
  const handleSavePlayer = async (playerData: Omit<Player, 'attendance' | 'history'>) => {
    const existing = await db.players.get(playerData.id);
    const newPlayer: Player = {
      ...existing,
      ...playerData,
      attendance: existing?.attendance || [],
      history: existing?.history || [],
    };

    await syncPlayerToCloud(newPlayer);
    const updatedList = await db.players.toArray();
    setPlayers(updatedList);
    setEditingPlayer(null);
    triggerToast(existing ? "تم تحديث بيانات اللاعب بنجاح ✅" : "تم تسجيل اللاعب في القاعدة بنجاح ✅");
  };

  // Delete Player
  const handleDeletePlayer = async () => {
    if (!playerToDeleteId) return;
    
    const p = await db.players.get(playerToDeleteId);
    if (p) {
      const updatedPlayer: Player = {
        ...p,
        isDeleted: true,
        last_updated: Date.now(),
      };
      await syncPlayerToCloud(updatedPlayer);
      const updatedList = await db.players.toArray();
      setPlayers(updatedList);
    }
    setPlayerToDeleteId(null);
    triggerToast("تم أرشفة اللاعب وإخفاؤه من القائمة بنجاح", true);
  };

  // Group configurations handlers
  const handleSaveGroupConfig = async (name: string) => {
    let sys = await db.players.get(GROUPS_CONFIG_ID);
    if (!sys) {
      sys = { id: GROUPS_CONFIG_ID, isSystem: true, name: 'إعدادات الجروبات', history: [] };
    }

    const history = sys.history ? [...sys.history] : [];
    const existingIdx = history.findIndex(h => h.desc === name);

    if (existingIdx === -1) {
      history.push({
        desc: name,
        subType: '',
        cost: 0,
        paid: 0,
        date: getTodayDate(),
        timestamp: Date.now(),
      });
    }
    const updatedSys = { ...sys, history };
    await syncPlayerToCloud(updatedSys);
    const updatedList = await db.players.toArray();
    setPlayers(updatedList);
    triggerToast("تم إنشاء الجروب بنجاح ✅");
  };

  const handleDeleteGroupConfig = async (name: string) => {
    // 1. Delete group configuration
    const sys = await db.players.get(GROUPS_CONFIG_ID);
    if (!sys || !sys.history) return;

    const history = sys.history.filter(h => h.desc !== name);
    const updatedSys = { ...sys, history };
    await syncPlayerToCloud(updatedSys);

    // 2. Reassign all players in this group to 'العام'
    const allPlayers = await db.players.toArray();
    const affectedPlayers = allPlayers.filter(p => !p.isSystem && p.sport === name);
    const updatedPlayers = affectedPlayers.map(p => ({
      ...p,
      sport: 'العام',
      last_updated: Date.now(),
    }));
    if (updatedPlayers.length > 0) {
      await db.players.bulkPut(updatedPlayers);
      if (navigator.onLine) {
        await syncAllToCloud(updatedPlayers);
      } else {
        // Queue saves if offline
        for (const p of updatedPlayers) {
          const existing = await db.syncQueue
            .where('playerId')
            .equals(p.id)
            .and(item => item.action === 'save')
            .first();
          if (!existing) {
            await db.syncQueue.add({
              playerId: p.id,
              action: 'save',
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    // 3. Reassign expected attendees for today to 'العام'
    const allExpected = await db.expectedToday.toArray();
    const affectedExpected = allExpected.filter(att => att.sport === name);
    const updatedExpected = affectedExpected.map(att => ({
      ...att,
      sport: 'العام',
      last_updated: Date.now(),
    }));
    if (updatedExpected.length > 0) {
      await db.expectedToday.bulkPut(updatedExpected);
      if (navigator.onLine) {
        const upsertExpectedData = updatedExpected.map(att => ({ id: String(att.id), attendee_data: att }));
        await supabase.from('expected_today_sync').upsert(upsertExpectedData);
      } else {
        // Queue expected today saves if offline
        for (const att of updatedExpected) {
          const existing = await db.syncQueue
            .where('playerId')
            .equals(att.id)
            .and(item => item.action === 'save_expected')
            .first();
          if (!existing) {
            await db.syncQueue.add({
              playerId: att.id,
              action: 'save_expected',
              timestamp: Date.now(),
            });
          }
        }
      }
      const updatedExpectedList = await db.expectedToday.toArray();
      setExpectedAttendees(updatedExpectedList);
    }

    // 4. Reload player list
    const updatedList = await db.players.toArray();
    setPlayers(updatedList);
    triggerToast("تم حذف الجروب ونقل اللاعبين لجروب العام بنجاح ✅", true);
  };

  const handleRenameGroupConfig = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;

    // 1. Update config
    const sys = await db.players.get(GROUPS_CONFIG_ID);
    if (!sys || !sys.history) return;

    const history = sys.history.map(h => {
      if (h.desc === oldName) {
        return {
          ...h,
          desc: newName.trim(),
          timestamp: Date.now()
        };
      }
      return h;
    });
    const updatedSys = { ...sys, history };
    await syncPlayerToCloud(updatedSys);

    // 2. Update players
    const allPlayers = await db.players.toArray();
    const affectedPlayers = allPlayers.filter(p => !p.isSystem && p.sport === oldName);
    const updatedPlayers = affectedPlayers.map(p => ({
      ...p,
      sport: newName.trim(),
      last_updated: Date.now(),
    }));
    if (updatedPlayers.length > 0) {
      await db.players.bulkPut(updatedPlayers);
      if (navigator.onLine) {
        await syncAllToCloud(updatedPlayers);
      } else {
        for (const p of updatedPlayers) {
          const existing = await db.syncQueue
            .where('playerId')
            .equals(p.id)
            .and(item => item.action === 'save')
            .first();
          if (!existing) {
            await db.syncQueue.add({
              playerId: p.id,
              action: 'save',
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    // 3. Update expected attendees for today
    const allExpected = await db.expectedToday.toArray();
    const affectedExpected = allExpected.filter(att => att.sport === oldName);
    const updatedExpected = affectedExpected.map(att => ({
      ...att,
      sport: newName.trim(),
      last_updated: Date.now(),
    }));
    if (updatedExpected.length > 0) {
      await db.expectedToday.bulkPut(updatedExpected);
      if (navigator.onLine) {
        const upsertExpectedData = updatedExpected.map(att => ({ id: String(att.id), attendee_data: att }));
        await supabase.from('expected_today_sync').upsert(upsertExpectedData);
      } else {
        for (const att of updatedExpected) {
          const existing = await db.syncQueue
            .where('playerId')
            .equals(att.id)
            .and(item => item.action === 'save_expected')
            .first();
          if (!existing) {
            await db.syncQueue.add({
              playerId: att.id,
              action: 'save_expected',
              timestamp: Date.now(),
            });
          }
        }
      }
      const updatedExpectedList = await db.expectedToday.toArray();
      setExpectedAttendees(updatedExpectedList);
    }

    // 4. Reload player list
    const updatedList = await db.players.toArray();
    setPlayers(updatedList);
    triggerToast("تم تعديل اسم الجروب وتحديث اللاعبين بنجاح ✅");
  };

  // Move a player to a different group
  const handleMovePlayerToGroup = async (playerId: string, groupName: string) => {
    const p = await db.players.get(playerId);
    if (!p) return;

    const updatedPlayer: Player = {
      ...p,
      sport: groupName,
      last_updated: Date.now(),
    };
    await syncPlayerToCloud(updatedPlayer);
    const updatedList = await db.players.toArray();
    setPlayers(updatedList);
    triggerToast(`تم نقل اللاعب إلى جروب "${groupName}" بنجاح ✅`);
  };

  // Calendar Attendance click toggle
  const handleToggleCalendarDay = async (playerId: string, dateStr: string) => {
    const p = await db.players.get(playerId);
    if (!p) return;

    const attendance = p.attendance ? [...p.attendance] : [];
    const index = attendance.indexOf(dateStr);
    
    if (index > -1) {
      attendance.splice(index, 1);
      triggerToast(`تم إلغاء حضور يوم ${dateStr} 🔴`, true);
    } else {
      attendance.push(dateStr);
      triggerToast(`تم تسجيل حضور يوم ${dateStr} 🟢`);
    }

    const updatedPlayer = { ...p, attendance };
    await syncPlayerToCloud(updatedPlayer);
    const updatedList = await db.players.toArray();
    setPlayers(updatedList);
  };

  const handleDeleteHistoryEntry = async (playerId: string, timestamp: number) => {
    const p = await db.players.get(playerId);
    if (!p || !p.history) return;

    const history = p.history.filter(h => h.timestamp !== timestamp);
    const updatedPlayer = { ...p, history };
    await syncPlayerToCloud(updatedPlayer);
    const updatedList = await db.players.toArray();
    setPlayers(updatedList);
    triggerToast("تم مسح المعاملة بنجاح وتحديث الخزنة ✅", true);
  };

  // Expenses management
  const handleSaveExpense = async (desc: string, cost: number, date: string, category?: string) => {
    let sys = await db.players.get(EXPENSES_ID);
    if (!sys) {
      sys = { id: EXPENSES_ID, isSystem: true, name: 'المصروفات العامة', history: [] };
    }

    const newExpense: HistoryEntry = {
      desc,
      cost,
      paid: 0,
      date,
      timestamp: Date.now(),
      subType: 'مصروف',
      category: category || undefined,
    };

    const updatedSys: Player = {
      ...sys,
      history: sys.history ? [...sys.history, newExpense] : [newExpense],
    };

    await syncPlayerToCloud(updatedSys);
    const updatedList = await db.players.toArray();
    setPlayers(updatedList);
    triggerToast("تم تسجيل المصروف بنجاح 💸");
  };

  const handleDeleteExpense = async (timestamp: number) => {
    const sys = await db.players.get(EXPENSES_ID);
    if (!sys || !sys.history) return;

    const history = sys.history.filter(h => h.timestamp !== timestamp);
    const updatedSys = { ...sys, history };
    await syncPlayerToCloud(updatedSys);
    const updatedList = await db.players.toArray();
    setPlayers(updatedList);
    triggerToast("تم مسح المصروف وتحديث الخزنة بنجاح ✅", true);
  };

  // Lock (close) a month. This ONLY marks the month as closed in a system record.
  // It never deletes or changes history, attendance, subscriptions or money,
  // so every monthly report keeps showing the month's numbers.
  const handleLockMonth = async (monthKey: string) => {
    let sys = await db.players.get(MONTH_LOCKS_ID);
    if (!sys) {
      sys = { id: MONTH_LOCKS_ID, isSystem: true, name: 'الشهور المقفولة', history: [] };
    }
    const history = sys.history ? [...sys.history] : [];
    if (history.some(h => h.desc === monthKey)) {
      triggerToast('الشهر ده مقفول بالفعل 🔒');
      return;
    }
    history.push({
      desc: monthKey,
      subType: 'month_lock',
      cost: 0,
      paid: 0,
      date: getTodayDate(),
      timestamp: Date.now(),
    });
    await syncPlayerToCloud({ ...sys, history });
    const updatedList = await db.players.toArray();
    setPlayers(updatedList);
    triggerToast(`تم قفل شهر ${monthKey} 🔒 (كل الأرقام والسجلات محفوظة)`);
  };

  return {
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
  };
}
