import { WEEK_DAYS, type WeekDay } from "./constants";

/** YYYY-MM-DD in local time — the key format for attendance/roster/holiday docs. */
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday of the week containing `d`, as YYYY-MM-DD. */
export function mondayOf(d: Date): string {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return ymd(copy);
}

export function addDaysYmd(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d! + days);
  return ymd(dt);
}

export function monthRange(monthStart: Date): { start: string; end: string } {
  const start = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
  const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  return { start: ymd(start), end: ymd(end) };
}

/** Sat/Sun off, everything else working — the common default before anyone edits a week. */
export function defaultWeekDays(): Record<WeekDay, "WORKING" | "WEEK_OFF"> {
  return Object.fromEntries(WEEK_DAYS.map((d) => [d, d === "SAT" || d === "SUN" ? "WEEK_OFF" : "WORKING"])) as Record<WeekDay, "WORKING" | "WEEK_OFF">;
}
