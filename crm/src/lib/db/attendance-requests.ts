"use client";

import {
  addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import { addDays, parseYmd, ymd } from "../dates";
import { markAttendance } from "./attendance";
import type {
  Actor, AttendanceRequest, AttendanceRequestKind, AttendanceRequestStatus, AttendanceStatus,
} from "../types";

export const ATTENDANCE_REQUESTS = "attendanceRequests";

function mapAttendanceRequest(id: string, data: Record<string, unknown>): AttendanceRequest {
  return { id, ...(data as Omit<AttendanceRequest, "id">) };
}

/** First day of last calendar month, as yyyy-mm-dd — the earliest date a regularization request may target. */
export function regularizationWindowStart(today: Date = new Date()): string {
  return ymd(new Date(today.getFullYear(), today.getMonth() - 1, 1));
}

export interface AttendanceRequestDraft {
  uid: string;
  userName: string;
  kind: AttendanceRequestKind;
  fromDate: string;
  toDate: string;
  reason?: string;
  desiredStatus?: AttendanceStatus;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
}

export async function applyForAttendanceRequest(draft: AttendanceRequestDraft, actor: Actor): Promise<void> {
  const today = ymd(new Date());
  if (draft.fromDate > today || draft.toDate > today) throw new Error("Can't request a future date.");
  if (draft.toDate < draft.fromDate) throw new Error("End date can't be before the start date.");
  if (draft.kind === "WFH" && (draft.fromDate !== today || draft.toDate !== today)) {
    throw new Error("Work from home can only be requested for today.");
  }
  if (draft.kind === "REGULARIZATION" && draft.fromDate < regularizationWindowStart()) {
    throw new Error("Regularization can only cover last month or this month.");
  }

  await addDoc(collection(getDb(), ATTENDANCE_REQUESTS), {
    uid: draft.uid, userName: draft.userName, kind: draft.kind,
    fromDate: draft.fromDate, toDate: draft.toDate,
    reason: draft.reason ?? "",
    desiredStatus: draft.desiredStatus ?? "PRESENT",
    requestedCheckIn: draft.requestedCheckIn ?? "",
    requestedCheckOut: draft.requestedCheckOut ?? "",
    status: "PENDING" satisfies AttendanceRequestStatus,
    appliedAt: serverTimestamp(),
    appliedBy: actor,
    decidedAt: null,
    decidedBy: null,
    decisionNote: "",
  });
}

/**
 * Does this employee have a Work From Home request covering today — pending
 * OR already approved? Checked at the moment of check-in/out so the office
 * geofence lifts as soon as they've flagged today as WFH, rather than
 * making them wait for a manager to act on the approval first (the
 * attendance STATUS still needs that approval to stick; this only decides
 * whether today's punch is exempt from the location check). Pure-equality
 * filters only (uid/kind/fromDate) — no composite index needed.
 */
export async function hasWfhToday(uid: string): Promise<boolean> {
  const today = ymd(new Date());
  const snap = await getDocs(query(
    collection(getDb(), ATTENDANCE_REQUESTS),
    where("uid", "==", uid),
    where("kind", "==", "WFH"),
    where("fromDate", "==", today),
  ));
  return snap.docs.some((d) => {
    const status = d.data().status as AttendanceRequestStatus;
    return status === "PENDING" || status === "APPROVED";
  });
}

/** Inclusive list of yyyy-mm-dd dates from fromDate to toDate. */
function datesBetween(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  for (let d = parseYmd(fromDate); ymd(d) <= toDate; d = addDays(d, 1)) dates.push(ymd(d));
  return dates;
}

/** Combines a yyyy-mm-dd date with an "HH:MM" time into a local Date, or null if the time is blank. */
function combineDateTime(date: string, time?: string): Date | null {
  if (!time) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0);
}

/**
 * Approve or reject an attendance request. On approval, applies the decision
 * to the underlying attendance record(s) via markAttendance — once per date
 * in [fromDate, toDate] — exactly the same manual-correction path a
 * manager/admin uses from the Team tab, so the request itself never writes
 * attendance directly.
 */
export async function decideAttendanceRequest(
  req: AttendanceRequest, status: "APPROVED" | "REJECTED", actor: Actor, note?: string,
): Promise<void> {
  if (status === "APPROVED") {
    const resolvedStatus: AttendanceStatus = req.kind === "WFH" ? "WORK_FROM_HOME" : (req.desiredStatus ?? "PRESENT");
    for (const date of datesBetween(req.fromDate, req.toDate)) {
      await markAttendance(
        req.uid, req.userName, date, resolvedStatus, actor,
        note || req.reason || "",
        combineDateTime(date, req.requestedCheckIn),
        combineDateTime(date, req.requestedCheckOut),
      );
    }
  }
  await updateDoc(doc(getDb(), ATTENDANCE_REQUESTS, req.id), {
    status,
    decidedAt: serverTimestamp(),
    decidedBy: actor,
    decisionNote: note ?? "",
  });
}

export async function cancelAttendanceRequest(id: string): Promise<void> {
  await updateDoc(doc(getDb(), ATTENDANCE_REQUESTS, id), { status: "CANCELLED" satisfies AttendanceRequestStatus });
}

export function subscribeMyAttendanceRequests(
  uid: string,
  cb: (rows: AttendanceRequest[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), ATTENDANCE_REQUESTS), where("uid", "==", uid), orderBy("appliedAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapAttendanceRequest(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

/** For managers/admins deciding requests — every request, newest first. */
export function subscribeAllAttendanceRequests(
  cb: (rows: AttendanceRequest[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), ATTENDANCE_REQUESTS), orderBy("appliedAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapAttendanceRequest(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}
