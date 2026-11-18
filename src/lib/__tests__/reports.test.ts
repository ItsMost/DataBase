import { describe, it, expect } from 'vitest';
import type { Player, HistoryEntry } from '../../types';
import { computeFinancials, fairMonthComparison, previousMonthKey, daysInMonth } from '../reports';
import { computeMonthlyTotals, getSettings } from '../subscription';

const settings = { ...getSettings([]), v2From: '2026-11-18' };
let ts = 1;
const pay = (date: string, paid: number, cost: number): HistoryEntry => ({
  date, subType: 'حصة واحدة', paid, cost, desc: 'حصة واحدة', timestamp: ts++,
});

// October: 300 profit in the first 17 days, 500 more later. November: 200 in the first 17 days.
const players: Player[] = [
  {
    id: 'x', name: 'x',
    attendance: ['2026-10-03', '2026-10-15', '2026-10-25', '2026-11-05', '2026-11-12'],
    history: [
      pay('2026-10-03', 210, 60), pay('2026-10-15', 210, 60), pay('2026-10-25', 560, 60),
      pay('2026-11-05', 160, 60), pay('2026-11-12', 160, 60),
    ],
  },
];

describe('current month vs the same days of the previous month', () => {
  const f = computeFinancials(players, settings);

  it('compares the first 17 days of November with the first 17 days of October', () => {
    const r = fairMonthComparison(f.dailyStats, '2026-11', '2026-11-17', true)!;
    expect(r.days).toBe(17);
    expect(r.previousDays).toBe(17);
    expect(r.previousKey).toBe('2026-10');
    expect(r.current).toBe(200);
    expect(r.previous).toBe(300); // the 25 October payment is outside the first 17 days
  });

  it('finished months are not "fair-compared" (full month vs full month)', () => {
    expect(fairMonthComparison(f.dailyStats, '2026-10', '2026-11-17', true)).toBeNull();
  });

  it('caps the days at the length of the previous month (31 March vs February)', () => {
    expect(fairMonthComparison({}, '2026-03', '2026-03-31', true)!.previousDays).toBe(28);
  });

  it('month helpers', () => {
    expect(previousMonthKey('2026-01')).toBe('2025-12');
    expect(daysInMonth('2024-02')).toBe(29);
  });

  it('report month totals equal the top card totals', () => {
    const top = computeMonthlyTotals(players, settings);
    expect(f.monthlyStats['2026-10'].profit).toBe(top['2026-10'].profit);
    expect(f.monthlyStats['2026-11'].revenue).toBe(top['2026-11'].revenue);
  });
});
