/**
 * Saving the synced settings record (gym share, discounts, alerts, messages).
 * Moved out of App.tsx without changing the logic.
 */
import type { Player, AppSettings } from '../types';
import { db } from '../services/db';
import { syncPlayerToCloud } from '../services/sync';
import { SETTINGS_ID } from '../lib/subscription';
import { localToday } from '../lib/dates';
import type { AppContextValue } from './appContext';

export function useSettings(ctx: AppContextValue) {
  const { setPlayers, triggerToast } = ctx;
  const getTodayDate = localToday;

  // Settings (gym share per session + discount table), synced as a system record
  const handleSaveSettings = async (next: AppSettings) => {
    const existing = await db.players.get(SETTINGS_ID);
    const record: Player = {
      ...(existing || { id: SETTINGS_ID, isSystem: true, name: 'الإعدادات', history: [] }),
      id: SETTINGS_ID,
      isSystem: true,
      settings: { ...next, v2From: existing?.settings?.v2From || next.v2From || getTodayDate() },
    };
    await syncPlayerToCloud(record);
    const updatedList = await db.players.toArray();
    setPlayers(updatedList);
    triggerToast('تم حفظ الإعدادات ✅');
  };

  return {
    handleSaveSettings,
  };
}
