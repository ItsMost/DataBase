/**
 * Report calculations (moved out of ProfileSection without changing any number).
 * Locked by tests/real-data.test.ts and src/lib/__tests__/reports.test.ts.
 */
import type { Player, AppSettings } from '../types';
import {
  analyzePlayer,
  DEFAULT_PLACE,
  OTHER_EXPENSE,
  SINGLE_SESSION,
  EXTRA_PAYMENT,
} from './subscription';

export interface MonthStat {
  revenue: number;
  cost: number;
  profit: number;
  expenses: number;
  count: number;
  monthSubCount: number;
  totalAttendances: number;
  year: number;
  monthIndex: number;
}

export interface DayStat {
  revenue: number;
  cost: number;
  profit: number;
  expenses: number;
  paymentCount: number;
  totalAttendances: number;
  dateObj: Date;
  monthlyRevenue: number;
  dailyRevenue: number;
  monthlyCost: number;
  dailyCost: number;
  monthlyPaymentCount: number;
  dailyPaymentCount: number;
  dailyAttendances: number;
  monthlyAttendances: number;
}

/** Monthly + daily stats and all-time treasury (the profile reports). */
export function computeFinancials(players: Player[], settings: AppSettings) {
  const monthlyStats: {
    [monthKey: string]: {
      revenue: number;
      cost: number;
      profit: number;
      expenses: number;
      count: number;
      monthSubCount: number;
      totalAttendances: number;
      year: number;
      monthIndex: number;
    };
  } = {};

  const dailyStats: {
    [dayKey: string]: {
      revenue: number;
      cost: number;
      profit: number;
      expenses: number;
      paymentCount: number;
      totalAttendances: number;
      dateObj: Date;
      monthlyRevenue: number;
      dailyRevenue: number;
      monthlyCost: number;
      dailyCost: number;
      monthlyPaymentCount: number;
      dailyPaymentCount: number;
      dailyAttendances: number;
      monthlyAttendances: number;
    };
  } = {};

  players.forEach(p => {
    if (p.isSystem) {
      if (p.id !== 'sys_expenses') return; // Ignore non-expense system players
      if (p.history) {
        p.history.forEach(h => {
          const [y, m, d] = h.date.split('-');
          const monthKey = `${y}-${m}`;
          const hDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));

          if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = {
              revenue: 0, cost: 0, profit: 0, expenses: 0, count: 0,
              monthSubCount: 0, totalAttendances: 0, year: parseInt(y), monthIndex: parseInt(m) - 1
            };
          }
          monthlyStats[monthKey].expenses += h.cost || 0;
          monthlyStats[monthKey].profit -= h.cost || 0;

          const dayKey = h.date;
          if (!dailyStats[dayKey]) {
            dailyStats[dayKey] = {
              revenue: 0, cost: 0, profit: 0, expenses: 0,
              paymentCount: 0, totalAttendances: 0, dateObj: hDate,
              monthlyRevenue: 0, dailyRevenue: 0,
              monthlyCost: 0, dailyCost: 0,
              monthlyPaymentCount: 0, dailyPaymentCount: 0,
              dailyAttendances: 0, monthlyAttendances: 0
            };
          }
          dailyStats[dayKey].expenses += h.cost || 0;
          dailyStats[dayKey].profit -= h.cost || 0;
        });
      }
    } else {
      if (p.history) {
        p.history.forEach(h => {
          const [y, m, d] = h.date.split('-');
          const monthKey = `${y}-${m}`;
          const hDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));

          // 1. Monthly stats and overall treasury:
          if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = {
              revenue: 0, cost: 0, profit: 0, expenses: 0, count: 0,
              monthSubCount: 0, totalAttendances: 0, year: parseInt(y), monthIndex: parseInt(m) - 1
            };
          }
          monthlyStats[monthKey].revenue += h.paid || 0;
          monthlyStats[monthKey].cost += h.cost || 0;
          monthlyStats[monthKey].profit += (h.paid || 0) - (h.cost || 0);
          monthlyStats[monthKey].count++;
          
          if (h.subType && h.subType !== SINGLE_SESSION && h.subType !== EXTRA_PAYMENT) {
            monthlyStats[monthKey].monthSubCount++;
          }

          // 2. Daily stats (History by day):
          const dayKey = h.date;
          if (!dailyStats[dayKey]) {
            dailyStats[dayKey] = {
              revenue: 0, cost: 0, profit: 0, expenses: 0,
              paymentCount: 0, totalAttendances: 0, dateObj: hDate,
              monthlyRevenue: 0, dailyRevenue: 0,
              monthlyCost: 0, dailyCost: 0,
              monthlyPaymentCount: 0, dailyPaymentCount: 0,
              dailyAttendances: 0, monthlyAttendances: 0
            };
          }

          dailyStats[dayKey].revenue += h.paid || 0;
          dailyStats[dayKey].cost += h.cost || 0;
          dailyStats[dayKey].profit += (h.paid || 0) - (h.cost || 0);
          dailyStats[dayKey].paymentCount++;

          if (h.subType === 'حصة واحدة') {
            dailyStats[dayKey].dailyRevenue += h.paid || 0;
            dailyStats[dayKey].dailyCost += h.cost || 0;
            dailyStats[dayKey].dailyPaymentCount++;
          } else {
            dailyStats[dayKey].monthlyRevenue += h.paid || 0;
            dailyStats[dayKey].monthlyCost += h.cost || 0;
            dailyStats[dayKey].monthlyPaymentCount++;
          }
        });
      }

      if (p.attendance) {
        p.attendance.forEach(attDateStr => {
          if (!attDateStr) return;
          const [y, m, d] = attDateStr.split('-');
          const monthKey = `${y}-${m}`;
          const attDateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));

          if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = {
              revenue: 0, cost: 0, profit: 0, expenses: 0, count: 0,
              monthSubCount: 0, totalAttendances: 0, year: parseInt(y), monthIndex: parseInt(m) - 1
            };
          }
          monthlyStats[monthKey].totalAttendances++;

          const dayKey = attDateStr;
          if (!dailyStats[dayKey]) {
            dailyStats[dayKey] = {
              revenue: 0, cost: 0, profit: 0, expenses: 0,
              paymentCount: 0, totalAttendances: 0, dateObj: attDateObj,
              monthlyRevenue: 0, dailyRevenue: 0,
              monthlyCost: 0, dailyCost: 0,
              monthlyPaymentCount: 0, dailyPaymentCount: 0,
              dailyAttendances: 0, monthlyAttendances: 0
            };
          }
          dailyStats[dayKey].totalAttendances++;

          // Gym money for this attendance from the shared engine (old rule before the cutoff,
          // extra sessions after it). Same number as the top profit card.
          const attInfo = analyzePlayer(p, settings).attendance.get(attDateStr);
          const isMonthly = attInfo?.kind === 'package';
          const attCharge = attInfo?.charge ?? 0;

          if (isMonthly) {
            dailyStats[dayKey].monthlyAttendances++;
          } else {
            dailyStats[dayKey].dailyAttendances++;
          }

          if (attCharge > 0) {
            dailyStats[dayKey].cost += attCharge;
            dailyStats[dayKey].dailyCost += attCharge; // Include in daily cost breakdown
            dailyStats[dayKey].profit -= attCharge;
            monthlyStats[monthKey].cost += attCharge;
            monthlyStats[monthKey].profit -= attCharge;
          }
        });
      }
    }
  });

  // 1. All-time Treasury Totals
  let allTimeRev = 0;
  let allTimeGymCost = 0;
  let allTimeExtExp = 0;

  for (const key in monthlyStats) {
    allTimeRev += monthlyStats[key].revenue;
    allTimeGymCost += monthlyStats[key].cost;
    allTimeExtExp += monthlyStats[key].expenses;
  }

  const totalOut = allTimeGymCost + allTimeExtExp;
  const netProfit = allTimeRev - totalOut;

  // 2. Sort keys chronologically
  const chronologicalKeys = Object.keys(monthlyStats).sort((a, b) => a.localeCompare(b));
  const reversedKeys = [...chronologicalKeys].reverse();

  const chronologicalDailyKeys = Object.keys(dailyStats).sort((a, b) => a.localeCompare(b));
  const reversedDailyKeys = [...chronologicalDailyKeys].reverse();

  return {
    allTimeRev,
    allTimeGymCost,
    allTimeExtExp,
    totalOut,
    netProfit,
    monthlyStats,
    dailyStats,
    chronologicalKeys,
    reversedKeys,
    chronologicalDailyKeys,
    reversedDailyKeys,
  };
}

export type Financials = ReturnType<typeof computeFinancials>;

/** Other expenses by type and gym/place share by place, per month (display only). */
export function computeBreakdowns(players: Player[], settings: AppSettings) {
  const expByCat: Record<string, Record<string, number>> = {};
  const gymByPlace: Record<string, Record<string, number>> = {};
  const add = (map: Record<string, Record<string, number>>, month: string, key: string, v: number) => {
    if (!v) return;
    map[month] ||= {};
    map[month][key] = (map[month][key] || 0) + v;
  };
  players.forEach(p => {
    if (p.isSystem) {
      if (p.id !== 'sys_expenses') return;
      p.history?.forEach(h => h.date && add(expByCat, h.date.slice(0, 7), h.category || OTHER_EXPENSE, h.cost || 0));
      return;
    }
    p.history?.forEach(h => h.date && add(gymByPlace, h.date.slice(0, 7), h.place || DEFAULT_PLACE, h.cost || 0));
    const a = analyzePlayer(p, settings);
    p.attendance?.forEach(d => {
      if (!d) return;
      const info = a.attendance.get(d);
      if (!info || !info.charge) return;
      add(gymByPlace, d.slice(0, 7), info.sub?.place || a.currentSub?.place || DEFAULT_PLACE, info.charge);
    });
  });
  const places = new Set<string>();
  Object.values(gymByPlace).forEach(m => Object.keys(m).forEach(k => places.add(k)));
  return { expByCat, gymByPlace, multiplePlaces: places.size > 1 };
}

/** "2026-11" -> "2026-10" */
export function previousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Profit of the first `days` days of a month, from the daily stats (same numbers as the report). */
export function partialMonthProfit(dailyStats: Record<string, { profit: number }>, monthKey: string, days: number): number {
  return Object.entries(dailyStats).reduce((sum, [dayKey, st]) => {
    if (!dayKey.startsWith(monthKey + '-')) return sum;
    return parseInt(dayKey.slice(8, 10), 10) <= days ? sum + st.profit : sum;
  }, 0);
}

/**
 * Fair comparison for the running month: its first N days vs the first N days of the month before
 * (N capped at the previous month's length). Returns null for finished months.
 */
export function fairMonthComparison(
  dailyStats: Record<string, { profit: number }>,
  monthKey: string,
  today: string,
  hasPreviousMonth: boolean,
): { current: number; previous: number; days: number; previousDays: number; previousKey: string } | null {
  if (monthKey !== today.slice(0, 7) || !hasPreviousMonth) return null;
  const previousKey = previousMonthKey(monthKey);
  const days = parseInt(today.slice(8, 10), 10);
  const previousDays = Math.min(days, daysInMonth(previousKey));
  return {
    current: partialMonthProfit(dailyStats, monthKey, days),
    previous: partialMonthProfit(dailyStats, previousKey, previousDays),
    days,
    previousDays,
    previousKey,
  };
}
