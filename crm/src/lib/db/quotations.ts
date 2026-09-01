"use client";

/**
 * Client-facing quotations — what Livanto is offering to sell (chargers
 * and/or EPC services) to a client, as opposed to a Purchase Order (money
 * going OUT to a vendor). Reuses the same pricing engine as a lead's own
 * quote (buildQuote/ConfigItem/ExtraItem) so charger-line GST, discount
 * distribution and totals behave identically everywhere in the app —
 * this isn't a parallel pricing model, just a standalone document around it.
 */

import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { GstType, QuotationStatus } from "../constants";
import { getDb } from "../firebase/client";
import { buildQuote, type ConfigItem, type ExtraItem } from "../pricing";
import { getCurrentTenantId } from "../tenant";
import type { Actor, ClientInfo, Quotation, ShipToInfo } from "../types";
import { logChangeSafe } from "./change-log";

export const QUOTATIONS = "quotations";

function mapQuotation(id: string, data: Record<string, unknown>): Quotation {
  return { id, ...(data as Omit<Quotation, "id">) };
}

async function nextQuoteNumber(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "quotations");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return `LG-QT-${String(next).padStart(6, "0")}`;
  });
}

export interface QuotationDraft {
  leadId?: string | null;
  leadCode?: string | null;
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

function computeTotals(draft: Pick<QuotationDraft, "items" | "extras" | "discount">): Quotation["totals"] {
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

export async function createQuotation(draft: QuotationDraft, actor: Actor): Promise<{ id: string; quoteNumber: string }> {
  const quoteNumber = await nextQuoteNumber();
  const orgId = await getCurrentTenantId();
  const ref = doc(collection(getDb(), QUOTATIONS));
  await runTransaction(getDb(), async (tx) => {
    tx.set(ref, {
      quoteNumber,
      orgId,
      status: "DRAFT" as QuotationStatus,
      leadId: draft.leadId ?? null,
      leadCode: draft.leadCode ?? null,
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
    entityType: "QUOTATION", entityId: ref.id, entityLabel: `${quoteNumber} — ${draft.client.name}`,
    action: "CREATE", actor,
  });

  return { id: ref.id, quoteNumber };
}

/**
 * Only meaningful while status is DRAFT — a sent/accepted quotation is a
 * fixed record of what the client saw. Takes the full draft (not a partial
 * patch) because totals are derived from items+extras+discount together —
 * recomputing off a partial would silently corrupt the other two.
 */
export async function updateQuotation(id: string, draft: QuotationDraft, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), QUOTATIONS, id), {
    leadId: draft.leadId ?? null,
    leadCode: draft.leadCode ?? null,
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
    entityType: "QUOTATION", entityId: id, entityLabel: `${draft.client.name}`,
    action: "UPDATE", actor,
  });
}

export async function updateQuotationStatus(quotation: Quotation, status: QuotationStatus, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), QUOTATIONS, quotation.id), { status, updatedAt: serverTimestamp(), updatedBy: actor });

  logChangeSafe({
    entityType: "QUOTATION", entityId: quotation.id, entityLabel: quotation.quoteNumber,
    action: "UPDATE", actor,
    changes: [{ field: "status", from: quotation.status, to: status }],
  });
}

export async function deleteQuotation(quotation: Quotation, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), QUOTATIONS, quotation.id));

  logChangeSafe({
    entityType: "QUOTATION", entityId: quotation.id, entityLabel: `${quotation.quoteNumber} — ${quotation.client.name}`,
    action: "DELETE", actor,
  });
}

export function subscribeQuotations(
  filters: { leadId?: string; max?: number },
  cb: (rows: Quotation[]) => void,
  onError?: (e: Error) => void,
): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    const constraints = [where("orgId", "==", orgId), ...(filters.leadId ? [where("leadId", "==", filters.leadId)] : [])];
    unsubscribe = onSnapshot(
      query(collection(getDb(), QUOTATIONS), ...constraints, orderBy("createdAt", "desc")),
      (snap) => cb(snap.docs.map((d) => mapQuotation(d.id, d.data()))),
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}

export function subscribeQuotation(
  id: string,
  cb: (row: Quotation | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), QUOTATIONS, id),
    (snap) => cb(snap.exists() ? mapQuotation(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}
