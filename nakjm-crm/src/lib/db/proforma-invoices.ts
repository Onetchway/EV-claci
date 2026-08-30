"use client";

import {
  collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc,
  Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { PiStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, LineItem, ProformaInvoice } from "../types";
import { logActivitySafe } from "./activity";
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

/** Org-wide — the top-level Proforma Invoices page across every project. */
export function subscribeProformaInvoices(cb: (rows: ProformaInvoice[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), PROFORMA_INVOICES)),
    (snap) => cb(snap.docs.map((d) => mapPi(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export async function getProformaInvoice(id: string): Promise<ProformaInvoice | null> {
  const snap = await getDoc(doc(getDb(), PROFORMA_INVOICES, id));
  return snap.exists() ? mapPi(snap.id, snap.data()) : null;
}

export function subscribeProformaInvoice(id: string, cb: (pi: ProformaInvoice | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), PROFORMA_INVOICES, id),
    (snap) => cb(snap.exists() ? mapPi(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
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
  gstType?: "IGST" | "CGST_SGST";
  terms?: string;
  notes?: string;
  sourceDocumentId?: string | null;
}

function splitGst(taxAmount: number, gstType: "IGST" | "CGST_SGST") {
  return {
    igstAmount: gstType === "IGST" ? taxAmount : 0,
    cgstAmount: gstType === "CGST_SGST" ? taxAmount / 2 : 0,
    sgstAmount: gstType === "CGST_SGST" ? taxAmount / 2 : 0,
  };
}

export async function createProformaInvoice(draft: PiDraft, actor?: Actor): Promise<ProformaInvoice> {
  const { items, subtotal } = computeLineTotals(draft.items);
  const taxAmount = draft.taxAmount ?? 0;
  const gstType = draft.gstType ?? "IGST";
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
    gstType,
    ...splitGst(taxAmount, gstType),
    totalAmount: subtotal + taxAmount,
    paidAmount: 0,
    terms: draft.terms ?? "",
    notes: draft.notes ?? "",
    sourceDocumentId: draft.sourceDocumentId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  if (actor) {
    logActivitySafe({
      entityType: "PROFORMA_INVOICE", entityId: ref.id, entityLabel: draft.piNo, action: "CREATE",
      message: `Created PI ${draft.piNo}`, actor, projectId: draft.projectId,
    });
  }
  return { id: ref.id, ...(payload as unknown as Omit<ProformaInvoice, "id">) };
}

export type PiPatch = Partial<Omit<PiDraft, "projectId" | "projectName" | "clientId" | "items">> & {
  items?: Omit<LineItem, "amount" | "srNo">[];
};

export async function updateProformaInvoice(pi: ProformaInvoice, patch: PiPatch, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  const gstType = patch.gstType ?? pi.gstType ?? "IGST";
  if (patch.items) {
    const { items, subtotal } = computeLineTotals(patch.items);
    const taxAmount = patch.taxAmount ?? pi.taxAmount;
    update.items = items;
    update.subtotal = subtotal;
    update.taxAmount = taxAmount;
    update.gstType = gstType;
    Object.assign(update, splitGst(taxAmount, gstType));
    update.totalAmount = subtotal + taxAmount;
  } else if (patch.taxAmount !== undefined || patch.gstType !== undefined) {
    const taxAmount = patch.taxAmount ?? pi.taxAmount;
    update.taxAmount = taxAmount;
    update.gstType = gstType;
    Object.assign(update, splitGst(taxAmount, gstType));
    update.totalAmount = pi.subtotal + taxAmount;
  }
  if (patch.piNo !== undefined) update.piNo = patch.piNo;
  if (patch.milestone !== undefined) update.milestone = patch.milestone;
  if (patch.terms !== undefined) update.terms = patch.terms;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.piDate !== undefined) update.piDate = patch.piDate ? Timestamp.fromDate(patch.piDate) : null;
  if (patch.dueDate !== undefined) update.dueDate = patch.dueDate ? Timestamp.fromDate(patch.dueDate) : null;
  await updateDoc(doc(getDb(), PROFORMA_INVOICES, pi.id), update);
  logActivitySafe({
    entityType: "PROFORMA_INVOICE", entityId: pi.id, entityLabel: pi.piNo,
    action: patch.status && patch.status !== pi.status ? "STATUS_CHANGE" : "UPDATE",
    message: patch.status && patch.status !== pi.status ? `Marked PI ${pi.piNo} ${patch.status}` : `Edited PI ${pi.piNo}`,
    actor, projectId: pi.projectId,
  });
}

export async function deleteProformaInvoice(pi: ProformaInvoice, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), PROFORMA_INVOICES, pi.id));
  logActivitySafe({
    entityType: "PROFORMA_INVOICE", entityId: pi.id, entityLabel: pi.piNo, action: "DELETE",
    message: `Deleted PI ${pi.piNo}`, actor, projectId: pi.projectId,
  });
}

/** Bumps paidAmount and updates status to PAID / PARTIALLY_PAID accordingly. */
export async function recordPiPayment(pi: ProformaInvoice, amount: number, actor?: Actor): Promise<void> {
  const paidAmount = pi.paidAmount + amount;
  const status: PiStatus = paidAmount >= pi.totalAmount ? "PAID" : "PARTIALLY_PAID";
  await updateDoc(doc(getDb(), PROFORMA_INVOICES, pi.id), { paidAmount, status, updatedAt: serverTimestamp() });
  if (actor) {
    logActivitySafe({
      entityType: "PROFORMA_INVOICE", entityId: pi.id, entityLabel: pi.piNo, action: "UPDATE",
      message: `Recorded payment against PI ${pi.piNo}`, actor, projectId: pi.projectId,
    });
  }
}
