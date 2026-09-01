"use client";

/**
 * Proforma Invoices — a formal pre-sale bill sent before the actual tax
 * Invoice, so a client can arrange payment/import approvals against fixed
 * numbers. Mirrors the Quotation module (same pricing engine, same client
 * snapshot pattern) but with its own numbering series and Firestore
 * collection since it's a distinct document with its own paper trail.
 */

import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { GstType, ProformaInvoiceStatus } from "../constants";
import { getDb } from "../firebase/client";
import { getCurrentTenantId } from "../tenant";
import { buildQuote, type ConfigItem, type ExtraItem } from "../pricing";
import type { Actor, ClientInfo, ProformaInvoice, ShipToInfo } from "../types";
import { logChangeSafe } from "./change-log";

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
  gstType?: GstType;
  shipToEnabled?: boolean;
  shipTo?: ShipToInfo | null;
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
  const orgId = await getCurrentTenantId();
  const ref = doc(collection(getDb(), PROFORMA_INVOICES));
  await runTransaction(getDb(), async (tx) => {
    tx.set(ref, {
      piNumber,
      orgId,
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
      gstType: draft.gstType ?? "IGST",
      shipToEnabled: draft.shipToEnabled ?? false,
      shipTo: draft.shipToEnabled ? (draft.shipTo ?? null) : null,
      createdAt: serverTimestamp(),
      createdBy: actor,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    });
  });

  logChangeSafe({
    entityType: "PROFORMA_INVOICE", entityId: ref.id, entityLabel: `${piNumber} — ${draft.client.name}`,
    action: "CREATE", actor,
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
    gstType: draft.gstType ?? "IGST",
    shipToEnabled: draft.shipToEnabled ?? false,
    shipTo: draft.shipToEnabled ? (draft.shipTo ?? null) : null,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  logChangeSafe({
    entityType: "PROFORMA_INVOICE", entityId: id, entityLabel: draft.client.name,
    action: "UPDATE", actor,
  });
}

export async function updateProformaInvoiceStatus(pi: ProformaInvoice, status: ProformaInvoiceStatus, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), PROFORMA_INVOICES, pi.id), { status, updatedAt: serverTimestamp(), updatedBy: actor });

  logChangeSafe({
    entityType: "PROFORMA_INVOICE", entityId: pi.id, entityLabel: pi.piNumber,
    action: "UPDATE", actor,
    changes: [{ field: "status", from: pi.status, to: status }],
  });
}

export async function deleteProformaInvoice(pi: ProformaInvoice, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), PROFORMA_INVOICES, pi.id));

  logChangeSafe({
    entityType: "PROFORMA_INVOICE", entityId: pi.id, entityLabel: `${pi.piNumber} — ${pi.client.name}`,
    action: "DELETE", actor,
  });
}

export function subscribeProformaInvoices(
  filters: { leadId?: string; max?: number },
  cb: (rows: ProformaInvoice[]) => void,
  onError?: (e: Error) => void,
): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    const constraints = [where("orgId", "==", orgId), ...(filters.leadId ? [where("leadId", "==", filters.leadId)] : [])];
    unsubscribe = onSnapshot(
      query(collection(getDb(), PROFORMA_INVOICES), ...constraints, orderBy("createdAt", "desc")),
      (snap) => cb(snap.docs.map((d) => mapProformaInvoice(d.id, d.data()))),
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
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
