import { WEEK_DAYS, type WeekDay } from "./constants";

/** Local yyyy-mm-dd — never UTC, since a calendar day is defined by the employee's own clock. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** Monday of the week containing `d`, as a yyyy-mm-dd. */
export function mondayOf(d: Date): string {
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  return ymd(addDays(d, diff));
}

export const WEEK_DAY_LABEL: Record<WeekDay, string> = {
  MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat", SUN: "Sun",
};

/** The seven yyyy-mm-dd dates of the week starting at `weekStart` (a Monday). */
export function weekDates(weekStart: string): Record<WeekDay, string> {
  const monday = parseYmd(weekStart);
  const entries = WEEK_DAYS.map((wd, i) => [wd, ymd(addDays(monday, i))] as const);
  return Object.fromEntries(entries) as Record<WeekDay, string>;
}

export function defaultWeekDays(): Record<WeekDay, "WORKING" | "WEEK_OFF"> {
  return { MON: "WORKING", TUE: "WORKING", WED: "WORKING", THU: "WORKING", FRI: "WORKING", SAT: "WORKING", SUN: "WEEK_OFF" };
}
