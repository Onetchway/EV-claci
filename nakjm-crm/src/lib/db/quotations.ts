"use client";

import {
  collection, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, Timestamp,
} from "firebase/firestore";

import type { QuotationStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { LineItem, Quotation } from "../types";

export const QUOTATIONS = "quotations";

function mapQuotation(id: string, data: Record<string, unknown>): Quotation {
  return { id, ...(data as Omit<Quotation, "id">) };
}

export function computeLineTotals(items: Omit<LineItem, "amount" | "srNo">[], taxPercent = 0) {
  const withAmounts: LineItem[] = items.map((it, i) => ({
    srNo: i + 1,
    description: it.description,
    unit: it.unit,
    qty: Number(it.qty) || 0,
    rate: Number(it.rate) || 0,
    amount: (Number(it.qty) || 0) * (Number(it.rate) || 0),
  }));
  const subtotal = withAmounts.reduce((s, it) => s + it.amount, 0);
  const taxAmount = Math.round(subtotal * (taxPercent / 100) * 100) / 100;
  return { items: withAmounts, subtotal, taxAmount, total: subtotal + taxAmount };
}

export function subscribeQuotationsForProject(projectId: string, cb: (rows: Quotation[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), QUOTATIONS), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapQuotation(d.id, d.data())).sort((a, b) => b.version - a.version)),
    (err) => onError?.(err as Error),
  );
}

export async function getQuotation(id: string): Promise<Quotation | null> {
  const snap = await getDoc(doc(getDb(), QUOTATIONS, id));
  return snap.exists() ? mapQuotation(snap.id, snap.data()) : null;
}

export async function nextQuotationVersion(projectId: string): Promise<number> {
  const snap = await getDocs(query(collection(getDb(), QUOTATIONS), where("projectId", "==", projectId)));
  return snap.docs.reduce((max, d) => Math.max(max, (d.data().version as number) || 0), 0) + 1;
}

export interface QuotationDraft {
  quotationNo: string;
  projectId: string;
  projectName: string;
  clientId: string;
  version: number;
  status?: QuotationStatus;
  quotationDate?: Date | null;
  validUntil?: Date | null;
  items: Omit<LineItem, "amount" | "srNo">[];
  taxPercent: number;
  terms?: string;
  notes?: string;
  sourceBoqId?: string | null;
}

export async function createQuotation(draft: QuotationDraft): Promise<Quotation> {
  const { items, subtotal, taxAmount, total } = computeLineTotals(draft.items, draft.taxPercent);
  const ref = doc(collection(getDb(), QUOTATIONS));
  const payload = {
    quotationNo: draft.quotationNo,
    projectId: draft.projectId,
    projectName: draft.projectName,
    clientId: draft.clientId,
    version: draft.version,
    status: draft.status ?? "DRAFT",
    quotationDate: draft.quotationDate ? Timestamp.fromDate(draft.quotationDate) : Timestamp.now(),
    validUntil: draft.validUntil ? Timestamp.fromDate(draft.validUntil) : null,
    items,
    subtotal,
    taxPercent: draft.taxPercent,
    taxAmount,
    totalAmount: total,
    terms: draft.terms ?? "",
    notes: draft.notes ?? "",
    sourceBoqId: draft.sourceBoqId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  return { id: ref.id, ...(payload as unknown as Omit<Quotation, "id">) };
}

export async function updateQuotationStatus(id: string, status: QuotationStatus): Promise<void> {
  await updateDoc(doc(getDb(), QUOTATIONS, id), { status, updatedAt: serverTimestamp() });
}
