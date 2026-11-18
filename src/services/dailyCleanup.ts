/**
 * Daily cleanup, once a day when the app opens:
 *  - yesterday's "حصة واحدة" stops being the player's current subscription
 *    (only subType/startDate/paid/cost on the player; history and attendance are untouched,
 *    so no report number changes),
 *  - "expected today" rows from previous days are removed.
 *
 * Online (after the cloud pull): changes are synced and the day is marked done.
 * Offline: the same cleanup is applied on this device only, and done again (and synced)
 * the next time the app opens online.
 */
import { db } from './db';
import { supabase } from './supabaseClient';
import { syncPlayerToCloud } from './sync';
import { SINGLE_SESSION } from '../lib/constants';
import { localToday } from '../lib/dates';

const DONE_KEY = 'daily_cleanup_done_on';

function doneToday(today: string): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === today;
  } catch {
    return false;
  }
}

export async function runDailyCleanup({ syncToCloud }: { syncToCloud: boolean }): Promise<{ playersChanged: number; expectedRemoved: number }> {
  const today = localToday();
  if (syncToCloud && doneToday(today)) return { playersChanged: 0, expectedRemoved: 0 };

  // 1) Yesterday's single sessions
  const players = await db.players.toArray();
  const stale = players.filter(p => p.subType === SINGLE_SESSION && p.startDate && p.startDate < today);
  for (const p of stale) {
    const updated = { ...p, subType: '', startDate: '', paid: 0, cost: 0 };
    if (syncToCloud) {
      await syncPlayerToCloud(updated); // saves locally + queues for the cloud
    } else {
      await db.players.put(updated); // this device only, until the next online open
    }
  }

  // 2) Old "expected today" rows
  const expected = await db.expectedToday.toArray();
  const expired = expected.filter(att => att.date < today);
  for (const att of expired) {
    await db.expectedToday.delete(att.id);
  }
  if (syncToCloud && expired.length > 0 && navigator.onLine) {
    await supabase.from('expected_today_sync').delete().in('id', expired.map(att => att.id));
  }

  if (syncToCloud) {
    try {
      localStorage.setItem(DONE_KEY, today);
    } catch {
      // storage blocked: it will simply run again next time
    }
  }
  return { playersChanged: stale.length, expectedRemoved: expired.length };
}
