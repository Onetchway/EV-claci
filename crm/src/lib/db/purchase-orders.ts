"use client";

/**
 * Purchase orders — what Livanto has ordered from a vendor (chargers, civil
 * work, EPC scope) and what's been paid against it. Mirrors the shape of
 * db/payments.ts (lead payments) but for money going OUT instead of in.
 */

import {
  addDoc, collection, doc, getDoc, getDocs, limit as fsLimit, onSnapshot,
  orderBy, query, runTransaction, serverTimestamp, Timestamp, updateDoc, where,
} from "firebase/firestore";

import { GST_RATE } from "../catalog";
import type { GstType, PaymentMode, PoStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, PoItem, PurchaseOrder, ShipToInfo, VendorPayment } from "../types";
import { VENDORS } from "./vendors";

export const PURCHASE_ORDERS = "purchaseOrders";

function mapPo(id: string, data: Record<string, unknown>): PurchaseOrder {
  return { id, ...(data as Omit<PurchaseOrder, "id">) };
}

function mapPayment(id: string, data: Record<string, unknown>): VendorPayment {
  return { id, ...(data as Omit<VendorPayment, "id">) };
}

async function nextPoNumber(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "purchaseOrders");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return `LG-PO-${String(next).padStart(6, "0")}`;
  });
}

function totals(items: PoItem[]) {
  let subtotal = 0;
  let gst = 0;
  for (const it of items) {
    const line = Math.max(0, Math.round(it.qty)) * Math.max(0, it.unitPrice);
    subtotal += line;
    gst += Math.round(line * (Math.max(0, it.gstPct) / 100));
  }
  return { subtotal: Math.round(subtotal), gst, total: Math.round(subtotal) + gst };
}

export interface PoDraft {
  vendorId: string;
  vendorName: string;
  items: PoItem[];
  linkedProjectId?: string | null;
  linkedProjectCode?: string | null;
  expectedDeliveryAt?: Date | null;
  notes?: string;
  terms?: string;
  gstType?: GstType;
  shipToEnabled?: boolean;
  shipTo?: ShipToInfo | null;
}

export async function createPurchaseOrder(draft: PoDraft, actor: Actor): Promise<{ id: string; poNumber: string }> {
  const poNumber = await nextPoNumber();
  const money = totals(draft.items);
  const ref = doc(collection(getDb(), PURCHASE_ORDERS));

  await runTransaction(getDb(), async (tx) => {
    const vendorRef = doc(getDb(), VENDORS, draft.vendorId);
    const vendorSnap = await tx.get(vendorRef);
    tx.set(ref, {
      poNumber,
      vendorId: draft.vendorId,
      vendorName: draft.vendorName,
      status: "DRAFT" as PoStatus,
      items: draft.items,
      ...money,
      paidAmount: 0,
      dueAmount: money.total,
      linkedProjectId: draft.linkedProjectId ?? null,
      linkedProjectCode: draft.linkedProjectCode ?? null,
      expectedDeliveryAt: draft.expectedDeliveryAt ? Timestamp.fromDate(draft.expectedDeliveryAt) : null,
      receivedAt: null,
      notes: draft.notes ?? "",
      terms: draft.terms ?? "",
      gstType: draft.gstType ?? "IGST",
      shipToEnabled: draft.shipToEnabled ?? false,
      shipTo: draft.shipToEnabled ? (draft.shipTo ?? null) : null,
      createdAt: serverTimestamp(),
      createdBy: actor,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    });
    if (vendorSnap.exists()) {
      const ordered = (vendorSnap.data().totalOrdered as number) ?? 0;
      tx.update(vendorRef, { totalOrdered: ordered + money.total });
    }
  });

  return { id: ref.id, poNumber };
}

export async function updatePurchaseOrderStatus(po: PurchaseOrder, status: PoStatus, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), PURCHASE_ORDERS, po.id), {
    status,
    receivedAt: status === "RECEIVED" ? serverTimestamp() : po.receivedAt ?? null,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

export function subscribePurchaseOrders(
  filters: { vendorId?: string; max?: number },
  cb: (rows: PurchaseOrder[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const constraints = filters.vendorId ? [where("vendorId", "==", filters.vendorId)] : [];
  return onSnapshot(
    query(collection(getDb(), PURCHASE_ORDERS), ...constraints, orderBy("createdAt", "desc"), fsLimit(filters.max ?? 500)),
    (snap) => cb(snap.docs.map((d) => mapPo(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribePurchaseOrder(
  id: string,
  cb: (row: PurchaseOrder | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), PURCHASE_ORDERS, id),
    (snap) => cb(snap.exists() ? mapPo(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

// --- vendor payments (subcollection of a PO) --------------------------------

const paymentsRef = (poId: string) => collection(getDb(), PURCHASE_ORDERS, poId, "payments");

export function subscribeVendorPayments(
  poId: string,
  cb: (rows: VendorPayment[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(paymentsRef(poId), orderBy("createdAt", "asc")),
    (snap) => cb(snap.docs.map((d) => mapPayment(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export interface VendorPaymentDraft {
  amount: number;
  mode: PaymentMode;
  reference?: string;
  paidAt?: Date | null;
  note?: string;
}

/** Recomputes the PO's paidAmount/dueAmount from every settled payment. */
async function refreshPoPaymentRollup(poId: string): Promise<void> {
  const snap = await getDocs(query(paymentsRef(poId)));
  const paid = snap.docs.reduce((a, d) => a + ((d.data().amount as number) ?? 0), 0);
  const poRef = doc(getDb(), PURCHASE_ORDERS, poId);
  const poSnap = await getDoc(poRef);
  if (!poSnap.exists()) return;
  const total = (poSnap.data().total as number) ?? 0;
  await updateDoc(poRef, { paidAmount: paid, dueAmount: Math.max(0, total - paid) });
}

export async function addVendorPayment(po: PurchaseOrder, draft: VendorPaymentDraft, actor: Actor): Promise<void> {
  await addDoc(paymentsRef(po.id), {
    poId: po.id,
    amount: Math.max(0, Math.round(draft.amount)),
    mode: draft.mode,
    reference: draft.reference ?? "",
    status: "PAID",
    paidAt: draft.paidAt ? Timestamp.fromDate(draft.paidAt) : serverTimestamp(),
    note: draft.note ?? "",
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
  await refreshPoPaymentRollup(po.id);

  const vendorRef = doc(getDb(), VENDORS, po.vendorId);
  const vendorSnap = await getDoc(vendorRef);
  if (vendorSnap.exists()) {
    const paid = (vendorSnap.data().totalPaid as number) ?? 0;
    await updateDoc(vendorRef, { totalPaid: paid + Math.max(0, Math.round(draft.amount)) });
  }
}

/** Default GST rate offered when adding a PO line item. */
export const DEFAULT_PO_GST_PCT = GST_RATE * 100;
