export interface HistoryEntry {
  desc: string;
  cost: number;
  paid: number;
  date: string;
  timestamp: number;
  subType: string;
  // --- Phase 2 (all optional; old entries keep working) ---
  endMode?: EndMode; // How a package ends. Missing = 'sessions'.
  place?: string; // Where the coach trains this player (default "الجيم").
  // Renewal that started at the first extra session: those dates were already
  // charged to the gym, so their gym money is stored here and deducted from `cost`.
  absorbedExtras?: { date: string; gym: number }[];
  // Package sessions are counted from this date (first extra session on a full renewal).
  // `date` stays the day the money was paid, so the payment lands in the right month.
  coverFrom?: string;
  // "حصص زيادة" payment: the extra-session dates this payment settles.
  settledExtras?: string[];
}

export type EndMode = 'sessions' | 'month';

export interface AppSettings {
  // Gym share per session, with the date each rate starts (keeps history exact).
  gymRates: { from: string; rate: number }[];
  discountThreshold: number;
  discountTiers: { sessions: number; cost: number }[];
  // Attendances before this date keep the old calculation (history unchanged).
  v2From?: string;
}

export interface Player {
  id: string; // Stored as a string to match Supabase's PK type
  number?: string;
  name: string;
  birthYear?: string | number;
  sport?: string;
  club?: string;
  phone?: string;
  position?: string; // Player position on field (e.g. forward, playmaker)
  height?: string | number;
  weight?: string | number;
  fat?: string | number;
  muscle?: string | number;
  subType?: string;
  startDate?: string;
  paid?: number;
  cost?: number;
  attendance?: string[];
  history?: HistoryEntry[];
  isSystem?: boolean; // True for system configurations like general expenses
  isDeleted?: boolean; // True if the player is soft-deleted/archived
  last_updated?: number;
  endMode?: EndMode; // End mode of the current subscription
  settings?: AppSettings; // Only on the 'sys_settings' system record
}

export interface SyncAction {
  id?: number; // Auto-incremented local queue ID
  playerId: string;
  action: 'save' | 'delete' | 'save_expected' | 'delete_expected' | 'save_wallet' | 'delete_wallet';
  playerData?: Player; // Holds full player data for delayed saves
  timestamp: number;
}

export interface ExpectedAttendee {
  id: string; // Stored as a string to match Supabase's PK type
  name: string;
  sport: string;
  paid: number;
  subType: string;
  date: string;
  time?: string; // Expected arrival time (e.g. "17:00")
  playerId?: string; // Link to existing player if chosen from database
  last_updated?: number;
  cost?: number; // Gym/place money typed by the coach
  endMode?: EndMode;
  place?: string;
  isDeleted?: boolean; // True if soft-deleted/registered/archived
}

export interface PersonalWalletEntry {
  id: string;
  desc: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  timestamp: number;
  last_updated?: number;
  isDeleted?: boolean;
}

