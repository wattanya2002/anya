/** Business dates are calendar days in Asia/Bangkok, represented as YYYY-MM-DD strings. */
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });

export function bangkokToday(now = new Date()): string {
  return fmt.format(now);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

export function parseRange(value: string | string[] | undefined): RangeDays {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (RANGE_OPTIONS as readonly number[]).includes(n) ? (n as RangeDays) : 30;
}

/** Current window = last `days` days ending today; previous = the equal window before it. */
export function windows(days: number, today = bangkokToday()) {
  const curEnd = today;
  const curStart = addDays(today, -(days - 1));
  const prevEnd = addDays(curStart, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  return { curStart, curEnd, prevStart, prevEnd };
}
