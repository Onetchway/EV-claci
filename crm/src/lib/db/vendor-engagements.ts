"use client";

/**
 * Sub-vendor work engagements — a specific job Livanto has assigned to a
 * vendor (milestones/stages, payment terms, PO/PI/Quotation/BOQ references,
 * a penalty clause, an overall timeline), distinct from the Vendor directory
 * record itself. One vendor can carry several engagements over time, so this
 * is its own top-level collection keyed by vendorId — the same structural
 * shape as purchaseOrders — surfaced as a "Work Engagements" tab on the
 * vendor detail page rather than new top-level nav (see the doc comment on
 * VendorEngagement in lib/types.ts for the full reasoning).
 *
 * Milestones are edited as a whole-array replace on save (saveEngagementMilestones),
 * the same idiom as ExpenseClaim.items (saveExpenseClaimItems) — no per-item
 * writes, since this is a small embedded list, not a subcollection.
 */

import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  setDoc, updateDoc, where,
} from "firebase/firestore";

import type { VendorEngagementStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, VendorEngagement, VendorEngagementMilestone } from "../types";
import { logChangeSafe } from "./change-log";

export const VENDOR_ENGAGEMENTS = "vendorEngagements";

function mapEngagement(id: string, data: Record<string, unknown>): VendorEngagement {
  return { id, ...(data as Omit<VendorEngagement, "id">) };
}

/** Copies nextExpenseClaimNumber()/nextPayslipNumber() verbatim — Firestore-transaction counter, zero-padded, LG-VE-000001 format. */
async function nextVendorEngagementNumber(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "vendorEngagements");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return `LG-VE-${String(next).padStart(6, "0")}`;
  });
}

export interface VendorEngagementDraft {
  vendorId: string;
  vendorName: string;
  title: string;
  description?: string;
  status: VendorEngagementStatus;
  linkedProjectId?: string | null;
  linkedProjectCode?: string | null;
  linkedPoId?: string | null;
  linkedPoNumber?: string | null;
  linkedPiId?: string | null;
  linkedPiNumber?: string | null;
  linkedQuotationId?: string | null;
  linkedQuotationNumber?: string | null;
  boqReference?: string;
  paymentTerms?: string;
  totalAmount?: number;
  penaltyClause?: string;
  penaltyAppliedAmount?: number;
  targetCompletionAt?: Date | null;
  actualCompletionAt?: Date | null;
}

export async function createVendorEngagement(draft: VendorEngagementDraft, actor: Actor): Promise<{ id: string; number: string }> {
  const number = await nextVendorEngagementNumber();
  const ref = doc(collection(getDb(), VENDOR_ENGAGEMENTS));
  await setDoc(ref, {
    number,
    vendorId: draft.vendorId,
    vendorName: draft.vendorName,
    title: draft.title,
    description: draft.description ?? "",
    status: draft.status,
    linkedProjectId: draft.linkedProjectId ?? null,
    linkedProjectCode: draft.linkedProjectCode ?? null,
    linkedPoId: draft.linkedPoId ?? null,
    linkedPoNumber: draft.linkedPoNumber ?? null,
    linkedPiId: draft.linkedPiId ?? null,
    linkedPiNumber: draft.linkedPiNumber ?? null,
    linkedQuotationId: draft.linkedQuotationId ?? null,
    linkedQuotationNumber: draft.linkedQuotationNumber ?? null,
    boqReference: draft.boqReference ?? "",
    paymentTerms: draft.paymentTerms ?? "",
    totalAmount: draft.totalAmount ?? 0,
    penaltyClause: draft.penaltyClause ?? "",
    penaltyAppliedAmount: draft.penaltyAppliedAmount ?? 0,
    targetCompletionAt: draft.targetCompletionAt ?? null,
    actualCompletionAt: draft.actualCompletionAt ?? null,
    milestones: [],
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  logChangeSafe({
    entityType: "VENDOR_ENGAGEMENT", entityId: ref.id, entityLabel: `${number} — ${draft.vendorName}`,
    action: "CREATE", actor,
  });

  return { id: ref.id, number };
}

export async function updateVendorEngagement(engagement: VendorEngagement, draft: VendorEngagementDraft, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), VENDOR_ENGAGEMENTS, engagement.id), {
    vendorId: draft.vendorId,
    vendorName: draft.vendorName,
    title: draft.title,
    description: draft.description ?? "",
    status: draft.status,
    linkedProjectId: draft.linkedProjectId ?? null,
    linkedProjectCode: draft.linkedProjectCode ?? null,
    linkedPoId: draft.linkedPoId ?? null,
    linkedPoNumber: draft.linkedPoNumber ?? null,
    linkedPiId: draft.linkedPiId ?? null,
    linkedPiNumber: draft.linkedPiNumber ?? null,
    linkedQuotationId: draft.linkedQuotationId ?? null,
    linkedQuotationNumber: draft.linkedQuotationNumber ?? null,
    boqReference: draft.boqReference ?? "",
    paymentTerms: draft.paymentTerms ?? "",
    totalAmount: draft.totalAmount ?? 0,
    penaltyClause: draft.penaltyClause ?? "",
    penaltyAppliedAmount: draft.penaltyAppliedAmount ?? 0,
    targetCompletionAt: draft.targetCompletionAt ?? null,
    actualCompletionAt: draft.actualCompletionAt ?? null,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  logChangeSafe({
    entityType: "VENDOR_ENGAGEMENT", entityId: engagement.id, entityLabel: `${engagement.number} — ${draft.vendorName}`,
    action: "UPDATE", actor,
    changes: [{ field: "status", from: engagement.status, to: draft.status }],
  });
}

/** Replaces the engagement's milestone list wholesale — same "full-array-replace on save" idiom as saveExpenseClaimItems. */
export async function saveEngagementMilestones(engagement: Pick<VendorEngagement, "id" | "number">, milestones: VendorEngagementMilestone[], actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), VENDOR_ENGAGEMENTS, engagement.id), {
    milestones,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });

  logChangeSafe({
    entityType: "VENDOR_ENGAGEMENT", entityId: engagement.id, entityLabel: engagement.number,
    action: "UPDATE", actor,
  });
}

export async function deleteVendorEngagement(engagement: VendorEngagement, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), VENDOR_ENGAGEMENTS, engagement.id));

  logChangeSafe({
    entityType: "VENDOR_ENGAGEMENT", entityId: engagement.id, entityLabel: `${engagement.number} — ${engagement.vendorName}`,
    action: "DELETE", actor,
  });
}

export function subscribeVendorEngagements(
  vendorId: string,
  cb: (rows: VendorEngagement[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), VENDOR_ENGAGEMENTS), where("vendorId", "==", vendorId), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapEngagement(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export function subscribeVendorEngagement(
  id: string,
  cb: (row: VendorEngagement | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), VENDOR_ENGAGEMENTS, id),
    (snap) => cb(snap.exists() ? mapEngagement(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}
