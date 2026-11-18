import { db } from './db';
import { supabase } from './supabaseClient';

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
