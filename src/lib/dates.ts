// Date handling.
//
// All date-only columns use Prisma `@db.Date`, which round-trips a calendar
// date as UTC midnight. To avoid timezone shifts (the hostel runs on Pakistan
// time, and the server may run on UTC), we always read/write date-only values
// via their UTC components and never run them through local-timezone conversion.

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-09-12" — canonical date string for a Date (uses UTC parts). */
export function toDateString(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a "YYYY-MM-DD" string into a UTC-midnight Date. */
export function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

/** "12 Sep 2026" */
export function formatDisplayDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Current "YYYY-MM" period based on Pakistan time (UTC+5). */
export function currentPeriod(now: Date = new Date()): string {
  const pk = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return `${pk.getUTCFullYear()}-${String(pk.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "September 2026" for a "YYYY-MM" period. */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Shift a "YYYY-MM" period by n months (may be negative). */
export function addMonths(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Inclusive list of "YYYY-MM" periods from start to end. */
export function periodsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard < 240) {
    out.push(cur);
    cur = addMonths(cur, 1);
    guard++;
  }
  return out;
}

export function isValidPeriod(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function isValidDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDate(s).getTime());
}

/** Today's date as a "YYYY-MM-DD" string (Pakistan time). */
export function todayString(): string {
  return toDateString(new Date(Date.now() + 5 * 60 * 60 * 1000));
}
