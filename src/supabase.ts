import { createClient } from '@supabase/supabase-js';
import { db } from './db';
import type { Player, SyncAction, ExpectedAttendee, PersonalWalletEntry } from './types';

const SUPABASE_URL = 'https://koakdlbwsjekmtiunfhr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvYWtkbGJ3c2pla210aXVuZmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDEyNDUsImV4cCI6MjA4OTcxNzI0NX0.ZTXsET8hhtIebRmXiv1fHELmReGjVJlrq7HdlO9uWMI';

const AUTH_STORAGE_KEY = 'sb-koakdlbwsjekmtiunfhr-auth-token';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: AUTH_STORAGE_KEY,
  },
});

/** True if a coach session is saved on this device (even if its access token expired). */
export function hasStoredSession(): boolean {
  try {
    return !!localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return false;
  }
}

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
    console.log(`Sync Manager: Processing ${queue.length} pending offline operations...`);

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
            console.error(`Sync Manager: Error saving player ${item.playerId}`, error);
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
          console.error(`Sync Manager: Error deleting player ${item.playerId}`, error);
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
            console.error(`Sync Manager: Error saving expected attendee ${item.playerId}`, error);
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
          console.error(`Sync Manager: Error deleting expected attendee ${item.playerId}`, error);
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
            console.error(`Sync Manager: Error saving personal wallet entry ${item.playerId}`, error);
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
          console.error(`Sync Manager: Error deleting personal wallet entry ${item.playerId}`, error);
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

    console.log("Sync Manager: Queue processed completely and successfully. ✅");
    updateSyncStatus('online');
    isProcessingQueue = false;
    return true;
  } catch (err) {
    console.error("Sync Manager: Fatal error in queue processing", err);
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
 * Queues a delete action locally and attempts online cloud sync.
 */
export async function deletePlayerFromCloud(playerId: string) {
  // 1. Always delete locally first
  await db.players.delete(playerId);

  // 2. Clear any pending saves in queue and add a delete action
  await db.syncQueue.where('playerId').equals(playerId).delete();
  await db.syncQueue.add({
    playerId,
    action: 'delete',
    timestamp: Date.now(),
  });

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
      console.error("Sync Manager: Bulk upload error:", error);
      updateSyncStatus('offline');
    } else {
      updateSyncStatus('online');
    }
  } catch (err) {
    console.error("Sync Manager: Bulk upload network error:", err);
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
    let allData: any[] = [];
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
    console.error("Sync Manager: Initial load network error:", e);
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
    let allData: any[] = [];
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
    console.error("Sync Manager: Initial load expected attendees network error:", e);
    updateSyncStatus('offline');
    return [];
  }
}

// 4. Set up window online/offline listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log("Network Status: Online. Retrying synchronization...");
    processSyncQueue();
  });
  window.addEventListener('offline', () => {
    console.log("Network Status: Offline.");
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
    let allData: any[] = [];
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
    console.error("Sync Manager: Initial load personal wallet entries network error:", e);
    updateSyncStatus('offline');
    return [];
  }
}


// ---------------------------------------------------------------------------
// Weekly automatic backup to Supabase Storage (private bucket, authenticated only)
// ---------------------------------------------------------------------------

const BACKUP_BUCKET = 'coach-backups';
const BACKUP_KEEP = 8;
const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function backupFileName(d: Date) {
  // e.g. backup-2026-11-18T09-30-00.json (sortable by name)
  return `backup-${d.toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
}

function parseBackupDate(name: string): number {
  const m = name.match(/^backup-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})\.json$/);
  if (!m) return 0;
  return Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`) || 0;
}

/**
 * Uploads a full JSON snapshot (players + expected + wallet) once a week, keeping the last 8.
 * Read-only on app data: it never modifies or deletes players, attendance or money.
 * Returns the uploaded file name, or null if no backup was needed / possible.
 */
export async function runWeeklyBackupIfDue(): Promise<string | null> {
  if (!navigator.onLine) return null;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return null;

    const { data: files, error: listError } = await supabase.storage
      .from(BACKUP_BUCKET)
      .list('', { limit: 100, sortBy: { column: 'name', order: 'desc' } });
    if (listError) {
      console.error('Backup: cannot list backups', listError);
      return null;
    }

    const backups = (files || [])
      .filter(f => parseBackupDate(f.name) > 0)
      .sort((a, b) => parseBackupDate(b.name) - parseBackupDate(a.name));

    const newest = backups[0] ? parseBackupDate(backups[0].name) : 0;
    if (newest && Date.now() - newest < BACKUP_INTERVAL_MS) return null;

    const [players, expectedToday, personalWallet] = await Promise.all([
      db.players.toArray(),
      db.expectedToday.toArray(),
      db.personalWallet.toArray(),
    ]);

    // Never write an empty snapshot (e.g. a fresh device before the first sync).
    if (players.length === 0) return null;

    const now = new Date();
    const payload = {
      version: 1,
      createdAt: now.toISOString(),
      counts: {
        players: players.length,
        expectedToday: expectedToday.length,
        personalWallet: personalWallet.length,
      },
      players,
      expectedToday,
      personalWallet,
    };

    const name = backupFileName(now);
    const { error: uploadError } = await supabase.storage
      .from(BACKUP_BUCKET)
      .upload(name, new Blob([JSON.stringify(payload)], { type: 'application/json' }), {
        contentType: 'application/json',
        upsert: false,
      });
    if (uploadError) {
      console.error('Backup: upload failed', uploadError);
      return null;
    }

    // Keep only the newest BACKUP_KEEP snapshots (the new one included).
    const all = [{ name }, ...backups];
    const toRemove = all.slice(BACKUP_KEEP).map(f => f.name);
    if (toRemove.length > 0) {
      const { error: removeError } = await supabase.storage.from(BACKUP_BUCKET).remove(toRemove);
      if (removeError) console.error('Backup: cleanup of old snapshots failed', removeError);
    }

    console.log(`Backup: saved ${name} ✅`);
    return name;
  } catch (err) {
    console.error('Backup: unexpected error', err);
    return null;
  }
}

/**
 * One-off safety snapshot (e.g. right before an Import). Same JSON shape as the weekly backup.
 * Tries the private Storage bucket; always returns the JSON so the caller can keep a local copy.
 * Not counted in the weekly "keep last 8" rotation (different file name prefix).
 */
export async function uploadSafetySnapshot(label: string): Promise<{ uploaded: string | null; json: string }> {
  const [players, expectedToday, personalWallet] = await Promise.all([
    db.players.toArray(),
    db.expectedToday.toArray(),
    db.personalWallet.toArray(),
  ]);
  const now = new Date();
  const json = JSON.stringify({
    version: 1,
    createdAt: now.toISOString(),
    reason: label,
    counts: { players: players.length, expectedToday: expectedToday.length, personalWallet: personalWallet.length },
    players,
    expectedToday,
    personalWallet,
  });
  if (!navigator.onLine) return { uploaded: null, json };
  try {
    const name = `${label}-${now.toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    const { error } = await supabase.storage
      .from(BACKUP_BUCKET)
      .upload(name, new Blob([json], { type: 'application/json' }), { contentType: 'application/json', upsert: false });
    if (error) {
      console.error('Safety snapshot: upload failed', error);
      return { uploaded: null, json };
    }
    return { uploaded: name, json };
  } catch (err) {
    console.error('Safety snapshot: unexpected error', err);
    return { uploaded: null, json };
  }
}
