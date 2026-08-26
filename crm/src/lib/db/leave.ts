"use client";

import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import { parseYmd } from "../dates";
import type { Actor, LeaveRequest, LeaveStatus, LeaveType } from "../types";

export const LEAVE_TYPES = "leaveTypes";
export const LEAVE_REQUESTS = "leaveRequests";

function mapLeaveType(id: string, data: Record<string, unknown>): LeaveType {
  return { id, ...(data as Omit<LeaveType, "id">) };
}

function mapLeaveRequest(id: string, data: Record<string, unknown>): LeaveRequest {
  return { id, ...(data as Omit<LeaveRequest, "id">) };
}

// ---------------------------------------------------------------------------
// Leave types
// ---------------------------------------------------------------------------

export async function createLeaveType(
  draft: { code: string; label: string; annualQuota: number },
): Promise<void> {
  await addDoc(collection(getDb(), LEAVE_TYPES), {
    ...draft,
    active: true,
    createdAt: serverTimestamp(),
  });
}

export async function setLeaveTypeActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(getDb(), LEAVE_TYPES, id), { active });
}

export function subscribeLeaveTypes(
  cb: (rows: LeaveType[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), LEAVE_TYPES), orderBy("label")),
    (snap) => cb(snap.docs.map((d) => mapLeaveType(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

// ---------------------------------------------------------------------------
// Leave requests
// ---------------------------------------------------------------------------

/** Inclusive day count between two yyyy-mm-dd dates. */
export function daysBetween(fromDate: string, toDate: string): number {
  const ms = parseYmd(toDate).getTime() - parseYmd(fromDate).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

export interface LeaveRequestDraft {
  uid: string;
  userName: string;
  leaveTypeId: string;
  leaveTypeLabel: string;
  fromDate: string;
  toDate: string;
  reason?: string;
}

export async function applyForLeave(draft: LeaveRequestDraft, actor: Actor): Promise<void> {
  await addDoc(collection(getDb(), LEAVE_REQUESTS), {
    ...draft,
    reason: draft.reason ?? "",
    days: daysBetween(draft.fromDate, draft.toDate),
    status: "PENDING" satisfies LeaveStatus,
    appliedAt: serverTimestamp(),
    appliedBy: actor,
    decidedAt: null,
    decidedBy: null,
    decisionNote: "",
  });
}

export async function decideLeaveRequest(
  id: string, status: "APPROVED" | "REJECTED", actor: Actor, note?: string,
): Promise<void> {
  await updateDoc(doc(getDb(), LEAVE_REQUESTS, id), {
    status,
    decidedAt: serverTimestamp(),
    decidedBy: actor,
    decisionNote: note ?? "",
  });
}

export async function cancelLeaveRequest(id: string): Promise<void> {
  await updateDoc(doc(getDb(), LEAVE_REQUESTS, id), { status: "CANCELLED" satisfies LeaveStatus });
}

export function subscribeMyLeaveRequests(
  uid: string,
  cb: (rows: LeaveRequest[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), LEAVE_REQUESTS), where("uid", "==", uid), orderBy("appliedAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapLeaveRequest(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

/** For managers/admins deciding requests — every request, newest first. */
export function subscribeAllLeaveRequests(
  cb: (rows: LeaveRequest[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), LEAVE_REQUESTS), orderBy("appliedAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapLeaveRequest(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}
