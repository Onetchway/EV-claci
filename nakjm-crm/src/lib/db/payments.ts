"use client";

import {
  collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp,
  Timestamp, where,
} from "firebase/firestore";

import type { PaymentMode } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, ClientPayment, VendorPayment } from "../types";
import { logActivitySafe } from "./activity";
import { PROFORMA_INVOICES } from "./proforma-invoices";
import { PURCHASE_ORDERS } from "./purchase-orders";

export const CLIENT_PAYMENTS = "clientPayments";
export const VENDOR_PAYMENTS = "vendorPayments";

function mapClientPayment(id: string, data: Record<string, unknown>): ClientPayment {
  return { id, ...(data as Omit<ClientPayment, "id">) };
}
function mapVendorPayment(id: string, data: Record<string, unknown>): VendorPayment {
  return { id, ...(data as Omit<VendorPayment, "id">) };
}

export function subscribeClientPayments(
  filters: { projectId?: string; clientId?: string },
  cb: (rows: ClientPayment[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const base = collection(getDb(), CLIENT_PAYMENTS);
  const q = filters.projectId
    ? query(base, where("projectId", "==", filters.projectId))
    : filters.clientId
      ? query(base, where("clientId", "==", filters.clientId))
      : query(base);
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => mapClientPayment(d.id, d.data())).sort((a, b) => (b.paymentDate?.seconds ?? 0) - (a.paymentDate?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export async function getClientPayment(id: string): Promise<ClientPayment | null> {
  const snap = await getDoc(doc(getDb(), CLIENT_PAYMENTS, id));
  return snap.exists() ? mapClientPayment(snap.id, snap.data()) : null;
}

export async function getVendorPayment(id: string): Promise<VendorPayment | null> {
  const snap = await getDoc(doc(getDb(), VENDOR_PAYMENTS, id));
  return snap.exists() ? mapVendorPayment(snap.id, snap.data()) : null;
}

export function subscribeVendorPayments(
  filters: { projectId?: string; vendorId?: string },
  cb: (rows: VendorPayment[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const base = collection(getDb(), VENDOR_PAYMENTS);
  const q = filters.projectId
    ? query(base, where("projectId", "==", filters.projectId))
    : filters.vendorId
      ? query(base, where("vendorId", "==", filters.vendorId))
      : query(base);
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => mapVendorPayment(d.id, d.data())).sort((a, b) => (b.paymentDate?.seconds ?? 0) - (a.paymentDate?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export interface ClientPaymentDraft {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  piId?: string | null;
  paymentDate?: Date | null;
  amount: number;
  mode: PaymentMode;
  referenceNo?: string;
  milestone?: string;
  notes?: string;
}

export async function recordClientPayment(draft: ClientPaymentDraft, actor?: Actor): Promise<void> {
  const db = getDb();
  const ref = doc(collection(db, CLIENT_PAYMENTS));
  await runTransaction(db, async (tx) => {
    let piSnap = null;
    const piRef = draft.piId ? doc(db, PROFORMA_INVOICES, draft.piId) : null;
    if (piRef) piSnap = await tx.get(piRef);

    tx.set(ref, {
      projectId: draft.projectId,
      projectName: draft.projectName,
      clientId: draft.clientId,
      clientName: draft.clientName,
      piId: draft.piId ?? null,
      paymentDate: draft.paymentDate ? Timestamp.fromDate(draft.paymentDate) : Timestamp.now(),
      amount: draft.amount,
      mode: draft.mode,
      referenceNo: draft.referenceNo ?? "",
      milestone: draft.milestone ?? "",
      notes: draft.notes ?? "",
      createdAt: serverTimestamp(),
    });

    if (piRef && piSnap?.exists()) {
      const pi = piSnap.data() as { paidAmount: number; totalAmount: number };
      const paidAmount = (pi.paidAmount ?? 0) + draft.amount;
      tx.update(piRef, { paidAmount, status: paidAmount >= pi.totalAmount ? "PAID" : "PARTIALLY_PAID", updatedAt: serverTimestamp() });
    }
  });
  if (actor) {
    logActivitySafe({
      entityType: "CLIENT_PAYMENT", entityId: ref.id, entityLabel: draft.clientName, action: "CREATE",
      message: `Recorded payment of ${draft.amount} from ${draft.clientName}`, actor, projectId: draft.projectId,
    });
  }
}

export interface VendorPaymentDraft {
  vendorId: string;
  vendorName: string;
  projectId: string;
  projectName: string;
  poId?: string | null;
  paymentDate?: Date | null;
  amount: number;
  mode: PaymentMode;
  referenceNo?: string;
  notes?: string;
}

export async function recordVendorPayment(draft: VendorPaymentDraft, actor?: Actor): Promise<void> {
  const db = getDb();
  const ref = doc(collection(db, VENDOR_PAYMENTS));
  await runTransaction(db, async (tx) => {
    let poSnap = null;
    const poRef = draft.poId ? doc(db, PURCHASE_ORDERS, draft.poId) : null;
    if (poRef) poSnap = await tx.get(poRef);

    tx.set(ref, {
      vendorId: draft.vendorId,
      vendorName: draft.vendorName,
      projectId: draft.projectId,
      projectName: draft.projectName,
      poId: draft.poId ?? null,
      paymentDate: draft.paymentDate ? Timestamp.fromDate(draft.paymentDate) : Timestamp.now(),
      amount: draft.amount,
      mode: draft.mode,
      referenceNo: draft.referenceNo ?? "",
      notes: draft.notes ?? "",
      createdAt: serverTimestamp(),
    });

    if (poRef && poSnap?.exists()) {
      const po = poSnap.data() as { paidAmount: number; totalAmount: number; status: string };
      const paidAmount = (po.paidAmount ?? 0) + draft.amount;
      tx.update(poRef, { paidAmount, status: paidAmount >= po.totalAmount ? "COMPLETED" : po.status, updatedAt: serverTimestamp() });
    }
  });
  if (actor) {
    logActivitySafe({
      entityType: "VENDOR_PAYMENT", entityId: ref.id, entityLabel: draft.vendorName, action: "CREATE",
      message: `Recorded payment of ${draft.amount} to ${draft.vendorName}`, actor, projectId: draft.projectId,
    });
  }
}
