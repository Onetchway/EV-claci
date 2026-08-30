"use client";

import {
  collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where,
} from "firebase/firestore";

import type { AttendanceStatus } from "../constants";
import { ymd } from "../dates";
import { getDb } from "../firebase/client";
import type { Actor, AttendanceRecord } from "../types";

export const ATTENDANCE = "attendance";

function attendanceId(uid: string, date: string): string {
  return `${uid}_${date}`;
}

function mapAttendance(id: string, data: Record<string, unknown>): AttendanceRecord {
  return { id, ...(data as Omit<AttendanceRecord, "id">) };
}

export async function checkIn(uid: string, userName: string, coords: { lat: number; lng: number } | null, actor: Actor): Promise<void> {
  const date = ymd(new Date());
  const ref = doc(getDb(), ATTENDANCE, attendanceId(uid, date));
  const existing = await getDoc(ref);
  if (existing.exists() && existing.data().checkIn?.at) {
    throw new Error("Already checked in today.");
  }
  await setDoc(
    ref,
    {
      uid, userName, date,
      status: "PRESENT" satisfies AttendanceStatus,
      checkIn: { lat: coords?.lat ?? null, lng: coords?.lng ?? null, at: serverTimestamp() },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    },
    { merge: true },
  );
}

export async function checkOut(uid: string, coords: { lat: number; lng: number } | null, actor: Actor): Promise<void> {
  const date = ymd(new Date());
  const ref = doc(getDb(), ATTENDANCE, attendanceId(uid, date));
  const existing = await getDoc(ref);
  if (!existing.exists() || !existing.data().checkIn?.at) {
    throw new Error("You haven't checked in yet today.");
  }
  await setDoc(
    ref,
    {
      checkOut: { lat: coords?.lat ?? null, lng: coords?.lng ?? null, at: serverTimestamp() },
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    },
    { merge: true },
  );
}

/** Admin/manager correction — marks a day's status by hand. */
export async function markAttendance(
  uid: string, userName: string, date: string, status: AttendanceStatus, actor: Actor, note?: string,
): Promise<void> {
  await setDoc(
    doc(getDb(), ATTENDANCE, attendanceId(uid, date)),
    {
      uid, userName, date, status,
      note: note ?? "",
      markedBy: actor,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    },
    { merge: true },
  );
}

export function subscribeMyAttendanceMonth(
  uid: string, monthStart: string, monthEnd: string,
  cb: (rows: AttendanceRecord[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), ATTENDANCE), where("uid", "==", uid)),
    (snap) => cb(
      snap.docs.map((d) => mapAttendance(d.id, d.data()))
        .filter((r) => r.date >= monthStart && r.date <= monthEnd)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    ),
    (err) => onError?.(err as Error),
  );
}

/** For managers/admins — every employee's records for one calendar day (the "Team" tab) or a month. */
export function subscribeAttendanceRange(
  fromDate: string, toDate: string,
  cb: (rows: AttendanceRecord[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), ATTENDANCE)),
    (snap) => cb(
      snap.docs.map((d) => mapAttendance(d.id, d.data())).filter((r) => r.date >= fromDate && r.date <= toDate),
    ),
    (err) => onError?.(err as Error),
  );
}
