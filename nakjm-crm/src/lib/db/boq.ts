"use client";

import {
  collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc,
  Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { BoqStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, Boq, BoqLineItem } from "../types";
import { logActivitySafe } from "./activity";

export const BOQS = "boqs";

function mapBoq(id: string, data: Record<string, unknown>): Boq {
  return { id, ...(data as Omit<Boq, "id">) };
}

export function computeBoqTotals(items: BoqLineItem[]): { items: BoqLineItem[]; total: number } {
  const withAmounts = items.map((it, i) => {
    const unitRate = it.supplyRate !== undefined || it.installationRate !== undefined
      ? (Number(it.supplyRate) || 0) + (Number(it.installationRate) || 0)
      : Number(it.rate) || 0;
    const amount = (Number(it.qty) || 0) * unitRate;
    return { ...it, srNo: i + 1, rate: unitRate, amount };
  });
  return { items: withAmounts, total: withAmounts.reduce((s, it) => s + it.amount, 0) };
}

export function subscribeBoqsForProject(projectId: string, cb: (rows: Boq[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), BOQS), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapBoq(d.id, d.data())).sort((a, b) => b.version - a.version)),
    (err) => onError?.(err as Error),
  );
}

export async function getBoq(id: string): Promise<Boq | null> {
  const snap = await getDoc(doc(getDb(), BOQS, id));
  return snap.exists() ? mapBoq(snap.id, snap.data()) : null;
}

export function subscribeBoq(id: string, cb: (b: Boq | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), BOQS, id),
    (snap) => cb(snap.exists() ? mapBoq(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

/** Org-wide — the top-level BOQ page across every project. */
export function subscribeBoqs(cb: (rows: Boq[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), BOQS)),
    (snap) => cb(snap.docs.map((d) => mapBoq(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export interface BoqDraft {
  boqNo: string;
  projectId: string;
  projectName: string;
  quotationId?: string | null;
  siteName?: string;
  version?: number;
  status?: BoqStatus;
  boqDate?: Date | null;
  items: BoqLineItem[];
  notes?: string;
  sourceDocumentId?: string | null;
}

export async function createBoq(draft: BoqDraft, actor?: Actor): Promise<Boq> {
  const { items, total } = computeBoqTotals(draft.items);
  const ref = doc(collection(getDb(), BOQS));
  const payload = {
    boqNo: draft.boqNo,
    projectId: draft.projectId,
    projectName: draft.projectName,
    quotationId: draft.quotationId ?? null,
    siteName: draft.siteName ?? "",
    version: draft.version ?? 1,
    status: draft.status ?? "DRAFT",
    boqDate: draft.boqDate ? Timestamp.fromDate(draft.boqDate) : Timestamp.now(),
    items,
    totalAmount: total,
    notes: draft.notes ?? "",
    sourceDocumentId: draft.sourceDocumentId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  if (actor) {
    logActivitySafe({
      entityType: "BOQ", entityId: ref.id, entityLabel: draft.boqNo, action: "CREATE",
      message: `Created BOQ ${draft.boqNo}`, actor, projectId: draft.projectId,
    });
  }
  return { id: ref.id, ...(payload as unknown as Omit<Boq, "id">) };
}

export async function updateBoqStatus(boq: Boq, status: BoqStatus, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), BOQS, boq.id), { status, updatedAt: serverTimestamp() });
  logActivitySafe({
    entityType: "BOQ", entityId: boq.id, entityLabel: boq.boqNo, action: "STATUS_CHANGE",
    message: `Marked BOQ ${boq.boqNo} ${status}`, actor, projectId: boq.projectId,
  });
}

/**
 * Sign-off: requires the approver to type their own name as confirmation
 * (a lightweight internal e-sign, not a cryptographic signature), records
 * who/when/what they typed, and moves status to APPROVED in the same write.
 */
export async function approveBoq(boq: Boq, signatureName: string, note: string | undefined, actor: Actor): Promise<void> {
  if (signatureName.trim().toLowerCase() !== actor.name.trim().toLowerCase()) {
    throw new Error("Type your name exactly as shown to confirm approval.");
  }
  await updateDoc(doc(getDb(), BOQS, boq.id), {
    status: "APPROVED",
    approval: { approvedBy: actor, approvedAt: serverTimestamp(), signatureName: signatureName.trim(), note: note ?? "" },
    updatedAt: serverTimestamp(),
  });
  logActivitySafe({
    entityType: "BOQ", entityId: boq.id, entityLabel: boq.boqNo, action: "STATUS_CHANGE",
    message: `${actor.name} approved BOQ ${boq.boqNo}`, actor, projectId: boq.projectId,
  });
}

/** Every version sharing one lineage -- the root (v1) plus every BOQ revised from it, directly or transitively. */
export function subscribeBoqLineage(rootBoqId: string, cb: (rows: Boq[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), BOQS), where("rootBoqId", "==", rootBoqId)),
    (snap) => {
      const revisions = snap.docs.map((d) => mapBoq(d.id, d.data()));
      void getDoc(doc(getDb(), BOQS, rootBoqId)).then((rootSnap) => {
        const root = rootSnap.exists() ? [mapBoq(rootSnap.id, rootSnap.data())] : [];
        cb([...root, ...revisions].sort((a, b) => a.version - b.version));
      });
    },
    (err) => onError?.(err as Error),
  );
}

/** Creates a new DRAFT version carrying the same content forward -- the only way to get a fresh version of an existing BOQ, so version history stays a real lineage instead of an always-1 placeholder. */
export async function reviseBoq(boq: Boq, actor: Actor): Promise<Boq> {
  const rootId = boq.rootBoqId ?? boq.id;
  const siblingsSnap = await getDocs(query(collection(getDb(), BOQS), where("rootBoqId", "==", rootId)));
  const maxSiblingVersion = siblingsSnap.docs.reduce((max, d) => Math.max(max, (d.data().version as number) || 0), boq.version);

  const ref = doc(collection(getDb(), BOQS));
  const payload = {
    boqNo: boq.boqNo,
    projectId: boq.projectId,
    projectName: boq.projectName,
    quotationId: boq.quotationId ?? null,
    siteName: boq.siteName ?? "",
    version: maxSiblingVersion + 1,
    status: "DRAFT" as BoqStatus,
    boqDate: Timestamp.now(),
    items: boq.items,
    totalAmount: boq.totalAmount,
    notes: boq.notes ?? "",
    sourceDocumentId: boq.sourceDocumentId ?? null,
    rootBoqId: rootId,
    revisedFrom: boq.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: "BOQ", entityId: ref.id, entityLabel: boq.boqNo, action: "CREATE",
    message: `${actor.name} created v${payload.version} of BOQ ${boq.boqNo}, revised from v${boq.version}`, actor, projectId: boq.projectId,
  });
  return { id: ref.id, ...(payload as unknown as Omit<Boq, "id">) };
}

export interface BoqPatch {
  boqNo?: string;
  siteName?: string;
  boqDate?: Date | null;
  items?: BoqLineItem[];
  notes?: string;
}

export async function updateBoq(boq: Boq, patch: BoqPatch, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.items) {
    const { items, total } = computeBoqTotals(patch.items);
    update.items = items;
    update.totalAmount = total;
  }
  if (patch.boqNo !== undefined) update.boqNo = patch.boqNo;
  if (patch.siteName !== undefined) update.siteName = patch.siteName;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.boqDate !== undefined) update.boqDate = patch.boqDate ? Timestamp.fromDate(patch.boqDate) : null;
  await updateDoc(doc(getDb(), BOQS, boq.id), update);
  logActivitySafe({
    entityType: "BOQ", entityId: boq.id, entityLabel: boq.boqNo, action: "UPDATE",
    message: `Edited BOQ ${boq.boqNo}`, actor, projectId: boq.projectId,
  });
}

export async function deleteBoq(boq: Boq, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), BOQS, boq.id));
  logActivitySafe({
    entityType: "BOQ", entityId: boq.id, entityLabel: boq.boqNo, action: "DELETE",
    message: `Deleted BOQ ${boq.boqNo}`, actor, projectId: boq.projectId,
  });
}
