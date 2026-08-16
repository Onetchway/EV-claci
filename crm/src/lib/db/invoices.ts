"use client";

/** GST invoices covering hand-picked billed charging sessions — see types.ts's Invoice doc comment for why session picking is manual. */

import {
  addDoc, collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { InvoiceBillToType, InvoiceStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, CreditDebitNote, CreditDebitNoteKind, Invoice } from "../types";

export const INVOICES = "invoices";
export const CREDIT_DEBIT_NOTES = "creditDebitNotes";

function mapInvoice(id: string, data: Record<string, unknown>): Invoice {
  return { id, ...(data as Omit<Invoice, "id">) };
}
function mapNote(id: string, data: Record<string, unknown>): CreditDebitNote {
  return { id, ...(data as Omit<CreditDebitNote, "id">) };
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

export async function setInvoiceTax(
  id: string,
  patch: { hsnSac?: string; tdsPct?: number },
  totalInr: number,
  actor: Actor,
): Promise<void> {
  const tdsInr = patch.tdsPct ? Math.round(totalInr * (patch.tdsPct / 100) * 100) / 100 : 0;
  await updateDoc(doc(getDb(), INVOICES, id), {
    ...patch, tdsInr, updatedAt: serverTimestamp(), updatedBy: actor,
  });
}

async function nextNoteNumber(kind: CreditDebitNoteKind): Promise<string> {
  const db = getDb();
  const counterId = kind === "CREDIT" ? "creditNotes" : "debitNotes";
  const prefix = kind === "CREDIT" ? "LG-CN" : "LG-DN";
  const ref = doc(db, "counters", counterId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return `${prefix}-${String(next).padStart(6, "0")}`;
  });
}

export async function createCreditDebitNote(
  draft: { invoiceId: string; invoiceNumber: string; kind: CreditDebitNoteKind; amountInr: number; gstInr: number; reason: string },
  actor: Actor,
): Promise<string> {
  const noteNumber = await nextNoteNumber(draft.kind);
  const ref = await addDoc(collection(getDb(), CREDIT_DEBIT_NOTES), {
    ...draft, noteNumber, createdAt: serverTimestamp(), createdBy: actor,
  });
  return ref.id;
}

export function subscribeCreditDebitNotesForInvoice(
  invoiceId: string,
  cb: (rows: CreditDebitNote[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), CREDIT_DEBIT_NOTES), where("invoiceId", "==", invoiceId), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapNote(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
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
