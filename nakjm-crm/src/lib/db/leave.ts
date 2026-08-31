"use client";

import {
  collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";

import type { LeaveType } from "../constants";
import { ymd } from "../dates";
import { getDb } from "../firebase/client";
import type { Actor, LeaveRequest } from "../types";
import { logActivitySafe } from "./activity";
import { markAttendance } from "./attendance";

export const LEAVE_REQUESTS = "leaveRequests";

function mapLeave(id: string, data: Record<string, unknown>): LeaveRequest {
  return { id, ...(data as Omit<LeaveRequest, "id">) };
}

export async function createLeaveRequest(params: {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}, actor: Actor): Promise<string> {
  if (params.endDate < params.startDate) throw new Error("End date can't be before start date.");
  const ref = doc(collection(getDb(), LEAVE_REQUESTS));
  await setDoc(ref, {
    uid: actor.uid,
    userName: actor.name,
    leaveType: params.leaveType,
    startDate: params.startDate,
    endDate: params.endDate,
    reason: params.reason,
    status: "PENDING",
    requestedAt: serverTimestamp(),
  });
  logActivitySafe({
    entityType: "LEAVE_REQUEST", entityId: ref.id, entityLabel: `${actor.name} — ${params.startDate} to ${params.endDate}`,
    action: "CREATE", message: `${actor.name} requested leave (${params.startDate} to ${params.endDate})`, actor,
  });
  return ref.id;
}

export function subscribeMyLeaveRequests(uid: string, cb: (rows: LeaveRequest[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), LEAVE_REQUESTS), where("uid", "==", uid)),
    (snap) => cb(snap.docs.map((d) => mapLeave(d.id, d.data())).sort((a, b) => (b.startDate < a.startDate ? -1 : 1))),
    (err) => onError?.(err as Error),
  );
}

/** For managers/admins — every employee's leave requests, newest first. */
export function subscribeAllLeaveRequests(cb: (rows: LeaveRequest[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), LEAVE_REQUESTS)),
    (snap) => cb(snap.docs.map((d) => mapLeave(d.id, d.data())).sort((a, b) => (b.startDate < a.startDate ? -1 : 1))),
    (err) => onError?.(err as Error),
  );
}

function datesBetween(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cur <= end) {
    out.push(ymd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export async function decideLeaveRequest(request: LeaveRequest, approve: boolean, actor: Actor, note?: string): Promise<void> {
  await updateDoc(doc(getDb(), LEAVE_REQUESTS, request.id), {
    status: approve ? "APPROVED" : "REJECTED",
    decidedBy: actor,
    decidedAt: serverTimestamp(),
    decisionNote: note ?? "",
  });

  if (approve) {
    for (const date of datesBetween(request.startDate, request.endDate)) {
      await markAttendance(request.uid, request.userName, date, "ON_LEAVE", actor, `Approved leave request (${request.leaveType})`);
    }
  }

  logActivitySafe({
    entityType: "LEAVE_REQUEST", entityId: request.id, entityLabel: `${request.userName} — ${request.startDate} to ${request.endDate}`,
    action: "STATUS_CHANGE", message: `${actor.name} ${approve ? "approved" : "rejected"} ${request.userName}'s leave request`, actor,
  });
}

export async function cancelLeaveRequest(request: LeaveRequest, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), LEAVE_REQUESTS, request.id), { status: "CANCELLED" });
  logActivitySafe({
    entityType: "LEAVE_REQUEST", entityId: request.id, entityLabel: `${request.userName} — ${request.startDate} to ${request.endDate}`,
    action: "STATUS_CHANGE", message: `${actor.name} cancelled their leave request`, actor,
  });
}
