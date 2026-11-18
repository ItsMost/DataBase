/**
 * Loads the data (Dexie first, then the cloud), keeps it live with Supabase Realtime,
 * and runs the daily cleanup. Moved out of App.tsx without changing the logic.
 */
import { useState, useEffect } from 'react';
import type { Player, ExpectedAttendee, PersonalWalletEntry } from '../types';
import { db, runMigration } from '../services/db';
import { supabase } from '../services/supabaseClient';
import {
  registerSyncStatusCallback,
  syncPlayerToCloud,
  fetchInitialDataFromSupabase,
  fetchInitialExpectedAttendeesFromSupabase,
  fetchInitialPersonalWalletFromSupabase,
} from '../services/sync';
import { runWeeklyBackupIfDue } from '../services/backup';
import { SETTINGS_ID, SINGLE_SESSION, getSettings } from '../lib/subscription';
import { GROUPS_CONFIG_ID } from '../lib/constants';
import { localToday } from '../lib/dates';

export type SyncStatus = 'online' | 'offline' | 'syncing';

export function useAppData(activeTab: string) {
  const getTodayDate = localToday;
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
  // Players database state
  const [players, setPlayers] = useState<Player[]>([]);

  // Expected Attendees state
  const [expectedAttendees, setExpectedAttendees] = useState<ExpectedAttendee[]>([]);

  // Personal Wallet state
  const [walletEntries, setWalletEntries] = useState<PersonalWalletEntry[]>([]);
  
  // 2. Initialize sync status callbacks
  useEffect(() => {
    registerSyncStatusCallback((status) => {
      setSyncStatus(status);
    });
  }, []);

  // Trigger cleanup of "حصة واحدة" subscriptions if the day rolls over during active usage
  useEffect(() => {
    const runDailyCleanup = async () => {
      const todayStr = getTodayDate();
      // NOTE: automatic deduplication was removed. Duplicate names are only
      // reported in the roster tab; the coach decides what to delete.
      const cleanPlayers = await db.players.toArray();
      let playersUpdated = false;
      const cleanedPlayers = cleanPlayers.map(p => {
        if (p.subType === SINGLE_SESSION && p.startDate && p.startDate < todayStr) {
          playersUpdated = true;
          return {
            ...p,
            subType: '',
            startDate: '',
            paid: 0,
            cost: 0,
          };
        }
        return p;
      });

      if (playersUpdated) {
        await db.players.bulkPut(cleanedPlayers);
        setPlayers(cleanedPlayers);
      } else {
        setPlayers(cleanPlayers);
      }

      // Purge expired expected attendees (date < todayStr)
      const allExpected = await db.expectedToday.toArray();
      const expiredExpected = allExpected.filter(att => att.date < todayStr);
      if (expiredExpected.length > 0) {
        console.log(`Daily Cleanup (activeTab): Deleting ${expiredExpected.length} expired expected attendees.`);
        for (const att of expiredExpected) {
          await db.expectedToday.delete(att.id);
        }
        if (navigator.onLine) {
          const expiredIds = expiredExpected.map(att => att.id);
          await supabase.from('expected_today_sync').delete().in('id', expiredIds);
        }
        const updatedExpected = await db.expectedToday.toArray();
        setExpectedAttendees(updatedExpected);
      }
    };
    runDailyCleanup();
  }, [activeTab]);

  // 3. Database Startup & Real-time Cloud Subscriptions
  useEffect(() => {
    const initializeData = async () => {
      // Step A: Run local data migration service
      await runMigration();

      // Load local wallet entries on startup
      const localWallet = await db.personalWallet.toArray();
      setWalletEntries(localWallet);

      // NOTE: startup automatic deduplication was removed (it deleted players
      // with the same name from this device and the cloud). Duplicates are now
      // only shown as a warning in the roster tab.
      const cleanPlayers = await db.players.toArray();
      setPlayers(cleanPlayers);

      // Load expected attendees and filter out expired ones locally
      const allExpected = await db.expectedToday.toArray();
      const todayStr = getTodayDate();
      const expiredExpected = allExpected.filter(att => att.date < todayStr);
      if (expiredExpected.length > 0) {
        console.log(`Startup Cleanup: Deleting ${expiredExpected.length} expired expected attendees.`);
        for (const att of expiredExpected) {
          await db.expectedToday.delete(att.id);
        }
        if (navigator.onLine) {
          const expiredIds = expiredExpected.map(att => att.id);
          await supabase.from('expected_today_sync').delete().in('id', expiredIds);
        }
      }
      
      const cleanExpected = await db.expectedToday.toArray();
      setExpectedAttendees(cleanExpected);

      // Auto-wipe expired single-session subscriptions (yesterday's "حصة واحدة" players)
      let playersUpdated = false;
      const cleanedPlayers = cleanPlayers.map(p => {
        if (p.subType === SINGLE_SESSION && p.startDate && p.startDate < todayStr) {
          playersUpdated = true;
          return {
            ...p,
            subType: '',
            startDate: '',
            paid: 0,
            cost: 0,
          };
        }
        return p;
      });

      if (playersUpdated) {
        await db.players.bulkPut(cleanedPlayers);
        setPlayers(cleanedPlayers);
      }

      // Seed group configs from existing database players if sys_groups_config doesn't exist or is empty
      const latestPlayers = await db.players.toArray();
      const sysGroups = latestPlayers.find(p => p.id === GROUPS_CONFIG_ID);
      if (!sysGroups || !sysGroups.history || sysGroups.history.length === 0) {
        const uniqueSports = [...new Set(latestPlayers.filter(p => !p.isSystem && p.sport && p.sport !== 'العام' && p.sport !== 'General').map(p => p.sport!))];
        if (uniqueSports.length > 0) {
          const newSysGroups = {
            id: GROUPS_CONFIG_ID,
            isSystem: true,
            name: 'إعدادات الجروبات',
            history: uniqueSports.map((sport, index) => ({
              desc: sport,
              subType: 'presence',
              cost: 0,
              paid: 0,
              date: todayStr,
              timestamp: Date.now() + index
            }))
          };
          await db.players.put(newSysGroups);
          await syncPlayerToCloud(newSysGroups);
          const finalReload = await db.players.toArray();
          setPlayers(finalReload);
        }
      }

      // Step B: Pull initial cloud data and merge
      if (navigator.onLine) {
        setTimeout(async () => {
          const syncedPlayers = await fetchInitialDataFromSupabase();
          if (syncedPlayers.length > 0) {
            setPlayers(syncedPlayers);
            // Also seed groups from synced players
            const sysGroupsSynced = syncedPlayers.find(p => p.id === GROUPS_CONFIG_ID);
            if (!sysGroupsSynced || !sysGroupsSynced.history || sysGroupsSynced.history.length === 0) {
              const uniqueSports = [...new Set(syncedPlayers.filter(p => !p.isSystem && p.sport && p.sport !== 'العام' && p.sport !== 'General').map(p => p.sport!))];
              if (uniqueSports.length > 0) {
                const newSysGroups = {
                  id: GROUPS_CONFIG_ID,
                  isSystem: true,
                  name: 'إعدادات الجروبات',
                  history: uniqueSports.map((sport, index) => ({
                    desc: sport,
                    subType: 'presence',
                    cost: 0,
                    paid: 0,
                    date: todayStr,
                    timestamp: Date.now() + index
                  }))
                };
                await db.players.put(newSysGroups);
                await syncPlayerToCloud(newSysGroups);
                const finalReload = await db.players.toArray();
                setPlayers(finalReload);
              }
            }
          }
          const syncedExpected = await fetchInitialExpectedAttendeesFromSupabase();
          // Filter out expired ones pulled from cloud, and delete them from Supabase too
          const activeSynced = syncedExpected.filter(att => att.date >= todayStr);
          const expiredSynced = syncedExpected.filter(att => att.date < todayStr);
          if (expiredSynced.length > 0) {
            console.log(`Startup Sync Cleanup: Deleting ${expiredSynced.length} expired expected attendees from cloud.`);
            const expiredIds = expiredSynced.map(att => att.id);
            for (const id of expiredIds) {
              await db.expectedToday.delete(id);
            }
            await supabase.from('expected_today_sync').delete().in('id', expiredIds);
          }
          setExpectedAttendees(activeSynced);

          // Pull cloud wallet entries and merge
          const syncedWallet = await fetchInitialPersonalWalletFromSupabase();
          if (syncedWallet.length > 0) {
            setWalletEntries(syncedWallet);
          }

          // Save the cutoff date for the new accounting rules once (synced to all devices).
          // Attendances before it keep the old calculation, so past months never change.
          const settingsRec = await db.players.get(SETTINGS_ID);
          if (!settingsRec?.settings?.v2From) {
            const base = settingsRec?.settings || getSettings([]);
            await syncPlayerToCloud({
              ...(settingsRec || { id: SETTINGS_ID, isSystem: true, name: 'الإعدادات', history: [] }),
              id: SETTINGS_ID,
              isSystem: true,
              settings: { ...base, v2From: todayStr },
            });
            setPlayers(await db.players.toArray());
          }

          // Weekly automatic backup (read-only snapshot to private Storage bucket)
          runWeeklyBackupIfDue();
        }, 1000);
      }
    };

    initializeData();

    // Step C: Listen to real-time database modifications via Supabase postgres channel
    const channel = supabase
      .channel('realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players_sync' },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const cloudP = payload.new.player_data as Player;
            if (cloudP && cloudP.id) {
              const localP = await db.players.get(cloudP.id);
              if (!localP || (cloudP.last_updated || 0) >= (localP.last_updated || 0)) {
                await db.players.put(cloudP);
                const updatedList = await db.players.toArray();
                setPlayers(updatedList);
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            if (deletedId) {
              await db.players.delete(deletedId);
              const updatedList = await db.players.toArray();
              setPlayers(updatedList);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expected_today_sync' },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const cloudP = payload.new.attendee_data as ExpectedAttendee;
            if (cloudP && cloudP.id) {
              const localP = await db.expectedToday.get(cloudP.id);
              if (!localP || (cloudP.last_updated || 0) >= (localP.last_updated || 0)) {
                await db.expectedToday.put(cloudP);
                const updatedList = await db.expectedToday.toArray();
                setExpectedAttendees(updatedList);
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            if (deletedId) {
              await db.expectedToday.delete(deletedId);
              const updatedList = await db.expectedToday.toArray();
              setExpectedAttendees(updatedList);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'personal_wallet_sync' },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const cloudEntry = payload.new.entry_data as PersonalWalletEntry;
            if (cloudEntry && cloudEntry.id) {
              const localEntry = await db.personalWallet.get(cloudEntry.id);
              if (!localEntry || (cloudEntry.last_updated || 0) >= (localEntry.last_updated || 0)) {
                await db.personalWallet.put(cloudEntry);
                const updatedList = await db.personalWallet.toArray();
                setWalletEntries(updatedList);
              }
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            if (deletedId) {
              await db.personalWallet.delete(deletedId);
              const updatedList = await db.personalWallet.toArray();
              setWalletEntries(updatedList);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    players,
    setPlayers,
    expectedAttendees,
    setExpectedAttendees,
    walletEntries,
    setWalletEntries,
    syncStatus,
  };
}
