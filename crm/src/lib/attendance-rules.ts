import type { WeekDay } from "./constants";
import { weekDayOf } from "./dates";
import type { AttendanceRules, AttendanceStatus, RosterWeek, ScheduleMode } from "./types";

/** An employee's own override wins; with none set, the org's default mode applies. */
export function effectiveScheduleMode(userMode: ScheduleMode | null | undefined, rules: AttendanceRules): ScheduleMode {
  return userMode ?? rules.defaultMode;
}

/**
 * Whether `weekDay` is a day this employee is expected in, given their
 * effective mode. ROSTER checks that week's saved roster entry — with none
 * saved yet, every day defaults to "expected in" (matching blankRosterWeek's
 * own Mon–Sat default) rather than silently excusing an unset roster.
 * FLAT_SHIFT uses the org's configured workingDays instead of a roster.
 */
export function isWorkingDay(mode: ScheduleMode, weekDay: WeekDay, roster: RosterWeek | null, rules: AttendanceRules): boolean {
  if (mode === "ROSTER") return roster ? roster.days[weekDay] === "WORKING" : true;
  return rules.workingDays.includes(weekDay);
}

/** Minutes `at` falls after `rules.shiftStart` on its own calendar day — negative if early. */
export function minutesLate(at: Date, rules: AttendanceRules): number {
  const [h, m] = rules.shiftStart.split(":").map(Number);
  const expected = new Date(at);
  expected.setHours(h ?? 0, m ?? 0, 0, 0);
  return Math.round((at.getTime() - expected.getTime()) / 60000);
}

/**
 * The status a check-in at `at` earns under `rules` — on-time (within grace)
 * stays PRESENT, moderately late becomes HALF_DAY, and beyond the absent
 * threshold becomes ABSENT even though a punch was actually recorded (the
 * spec calls for exactly this: "half day and full absent after certain
 * limit" are two thresholds on the same lateness scale, not separate
 * concepts). Same thresholds apply whether the day came from a roster or
 * the flat weekly schedule — only isWorkingDay's source differs by mode.
 */
export function statusForCheckIn(at: Date, rules: AttendanceRules): { status: AttendanceStatus; lateMinutes: number } {
  const late = minutesLate(at, rules);
  if (late <= rules.graceMinutes) return { status: "PRESENT", lateMinutes: Math.max(0, late) };
  if (late <= rules.halfDayAfterMinutes) return { status: "HALF_DAY", lateMinutes: late };
  return { status: "ABSENT", lateMinutes: late };
}

/** Convenience wrapper used by the check-in action: resolves mode, working-day-ness, and (if a working day) the lateness-based status all in one call. `null` status means today isn't a working day for this employee — check-in still succeeds, but no lateness rule applies. */
export function evaluateCheckIn(
  at: Date, userMode: ScheduleMode | null | undefined, roster: RosterWeek | null, rules: AttendanceRules,
): { status: AttendanceStatus; lateMinutes: number } | null {
  const mode = effectiveScheduleMode(userMode, rules);
  if (!isWorkingDay(mode, weekDayOf(at), roster, rules)) return null;
  return statusForCheckIn(at, rules);
}
