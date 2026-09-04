"use client";

/**
 * Bill of Quantities — ported from nakjm-crm. Every version of one BOQ
 * shares a `rootBoqId` (the v1 document's own id); `reviseBoq` is the only
 * way to get a new version, so the lineage is always a real chain rather
 * than an always-1 placeholder. Org-scoped and audited through the shared
 * changeLog trail, unlike nakjm's own single-tenant activity log.
 */

import {
  collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { BoqStatus } from "../constants";
import { getDb } from "../firebase/client";
import { getCurrentTenantId } from "../tenant";
import type { Actor, Boq, BoqLineItem } from "../types";
import { buildSearchTokens } from "../utils";
import { logChangeSafe } from "./change-log";

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

export interface BoqDraft {
  boqNo: string;
  projectId: string;
  projectName: string;
  siteName?: string;
  boqDate?: Date | null;
  items: BoqLineItem[];
  notes?: string;
}

export async function createBoq(draft: BoqDraft, actor: Actor): Promise<{ id: string; boqNo: string }> {
  const { items, total } = computeBoqTotals(draft.items);
  const orgId = await getCurrentTenantId();
  const ref = doc(collection(getDb(), BOQS));
  await runTransaction(getDb(), async (tx) => {
    tx.set(ref, {
      boqNo: draft.boqNo,
      projectId: draft.projectId,
      projectName: draft.projectName,
      siteName: draft.siteName ?? "",
      version: 1,
      status: "DRAFT" as BoqStatus,
      boqDate: draft.boqDate ? Timestamp.fromDate(draft.boqDate) : Timestamp.now(),
      items,
      totalAmount: total,
      notes: draft.notes ?? "",
      rootBoqId: null,
      revisedFrom: null,
      approval: null,
      orgId,
      search: buildSearchTokens(draft.boqNo, draft.projectName, draft.siteName),
      createdAt: serverTimestamp(),
      createdBy: actor,
      updatedAt: serverTimestamp(),
    });
  });

  logChangeSafe({ entityType: "BOQ", entityId: ref.id, entityLabel: draft.boqNo, action: "CREATE", actor });
  return { id: ref.id, boqNo: draft.boqNo };
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
  update.search = buildSearchTokens(patch.boqNo ?? boq.boqNo, boq.projectName, patch.siteName ?? boq.siteName);

  await updateDoc(doc(getDb(), BOQS, boq.id), update);
  logChangeSafe({ entityType: "BOQ", entityId: boq.id, entityLabel: patch.boqNo ?? boq.boqNo, action: "UPDATE", actor });
}

export async function updateBoqStatus(boq: Boq, status: BoqStatus, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), BOQS, boq.id), { status, updatedAt: serverTimestamp() });
  logChangeSafe({
    entityType: "BOQ", entityId: boq.id, entityLabel: boq.boqNo, action: "UPDATE", actor,
    changes: [{ field: "status", from: boq.status, to: status }],
  });
}

/** Requires the approver to type their own name as confirmation — a lightweight internal e-sign, not a cryptographic signature — and moves status to APPROVED in the same write. */
export async function approveBoq(boq: Boq, signatureName: string, note: string | undefined, actor: Actor): Promise<void> {
  if (signatureName.trim().toLowerCase() !== actor.name.trim().toLowerCase()) {
    throw new Error("Type your name exactly as shown to confirm approval.");
  }
  await updateDoc(doc(getDb(), BOQS, boq.id), {
    status: "APPROVED" as BoqStatus,
    approval: { approvedBy: actor, approvedAt: serverTimestamp(), signatureName: signatureName.trim(), note: note ?? "" },
    updatedAt: serverTimestamp(),
  });
  logChangeSafe({
    entityType: "BOQ", entityId: boq.id, entityLabel: boq.boqNo, action: "UPDATE", actor,
    changes: [{ field: "status", from: boq.status, to: "APPROVED" }],
  });
}

/** Creates a new DRAFT version carrying the same content forward — the only way to get a fresh version, so history stays a real lineage. */
export async function reviseBoq(boq: Boq, actor: Actor): Promise<{ id: string }> {
  const orgId = await getCurrentTenantId();
  const rootId = boq.rootBoqId ?? boq.id;
  const siblingsSnap = await getDocs(
    query(collection(getDb(), BOQS), where("orgId", "==", orgId), where("rootBoqId", "==", rootId)),
  );
  const maxSiblingVersion = siblingsSnap.docs.reduce((max, d) => Math.max(max, (d.data().version as number) || 0), boq.version);

  const ref = doc(collection(getDb(), BOQS));
  const version = maxSiblingVersion + 1;
  await runTransaction(getDb(), async (tx) => {
    tx.set(ref, {
      boqNo: boq.boqNo,
      projectId: boq.projectId,
      projectName: boq.projectName,
      siteName: boq.siteName ?? "",
      version,
      status: "DRAFT" as BoqStatus,
      boqDate: Timestamp.now(),
      items: boq.items,
      totalAmount: boq.totalAmount,
      notes: boq.notes ?? "",
      rootBoqId: rootId,
      revisedFrom: boq.id,
      approval: null,
      orgId,
      search: buildSearchTokens(boq.boqNo, boq.projectName, boq.siteName),
      createdAt: serverTimestamp(),
      createdBy: actor,
      updatedAt: serverTimestamp(),
    });
  });

  logChangeSafe({
    entityType: "BOQ", entityId: ref.id, entityLabel: boq.boqNo, action: "CREATE",
    changes: [{ field: "version", from: boq.version, to: version }],
    actor,
  });
  return { id: ref.id };
}

export async function deleteBoq(boq: Boq, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), BOQS, boq.id));
  logChangeSafe({ entityType: "BOQ", entityId: boq.id, entityLabel: boq.boqNo, action: "DELETE", actor });
}

export function subscribeBoqs(cb: (rows: Boq[]) => void, onError?: (e: Error) => void): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      query(collection(getDb(), BOQS), where("orgId", "==", orgId), orderBy("createdAt", "desc")),
      (snap) => cb(snap.docs.map((d) => mapBoq(d.id, d.data()))),
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}

export function subscribeBoqsForProject(projectId: string, cb: (rows: Boq[]) => void, onError?: (e: Error) => void): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      query(collection(getDb(), BOQS), where("orgId", "==", orgId), where("projectId", "==", projectId)),
      (snap) => cb(snap.docs.map((d) => mapBoq(d.id, d.data())).sort((a, b) => b.version - a.version)),
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}

export function subscribeBoq(id: string, cb: (row: Boq | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), BOQS, id),
    (snap) => cb(snap.exists() ? mapBoq(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export async function getBoq(id: string): Promise<Boq | null> {
  const snap = await getDoc(doc(getDb(), BOQS, id));
  return snap.exists() ? mapBoq(snap.id, snap.data()) : null;
}

/** Every version sharing one lineage: the root (v1) plus every BOQ revised from it. */
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
