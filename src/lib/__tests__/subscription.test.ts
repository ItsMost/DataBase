import { describe, it, expect } from 'vitest';
import type { Player, HistoryEntry, AppSettings } from '../../types';
import {
  analyzePlayer,
  computeMonthlyTotals,
  suggestGymCost,
  getSettings,
  DEFAULT_SETTINGS,
  SINGLE_SESSION,
  EXTRA_PAYMENT,
} from '../subscription';

// New rules apply from this date (attendances before it use the old calculation)
const settings: AppSettings = { ...getSettings([]), ...DEFAULT_SETTINGS, v2From: '2026-11-18' };

let ts = 1;
const entry = (date: string, subType: string, paid: number, cost: number, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
  date, subType, paid, cost, desc: subType, timestamp: ts++, ...extra,
});

/** n dates starting at `from`, every `step` days */
const dates = (from: string, n: number, step = 2): string[] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i * step);
    return d.toISOString().slice(0, 10);
  });

const player = (id: string, p: Partial<Player>): Player => ({ id, name: id, attendance: [], history: [], ...p });

describe('subscription by sessions: attended 15 of 12', () => {
  const p = player('A', {
    subType: '12 حصة', startDate: '2026-11-20', paid: 1200, cost: 720, endMode: 'sessions',
    attendance: dates('2026-11-20', 15, 3), // crosses into December, still counted by sessions
    history: [entry('2026-11-20', '12 حصة', 1200, 720, { endMode: 'sessions' })],
  });
  const a = analyzePlayer(p, settings, '2027-01-10');

  it('shows 15 of 12 with 3 extra sessions and is finished', () => {
    expect(a.status.attendedInSub).toBe(15);
    expect(a.status.totalSessions).toBe(12);
    expect(a.status.usedSessions).toBe(12);
    expect(a.status.extraSessions).toBe(3);
    expect(a.status.isExpired).toBe(true);
  });

  it('the coach advanced the gym share for the 3 extras', () => {
    expect(a.balance.extraCount).toBe(3);
    expect(a.balance.gymAdvanced).toBe(180);
  });

  it('gym money = package 720 + 3 extras x 60, in the months they were attended', () => {
    const t = computeMonthlyTotals([p], settings);
    const totalGym = Object.values(t).reduce((s, m) => s + m.cost, 0);
    expect(totalGym).toBe(720 + 180);
    expect(t['2027-01'].cost).toBe(60); // the 15th session was attended in January
    expect(t['2026-11'].revenue).toBe(1200);
  });

  it('crossing the month does not create extras while sessions remain', () => {
    const q = { ...p, attendance: dates('2026-11-20', 12, 4) }; // 12 sessions over ~45 days
    expect(analyzePlayer(q, settings, '2027-01-10').balance.extraCount).toBe(0);
  });
});

describe('subscription by month: ended with sessions left', () => {
  const p = player('B', {
    subType: '8 حصص', startDate: '2026-11-20', paid: 800, cost: 480, endMode: 'month',
    attendance: ['2026-11-21', '2026-11-25', '2026-12-01', '2026-12-08', '2026-12-15', '2026-12-22', '2026-12-26'],
    history: [entry('2026-11-20', '8 حصص', 800, 480, { endMode: 'month' })],
  });
  const a = analyzePlayer(p, settings, '2026-12-30');

  it('is expired by date with 3 sessions unused', () => {
    expect(a.status.isExpired).toBe(true);
    expect(a.status.usedSessions).toBe(5);
    expect(a.status.totalSessions - a.status.usedSessions).toBe(3);
  });

  it('sessions after the month are extras', () => {
    expect(a.status.extraSessions).toBe(2);
    expect(a.balance.extraDates).toEqual(['2026-12-22', '2026-12-26']);
    expect(a.balance.gymAdvanced).toBe(120);
  });

  it('is still active before the month ends', () => {
    const early = analyzePlayer({ ...p, attendance: ['2026-11-21'] }, settings, '2026-12-01');
    expect(early.status.isExpired).toBe(false);
    expect(early.status.days).toBe(19); // until 2026-12-20
  });
});

describe('single session', () => {
  const p = player('C', {
    subType: SINGLE_SESSION, startDate: '2026-11-25', paid: 100, cost: 60,
    attendance: ['2026-11-25'],
    history: [entry('2026-11-25', SINGLE_SESSION, 100, 60)],
  });

  it('is not an extra and gym is counted once', () => {
    const a = analyzePlayer(p, settings, '2026-11-25');
    expect(a.balance.extraCount).toBe(0);
    expect(a.attendance.get('2026-11-25')?.kind).toBe('single');
    expect(computeMonthlyTotals([p], settings)['2026-11']).toEqual({ revenue: 100, cost: 60, expenses: 0, profit: 40 });
  });

  it('expires the day after', () => {
    expect(analyzePlayer(p, settings, '2026-11-26').status.isExpired).toBe(false);
    expect(analyzePlayer(p, settings, '2026-11-27').status.isExpired).toBe(true);
  });
});

describe('paying the extra sessions only', () => {
  const base = player('D', {
    subType: '8 حصص', startDate: '2026-11-20', paid: 800, cost: 480, endMode: 'sessions',
    attendance: dates('2026-11-20', 10, 2),
    history: [entry('2026-11-20', '8 حصص', 800, 480, { endMode: 'sessions' })],
  });
  const before = analyzePlayer(base, settings, '2026-12-20');
  const paidPlayer: Player = {
    ...base,
    history: [...base.history!, entry('2026-12-20', EXTRA_PAYMENT, 300, 0, { settledExtras: before.balance.extraDates })],
  };

  it('clears the balance', () => {
    expect(before.balance.extraCount).toBe(2);
    expect(analyzePlayer(paidPlayer, settings, '2026-12-20').balance.extraCount).toBe(0);
  });

  it('adds the money to revenue and does not touch the gym numbers', () => {
    const t1 = computeMonthlyTotals([base], settings);
    const t2 = computeMonthlyTotals([paidPlayer], settings);
    expect(t2['2026-11'].cost).toBe(t1['2026-11'].cost);
    expect(t2['2026-12'].cost).toBe(t1['2026-12'].cost);
    expect(t2['2026-12'].revenue - t1['2026-12'].revenue).toBe(300);
  });
});

describe('late renewal: gym money is not counted twice', () => {
  // Old package in July; extra sessions in August/September (before the cutoff), renewed in November
  const p = player('F', {
    subType: '8 حصص', startDate: '2026-07-01', paid: 800, cost: 480,
    attendance: [...dates('2026-07-02', 8, 3), '2026-08-19', '2026-08-22', '2026-09-01'],
    history: [entry('2026-07-01', '8 حصص', 800, 480)],
  });
  const a = analyzePlayer(p, settings, '2026-11-20');
  const absorbed = a.balance.extraDates.map(d => ({ date: d, gym: a.attendance.get(d)!.charge }));
  const gym = absorbed.reduce((s, x) => s + x.gym, 0);
  const renewed: Player = {
    ...p,
    startDate: a.balance.oldestDate!,
    history: [...p.history!, entry('2026-11-20', '8 حصص', 900, 480 - gym, { coverFrom: a.balance.oldestDate!, absorbedExtras: absorbed })],
  };
  const before = computeMonthlyTotals([p], settings);
  const after = computeMonthlyTotals([renewed], settings);

  it('finds the 3 extras and their gym money', () => {
    expect(a.balance.extraCount).toBe(3);
    expect(gym).toBe(180);
  });

  it('past months stay exactly the same', () => {
    for (const m of ['2026-07', '2026-08', '2026-09']) expect(after[m]).toEqual(before[m]);
  });

  it('the payment lands in the payment month with the reduced gym cost', () => {
    expect(after['2026-11'].revenue).toBe(900);
    expect(after['2026-11'].cost).toBe(300);
  });

  it('the extras become the first sessions of the new package', () => {
    const r = analyzePlayer(renewed, settings, '2026-11-20');
    expect(r.balance.extraCount).toBe(0);
    expect(r.status.usedSessions).toBe(3);
  });
});

describe('discounted packages (paid >= 1500)', () => {
  it('uses the discount table', () => {
    expect(suggestGymCost(settings, '8 حصص', 1500)).toBe(800);
    expect(suggestGymCost(settings, '12 حصة', 1500)).toBe(900);
    expect(suggestGymCost(settings, '16 حصة', 2000)).toBe(1000);
    expect(suggestGymCost(settings, '20 حصة', 1500)).toBe(1100);
  });
  it('10 sessions are excluded', () => {
    expect(suggestGymCost(settings, '10 حصص', 1500)).toBe(600);
  });
  it('below the threshold: share x sessions', () => {
    expect(suggestGymCost(settings, '12 حصة', 1499)).toBe(720);
    expect(suggestGymCost(settings, SINGLE_SESSION, 0)).toBe(60);
  });
  it('a new gym share applies from its date only', () => {
    const s70: AppSettings = { ...settings, gymRates: [{ from: '2000-01-01', rate: 60 }, { from: '2026-12-01', rate: 70 }] };
    expect(suggestGymCost(s70, '8 حصص', 0, '2026-11-30')).toBe(480);
    expect(suggestGymCost(s70, '8 حصص', 0, '2026-12-01')).toBe(560);
  });
});

describe('old calculation before the cutoff', () => {
  it('attendance after the month window costs 60 (as before), inside the window costs 0', () => {
    const p = player('L', {
      subType: '12 حصة', startDate: '2026-09-01', paid: 1000, cost: 720,
      attendance: ['2026-09-05', '2026-10-05'],
      history: [entry('2026-09-01', '12 حصة', 1000, 720)],
    });
    const a = analyzePlayer(p, settings, '2026-11-20');
    expect(a.attendance.get('2026-09-05')?.charge).toBe(0);
    expect(a.attendance.get('2026-10-05')?.charge).toBe(60);
  });
});

describe('deleted players (trash)', () => {
  it("their old money stays counted in the reports", () => {
    const p = player('Z', {
      isDeleted: true,
      attendance: ['2026-10-05'],
      history: [entry('2026-10-05', SINGLE_SESSION, 150, 60)],
    });
    expect(computeMonthlyTotals([p], settings)['2026-10']).toEqual({ revenue: 150, cost: 60, expenses: 0, profit: 90 });
  });
});
