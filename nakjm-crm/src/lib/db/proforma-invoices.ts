"use client";

import {
  collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc,
  Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { PiStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { LineItem, ProformaInvoice } from "../types";
import { computeLineTotals } from "./quotations";

export const PROFORMA_INVOICES = "proformaInvoices";

function mapPi(id: string, data: Record<string, unknown>): ProformaInvoice {
  return { id, ...(data as Omit<ProformaInvoice, "id">) };
}

export function subscribePisForProject(projectId: string, cb: (rows: ProformaInvoice[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), PROFORMA_INVOICES), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapPi(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export async function getProformaInvoice(id: string): Promise<ProformaInvoice | null> {
  const snap = await getDoc(doc(getDb(), PROFORMA_INVOICES, id));
  return snap.exists() ? mapPi(snap.id, snap.data()) : null;
}

export interface PiDraft {
  piNo: string;
  projectId: string;
  projectName: string;
  clientId: string;
  quotationId?: string | null;
  piDate?: Date | null;
  dueDate?: Date | null;
  status?: PiStatus;
  milestone?: string;
  items: Omit<LineItem, "amount" | "srNo">[];
  taxAmount?: number;
  notes?: string;
  sourceDocumentId?: string | null;
}

export async function createProformaInvoice(draft: PiDraft): Promise<ProformaInvoice> {
  const { items, subtotal } = computeLineTotals(draft.items);
  const taxAmount = draft.taxAmount ?? 0;
  const ref = doc(collection(getDb(), PROFORMA_INVOICES));
  const payload = {
    piNo: draft.piNo,
    projectId: draft.projectId,
    projectName: draft.projectName,
    clientId: draft.clientId,
    quotationId: draft.quotationId ?? null,
    piDate: draft.piDate ? Timestamp.fromDate(draft.piDate) : Timestamp.now(),
    dueDate: draft.dueDate ? Timestamp.fromDate(draft.dueDate) : null,
    status: draft.status ?? "DRAFT",
    milestone: draft.milestone ?? "",
    items,
    subtotal,
    taxAmount,
    totalAmount: subtotal + taxAmount,
    paidAmount: 0,
    notes: draft.notes ?? "",
    sourceDocumentId: draft.sourceDocumentId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  return { id: ref.id, ...(payload as unknown as Omit<ProformaInvoice, "id">) };
}

/** Bumps paidAmount and updates status to PAID / PARTIALLY_PAID accordingly. */
export async function recordPiPayment(pi: ProformaInvoice, amount: number): Promise<void> {
  const paidAmount = pi.paidAmount + amount;
  const status: PiStatus = paidAmount >= pi.totalAmount ? "PAID" : "PARTIALLY_PAID";
  await updateDoc(doc(getDb(), PROFORMA_INVOICES, pi.id), { paidAmount, status, updatedAt: serverTimestamp() });
}
