"use client";

import { useEffect, useState } from "react";

import { useActor, useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/ui";
import { canBypassGeofence, performCheckIn, performCheckOut } from "@/lib/attendance-actions";
import { subscribeMyAttendanceMonth } from "@/lib/db/attendance";
import { subscribeOfficeLocations } from "@/lib/db/office-locations";
import { ymd } from "@/lib/dates";
import type { AttendanceRecord, OfficeLocation } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * A one-click Apple-Control-Center-style switch, next to notifications:
 * off = not checked in, on = checked in, locked on = checked out for the
 * day. No menu to open — clicking it IS the check-in/check-out action.
 * Goes through the same geofence-aware helpers the Attendance page itself
 * uses (lib/attendance-actions.ts), so the two can't disagree.
 */
export function AttendanceQuickToggle() {
  const { profile, role } = useAuth();
  const actor = useActor();
  const { push } = useToast();
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [offices, setOffices] = useState<OfficeLocation[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeOfficeLocations(setOffices), []);

  useEffect(() => {
    if (!profile) return;
    const d = ymd(new Date());
    return subscribeMyAttendanceMonth(profile.uid, d, d, (rows) => setToday(rows[0] ?? null));
  }, [profile]);

  if (!profile || profile.attendanceRequired === false) return null;

  const checkedIn = Boolean(today?.checkIn?.at);
  const checkedOut = Boolean(today?.checkOut?.at);
  const on = checkedIn && !checkedOut;
  const locked = checkedOut;
  const exempt = canBypassGeofence(role, profile);

  async function handleToggle() {
    if (busy || locked) return;
    setBusy(true);
    try {
      if (!checkedIn) {
        await performCheckIn(profile!, actor, offices, role);
        push("Checked in.", "success");
      } else {
        await performCheckOut(profile!, actor, offices, role);
        push("Checked out.", "success");
      }
    } catch (e) {
      push((e as Error).message || "Something went wrong.", "error");
    } finally {
      setBusy(false);
    }
  }

  const title = locked
    ? `Checked out ${today?.checkOut?.at ? formatDateTime(today.checkOut.at) : ""} — day complete`
    : on
      ? `Checked in ${today?.checkIn?.at ? formatDateTime(today.checkIn.at) : ""} — tap to check out${exempt ? " (geofence exempt)" : ""}`
      : `Tap to check in${exempt ? " (geofence exempt)" : ""}`;

  return (
    <div className="flex items-center gap-2 px-1" title={title}>
      <span className="hidden text-xs font-medium text-ink-600 sm:inline">
        {locked ? "Checked out" : on ? "Checked in" : "Check in"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Attendance check in/out"
        disabled={busy || locked}
        onClick={() => void handleToggle()}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500",
          locked ? "cursor-not-allowed bg-ink-300" : on ? "bg-emerald-500" : "bg-ink-300",
          busy && "opacity-60",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
            on ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}
