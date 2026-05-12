/**
 * Argentina-local date helpers.
 *
 * Argentina runs on UTC-3 year-round (no DST). The daily Peekrbuzz cycle is
 * keyed off "today in Argentina" so editors see one cohort of candidates per
 * Buenos Aires calendar day, regardless of when the cron fires in UTC.
 */

const ARG_OFFSET_HOURS = -3;

/** Returns "YYYY-MM-DD" for today in Argentina-local time. */
export function todayInArgentina(now: Date = new Date()): string {
  const argMs = now.getTime() + ARG_OFFSET_HOURS * 3_600_000;
  const arg = new Date(argMs);
  const y = arg.getUTCFullYear();
  const m = String(arg.getUTCMonth() + 1).padStart(2, "0");
  const d = String(arg.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns ISO string for N hours ago. */
export function hoursAgoIso(hours: number, now: Date = new Date()): string {
  return new Date(now.getTime() - hours * 3_600_000).toISOString();
}
