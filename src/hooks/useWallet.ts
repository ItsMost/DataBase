/**
 * Personal wallet entries.
 * Moved out of App.tsx without changing the logic.
 */
import type { PersonalWalletEntry } from '../types';
import { db } from '../services/db';
import { syncPersonalWalletToCloud, deletePersonalWalletFromCloud } from '../services/sync';
import type { AppContextValue } from './appContext';

export function useWallet(ctx: AppContextValue) {
  const { setWalletEntries } = ctx;

  // Personal Wallet Handlers
  const handleSaveWalletEntry = async (entryData: Omit<PersonalWalletEntry, 'timestamp'>) => {
    const existing = await db.personalWallet.get(entryData.id);
    const newEntry: PersonalWalletEntry = {
      ...existing,
      ...entryData,
      timestamp: existing?.timestamp || Date.now(),
    };

    await syncPersonalWalletToCloud(newEntry);
    const updated = await db.personalWallet.toArray();
    setWalletEntries(updated);
  };

  const handleDeleteWalletEntry = async (id: string) => {
    await deletePersonalWalletFromCloud(id);
    const updated = await db.personalWallet.toArray();
    setWalletEntries(updated);
  };

  return {
    handleSaveWalletEntry,
    handleDeleteWalletEntry,
  };
}
