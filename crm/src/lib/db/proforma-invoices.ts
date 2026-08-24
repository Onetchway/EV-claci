"use client";

/**
 * Proforma Invoices — a formal pre-sale bill sent before the actual tax
 * Invoice, so a client can arrange payment/import approvals against fixed
 * numbers. Mirrors the Quotation module (same pricing engine, same client
 * snapshot pattern) but with its own numbering series and Firestore
 * collection since it's a distinct document with its own paper trail.
 */

import {
  collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { ProformaInvoiceStatus } from "../constants";
import { getDb } from "../firebase/client";
import { buildQuote, type ConfigItem, type ExtraItem } from "../pricing";
import type { Actor, ClientInfo, ProformaInvoice } from "../types";

export const PROFORMA_INVOICES = "proformaInvoices";

function mapProformaInvoice(id: string, data: Record<string, unknown>): ProformaInvoice {
  return { id, ...(data as Omit<ProformaInvoice, "id">) };
}

async function nextPiNumber(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "proformaInvoices");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return `LG-PI-${String(next).padStart(6, "0")}`;
  });
}

export interface ProformaInvoiceDraft {
  leadId?: string | null;
  leadCode?: string | null;
  quotationId?: string | null;
  quoteNumber?: string | null;
  client: ClientInfo;
  items: ConfigItem[];
  extras: ExtraItem[];
  discount: number;
  validUntil?: Date | null;
  notes?: string;
}

function computeTotals(draft: Pick<ProformaInvoiceDraft, "items" | "extras" | "discount">): ProformaInvoice["totals"] {
  const quote = buildQuote(draft.items, { discount: draft.discount, extras: draft.extras });
  return {
    subtotal: quote.subtotal,
    discount: quote.discount,
    taxableValue: quote.taxableValue,
    gst: quote.gst,
    grandTotal: quote.grandTotal,
    effectiveGstPct: quote.effectiveGstPct,
    totalKw: quote.totalKw,
    unitCount: quote.unitCount,
  };
}

export async function createProformaInvoice(draft: ProformaInvoiceDraft, actor: Actor): Promise<{ id: string; piNumber: string }> {
  const piNumber = await nextPiNumber();
  const ref = doc(collection(getDb(), PROFORMA_INVOICES));
  await runTransaction(getDb(), async (tx) => {
    tx.set(ref, {
      piNumber,
      status: "DRAFT" as ProformaInvoiceStatus,
      leadId: draft.leadId ?? null,
      leadCode: draft.leadCode ?? null,
      quotationId: draft.quotationId ?? null,
      quoteNumber: draft.quoteNumber ?? null,
      client: draft.client,
      items: draft.items,
      extras: draft.extras,
      discount: draft.discount,
      totals: computeTotals(draft),
      validUntil: draft.validUntil ? Timestamp.fromDate(draft.validUntil) : null,
      notes: draft.notes ?? "",
      createdAt: serverTimestamp(),
      createdBy: actor,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    });
  });
  return { id: ref.id, piNumber };
}

/**
 * Only meaningful while status is DRAFT — a sent/accepted PI is a fixed
 * record of what the client saw. Takes the full draft (not a partial
 * patch) because totals are derived from items+extras+discount together —
 * recomputing off a partial would silently corrupt the other two.
 */
export async function updateProformaInvoice(id: string, draft: ProformaInvoiceDraft, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), PROFORMA_INVOICES, id), {
    leadId: draft.leadId ?? null,
    leadCode: draft.leadCode ?? null,
    quotationId: draft.quotationId ?? null,
    quoteNumber: draft.quoteNumber ?? null,
    client: draft.client,
    items: draft.items,
    extras: draft.extras,
    discount: draft.discount,
    totals: computeTotals(draft),
    validUntil: draft.validUntil ? Timestamp.fromDate(draft.validUntil) : null,
    notes: draft.notes ?? "",
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

export async function updateProformaInvoiceStatus(id: string, status: ProformaInvoiceStatus, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), PROFORMA_INVOICES, id), { status, updatedAt: serverTimestamp(), updatedBy: actor });
}

export function subscribeProformaInvoices(
  filters: { leadId?: string; max?: number },
  cb: (rows: ProformaInvoice[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const constraints = filters.leadId ? [where("leadId", "==", filters.leadId)] : [];
  return onSnapshot(
    query(collection(getDb(), PROFORMA_INVOICES), ...constraints, orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapProformaInvoice(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeProformaInvoice(
  id: string,
  cb: (row: ProformaInvoice | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), PROFORMA_INVOICES, id),
    (snap) => cb(snap.exists() ? mapProformaInvoice(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}
