"use client";

/**
 * Customer/driver-initiated complaints — billing, app issues, service
 * quality. Separate collection from tickets.ts (charger-fault only,
 * opened automatically by the OCPP server or ops staff for a specific
 * charger); a complaint may have nothing to do with a charger at all.
 */

import {
  addDoc, arrayUnion, collection, doc, getDocs, limit as fsLimit, onSnapshot, orderBy, query, serverTimestamp,
  updateDoc, where,
} from "firebase/firestore";

import type { ComplaintCategory, ComplaintPriority, ComplaintStatus } from "../constants";
import { getDb } from "../firebase/client";
import { notifyComplaintTag } from "./notifications";
import type { Actor, Complaint, EmspUser } from "../types";

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
  customerEmail?: string;
  emspUserId?: string | null;
  relatedChargerId?: string | null;
  city?: string | null;
  relatedSessionId?: string | null;
}

/** Matches a complainant against the registered driver directory by phone or email — whichever is given — so a complaint from an existing app/CRM/CMS user auto-links to their wallet/session history instead of staying a bare name. */
export async function findRegisteredUser(contact: { phone?: string; email?: string }): Promise<EmspUser | null> {
  const phone = contact.phone?.trim();
  const email = contact.email?.trim().toLowerCase();
  if (phone) {
    const snap = await getDocs(query(collection(getDb(), "emspUsers"), where("phone", "==", phone), fsLimit(1)));
    if (!snap.empty) return { id: snap.docs[0]!.id, ...(snap.docs[0]!.data() as Omit<EmspUser, "id">) };
  }
  if (email) {
    const snap = await getDocs(query(collection(getDb(), "emspUsers"), where("email", "==", email), fsLimit(1)));
    if (!snap.empty) return { id: snap.docs[0]!.id, ...(snap.docs[0]!.data() as Omit<EmspUser, "id">) };
  }
  return null;
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

/** Tags a teammate for visibility/help on a complaint — appends (doesn't replace) and emails them, distinct from the single assignedTo owner. */
export async function tagComplaint(
  id: string,
  subject: string,
  tagged: { uid: string; name: string; email: string },
  taggedBy: Actor,
): Promise<void> {
  await updateDoc(doc(getDb(), COMPLAINTS, id), {
    taggedTo: arrayUnion({ uid: tagged.uid, name: tagged.name, role: taggedBy.role }),
    updatedAt: serverTimestamp(),
  });
  notifyComplaintTag({ toUid: tagged.uid, toEmail: tagged.email, taggedByName: taggedBy.name, subject });
}

export async function resolveComplaint(id: string, resolutionNotes: string): Promise<void> {
  await updateDoc(doc(getDb(), COMPLAINTS, id), {
    status: "RESOLVED",
    resolutionNotes,
    resolvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
