"use client";

import {
  collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc,
  Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { PoStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { LineItem, PurchaseOrder } from "../types";
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

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder | null> {
  const snap = await getDoc(doc(getDb(), PURCHASE_ORDERS, id));
  return snap.exists() ? mapPo(snap.id, snap.data()) : null;
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

export async function createPurchaseOrder(draft: PoDraft): Promise<PurchaseOrder> {
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
  return { id: ref.id, ...(payload as unknown as Omit<PurchaseOrder, "id">) };
}

export async function updatePoStatus(id: string, status: PoStatus): Promise<void> {
  await updateDoc(doc(getDb(), PURCHASE_ORDERS, id), { status, updatedAt: serverTimestamp() });
}

/** Bumps paidAmount and, once it covers the total, marks the PO completed. */
export async function recordPoPayment(po: PurchaseOrder, amount: number): Promise<void> {
  const paidAmount = po.paidAmount + amount;
  const update: Record<string, unknown> = { paidAmount, updatedAt: serverTimestamp() };
  if (paidAmount >= po.totalAmount) update.status = "COMPLETED";
  await updateDoc(doc(getDb(), PURCHASE_ORDERS, po.id), update);
}
