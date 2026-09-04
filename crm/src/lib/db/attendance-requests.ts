"use client";

/**
 * WFH and attendance-regularization requests — see the AttendanceRequest
 * doc comment in lib/types.ts for why both share one collection/shape.
 * Approval alone doesn't write an attendance record; it only unlocks what
 * the employee (WFH: today's geofence-free check-in) or a manager
 * (regularization: marking a past day without it looking like an
 * unexplained correction) can do next.
 */

import {
  addDoc, collection, doc, getDocs, limit as fsLimit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import { getCurrentTenantId } from "../tenant";
import type { Actor, AttendanceRequest, AttendanceRequestType } from "../types";

export const ATTENDANCE_REQUESTS = "attendanceRequests";

function mapRequest(id: string, data: Record<string, unknown>): AttendanceRequest {
  return { id, ...(data as Omit<AttendanceRequest, "id">) };
}

export interface AttendanceRequestDraft {
  uid: string;
  userName: string;
  type: AttendanceRequestType;
  fromDate: string;
  toDate: string;
  reason?: string;
}

export async function applyForAttendanceRequest(draft: AttendanceRequestDraft, actor: Actor): Promise<void> {
  const orgId = await getCurrentTenantId();
  await addDoc(collection(getDb(), ATTENDANCE_REQUESTS), {
    ...draft,
    orgId,
    reason: draft.reason ?? "",
    status: "PENDING",
    appliedAt: serverTimestamp(),
    appliedBy: actor,
    decidedAt: null,
    decidedBy: null,
    decisionNote: "",
  });
}

export async function decideAttendanceRequest(id: string, status: "APPROVED" | "REJECTED", actor: Actor, note?: string): Promise<void> {
  await updateDoc(doc(getDb(), ATTENDANCE_REQUESTS, id), {
    status,
    decidedAt: serverTimestamp(),
    decidedBy: actor,
    decisionNote: note ?? "",
  });
}

export async function cancelAttendanceRequest(id: string): Promise<void> {
  await updateDoc(doc(getDb(), ATTENDANCE_REQUESTS, id), { status: "CANCELLED" });
}

export function subscribeMyAttendanceRequests(
  uid: string,
  cb: (rows: AttendanceRequest[]) => void,
  onError?: (e: Error) => void,
): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      query(collection(getDb(), ATTENDANCE_REQUESTS), where("orgId", "==", orgId), where("uid", "==", uid), orderBy("appliedAt", "desc")),
      (snap) => cb(snap.docs.map((d) => mapRequest(d.id, d.data()))),
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}

/** For managers/admins deciding requests — every request, newest first. */
export function subscribeAllAttendanceRequests(
  cb: (rows: AttendanceRequest[]) => void,
  onError?: (e: Error) => void,
): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      query(collection(getDb(), ATTENDANCE_REQUESTS), where("orgId", "==", orgId), orderBy("appliedAt", "desc")),
      (snap) => cb(snap.docs.map((d) => mapRequest(d.id, d.data()))),
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}

/** Checked by performCheckIn() before enforcing the office geofence. */
export async function hasApprovedWfhToday(uid: string, date: string): Promise<boolean> {
  const orgId = await getCurrentTenantId();
  const snap = await getDocs(query(
    collection(getDb(), ATTENDANCE_REQUESTS),
    where("orgId", "==", orgId), where("uid", "==", uid), where("type", "==", "WFH"),
    where("fromDate", "==", date), where("status", "==", "APPROVED"),
    fsLimit(1),
  ));
  return !snap.empty;
}
