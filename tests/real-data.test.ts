/**
 * Locks the monthly report numbers of the REAL data so no refactor can change them.
 *
 * The data and the expected numbers live in tests/private/ (git-ignored: names, phones, money).
 * Put an export there as tests/private/real-players.json. The first run writes
 * tests/private/real-monthly.expected.json; every later run must match it exactly.
 * Without the export (e.g. on another machine) this test is skipped.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Player } from '../src/types';
import { computeMonthlyTotals, getSettings, analyzePlayer } from '../src/lib/subscription';
import { computeFinancials } from '../src/lib/reports';

const dir = resolve(__dirname, 'private');
const dataFile = resolve(dir, 'real-players.json');
const expectedFile = resolve(dir, 'real-monthly.expected.json');
const hasData = existsSync(dataFile);

function snapshot() {
  const players: Player[] = JSON.parse(readFileSync(dataFile, 'utf8'));
  const settings = getSettings(players);
  const monthly = computeMonthlyTotals(players, settings);
  const today = '2026-11-18';
  let extraPlayers = 0;
  let extraSessions = 0;
  let gymAdvanced = 0;
  players.forEach(p => {
    if (p.isSystem || p.isDeleted) return;
    const b = analyzePlayer(p, settings, today).balance;
    if (b.extraCount > 0) {
      extraPlayers++;
      extraSessions += b.extraCount;
      gymAdvanced += b.gymAdvanced;
    }
  });
  return { monthly, balances: { extraPlayers, extraSessions, gymAdvanced } };
}

describe.skipIf(!hasData)('real data: report numbers never change', () => {
  it('monthly revenue / gym / expenses / profit match the locked snapshot', () => {
    const now = snapshot();
    if (!existsSync(expectedFile)) {
      writeFileSync(expectedFile, JSON.stringify(now, null, 2));
    }
    const expected = JSON.parse(readFileSync(expectedFile, 'utf8'));
    expect(now).toEqual(expected);
  });

  it('the full profile report (monthly + daily + treasury) matches its locked snapshot', () => {
    const players: Player[] = JSON.parse(readFileSync(dataFile, 'utf8'));
    const f = computeFinancials(players, getSettings(players));
    const now = JSON.parse(JSON.stringify({
      monthlyStats: f.monthlyStats,
      daily: Object.fromEntries(Object.entries(f.dailyStats).map(([k, d]) => [k, { ...d, dateObj: undefined }])),
      allTimeRev: f.allTimeRev,
      allTimeGymCost: f.allTimeGymCost,
      allTimeExtExp: f.allTimeExtExp,
      netProfit: f.netProfit,
    }));
    const file = resolve(dir, 'real-report.expected.json');
    if (!existsSync(file)) writeFileSync(file, JSON.stringify(now, null, 2));
    expect(now).toEqual(JSON.parse(readFileSync(file, 'utf8')));
  });

  it('the profile report (monthly stats) gives the same totals as the top card', () => {
    const players: Player[] = JSON.parse(readFileSync(dataFile, 'utf8'));
    const settings = getSettings(players);
    const top = computeMonthlyTotals(players, settings);
    const report = computeFinancials(players, settings).monthlyStats;
    Object.keys(top).forEach(k => {
      expect({ revenue: report[k].revenue, cost: report[k].cost, expenses: report[k].expenses, profit: report[k].profit })
        .toEqual(top[k]);
    });
  });
});
