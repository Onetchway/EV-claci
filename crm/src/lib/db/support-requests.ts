"use client";

import {
  addDoc, collection, collectionGroup, doc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, where,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, Lead, PortalSupportRequest } from "../types";
import { LEADS } from "./leads";
import { createPortalNotificationSafe } from "./notifications";

const SUPPORT_REQUESTS = "supportRequests";
const sub = (leadId: string) => collection(getDb(), LEADS, leadId, SUPPORT_REQUESTS);

function mapRequest(id: string, leadId: string, data: Record<string, unknown>): PortalSupportRequest {
  return { id, ...(data as Omit<PortalSupportRequest, "id" | "leadId">), leadId };
}

/** Investor-side only — see the Firestore rule for exactly what's validated. */
export async function submitSupportRequest(
  lead: Pick<Lead, "id" | "code" | "ownerId" | "ownerName">,
  investor: { name: string; phone: string },
  input: { subject: string; message: string },
): Promise<void> {
  const payload = {
    leadId: lead.id,
    leadCode: lead.code,
    ownerId: lead.ownerId,
    ownerName: lead.ownerName,
    investorName: investor.name,
    investorPhone: investor.phone,
    subject: input.subject.trim(),
    message: input.message.trim(),
    status: "OPEN" as const,
    createdAt: serverTimestamp(),
  };
  await addDoc(sub(lead.id), payload);

  createPortalNotificationSafe({
    toUid: lead.ownerId,
    title: `New message from ${investor.name}`,
    body: `${lead.code} — ${input.subject.trim()}`,
    leadId: lead.id,
  });
}

export function subscribeLeadSupportRequests(
  leadId: string,
  cb: (rows: PortalSupportRequest[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(sub(leadId), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapRequest(d.id, leadId, d.data()))),
    (err) => onError?.(err as Error),
  );
}

/** CRM Dashboard's "across every lead" view — open requests only, newest first. Client-side filters to the viewer's own leads unless they see the whole org. */
export function subscribeOpenSupportRequests(
  cb: (rows: PortalSupportRequest[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collectionGroup(getDb(), SUPPORT_REQUESTS), where("status", "==", "OPEN"), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapRequest(d.id, (d.data() as { leadId: string }).leadId, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export async function resolveSupportRequest(
  leadId: string,
  requestId: string,
  actor: Actor,
  reply?: string,
): Promise<void> {
  await updateDoc(doc(getDb(), LEADS, leadId, SUPPORT_REQUESTS, requestId), {
    status: "RESOLVED",
    reply: reply ?? "",
    resolvedAt: serverTimestamp(),
    resolvedBy: actor,
  });
}
