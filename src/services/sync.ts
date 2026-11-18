/**
 * Offline-first sync: every change is saved in Dexie first, queued, then pushed to Supabase.
 */
import { db } from './db';
import { supabase } from './supabaseClient';
import type { Player, ExpectedAttendee, PersonalWalletEntry } from '../types';

let syncStatusCallback: ((status: 'online' | 'offline' | 'syncing') => void) | null = null;
let isProcessingQueue = false;

export function registerSyncStatusCallback(callback: (status: 'online' | 'offline' | 'syncing') => void) {
  syncStatusCallback = callback;
  // Trigger initial status
  callback(navigator.onLine ? 'online' : 'offline');
}

function updateSyncStatus(status: 'online' | 'offline' | 'syncing') {
  if (syncStatusCallback) {
    syncStatusCallback(status);
  }
  void publishSyncInfo();
}

// ---------------------------------------------------------------------------
// Pending changes + last real error (shown in the header next to "متصل")
// ---------------------------------------------------------------------------

export interface SyncInfo {
  pending: number; // changes saved on the phone that are not in the cloud yet
  error: string | null; // last server error (not a simple "no internet")
}

let lastSyncError: string | null = null;
let syncInfoCallback: ((info: SyncInfo) => void) | null = null;

export function registerSyncInfoCallback(callback: (info: SyncInfo) => void) {
  syncInfoCallback = callback;
  void publishSyncInfo();
}

async function publishSyncInfo() {
  if (!syncInfoCallback) return;
  try {
    const pending = await db.syncQueue.count();
    syncInfoCallback({ pending, error: lastSyncError });
  } catch {
    // database not ready yet: next status change will publish again
  }
}

function isNetworkProblem(message: string): boolean {
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(message);
}

/** Keep a readable message for real server errors (permissions, invalid data...). */
function recordSyncError(what: string, error: unknown) {
  const message =
    error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : String(error);
  console.error(`Sync: ${what}`, error);
  if (!navigator.onLine || isNetworkProblem(message)) return;
  lastSyncError = `${what}: ${message}`;
}

/**
 * Triggers background sync for any changes queued while offline.
 */
export async function processSyncQueue(): Promise<boolean> {
  if (!navigator.onLine) {
    updateSyncStatus('offline');
    return false;
  }

  if (isProcessingQueue) return false;
  isProcessingQueue = true;

  try {
    const queue = await db.syncQueue.orderBy('timestamp').toArray();
    if (queue.length === 0) {
      updateSyncStatus('online');
      isProcessingQueue = false;
      return true;
    }

    updateSyncStatus('syncing');

    for (const item of queue) {
      let success = false;

      if (item.action === 'save') {
        // Fetch most up-to-date player from local DB to sync
        const player = await db.players.get(item.playerId);
        if (player) {
          const { error } = await supabase
            .from('players_sync')
            .upsert({ id: String(player.id), player_data: player });
          
          if (!error) {
            success = true;
          } else {
            recordSyncError('حفظ لاعب', error);
          }
        } else {
          // Player no longer exists locally, remove from queue
          success = true;
        }
      } else if (item.action === 'delete') {
        const { error } = await supabase
          .from('players_sync')
          .delete()
          .eq('id', String(item.playerId));
        
        if (!error) {
          success = true;
        } else {
          recordSyncError('مسح لاعب', error);
        }
      } else if (item.action === 'save_expected') {
        const attendee = await db.expectedToday.get(item.playerId);
        if (attendee) {
          const { error } = await supabase
            .from('expected_today_sync')
            .upsert({ id: String(attendee.id), attendee_data: attendee });
          
          if (!error) {
            success = true;
          } else {
            recordSyncError('حفظ المتوقع', error);
          }
        } else {
          success = true;
        }
      } else if (item.action === 'delete_expected') {
        const { error } = await supabase
          .from('expected_today_sync')
          .delete()
          .eq('id', String(item.playerId));
        
        if (!error) {
          success = true;
        } else {
          recordSyncError('مسح من المتوقع', error);
        }
      } else if (item.action === 'save_wallet') {
        const entry = await db.personalWallet.get(item.playerId);
        if (entry) {
          const { error } = await supabase
            .from('personal_wallet_sync')
            .upsert({ id: String(entry.id), entry_data: entry });
          
          if (!error) {
            success = true;
          } else {
            recordSyncError('حفظ المحفظة', error);
          }
        } else {
          success = true;
        }
      } else if (item.action === 'delete_wallet') {
        const { error } = await supabase
          .from('personal_wallet_sync')
          .delete()
          .eq('id', String(item.playerId));
        
        if (!error) {
          success = true;
        } else {
          recordSyncError('مسح من المحفظة', error);
        }
      }

      if (success && item.id !== undefined) {
        await db.syncQueue.delete(item.id);
      } else {
        // Stop processing queue if an item fails (likely network/server issue)
        updateSyncStatus('offline');
        isProcessingQueue = false;
        return false;
      }
    }

    lastSyncError = null;
    updateSyncStatus('online');
    isProcessingQueue = false;
    return true;
  } catch (err) {
    recordSyncError('طابور المزامنة', err);
    updateSyncStatus('offline');
    isProcessingQueue = false;
    return false;
  }
}

/**
 * Queues a save action locally and attempts online cloud sync.
 */
export async function syncPlayerToCloud(player: Player) {
  player.last_updated = Date.now();
  
  // 1. Always save locally to IndexedDB first (Offline-First)
  await db.players.put(player);

  // 2. Queue for synchronization
  // Check if there is already a save operation for this player in the queue to avoid duplicates
  const existing = await db.syncQueue
    .where('playerId')
    .equals(player.id)
    .and(item => item.action === 'save')
    .first();
  
  if (!existing) {
    await db.syncQueue.add({
      playerId: player.id,
      action: 'save',
      timestamp: Date.now(),
    });
  }

  // 3. Attempt immediate sync in background
  processSyncQueue();
}

/**
 * Syncs all local players to the cloud (bulk operation).
 */
export async function syncAllToCloud(players: Player[]) {
  if (!navigator.onLine) return;
  updateSyncStatus('syncing');

  try {
    const upsertData = players.map(p => ({ id: String(p.id), player_data: p }));
    const { error } = await supabase.from('players_sync').upsert(upsertData);
    if (error) {
      recordSyncError('رفع اللاعيبة', error);
      updateSyncStatus('offline');
    } else {
      updateSyncStatus('online');
    }
  } catch (err) {
    recordSyncError('رفع اللاعيبة', err);
    updateSyncStatus('offline');
  }
}

/**
 * Startup cloud sync that pulls from Supabase and merges with local data.
 */
export async function fetchInitialDataFromSupabase(): Promise<Player[]> {
  if (!navigator.onLine) {
    updateSyncStatus('offline');
    return [];
  }

  updateSyncStatus('syncing');
  try {
    let allData: { player_data: Player }[] = [];
    let count = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('players_sync')
        .select('*')
        .range(count, count + pageSize - 1);
      
      if (error) throw error;
      if (data && data.length > 0) {
        allData = allData.concat(data);
        count += data.length;
        if (data.length < pageSize) break;
      } else {
        break;
      }
    }

    const cloudPlayers: Player[] = allData.map(row => row.player_data);
    const localPlayers = await db.players.toArray();

    // Merge logic: Merge cloud and local players, keeping the newest last_updated
    const mergedMap = new Map<string, Player>();
    localPlayers.forEach(p => mergedMap.set(String(p.id), p));

    let needsCloudUpload = false;

    cloudPlayers.forEach(cloudP => {
      const localP = mergedMap.get(String(cloudP.id));
      if (!localP || (cloudP.last_updated || 0) >= (localP.last_updated || 0)) {
        mergedMap.set(String(cloudP.id), cloudP);
      } else {
        needsCloudUpload = true;
      }
    });

    if (localPlayers.length > cloudPlayers.length) {
      needsCloudUpload = true;
    }

    const finalPlayers = Array.from(mergedMap.values());
    
    // Save to local database
    await db.players.bulkPut(finalPlayers);
    updateSyncStatus('online');

    if (needsCloudUpload) {
      syncAllToCloud(finalPlayers);
    }

    return finalPlayers;
  } catch (e) {
    recordSyncError('تحميل اللاعيبة', e);
    updateSyncStatus('offline');
    return [];
  }
}

/**
 * Queues a save action locally and attempts online cloud sync for expected attendees.
 */
export async function syncExpectedAttendeeToCloud(attendee: ExpectedAttendee) {
  attendee.last_updated = Date.now();
  
  // 1. Always save locally to IndexedDB first
  await db.expectedToday.put(attendee);

  // 2. Queue for synchronization
  const existing = await db.syncQueue
    .where('playerId')
    .equals(attendee.id)
    .and(item => item.action === 'save_expected')
    .first();
  
  if (!existing) {
    await db.syncQueue.add({
      playerId: attendee.id,
      action: 'save_expected',
      timestamp: Date.now(),
    });
  }

  // 3. Attempt immediate sync in background
  processSyncQueue();
}

export async function deleteExpectedAttendeeFromCloud(id: string) {
  // Soft-delete expected attendee by setting isDeleted = true and syncing
  const attendee = await db.expectedToday.get(id);
  if (attendee) {
    const updated: ExpectedAttendee = {
      ...attendee,
      isDeleted: true,
    };
    await syncExpectedAttendeeToCloud(updated);
  }
}

/**
 * Startup cloud sync that pulls from Supabase and merges with local expected attendees.
 */
export async function fetchInitialExpectedAttendeesFromSupabase(): Promise<ExpectedAttendee[]> {
  if (!navigator.onLine) {
    updateSyncStatus('offline');
    return [];
  }

  updateSyncStatus('syncing');
  try {
    let allData: { attendee_data: ExpectedAttendee }[] = [];
    let count = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('expected_today_sync')
        .select('*')
        .range(count, count + pageSize - 1);
      
      if (error) throw error;
      if (data && data.length > 0) {
        allData = allData.concat(data);
        count += data.length;
        if (data.length < pageSize) break;
      } else {
        break;
      }
    }

    const cloudExpected: ExpectedAttendee[] = allData.map(row => row.attendee_data);
    const localExpected = await db.expectedToday.toArray();

    // Merge logic: Merge cloud and local expected attendees, keeping the newest last_updated
    const mergedMap = new Map<string, ExpectedAttendee>();
    localExpected.forEach(p => mergedMap.set(String(p.id), p));

    let needsCloudUpload = false;

    cloudExpected.forEach(cloudP => {
      const localP = mergedMap.get(String(cloudP.id));
      if (!localP || (cloudP.last_updated || 0) >= (localP.last_updated || 0)) {
        mergedMap.set(String(cloudP.id), cloudP);
      } else {
        needsCloudUpload = true;
      }
    });

    if (localExpected.length > cloudExpected.length) {
      needsCloudUpload = true;
    }

    const finalExpected = Array.from(mergedMap.values());
    
    // Save to local database
    await db.expectedToday.bulkPut(finalExpected);
    updateSyncStatus('online');

    if (needsCloudUpload) {
      // Bulk upsert expected attendees
      const upsertData = finalExpected.map(p => ({ id: String(p.id), attendee_data: p }));
      await supabase.from('expected_today_sync').upsert(upsertData);
    }

    return finalExpected;
  } catch (e) {
    recordSyncError('تحميل المتوقع', e);
    updateSyncStatus('offline');
    return [];
  }
}

// 4. Set up window online/offline listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processSyncQueue();
  });
  window.addEventListener('offline', () => {
    updateSyncStatus('offline');
  });
}

/**
 * Queues a save action locally and attempts online cloud sync for personal wallet entries.
 */
export async function syncPersonalWalletToCloud(entry: PersonalWalletEntry) {
  entry.last_updated = Date.now();
  
  // 1. Always save locally to IndexedDB first
  await db.personalWallet.put(entry);

  // 2. Queue for synchronization
  const existing = await db.syncQueue
    .where('playerId')
    .equals(entry.id)
    .and(item => item.action === 'save_wallet')
    .first();
  
  if (!existing) {
    await db.syncQueue.add({
      playerId: entry.id,
      action: 'save_wallet',
      timestamp: Date.now(),
    });
  }

  // 3. Attempt immediate sync in background
  processSyncQueue();
}

/**
 * Deletes a personal wallet entry locally and from the cloud
 */
export async function deletePersonalWalletFromCloud(id: string) {
  // 1. Delete locally first
  await db.personalWallet.delete(id);

  // 2. Clear any pending saves and add a delete action
  await db.syncQueue.where('playerId').equals(id).delete();
  await db.syncQueue.add({
    playerId: id,
    action: 'delete_wallet',
    timestamp: Date.now(),
  });

  // 3. Attempt immediate sync in background
  processSyncQueue();
}

/**
 * Startup cloud sync that pulls from Supabase and merges with local personal wallet entries.
 */
export async function fetchInitialPersonalWalletFromSupabase(): Promise<PersonalWalletEntry[]> {
  if (!navigator.onLine) {
    updateSyncStatus('offline');
    return [];
  }

  updateSyncStatus('syncing');
  try {
    let allData: { entry_data: PersonalWalletEntry }[] = [];
    let count = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('personal_wallet_sync')
        .select('*')
        .range(count, count + pageSize - 1);
      
      if (error) throw error;
      if (data && data.length > 0) {
        allData = allData.concat(data);
        count += data.length;
        if (data.length < pageSize) break;
      } else {
        break;
      }
    }

    const cloudEntries: PersonalWalletEntry[] = allData.map(row => row.entry_data);
    const localEntries = await db.personalWallet.toArray();

    // Merge logic: Merge cloud and local wallet entries, keeping the newest last_updated
    const mergedMap = new Map<string, PersonalWalletEntry>();
    localEntries.forEach(p => mergedMap.set(String(p.id), p));

    let needsCloudUpload = false;

    cloudEntries.forEach(cloudP => {
      const localP = mergedMap.get(String(cloudP.id));
      if (!localP || (cloudP.last_updated || 0) >= (localP.last_updated || 0)) {
        mergedMap.set(String(cloudP.id), cloudP);
      } else {
        needsCloudUpload = true;
      }
    });

    if (localEntries.length > cloudEntries.length) {
      needsCloudUpload = true;
    }

    const finalEntries = Array.from(mergedMap.values());
    
    // Save to local database
    await db.personalWallet.bulkPut(finalEntries);
    updateSyncStatus('online');

    if (needsCloudUpload) {
      const upsertData = finalEntries.map(p => ({ id: String(p.id), entry_data: p }));
      await supabase.from('personal_wallet_sync').upsert(upsertData);
    }

    return finalEntries;
  } catch (e) {
    recordSyncError('تحميل المحفظة', e);
    updateSyncStatus('offline');
    return [];
  }
}
