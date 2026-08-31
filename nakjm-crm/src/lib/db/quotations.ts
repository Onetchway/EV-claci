"use client";

import {
  collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, Timestamp,
} from "firebase/firestore";

import type { QuotationStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, LineItem, Quotation } from "../types";
import { logActivitySafe } from "./activity";

export const QUOTATIONS = "quotations";

function mapQuotation(id: string, data: Record<string, unknown>): Quotation {
  return { id, ...(data as Omit<Quotation, "id">) };
}

/** gstType only changes how the (already flat-rate) tax is split for display/print — IGST, or half-half CGST+SGST. */
export function computeLineTotals(items: Omit<LineItem, "amount" | "srNo">[], taxPercent = 0, gstType: "IGST" | "CGST_SGST" = "IGST") {
  const withAmounts: LineItem[] = items.map((it, i) => ({
    srNo: i + 1,
    description: it.description,
    unit: it.unit,
    qty: Number(it.qty) || 0,
    rate: Number(it.rate) || 0,
    amount: (Number(it.qty) || 0) * (Number(it.rate) || 0),
    hsnCode: it.hsnCode,
  }));
  const subtotal = withAmounts.reduce((s, it) => s + it.amount, 0);
  const taxAmount = Math.round(subtotal * (taxPercent / 100) * 100) / 100;
  const igstAmount = gstType === "IGST" ? taxAmount : 0;
  const cgstAmount = gstType === "CGST_SGST" ? taxAmount / 2 : 0;
  const sgstAmount = gstType === "CGST_SGST" ? taxAmount / 2 : 0;
  return { items: withAmounts, subtotal, taxAmount, igstAmount, cgstAmount, sgstAmount, total: subtotal + taxAmount };
}

export function subscribeQuotationsForProject(projectId: string, cb: (rows: Quotation[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), QUOTATIONS), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapQuotation(d.id, d.data())).sort((a, b) => b.version - a.version)),
    (err) => onError?.(err as Error),
  );
}

export function subscribeQuotationsForClient(clientId: string, cb: (rows: Quotation[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), QUOTATIONS), where("clientId", "==", clientId)),
    (snap) => cb(snap.docs.map((d) => mapQuotation(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

/** Org-wide — the top-level Quotations page across every project. */
export function subscribeQuotations(cb: (rows: Quotation[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), QUOTATIONS)),
    (snap) => cb(snap.docs.map((d) => mapQuotation(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export async function getQuotation(id: string): Promise<Quotation | null> {
  const snap = await getDoc(doc(getDb(), QUOTATIONS, id));
  return snap.exists() ? mapQuotation(snap.id, snap.data()) : null;
}

export function subscribeQuotation(id: string, cb: (q: Quotation | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), QUOTATIONS, id),
    (snap) => cb(snap.exists() ? mapQuotation(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export async function nextQuotationVersion(projectId: string): Promise<number> {
  const snap = await getDocs(query(collection(getDb(), QUOTATIONS), where("projectId", "==", projectId)));
  return snap.docs.reduce((max, d) => Math.max(max, (d.data().version as number) || 0), 0) + 1;
}

export interface QuotationDraft {
  quotationNo: string;
  projectId: string;
  projectName: string;
  clientId: string;
  version: number;
  status?: QuotationStatus;
  quotationDate?: Date | null;
  validUntil?: Date | null;
  items: Omit<LineItem, "amount" | "srNo">[];
  taxPercent: number;
  gstType?: "IGST" | "CGST_SGST";
  shipToDifferent?: boolean;
  shipToAddress?: string;
  terms?: string;
  notes?: string;
  sourceBoqId?: string | null;
}

export async function createQuotation(draft: QuotationDraft, actor?: Actor): Promise<Quotation> {
  const gstType = draft.gstType ?? "IGST";
  const { items, subtotal, taxAmount, igstAmount, cgstAmount, sgstAmount, total } = computeLineTotals(draft.items, draft.taxPercent, gstType);
  const ref = doc(collection(getDb(), QUOTATIONS));
  const payload = {
    quotationNo: draft.quotationNo,
    projectId: draft.projectId,
    projectName: draft.projectName,
    clientId: draft.clientId,
    version: draft.version,
    status: draft.status ?? "DRAFT",
    quotationDate: draft.quotationDate ? Timestamp.fromDate(draft.quotationDate) : Timestamp.now(),
    validUntil: draft.validUntil ? Timestamp.fromDate(draft.validUntil) : null,
    items,
    subtotal,
    taxPercent: draft.taxPercent,
    taxAmount,
    gstType,
    igstAmount,
    cgstAmount,
    sgstAmount,
    totalAmount: total,
    shipToDifferent: draft.shipToDifferent ?? false,
    shipToAddress: draft.shipToDifferent ? (draft.shipToAddress ?? "") : "",
    terms: draft.terms ?? "",
    notes: draft.notes ?? "",
    sourceBoqId: draft.sourceBoqId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  if (actor) {
    logActivitySafe({
      entityType: "QUOTATION", entityId: ref.id, entityLabel: draft.quotationNo, action: "CREATE",
      message: `Created quotation ${draft.quotationNo} (v${draft.version})`, actor, projectId: draft.projectId,
    });
  }
  return { id: ref.id, ...(payload as unknown as Omit<Quotation, "id">) };
}

/** Every version sharing one lineage -- the root (v1) plus every quotation revised from it, directly or transitively. */
export function subscribeQuotationLineage(rootQuotationId: string, cb: (rows: Quotation[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), QUOTATIONS), where("rootQuotationId", "==", rootQuotationId)),
    (snap) => {
      const revisions = snap.docs.map((d) => mapQuotation(d.id, d.data()));
      void getDoc(doc(getDb(), QUOTATIONS, rootQuotationId)).then((rootSnap) => {
        const root = rootSnap.exists() ? [mapQuotation(rootSnap.id, rootSnap.data())] : [];
        cb([...root, ...revisions].sort((a, b) => a.version - b.version));
      });
    },
    (err) => onError?.(err as Error),
  );
}

/** Creates a new DRAFT version carrying the same content forward -- the only way to get a fresh version of an existing quotation, so version history stays a real lineage instead of an unrelated per-project counter. */
export async function reviseQuotation(quotation: Quotation, actor: Actor): Promise<Quotation> {
  const rootId = quotation.rootQuotationId ?? quotation.id;
  const siblingsSnap = await getDocs(query(collection(getDb(), QUOTATIONS), where("rootQuotationId", "==", rootId)));
  const maxSiblingVersion = siblingsSnap.docs.reduce((max, d) => Math.max(max, (d.data().version as number) || 0), quotation.version);

  const ref = doc(collection(getDb(), QUOTATIONS));
  const payload = {
    quotationNo: quotation.quotationNo,
    projectId: quotation.projectId,
    projectName: quotation.projectName,
    clientId: quotation.clientId,
    version: maxSiblingVersion + 1,
    status: "DRAFT" as QuotationStatus,
    quotationDate: Timestamp.now(),
    validUntil: quotation.validUntil ?? null,
    items: quotation.items,
    subtotal: quotation.subtotal,
    taxPercent: quotation.taxPercent,
    taxAmount: quotation.taxAmount,
    gstType: quotation.gstType ?? "IGST",
    igstAmount: quotation.igstAmount ?? 0,
    cgstAmount: quotation.cgstAmount ?? 0,
    sgstAmount: quotation.sgstAmount ?? 0,
    totalAmount: quotation.totalAmount,
    shipToDifferent: quotation.shipToDifferent ?? false,
    shipToAddress: quotation.shipToAddress ?? "",
    terms: quotation.terms ?? "",
    notes: quotation.notes ?? "",
    sourceBoqId: quotation.sourceBoqId ?? null,
    rootQuotationId: rootId,
    revisedFrom: quotation.id,
    approval: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: "QUOTATION", entityId: ref.id, entityLabel: quotation.quotationNo, action: "CREATE",
    message: `${actor.name} created v${payload.version} of quotation ${quotation.quotationNo}, revised from v${quotation.version}`, actor, projectId: quotation.projectId,
  });
  return { id: ref.id, ...(payload as unknown as Omit<Quotation, "id">) };
}

export async function updateQuotationStatus(id: string, status: QuotationStatus, actor?: Actor, context?: { quotationNo: string; projectId: string }): Promise<void> {
  await updateDoc(doc(getDb(), QUOTATIONS, id), { status, updatedAt: serverTimestamp() });
  if (actor && context) {
    logActivitySafe({
      entityType: "QUOTATION", entityId: id, entityLabel: context.quotationNo, action: "STATUS_CHANGE",
      message: `Marked quotation ${context.quotationNo} ${status}`, actor, projectId: context.projectId,
    });
  }
}

/**
 * Sign-off: requires the approver to type their own name as confirmation
 * (a lightweight internal e-sign, not a cryptographic signature), records
 * who/when/what they typed, and moves status to APPROVED in the same write.
 */
export async function approveQuotation(quotation: Quotation, signatureName: string, note: string | undefined, actor: Actor): Promise<void> {
  if (signatureName.trim().toLowerCase() !== actor.name.trim().toLowerCase()) {
    throw new Error("Type your name exactly as shown to confirm approval.");
  }
  await updateDoc(doc(getDb(), QUOTATIONS, quotation.id), {
    status: "APPROVED",
    approval: { approvedBy: actor, approvedAt: serverTimestamp(), signatureName: signatureName.trim(), note: note ?? "" },
    updatedAt: serverTimestamp(),
  });
  logActivitySafe({
    entityType: "QUOTATION", entityId: quotation.id, entityLabel: quotation.quotationNo, action: "STATUS_CHANGE",
    message: `${actor.name} approved quotation ${quotation.quotationNo}`, actor, projectId: quotation.projectId,
  });
}

export type QuotationPatch = Partial<Omit<QuotationDraft, "projectId" | "projectName" | "clientId" | "version" | "items" | "taxPercent">> & {
  items?: Omit<LineItem, "amount" | "srNo">[];
  taxPercent?: number;
};

export async function updateQuotation(quotation: Quotation, patch: QuotationPatch, actor: Actor): Promise<void> {
  const items = patch.items ?? quotation.items;
  const taxPercent = patch.taxPercent ?? quotation.taxPercent;
  const gstType = patch.gstType ?? quotation.gstType ?? "IGST";
  const { items: computedItems, subtotal, taxAmount, igstAmount, cgstAmount, sgstAmount, total } = computeLineTotals(items, taxPercent, gstType);
  const update: Record<string, unknown> = {
    items: computedItems, subtotal, taxPercent, taxAmount, gstType, igstAmount, cgstAmount, sgstAmount,
    totalAmount: total, updatedAt: serverTimestamp(),
  };
  if (patch.quotationDate !== undefined) update.quotationDate = patch.quotationDate ? Timestamp.fromDate(patch.quotationDate) : null;
  if (patch.validUntil !== undefined) update.validUntil = patch.validUntil ? Timestamp.fromDate(patch.validUntil) : null;
  if (patch.terms !== undefined) update.terms = patch.terms;
  if (patch.shipToDifferent !== undefined) update.shipToDifferent = patch.shipToDifferent;
  if (patch.shipToAddress !== undefined) update.shipToAddress = patch.shipToAddress;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.quotationNo !== undefined) update.quotationNo = patch.quotationNo;
  await updateDoc(doc(getDb(), QUOTATIONS, quotation.id), update);
  logActivitySafe({
    entityType: "QUOTATION", entityId: quotation.id, entityLabel: quotation.quotationNo, action: "UPDATE",
    message: `Edited quotation ${quotation.quotationNo}`, actor, projectId: quotation.projectId,
  });
}

export async function deleteQuotation(quotation: Quotation, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), QUOTATIONS, quotation.id));
  logActivitySafe({
    entityType: "QUOTATION", entityId: quotation.id, entityLabel: quotation.quotationNo, action: "DELETE",
    message: `Deleted quotation ${quotation.quotationNo}`, actor, projectId: quotation.projectId,
  });
}
