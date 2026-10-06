/**
 * lib/rehab/dates.ts
 *
 * Calendar-day arithmetic for prescriptions. A "date key" is a plain `YYYY-MM-DD`
 * string in the patient's own timezone, so "today", "day 6" and "this week" mean
 * the same thing on the server, in a cron run and on the patient's phone.
 * No dependencies; pure functions only.
 */

export type DateKey = string;

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== "string" || !KEY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

export function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The calendar day an instant falls on in `timeZone`. */
export function dateKeyInTimezone(instant: Date, timeZone: string = DEFAULT_TIMEZONE): DateKey {
  const tz = isValidTimezone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Hour of day (0-23) of an instant in `timeZone`. */
export function hourInTimezone(instant: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  const tz = isValidTimezone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(instant);
  return Number(hour) % 24;
}

function toUtcMs(key: DateKey): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(key: DateKey, days: number): DateKey {
  const next = new Date(toUtcMs(key) + days * 86_400_000);
  return next.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(key: DateKey): number {
  return new Date(toUtcMs(key)).getUTCDay();
}

export function formatDateKey(key: DateKey, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  return new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: "UTC" }).format(new Date(toUtcMs(key)));
}

/**
 * "Today" in UTC-12, the last timezone to reach any new day. A day strictly before this
 * key has therefore ended everywhere on Earth, which lets a review day be closed out
 * without knowing the patient's timezone.
 */
export function dayEndedEverywhere(now: Date = new Date()): DateKey {
  return dateKeyInTimezone(now, "Etc/GMT+12");
}
