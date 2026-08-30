"use client";

import {
  collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc,
  Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { PoStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, LineItem, PurchaseOrder } from "../types";
import { logActivitySafe } from "./activity";
import { computeLineTotals } from "./quotations";

export const PURCHASE_ORDERS = "purchaseOrders";

function mapPo(id: string, data: Record<string, unknown>): PurchaseOrder {
  return { id, ...(data as Omit<PurchaseOrder, "id">) };
}

export function subscribePosForProject(projectId: string, cb: (rows: PurchaseOrder[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), PURCHASE_ORDERS), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapPo(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export function subscribePosForVendor(vendorId: string, cb: (rows: PurchaseOrder[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), PURCHASE_ORDERS), where("vendorId", "==", vendorId)),
    (snap) => cb(snap.docs.map((d) => mapPo(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

/** Org-wide — the top-level Purchase Orders page across every project. */
export function subscribePurchaseOrders(cb: (rows: PurchaseOrder[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), PURCHASE_ORDERS)),
    (snap) => cb(snap.docs.map((d) => mapPo(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder | null> {
  const snap = await getDoc(doc(getDb(), PURCHASE_ORDERS, id));
  return snap.exists() ? mapPo(snap.id, snap.data()) : null;
}

export function subscribePurchaseOrder(id: string, cb: (po: PurchaseOrder | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), PURCHASE_ORDERS, id),
    (snap) => cb(snap.exists() ? mapPo(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export interface PoDraft {
  poNo: string;
  projectId: string;
  projectName: string;
  vendorId: string;
  vendorName: string;
  poDate?: Date | null;
  deliveryDate?: Date | null;
  status?: PoStatus;
  items: Omit<LineItem, "amount" | "srNo">[];
  taxAmount?: number;
  terms?: string;
  notes?: string;
}

export async function createPurchaseOrder(draft: PoDraft, actor?: Actor): Promise<PurchaseOrder> {
  const { items, subtotal } = computeLineTotals(draft.items);
  const taxAmount = draft.taxAmount ?? 0;
  const ref = doc(collection(getDb(), PURCHASE_ORDERS));
  const payload = {
    poNo: draft.poNo,
    projectId: draft.projectId,
    projectName: draft.projectName,
    vendorId: draft.vendorId,
    vendorName: draft.vendorName,
    poDate: draft.poDate ? Timestamp.fromDate(draft.poDate) : Timestamp.now(),
    deliveryDate: draft.deliveryDate ? Timestamp.fromDate(draft.deliveryDate) : null,
    status: draft.status ?? "DRAFT",
    items,
    subtotal,
    taxAmount,
    totalAmount: subtotal + taxAmount,
    paidAmount: 0,
    terms: draft.terms ?? "",
    notes: draft.notes ?? "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  if (actor) {
    logActivitySafe({
      entityType: "PURCHASE_ORDER", entityId: ref.id, entityLabel: draft.poNo, action: "CREATE",
      message: `Created PO ${draft.poNo} for ${draft.vendorName}`, actor, projectId: draft.projectId,
    });
  }
  return { id: ref.id, ...(payload as unknown as Omit<PurchaseOrder, "id">) };
}

export async function updatePoStatus(po: PurchaseOrder, status: PoStatus, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), PURCHASE_ORDERS, po.id), { status, updatedAt: serverTimestamp() });
  logActivitySafe({
    entityType: "PURCHASE_ORDER", entityId: po.id, entityLabel: po.poNo, action: "STATUS_CHANGE",
    message: `Marked PO ${po.poNo} ${status}`, actor, projectId: po.projectId,
  });
}

export type PoPatch = Partial<Omit<PoDraft, "projectId" | "projectName" | "vendorId" | "vendorName" | "items">> & {
  items?: Omit<LineItem, "amount" | "srNo">[];
  vendorId?: string;
  vendorName?: string;
};

export async function updatePurchaseOrder(po: PurchaseOrder, patch: PoPatch, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.items) {
    const { items, subtotal } = computeLineTotals(patch.items);
    const taxAmount = patch.taxAmount ?? po.taxAmount;
    update.items = items;
    update.subtotal = subtotal;
    update.taxAmount = taxAmount;
    update.totalAmount = subtotal + taxAmount;
  } else if (patch.taxAmount !== undefined) {
    update.taxAmount = patch.taxAmount;
    update.totalAmount = po.subtotal + patch.taxAmount;
  }
  if (patch.poNo !== undefined) update.poNo = patch.poNo;
  if (patch.vendorId !== undefined) update.vendorId = patch.vendorId;
  if (patch.vendorName !== undefined) update.vendorName = patch.vendorName;
  if (patch.terms !== undefined) update.terms = patch.terms;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.poDate !== undefined) update.poDate = patch.poDate ? Timestamp.fromDate(patch.poDate) : null;
  if (patch.deliveryDate !== undefined) update.deliveryDate = patch.deliveryDate ? Timestamp.fromDate(patch.deliveryDate) : null;
  await updateDoc(doc(getDb(), PURCHASE_ORDERS, po.id), update);
  logActivitySafe({
    entityType: "PURCHASE_ORDER", entityId: po.id, entityLabel: po.poNo, action: "UPDATE",
    message: `Edited PO ${po.poNo}`, actor, projectId: po.projectId,
  });
}

export async function deletePurchaseOrder(po: PurchaseOrder, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), PURCHASE_ORDERS, po.id));
  logActivitySafe({
    entityType: "PURCHASE_ORDER", entityId: po.id, entityLabel: po.poNo, action: "DELETE",
    message: `Deleted PO ${po.poNo}`, actor, projectId: po.projectId,
  });
}

/** Bumps paidAmount and, once it covers the total, marks the PO completed. */
export async function recordPoPayment(po: PurchaseOrder, amount: number, actor?: Actor): Promise<void> {
  const paidAmount = po.paidAmount + amount;
  const update: Record<string, unknown> = { paidAmount, updatedAt: serverTimestamp() };
  if (paidAmount >= po.totalAmount) update.status = "COMPLETED";
  await updateDoc(doc(getDb(), PURCHASE_ORDERS, po.id), update);
  if (actor) {
    logActivitySafe({
      entityType: "PURCHASE_ORDER", entityId: po.id, entityLabel: po.poNo, action: "UPDATE",
      message: `Recorded payment against PO ${po.poNo}`, actor, projectId: po.projectId,
    });
  }
}
