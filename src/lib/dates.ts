/**
 * Date helpers on plain 'YYYY-MM-DD' strings (no time-zone surprises).
 */

/** Today's date on the device, as 'YYYY-MM-DD'. */
export function localToday(): string {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
}

/** 'YYYY-MM-DD' for a local calendar day (month is 0-based like Date). */
export function dateKey(year: number, month: number, day: number): string {
  const d = new Date(year, month, day);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
}

/** 'YYYY-MM' of today. */
export function currentMonthKey(): string {
  return localToday().slice(0, 7);
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

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
