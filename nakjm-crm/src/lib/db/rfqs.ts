"use client";

import {
  collection, deleteDoc, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp,
  setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { RfqStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, Rfq } from "../types";
import { logActivitySafe } from "./activity";

export const RFQS = "rfqs";

function mapRfq(id: string, data: Record<string, unknown>): Rfq {
  return { id, ...(data as Omit<Rfq, "id">) };
}

/** NKJM-RFQ-000142, allocated transactionally so two office staff can't collide. */
async function nextRfqNo(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "rfqs");
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists() ? (snap.data().seq as number | undefined) : undefined) ?? 0;
    const next = current + 1;
    tx.set(ref, { seq: next }, { merge: true });
    return next;
  });
  return `NKJM-RFQ-${String(seq).padStart(5, "0")}`;
}

export function subscribeRfqs(cb: (rows: Rfq[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), RFQS)),
    (snap) => cb(snap.docs.map((d) => mapRfq(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeRfqsForClient(clientId: string, cb: (rows: Rfq[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), RFQS), where("clientId", "==", clientId)),
    (snap) => cb(snap.docs.map((d) => mapRfq(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeRfq(id: string, cb: (r: Rfq | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), RFQS, id),
    (snap) => cb(snap.exists() ? mapRfq(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export async function getRfq(id: string): Promise<Rfq | null> {
  const snap = await getDoc(doc(getDb(), RFQS, id));
  return snap.exists() ? mapRfq(snap.id, snap.data()) : null;
}

export interface RfqDraft {
  clientId: string;
  clientName: string;
  projectId?: string | null;
  projectName?: string;
  subject: string;
  receivedDate?: Date | null;
  dueDate?: Date | null;
  status?: RfqStatus;
  notes?: string;
  sourceDocumentId?: string | null;
}

export async function createRfq(draft: RfqDraft, actor: Actor): Promise<Rfq> {
  const rfqNo = await nextRfqNo();
  const ref = doc(collection(getDb(), RFQS));
  const payload = {
    rfqNo,
    clientId: draft.clientId,
    clientName: draft.clientName,
    projectId: draft.projectId ?? null,
    projectName: draft.projectName ?? "",
    subject: draft.subject,
    receivedDate: draft.receivedDate ? Timestamp.fromDate(draft.receivedDate) : Timestamp.now(),
    dueDate: draft.dueDate ? Timestamp.fromDate(draft.dueDate) : null,
    status: draft.status ?? "OPEN",
    notes: draft.notes ?? "",
    sourceDocumentId: draft.sourceDocumentId ?? null,
    convertedQuotationId: null,
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: "RFQ", entityId: ref.id, entityLabel: `${rfqNo} — ${draft.subject}`, action: "CREATE",
    message: `Created RFQ ${rfqNo} — ${draft.subject}`, actor, projectId: draft.projectId,
  });
  return { id: ref.id, ...(payload as unknown as Omit<Rfq, "id">) };
}

export type RfqPatch = Partial<Omit<RfqDraft, "clientId" | "clientName">>;

export async function updateRfq(rfq: Rfq, patch: RfqPatch, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.projectId !== undefined) update.projectId = patch.projectId;
  if (patch.projectName !== undefined) update.projectName = patch.projectName;
  if (patch.subject !== undefined) update.subject = patch.subject;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.receivedDate !== undefined) update.receivedDate = patch.receivedDate ? Timestamp.fromDate(patch.receivedDate) : null;
  if (patch.dueDate !== undefined) update.dueDate = patch.dueDate ? Timestamp.fromDate(patch.dueDate) : null;
  await updateDoc(doc(getDb(), RFQS, rfq.id), update);
  logActivitySafe({
    entityType: "RFQ", entityId: rfq.id, entityLabel: rfq.rfqNo,
    action: patch.status && patch.status !== rfq.status ? "STATUS_CHANGE" : "UPDATE",
    message: patch.status && patch.status !== rfq.status ? `Marked RFQ ${rfq.rfqNo} ${patch.status}` : `Edited RFQ ${rfq.rfqNo}`,
    actor, projectId: rfq.projectId,
  });
}

/** Records the Quotation an RFQ turned into and marks it QUOTED in one write. */
export async function markRfqConverted(rfq: Rfq, quotationId: string, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), RFQS, rfq.id), { convertedQuotationId: quotationId, status: "QUOTED", updatedAt: serverTimestamp() });
  logActivitySafe({
    entityType: "RFQ", entityId: rfq.id, entityLabel: rfq.rfqNo, action: "STATUS_CHANGE",
    message: `Converted RFQ ${rfq.rfqNo} to a quotation`, actor, projectId: rfq.projectId,
  });
}

export async function deleteRfq(rfq: Rfq, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), RFQS, rfq.id));
  logActivitySafe({
    entityType: "RFQ", entityId: rfq.id, entityLabel: rfq.rfqNo, action: "DELETE",
    message: `Deleted RFQ ${rfq.rfqNo}`, actor, projectId: rfq.projectId,
  });
}
