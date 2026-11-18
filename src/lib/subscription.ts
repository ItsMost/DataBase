/**
 * Single source of truth for subscriptions and gym money.
 *
 * Words used here:
 *  - paid  = what the player paid the coach.
 *  - cost  = what the coach pays the gym / place.
 *  - "extra session" = an attendance not covered by a package and not paid as a single session.
 *    The coach pays the gym for it out of pocket; the player owes it.
 *
 * History rule: attendances BEFORE settings.v2From are charged with the exact old
 * calculation (legacyAttendanceCharge), so past months never change.
 *
 * Only `import type` here, so this file also runs directly in Node for checks.
 */
import type { Player, HistoryEntry, AppSettings, EndMode } from '../types';

export const SINGLE_SESSION = 'حصة واحدة';
export const EXTRA_PAYMENT = 'حصص زيادة';
export const ATTEND_ONLY_TYPES = ['حضور فقط (مشترك شهرياً)', 'حضور فقط'];
export const SETTINGS_ID = 'sys_settings';
export const DEFAULT_PLACE = 'الجيم';
const LEGACY_GYM_RATE = 60;

export const OTHER_EXPENSE = 'تانية';
export const DEFAULT_EXPENSE_CATEGORIES = ['مواصلات', 'أدوات', 'إيجار', OTHER_EXPENSE];
export const DEFAULT_INACTIVE_DAYS = 30;
export const DEFAULT_REMINDER_TEMPLATE = [
  'أهلاً {الاسم} 👋',
  '{حالة_الاشتراك}',
  '{سطر_الزيادة}',
  'ياريت تجدد الاشتراك علشان نكمل 💪',
].join('\n');
export const DEFAULT_RECEIPT_TEMPLATE = [
  'أهلاً {الاسم} ✅',
  'تم استلام {المبلغ} ج ({نوع_الدفع}) يوم {تاريخ_الدفع}.',
  '{صلاحية_الاشتراك}',
  'شكراً 🙏',
].join('\n');

export const DEFAULT_SETTINGS: AppSettings = {
  gymRates: [{ from: '2000-01-01', rate: 60 }],
  discountThreshold: 1500,
  discountTiers: [
    { sessions: 8, cost: 800 },
    { sessions: 12, cost: 900 },
    { sessions: 16, cost: 1000 },
    { sessions: 20, cost: 1100 },
  ],
};

// ---------------------------------------------------------------------------
// Dates (pure 'YYYY-MM-DD' strings, no time zone surprises)
// ---------------------------------------------------------------------------

export function localToday(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
}

function toUTC(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

function fromUTC(ms: number): string {
  return new Date(ms).toISOString().split('T')[0];
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

export function addDays(dateStr: string, days: number): string {
  return fromUTC(toUTC(dateStr) + days * 86400000);
}

/** One calendar month later (JS overflow rule: Jan 31 -> Mar 3/2), computed in UTC. */
export function addOneMonth(dateStr: string): string {
  const d = new Date(toUTC(dateStr));
  d.setUTCMonth(d.getUTCMonth() + 1);
  return fromUTC(d.getTime());
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ---------------------------------------------------------------------------
// Packages & settings
// ---------------------------------------------------------------------------

/** Number of sessions in a subscription type ("12 حصة" -> 12, single -> 1, others -> 0). */
export function getSessionCount(subType?: string): number {
  if (!subType) return 0;
  if (subType === SINGLE_SESSION) return 1;
  const m = subType.match(/^(\d+)\s*حص/);
  return m ? parseInt(m[1], 10) : 0;
}

export function isPackageType(subType?: string): boolean {
  return !!subType && subType !== SINGLE_SESSION && subType !== EXTRA_PAYMENT && getSessionCount(subType) > 0;
}

export function getSettings(players: Player[]): AppSettings {
  const rec = players.find(p => p.id === SETTINGS_ID)?.settings;
  if (!rec) {
    return {
      ...DEFAULT_SETTINGS,
      inactiveAfterDays: DEFAULT_INACTIVE_DAYS,
      waReminderTemplate: DEFAULT_REMINDER_TEMPLATE,
      waReceiptTemplate: DEFAULT_RECEIPT_TEMPLATE,
      expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
    };
  }
  return {
    gymRates: rec.gymRates && rec.gymRates.length > 0 ? rec.gymRates : DEFAULT_SETTINGS.gymRates,
    discountThreshold: rec.discountThreshold ?? DEFAULT_SETTINGS.discountThreshold,
    discountTiers: rec.discountTiers ?? DEFAULT_SETTINGS.discountTiers,
    v2From: rec.v2From,
    inactiveAfterDays: rec.inactiveAfterDays ?? DEFAULT_INACTIVE_DAYS,
    waReminderTemplate: rec.waReminderTemplate || DEFAULT_REMINDER_TEMPLATE,
    waReceiptTemplate: rec.waReceiptTemplate || DEFAULT_RECEIPT_TEMPLATE,
    expenseCategories: rec.expenseCategories && rec.expenseCategories.length > 0 ? rec.expenseCategories : DEFAULT_EXPENSE_CATEGORIES,
  };
}

/** Gym share per session that applied on a given date. */
export function gymRateAt(settings: AppSettings, dateStr: string): number {
  let rate = settings.gymRates[0]?.rate ?? LEGACY_GYM_RATE;
  [...settings.gymRates]
    .sort((a, b) => a.from.localeCompare(b.from))
    .forEach(r => {
      if (r.from <= dateStr) rate = r.rate;
    });
  return rate;
}

export function currentGymRate(settings: AppSettings): number {
  return gymRateAt(settings, localToday());
}

/** Suggested gym/place money for a payment. The coach can always change it. */
export function suggestGymCost(settings: AppSettings, subType: string, paid: number, dateStr = localToday()): number {
  const rate = gymRateAt(settings, dateStr);
  if (subType === SINGLE_SESSION || ATTEND_ONLY_TYPES.includes(subType)) return rate;
  const sessions = getSessionCount(subType);
  if (sessions <= 0) return 0;
  if (paid >= settings.discountThreshold) {
    const tier = settings.discountTiers.find(t => t.sessions === sessions);
    if (tier) return tier.cost;
  }
  return sessions * rate;
}

/** Cutoff for the new rules; before it the old calculation is used. */
export function getV2From(settings: AppSettings): string {
  return settings.v2From || localToday();
}

// ---------------------------------------------------------------------------
// Old calculation (kept byte-for-byte in behaviour for dates before v2From)
// ---------------------------------------------------------------------------

export function legacyIsCoveredByMonthly(history: HistoryEntry[], attDate: string): HistoryEntry | null {
  const pastHistories = history
    .filter(h => h.date <= attDate && h.subType !== EXTRA_PAYMENT)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (pastHistories.length > 0 && pastHistories[0].subType !== SINGLE_SESSION) {
    const start = new Date(pastHistories[0].date);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    const att = new Date(attDate);
    if (att <= end) return pastHistories[0];
  }
  return null;
}

export function legacyAttendanceCharge(history: HistoryEntry[], attDate: string): number {
  const hasPaidDailyToday = history.some(h => h.date === attDate && h.subType === SINGLE_SESSION);
  const isMonthly = !!legacyIsCoveredByMonthly(history, attDate);
  return !isMonthly && !hasPaidDailyToday ? LEGACY_GYM_RATE : 0;
}

// ---------------------------------------------------------------------------
// Per-player analysis
// ---------------------------------------------------------------------------

export type AttendanceKind = 'single' | 'package' | 'extra';

export interface AttendanceInfo {
  kind: AttendanceKind;
  sub?: HistoryEntry; // package that covers it (kind === 'package')
  sessionNumber?: number; // 1-based number inside that package
  charge: number; // gym money counted for this attendance in reports
}

export interface SubscriptionStatus {
  hasSubscription: boolean;
  isSingle: boolean;
  isExpired: boolean;
  endMode: EndMode | null;
  totalSessions: number; // package size (0 if none)
  usedSessions: number; // sessions used from the package
  extraSessions: number; // attended beyond the package (current subscription)
  attendedInSub: number; // used + extra -> "حضر 15 من 12"
  days: number; // expired: days since it ended; active: days left (estimate for 'sessions')
  endDateStr: string; // dd/mm/yyyy or '-'
  endDate: string | null;
}

export interface PlayerBalance {
  extraDates: string[]; // unsettled extra sessions, oldest first
  extraCount: number;
  gymAdvanced: number; // gym money the coach already paid for them
  oldestDate: string | null;
}

export interface PlayerAnalysis {
  attendance: Map<string, AttendanceInfo>;
  status: SubscriptionStatus;
  balance: PlayerBalance;
  currentSub: HistoryEntry | null;
}

const cache = new WeakMap<Player, { key: string; value: PlayerAnalysis }>();

function settingsKey(settings: AppSettings, today: string) {
  return JSON.stringify(settings) + '|' + today;
}

function sortEntries(a: HistoryEntry, b: HistoryEntry) {
  return a.date.localeCompare(b.date) || (a.timestamp || 0) - (b.timestamp || 0);
}

/** Day a package starts counting sessions (coverFrom on a full renewal, else the payment day). */
export function packageStart(h: HistoryEntry): string {
  return h.coverFrom || h.date;
}

function sortPackages(a: HistoryEntry, b: HistoryEntry) {
  return packageStart(a).localeCompare(packageStart(b)) || (a.timestamp || 0) - (b.timestamp || 0);
}

export function analyzePlayer(player: Player, settings: AppSettings, today = localToday()): PlayerAnalysis {
  const key = settingsKey(settings, today);
  const hit = cache.get(player);
  if (hit && hit.key === key) return hit.value;

  const history = (player.history || []).filter(h => h && h.date);
  const v2From = getV2From(settings);
  const attendanceDates = [...new Set((player.attendance || []).filter(Boolean))].sort();
  const singleDates = new Set(history.filter(h => h.subType === SINGLE_SESSION).map(h => h.date));

  const absorbed = new Map<string, number>();
  const settled = new Set<string>();
  history.forEach(h => {
    h.absorbedExtras?.forEach(x => {
      absorbed.set(x.date, x.gym);
      settled.add(x.date);
    });
    h.settledExtras?.forEach(d => settled.add(d));
  });

  const packages = history.filter(h => isPackageType(h.subType)).sort(sortPackages);

  // Which package covers each attendance (new rules)
  const covered = new Map<string, { sub: HistoryEntry; n: number }>();
  const extraSet = new Set<string>();
  const extrasBySub = new Map<HistoryEntry, string[]>();
  const usedBySub = new Map<HistoryEntry, string[]>();

  attendanceDates.forEach(a => {
    if (singleDates.has(a)) return;
    let idx = -1;
    for (let i = 0; i < packages.length; i++) {
      if (packageStart(packages[i]) <= a) idx = i;
    }
    if (idx === -1) {
      extraSet.add(a);
      return;
    }
    const sub = packages[idx];
    const size = getSessionCount(sub.subType);
    const mode: EndMode = sub.endMode || 'sessions';
    const used = usedBySub.get(sub) || [];
    const inTime = mode === 'sessions' || a <= addOneMonth(packageStart(sub));
    if (inTime && used.length < size) {
      used.push(a);
      usedBySub.set(sub, used);
      covered.set(a, { sub, n: used.length });
    } else {
      extraSet.add(a);
      extrasBySub.set(sub, [...(extrasBySub.get(sub) || []), a]);
    }
  });

  const chargeFor = (a: string): number => {
    if (absorbed.has(a)) return absorbed.get(a)!;
    if (a < v2From) return legacyAttendanceCharge(history, a);
    if (singleDates.has(a)) return 0;
    return extraSet.has(a) ? gymRateAt(settings, a) : 0;
  };

  const attendance = new Map<string, AttendanceInfo>();
  attendanceDates.forEach(a => {
    const charge = chargeFor(a);
    if (singleDates.has(a)) {
      attendance.set(a, { kind: 'single', charge });
    } else if (a < v2From && !absorbed.has(a)) {
      // Before the cutoff, display follows the old rule too.
      const legacySub = legacyIsCoveredByMonthly(history, a);
      if (legacySub && isPackageType(legacySub.subType)) {
        const n = attendanceDates.filter(d => d >= legacySub.date && d <= a && !singleDates.has(d)).length;
        attendance.set(a, { kind: 'package', sub: legacySub, sessionNumber: n, charge });
      } else {
        attendance.set(a, { kind: 'extra', charge });
      }
    } else if (covered.has(a)) {
      const c = covered.get(a)!;
      attendance.set(a, { kind: 'package', sub: c.sub, sessionNumber: c.n, charge });
    } else {
      attendance.set(a, { kind: 'extra', charge });
    }
  });

  // ----- current subscription status -----
  let currentSub: HistoryEntry | null = null;
  if (player.subType && player.startDate) {
    if (isPackageType(player.subType)) {
      currentSub =
        [...packages].reverse().find(h => packageStart(h) === player.startDate && h.subType === player.subType) ||
        packages[packages.length - 1] ||
        null;
      if (!currentSub) {
        currentSub = {
          date: player.startDate,
          subType: player.subType,
          paid: player.paid || 0,
          cost: player.cost || 0,
          desc: player.subType,
          timestamp: 0,
          endMode: player.endMode,
        };
      }
    }
  }

  let status: SubscriptionStatus;
  if (!player.subType || !player.startDate) {
    status = {
      hasSubscription: false, isSingle: false, isExpired: true, endMode: null,
      totalSessions: 0, usedSessions: 0, extraSessions: 0, attendedInSub: 0,
      days: 0, endDateStr: '-', endDate: null,
    };
  } else if (player.subType === SINGLE_SESSION) {
    const end = addDays(player.startDate, 1);
    const isExpired = today > end;
    status = {
      hasSubscription: true, isSingle: true, isExpired, endMode: null,
      totalSessions: 1, usedSessions: 1, extraSessions: 0, attendedInSub: 1,
      days: isExpired ? diffDays(end, today) : 0, endDateStr: formatDate(end), endDate: end,
    };
  } else if (currentSub) {
    const size = getSessionCount(currentSub.subType);
    const mode: EndMode = currentSub.endMode || player.endMode || 'sessions';
    const used = usedBySub.get(currentSub) || [];
    const extras = extrasBySub.get(currentSub) || [];
    const monthEnd = addOneMonth(packageStart(currentSub));
    const finished = used.length >= size;
    let endDate: string;
    let isExpired: boolean;
    if (mode === 'sessions') {
      endDate = finished ? used[size - 1] : monthEnd; // monthEnd is only an estimate while active
      isExpired = finished;
    } else {
      endDate = finished && used[size - 1] < monthEnd ? used[size - 1] : monthEnd;
      isExpired = finished || today > monthEnd;
    }
    status = {
      hasSubscription: true, isSingle: false, isExpired, endMode: mode,
      totalSessions: size, usedSessions: used.length, extraSessions: extras.length,
      attendedInSub: used.length + extras.length,
      days: isExpired ? Math.max(0, diffDays(endDate, today)) : Math.max(0, diffDays(today, endDate)),
      endDateStr: formatDate(endDate), endDate,
    };
  } else {
    status = {
      hasSubscription: false, isSingle: false, isExpired: true, endMode: null,
      totalSessions: 0, usedSessions: 0, extraSessions: 0, attendedInSub: 0,
      days: 0, endDateStr: '-', endDate: null,
    };
  }

  // ----- balance: unsettled extra sessions since the latest payment -----
  const lastEntry = [...history].filter(h => h.subType !== EXTRA_PAYMENT).sort(sortEntries).pop();
  const windowStart = lastEntry ? (isPackageType(lastEntry.subType) ? packageStart(lastEntry) : lastEntry.date) : '';
  const extraDates = [...extraSet].filter(a => a >= windowStart && !settled.has(a)).sort();
  const balance: PlayerBalance = {
    extraDates,
    extraCount: extraDates.length,
    gymAdvanced: extraDates.reduce((sum, a) => sum + chargeFor(a), 0),
    oldestDate: extraDates[0] || null,
  };

  const value: PlayerAnalysis = { attendance, status, balance, currentSub };
  cache.set(player, { key, value });
  return value;
}

/** Gym money counted for one attendance (same number everywhere). */
export function attendanceCharge(player: Player, dateStr: string, settings: AppSettings): number {
  return analyzePlayer(player, settings).attendance.get(dateStr)?.charge ?? 0;
}

// ---------------------------------------------------------------------------
// Monthly totals (top profit card + record month)
// ---------------------------------------------------------------------------

export interface MonthTotals {
  revenue: number;
  cost: number;
  expenses: number;
  profit: number;
}

export function computeMonthlyTotals(players: Player[], settings: AppSettings): Record<string, MonthTotals> {
  const stats: Record<string, MonthTotals> = {};
  const get = (key: string) => (stats[key] ||= { revenue: 0, cost: 0, expenses: 0, profit: 0 });

  players.forEach(p => {
    if (p.isSystem) {
      if (p.id !== 'sys_expenses') return;
      p.history?.forEach(h => {
        if (!h.date) return;
        const parts = h.date.split('-');
        if (parts.length < 2) return;
        const s = get(`${parts[0]}-${parts[1]}`);
        s.expenses += h.cost || 0;
        s.profit -= h.cost || 0;
      });
      return;
    }

    p.history?.forEach(h => {
      if (!h.date) return;
      const parts = h.date.split('-');
      if (parts.length < 2) return;
      const s = get(`${parts[0]}-${parts[1]}`);
      s.revenue += h.paid || 0;
      s.cost += h.cost || 0;
      s.profit += (h.paid || 0) - (h.cost || 0);
    });

    const analysis = analyzePlayer(p, settings);
    p.attendance?.forEach(a => {
      if (!a) return;
      const parts = a.split('-');
      if (parts.length < 2) return;
      const s = get(`${parts[0]}-${parts[1]}`);
      const charge = analysis.attendance.get(a)?.charge ?? 0;
      s.cost += charge;
      s.profit -= charge;
    });
  });

  return stats;
}
