"use client";

import {
  collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, Timestamp, where,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import { ymd } from "../dates";
import type { NearestOffice } from "../geo";
import type { Actor, AttendanceRecord, AttendanceStatus, AttendancePunch } from "../types";

export const ATTENDANCE = "attendance";

function attendanceId(uid: string, date: string): string {
  return `${uid}_${date}`;
}

function mapAttendance(id: string, data: Record<string, unknown>): AttendanceRecord {
  return { id, ...(data as Omit<AttendanceRecord, "id">) };
}

function punchFrom(nearest: NearestOffice): Omit<AttendancePunch, "at"> {
  return {
    lat: null, lng: null,
    officeId: nearest.officeId, officeName: nearest.officeName,
    distanceMeters: nearest.distanceMeters, withinGeofence: nearest.withinGeofence,
  };
}

export async function checkIn(
  uid: string, userName: string, coords: { lat: number; lng: number } | null, nearest: NearestOffice, actor: Actor,
): Promise<void> {
  const date = ymd(new Date());
  const ref = doc(getDb(), ATTENDANCE, attendanceId(uid, date));
  const existing = await getDoc(ref);
  if (existing.exists() && (existing.data().checkIn as AttendancePunch | undefined)?.at) {
    throw new Error("Already checked in today.");
  }
  await setDoc(
    ref,
    {
      uid, userName, date,
      status: "PRESENT" satisfies AttendanceStatus,
      checkIn: { ...punchFrom(nearest), lat: coords?.lat ?? null, lng: coords?.lng ?? null, at: serverTimestamp() },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    },
    { merge: true },
  );
}

export async function checkOut(
  uid: string, coords: { lat: number; lng: number } | null, nearest: NearestOffice, actor: Actor,
): Promise<void> {
  const date = ymd(new Date());
  const ref = doc(getDb(), ATTENDANCE, attendanceId(uid, date));
  const existing = await getDoc(ref);
  if (!existing.exists() || !(existing.data().checkIn as AttendancePunch | undefined)?.at) {
    throw new Error("You haven't checked in yet today.");
  }
  await setDoc(
    ref,
    {
      checkOut: { ...punchFrom(nearest), lat: coords?.lat ?? null, lng: coords?.lng ?? null, at: serverTimestamp() },
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    },
    { merge: true },
  );
}

/**
 * Admin/manager correction — marks a day's status by hand, bypassing
 * geofencing entirely. Optionally backfills a check-in/check-out time too
 * (e.g. an employee forgot to punch, or was in the field without the app) —
 * left out, any existing punch on the record is untouched. Either way the
 * record carries `markedBy` so it reads as manager-entered, not a self-punch.
 */
export async function markAttendance(
  uid: string, userName: string, date: string, status: AttendanceStatus, actor: Actor, note?: string,
  checkInAt?: Date | null, checkOutAt?: Date | null,
): Promise<void> {
  const manualPunch = (at: Date) => ({
    at: Timestamp.fromDate(at),
    lat: null, lng: null,
    officeId: null, officeName: null, distanceMeters: null,
    withinGeofence: false,
  });

  const payload: Record<string, unknown> = {
    uid, userName, date, status,
    note: note ?? "",
    markedBy: actor,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  };
  if (checkInAt) payload.checkIn = manualPunch(checkInAt);
  if (checkOutAt) payload.checkOut = manualPunch(checkOutAt);

  await setDoc(doc(getDb(), ATTENDANCE, attendanceId(uid, date)), payload, { merge: true });
}

export function subscribeMyAttendanceMonth(
  uid: string, monthStart: string, monthEnd: string,
  cb: (rows: AttendanceRecord[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(
      collection(getDb(), ATTENDANCE),
      where("uid", "==", uid),
      where("date", ">=", monthStart),
      where("date", "<=", monthEnd),
    ),
    (snap) => cb(snap.docs.map((d) => mapAttendance(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

/** One-shot equivalent of subscribeMyAttendanceMonth — used by the payroll generator, which computes paid days for a whole month at once rather than staying subscribed. */
export async function getAttendanceMonth(uid: string, monthStart: string, monthEnd: string): Promise<AttendanceRecord[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), ATTENDANCE),
      where("uid", "==", uid),
      where("date", ">=", monthStart),
      where("date", "<=", monthEnd),
    ),
  );
  return snap.docs.map((d) => mapAttendance(d.id, d.data()));
}

/**
 * Paid/absent/half-day breakdown for a payslip. Approved leave requests do
 * NOT currently write an ON_LEAVE attendance row (see lib/db/leave.ts), so
 * this can't lean on attendance alone to know who was on paid leave — it
 * falls back to the simplest defensible rule: a day counts as paid unless
 * it's explicitly marked ABSENT or left unmarked (PRESENT/ON_LEAVE/
 * WEEK_OFF/HOLIDAY all pay in full, HALF_DAY pays half and counts toward
 * `halfDays`; ABSENT/unmarked count toward `absentDays`). This is
 * deliberately a starting point, not a verdict — the payroll generator
 * surfaces the counts as editable fields per employee so an operator can
 * correct them before finalizing a payslip (see computeLossOfPay in
 * db/payroll.ts for how absentDays/halfDays turn into a deduction amount).
 */
export function computeAttendanceBreakdown(
  records: AttendanceRecord[], year: number, month: number, monthDays: number,
): { paidDays: number; absentDays: number; halfDays: number } {
  const byDate = new Map(records.map((r) => [r.date, r.status]));
  const mm = String(month).padStart(2, "0");
  let paid = 0;
  let absentDays = 0;
  let halfDays = 0;
  for (let day = 1; day <= monthDays; day++) {
    const status = byDate.get(`${year}-${mm}-${String(day).padStart(2, "0")}`);
    if (status === "HALF_DAY") { paid += 0.5; halfDays += 1; }
    else if (status === "ABSENT" || status === undefined) { absentDays += 1; }
    else paid += 1; // PRESENT, ON_LEAVE, WEEK_OFF, HOLIDAY
  }
  return { paidDays: paid, absentDays, halfDays };
}

/** @deprecated Thin wrapper kept for anything still calling the old paid-days-only signature — prefer computeAttendanceBreakdown, which also reports the absent/half-day counts a payslip now itemizes. */
export function computePaidDays(records: AttendanceRecord[], year: number, month: number, monthDays: number): number {
  return computeAttendanceBreakdown(records, year, month, monthDays).paidDays;
}

/** For managers/admins — every employee's records for one calendar day (the "Team" tab) or a month (exports). */
export function subscribeAttendanceRange(
  fromDate: string, toDate: string,
  cb: (rows: AttendanceRecord[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), ATTENDANCE), where("date", ">=", fromDate), where("date", "<=", toDate)),
    (snap) => cb(snap.docs.map((d) => mapAttendance(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}
