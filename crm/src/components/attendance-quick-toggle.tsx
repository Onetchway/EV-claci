"use client";

import { useEffect, useRef, useState } from "react";
import { LogIn, LogOut } from "lucide-react";

import { useActor, useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/ui";
import { canBypassGeofence, performCheckIn, performCheckOut } from "@/lib/attendance-actions";
import { subscribeMyAttendanceMonth } from "@/lib/db/attendance";
import { subscribeOfficeLocations } from "@/lib/db/office-locations";
import { ymd } from "@/lib/dates";
import type { AttendanceRecord, OfficeLocation } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * A menu-bar-style quick control, next to notifications — check in/out
 * without leaving whatever page you're on. Mirrors the exact same
 * geofence-aware logic the Attendance page itself uses (see
 * lib/attendance-actions.ts), so the two never disagree about whether a
 * punch is allowed.
 */
export function AttendanceQuickToggle() {
  const { profile, role } = useAuth();
  const actor = useActor();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [offices, setOffices] = useState<OfficeLocation[]>([]);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeOfficeLocations(setOffices), []);

  useEffect(() => {
    if (!profile) return;
    const d = ymd(new Date());
    return subscribeMyAttendanceMonth(profile.uid, d, d, (rows) => setToday(rows[0] ?? null));
  }, [profile]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!profile) return null;

  const checkedIn = Boolean(today?.checkIn?.at);
  const checkedOut = Boolean(today?.checkOut?.at);
  const exempt = canBypassGeofence(role, profile);

  async function run(fn: () => Promise<void>, successMessage: string) {
    setBusy(true);
    try {
      await fn();
      push(successMessage, "success");
    } catch (e) {
      push((e as Error).message || "Something went wrong.", "error");
    } finally {
      setBusy(false);
    }
  }

  const dotColor = checkedOut ? "bg-ink-400" : checkedIn ? "bg-emerald-500" : "bg-rose-400";
  const label = checkedOut ? "Checked out" : checkedIn ? "Checked in" : "Check in";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-800"
        aria-label="Attendance"
      >
        <span className={cn("h-2 w-2 shrink-0 rounded-full", dotColor)} />
        <span className="hidden sm:inline">{label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-ink-200 bg-white p-3 shadow-lg">
          <p className="text-sm font-semibold text-ink-900">Today's attendance</p>
          {exempt && <p className="mt-0.5 text-[11px] text-ink-400">Exempt from geofencing</p>}

          <div className="mt-2 space-y-1 text-xs text-ink-600">
            <p>Check in: {today?.checkIn?.at ? formatDateTime(today.checkIn.at) : "—"}</p>
            <p>Check out: {today?.checkOut?.at ? formatDateTime(today.checkOut.at) : "—"}</p>
          </div>

          <div className="mt-3">
            {!checkedIn ? (
              <button
                disabled={busy}
                onClick={() => void run(() => performCheckIn(profile, actor, offices, role), "Checked in.")}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <LogIn className="h-4 w-4" /> Check in
              </button>
            ) : !checkedOut ? (
              <button
                disabled={busy}
                onClick={() => void run(() => performCheckOut(profile, actor, offices, role), "Checked out.")}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink-800 px-3 py-2 text-sm font-medium text-white hover:bg-ink-900 disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" /> Check out
              </button>
            ) : (
              <p className="rounded-lg bg-ink-50 px-3 py-2 text-center text-xs text-ink-500">Day complete — see you tomorrow.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
