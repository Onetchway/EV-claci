"use client";

/**
 * Customer/driver-initiated complaints — billing, app issues, service
 * quality. Separate collection from tickets.ts (charger-fault only,
 * opened automatically by the OCPP server or ops staff for a specific
 * charger); a complaint may have nothing to do with a charger at all.
 */

import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";

import type { ComplaintCategory, ComplaintPriority, ComplaintStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, Complaint } from "../types";

export const COMPLAINTS = "complaints";

function mapComplaint(id: string, data: Record<string, unknown>): Complaint {
  return { id, ...(data as Omit<Complaint, "id">) };
}

export function subscribeComplaints(
  filters: { status?: ComplaintStatus },
  cb: (rows: Complaint[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const constraints = filters.status ? [where("status", "==", filters.status)] : [];
  return onSnapshot(
    query(collection(getDb(), COMPLAINTS), ...constraints, orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapComplaint(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export interface ComplaintDraft {
  category: ComplaintCategory;
  priority: ComplaintPriority;
  subject: string;
  description: string;
  customerName?: string;
  customerPhone?: string;
  emspUserId?: string | null;
  relatedChargerId?: string | null;
  relatedSessionId?: string | null;
}

export async function createComplaint(draft: ComplaintDraft, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), COMPLAINTS), {
    ...draft,
    status: "OPEN",
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
  return ref.id;
}

export async function setComplaintStatus(id: string, status: ComplaintStatus): Promise<void> {
  await updateDoc(doc(getDb(), COMPLAINTS, id), { status, updatedAt: serverTimestamp() });
}

export async function assignComplaint(id: string, assignee: Actor | null): Promise<void> {
  await updateDoc(doc(getDb(), COMPLAINTS, id), { assignedTo: assignee, updatedAt: serverTimestamp() });
}

export async function resolveComplaint(id: string, resolutionNotes: string): Promise<void> {
  await updateDoc(doc(getDb(), COMPLAINTS, id), {
    status: "RESOLVED",
    resolutionNotes,
    resolvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
