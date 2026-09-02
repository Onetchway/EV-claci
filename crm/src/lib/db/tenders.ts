"use client";

/**
 * Tenders (EPC / Construction) — government/institutional bids, tracked
 * ahead of and independent from a lead's own quotation. Ported from
 * nakjm-crm's single-tenant tenders module; the multi-tenant version here
 * scopes every query by orgId and logs through changeLog (see
 * lib/db/change-log.ts) rather than nakjm's own activity log, and points at
 * an existing Lead (optional) instead of a separate Clients collection.
 */

import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { TenderStatus } from "../constants";
import { getDb } from "../firebase/client";
import { getCurrentTenantId } from "../tenant";
import type { Actor, Tender } from "../types";
import { buildSearchTokens } from "../utils";
import { logChangeSafe } from "./change-log";

export const TENDERS = "tenders";

function mapTender(id: string, data: Record<string, unknown>): Tender {
  return { id, ...(data as Omit<Tender, "id">) };
}

async function nextTenderCode(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "tenders");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return `TND-${String(next).padStart(5, "0")}`;
  });
}

export interface TenderDraft {
  title: string;
  leadId?: string | null;
  clientName: string;
  department?: string;
  authority?: string;
  location?: string;
  tenderNumber?: string;
  tenderValue?: number;
  emdAmount?: number;
  tenderFee?: number;
  submissionDate?: Date | null;
  openingDate?: Date | null;
  notes?: string;
}

function draftFields(draft: TenderDraft) {
  return {
    title: draft.title,
    leadId: draft.leadId ?? null,
    clientName: draft.clientName,
    department: draft.department ?? "",
    authority: draft.authority ?? "",
    location: draft.location ?? "",
    tenderNumber: draft.tenderNumber ?? "",
    tenderValue: draft.tenderValue ?? null,
    emdAmount: draft.emdAmount ?? null,
    tenderFee: draft.tenderFee ?? null,
    submissionDate: draft.submissionDate ? Timestamp.fromDate(draft.submissionDate) : null,
    openingDate: draft.openingDate ? Timestamp.fromDate(draft.openingDate) : null,
    notes: draft.notes ?? "",
  };
}

export async function createTender(draft: TenderDraft, actor: Actor): Promise<{ id: string; tenderCode: string }> {
  const tenderCode = await nextTenderCode();
  const orgId = await getCurrentTenantId();
  const ref = doc(collection(getDb(), TENDERS));
  await runTransaction(getDb(), async (tx) => {
    tx.set(ref, {
      ...draftFields(draft),
      tenderCode,
      orgId,
      status: "DRAFT" as TenderStatus,
      deletedAt: null,
      deletedBy: null,
      search: buildSearchTokens(tenderCode, draft.title, draft.clientName, draft.tenderNumber),
      createdAt: serverTimestamp(),
      createdBy: actor,
      updatedAt: serverTimestamp(),
    });
  });

  logChangeSafe({
    entityType: "TENDER", entityId: ref.id, entityLabel: `${tenderCode} — ${draft.title}`,
    action: "CREATE", actor,
  });

  return { id: ref.id, tenderCode };
}

export type TenderPatch = Partial<TenderDraft>;

export async function updateTender(tender: Tender, patch: TenderPatch, actor: Actor): Promise<void> {
  const merged: TenderDraft = {
    title: patch.title ?? tender.title,
    leadId: patch.leadId !== undefined ? patch.leadId : tender.leadId,
    clientName: patch.clientName ?? tender.clientName,
    department: patch.department ?? tender.department,
    authority: patch.authority ?? tender.authority,
    location: patch.location ?? tender.location,
    tenderNumber: patch.tenderNumber ?? tender.tenderNumber,
    tenderValue: patch.tenderValue ?? tender.tenderValue,
    emdAmount: patch.emdAmount ?? tender.emdAmount,
    tenderFee: patch.tenderFee ?? tender.tenderFee,
    submissionDate: patch.submissionDate !== undefined
      ? patch.submissionDate
      : (tender.submissionDate ? (tender.submissionDate as Timestamp).toDate() : null),
    openingDate: patch.openingDate !== undefined
      ? patch.openingDate
      : (tender.openingDate ? (tender.openingDate as Timestamp).toDate() : null),
    notes: patch.notes ?? tender.notes,
  };

  await updateDoc(doc(getDb(), TENDERS, tender.id), {
    ...draftFields(merged),
    search: buildSearchTokens(tender.tenderCode, merged.title, merged.clientName, merged.tenderNumber),
    updatedAt: serverTimestamp(),
  });

  logChangeSafe({
    entityType: "TENDER", entityId: tender.id, entityLabel: `${tender.tenderCode} — ${merged.title}`,
    action: "UPDATE", actor,
  });
}

export async function updateTenderStatus(tender: Tender, status: TenderStatus, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), TENDERS, tender.id), { status, updatedAt: serverTimestamp() });

  logChangeSafe({
    entityType: "TENDER", entityId: tender.id, entityLabel: tender.tenderCode,
    action: "UPDATE", actor,
    changes: [{ field: "status", from: tender.status, to: status }],
  });
}

export async function trashTender(tender: Tender, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), TENDERS, tender.id), {
    deletedAt: serverTimestamp(), deletedBy: actor, updatedAt: serverTimestamp(),
  });

  logChangeSafe({
    entityType: "TENDER", entityId: tender.id, entityLabel: tender.tenderCode,
    action: "DELETE", actor,
  });
}

export async function restoreTender(tender: Tender, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), TENDERS, tender.id), {
    deletedAt: null, deletedBy: null, updatedAt: serverTimestamp(),
  });

  logChangeSafe({
    entityType: "TENDER", entityId: tender.id, entityLabel: tender.tenderCode,
    action: "ACTIVATE", actor,
  });
}

/** Hard delete — same write bar as create/update (enforced by Firestore rules). */
export async function deleteTender(tender: Tender): Promise<void> {
  await deleteDoc(doc(getDb(), TENDERS, tender.id));
}

export interface TenderFilters {
  status?: TenderStatus;
  includeDeleted?: boolean;
  max?: number;
}

export function subscribeTenders(
  filters: TenderFilters,
  cb: (rows: Tender[]) => void,
  onError?: (e: Error) => void,
): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    const constraints = [
      where("orgId", "==", orgId),
      ...(filters.status ? [where("status", "==", filters.status)] : []),
    ];
    unsubscribe = onSnapshot(
      query(collection(getDb(), TENDERS), ...constraints, orderBy("createdAt", "desc")),
      (snap) => {
        const rows = snap.docs.map((d) => mapTender(d.id, d.data()));
        cb(filters.includeDeleted ? rows : rows.filter((r) => !r.deletedAt));
      },
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}

export function subscribeTender(
  id: string,
  cb: (row: Tender | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), TENDERS, id),
    (snap) => cb(snap.exists() ? mapTender(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}
