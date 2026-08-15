"use client";

/** GST invoices covering hand-picked billed charging sessions — see types.ts's Invoice doc comment for why session picking is manual. */

import {
  addDoc, collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  Timestamp, updateDoc,
} from "firebase/firestore";

import type { InvoiceBillToType, InvoiceStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, Invoice } from "../types";

export const INVOICES = "invoices";

function mapInvoice(id: string, data: Record<string, unknown>): Invoice {
  return { id, ...(data as Omit<Invoice, "id">) };
}

async function nextInvoiceNumber(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "invoices");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return `LG-INV-${String(next).padStart(6, "0")}`;
  });
}

export interface InvoiceDraft {
  billToType: InvoiceBillToType;
  billToId?: string | null;
  billToName: string;
  billToGstin?: string;
  periodStart: Date;
  periodEnd: Date;
  sessionIds: string[];
  subtotalInr: number;
  gstInr: number;
  totalInr: number;
  notes?: string;
}

export async function createInvoice(draft: InvoiceDraft, actor: Actor): Promise<{ id: string; invoiceNumber: string }> {
  const invoiceNumber = await nextInvoiceNumber();
  const ref = await addDoc(collection(getDb(), INVOICES), {
    invoiceNumber,
    status: "DRAFT" as InvoiceStatus,
    billToType: draft.billToType,
    billToId: draft.billToId ?? null,
    billToName: draft.billToName,
    billToGstin: draft.billToGstin ?? "",
    periodStart: Timestamp.fromDate(draft.periodStart),
    periodEnd: Timestamp.fromDate(draft.periodEnd),
    sessionIds: draft.sessionIds,
    subtotalInr: draft.subtotalInr,
    gstInr: draft.gstInr,
    totalInr: draft.totalInr,
    notes: draft.notes ?? "",
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
  return { id: ref.id, invoiceNumber };
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), INVOICES, id), { status, updatedAt: serverTimestamp(), updatedBy: actor });
}

export function subscribeInvoices(
  cb: (rows: Invoice[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), INVOICES), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapInvoice(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeInvoice(
  id: string,
  cb: (row: Invoice | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), INVOICES, id),
    (snap) => cb(snap.exists() ? mapInvoice(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}
