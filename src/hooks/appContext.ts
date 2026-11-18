/**
 * What the screen (App) shares with the hooks.
 */
import type { Dispatch, SetStateAction } from 'react';
import type {
  Player,
  ExpectedAttendee,
  PersonalWalletEntry,
  AppSettings,
} from '../types';
import type { SubscriptionStatus } from '../lib/subscription';
import type { ReceiptInfo } from '../lib/messages';

export interface AppContextValue {
  players: Player[];
  setPlayers: Dispatch<SetStateAction<Player[]>>;
  expectedAttendees: ExpectedAttendee[];
  setExpectedAttendees: Dispatch<SetStateAction<ExpectedAttendee[]>>;
  walletEntries: PersonalWalletEntry[];
  setWalletEntries: Dispatch<SetStateAction<PersonalWalletEntry[]>>;
  triggerToast: (message: string, isError?: boolean) => void;
  appSettings: AppSettings;
  setReceipt: Dispatch<SetStateAction<ReceiptInfo | null>>;
  setEditingPlayer: Dispatch<SetStateAction<Player | null>>;
  playerToDeleteId: string | null;
  setPlayerToDeleteId: Dispatch<SetStateAction<string | null>>;
  checkExpiration: (player: Player) => SubscriptionStatus;
}
