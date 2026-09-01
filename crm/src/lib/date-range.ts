/**
 * Shared date-range filter logic for Energy/Earnings (and anywhere else
 * that reports on ChargeSession history). A preset picks a `since` bound
 * cheap enough to push into the Firestore query itself; "Custom" and
 * "Year" both need a hard upper bound too, which subscribeSessionsSince
 * can't express — so callers always subscribe from `since` and then
 * filter the result down to `[since, until]` client-side.
 */

export type DateRangePreset = "7d" | "30d" | "90d" | "year" | "custom";

export interface DateRangeState {
  preset: DateRangePreset;
  /** Only meaningful when preset === "year" */
  year: number;
  /** Only meaningful when preset === "custom", yyyy-mm-dd */
  customFrom: string;
  customTo: string;
}

export const DATE_RANGE_PRESET_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "Calendar year" },
  { value: "custom", label: "Custom range" },
];

export function defaultDateRangeState(): DateRangeState {
  const now = new Date();
  return { preset: "30d", year: now.getFullYear(), customFrom: "", customTo: "" };
}

export function yearOptions(spanBack = 5): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: spanBack }, (_, i) => current - i);
}

/** The bound to pass to subscribeSessionsSince — always the earlier edge, computed generously for "custom" in case the user hasn't picked a from-date yet. */
export function rangeSince(state: DateRangeState): Date {
  const now = new Date();
  switch (state.preset) {
    case "7d": { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    case "30d": { const d = new Date(now); d.setDate(d.getDate() - 30); return d; }
    case "90d": { const d = new Date(now); d.setDate(d.getDate() - 90); return d; }
    case "year": return new Date(state.year, 0, 1);
    case "custom": return state.customFrom ? new Date(state.customFrom) : new Date(now.getFullYear() - 5, 0, 1);
  }
}

/** The upper bound — undefined means "no upper bound, up to now." */
export function rangeUntil(state: DateRangeState): Date | undefined {
  if (state.preset === "year") return new Date(state.year + 1, 0, 1);
  if (state.preset === "custom" && state.customTo) {
    const d = new Date(state.customTo);
    d.setDate(d.getDate() + 1);
    return d;
  }
  return undefined;
}

export function rangeLabel(state: DateRangeState): string {
  switch (state.preset) {
    case "7d": return "the last 7 days";
    case "30d": return "the last 30 days";
    case "90d": return "the last 90 days";
    case "year": return `calendar year ${state.year}`;
    case "custom": return state.customFrom && state.customTo ? `${state.customFrom} to ${state.customTo}` : "the selected custom range";
  }
}
