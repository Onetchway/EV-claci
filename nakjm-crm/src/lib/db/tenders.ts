"use client";

import {
  collection, deleteDoc, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp,
  setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { TenderStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, Tender } from "../types";
import { buildSearchTokens } from "../utils";
import { logActivitySafe } from "./activity";

export const TENDERS = "tenders";

function mapTender(id: string, data: Record<string, unknown>): Tender {
  return { id, ...(data as Omit<Tender, "id">) };
}

/** NKJM-TND-000142, allocated transactionally so two admins can't collide. */
async function nextTenderCode(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "tenders");
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists() ? (snap.data().seq as number | undefined) : undefined) ?? 0;
    const next = current + 1;
    tx.set(ref, { seq: next }, { merge: true });
    return next;
  });
  return `NKJM-TND-${String(seq).padStart(5, "0")}`;
}

export interface TenderFilters {
  status?: TenderStatus | "ALL";
  clientId?: string;
  search?: string;
  includeTrashed?: boolean;
}

export function applyTenderFilters(rows: Tender[], f: TenderFilters): Tender[] {
  const needle = f.search?.trim().toLowerCase();
  return rows.filter((t) => {
    if (f.includeTrashed) { if (!t.deletedAt) return false; }
    else if (t.deletedAt) return false;
    if (f.status && f.status !== "ALL" && t.status !== f.status) return false;
    if (f.clientId && t.clientId !== f.clientId) return false;
    if (needle) {
      const hay = [t.tenderCode, t.tenderNumber, t.title, t.clientName, t.department, t.authority].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(needle) && !(t.search ?? []).some((tok) => tok.startsWith(needle))) return false;
    }
    return true;
  });
}

export function subscribeTenders(
  filters: TenderFilters,
  cb: (rows: Tender[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), TENDERS)),
    (snap) => cb(applyTenderFilters(
      snap.docs.map((d) => mapTender(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)),
      filters,
    )),
    (err) => onError?.(err as Error),
  );
}

export function subscribeTendersForClient(clientId: string, cb: (rows: Tender[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), TENDERS), where("clientId", "==", clientId)),
    (snap) => cb(
      snap.docs.map((d) => mapTender(d.id, d.data()))
        .filter((t) => !t.deletedAt)
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)),
    ),
    (err) => onError?.(err as Error),
  );
}

export function subscribeTender(id: string, cb: (t: Tender | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), TENDERS, id),
    (snap) => cb(snap.exists() ? mapTender(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export async function getTender(id: string): Promise<Tender | null> {
  const snap = await getDoc(doc(getDb(), TENDERS, id));
  return snap.exists() ? mapTender(snap.id, snap.data()) : null;
}

export interface TenderDraft {
  tenderNumber?: string;
  title: string;
  clientId: string;
  clientName: string;
  department?: string;
  authority?: string;
  location?: string;
  tenderValue?: number;
  emdAmount?: number;
  tenderFee?: number;
  submissionDate?: Date | null;
  openingDate?: Date | null;
  status?: TenderStatus;
  notes?: string;
}

export async function createTender(draft: TenderDraft, actor: Actor): Promise<Tender> {
  const tenderCode = await nextTenderCode();
  const ref = doc(collection(getDb(), TENDERS));
  const payload = {
    tenderCode,
    tenderNumber: draft.tenderNumber ?? "",
    title: draft.title,
    clientId: draft.clientId,
    clientName: draft.clientName,
    department: draft.department ?? "",
    authority: draft.authority ?? "",
    location: draft.location ?? "",
    tenderValue: draft.tenderValue ?? 0,
    emdAmount: draft.emdAmount ?? 0,
    tenderFee: draft.tenderFee ?? 0,
    submissionDate: draft.submissionDate ? Timestamp.fromDate(draft.submissionDate) : null,
    openingDate: draft.openingDate ? Timestamp.fromDate(draft.openingDate) : null,
    status: draft.status ?? "DRAFT",
    notes: draft.notes ?? "",
    linkedProjectId: null,
    deletedAt: null,
    search: buildSearchTokens(tenderCode, draft.tenderNumber, draft.title, draft.clientName, draft.department, draft.authority),
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: "TENDER", entityId: ref.id, entityLabel: `${tenderCode} — ${draft.title}`, action: "CREATE",
    message: `Created tender ${tenderCode} — ${draft.title}`, actor,
  });
  return { id: ref.id, ...(payload as unknown as Omit<Tender, "id">) };
}

export type TenderPatch = Partial<Omit<TenderDraft, "clientId" | "clientName">>;

export async function updateTender(tender: Tender, patch: TenderPatch, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const key of ["tenderNumber", "title", "department", "authority", "location", "tenderValue", "emdAmount", "tenderFee", "status", "notes"] as const) {
    if (patch[key] !== undefined) update[key] = patch[key];
  }
  if (patch.submissionDate !== undefined) update.submissionDate = patch.submissionDate ? Timestamp.fromDate(patch.submissionDate) : null;
  if (patch.openingDate !== undefined) update.openingDate = patch.openingDate ? Timestamp.fromDate(patch.openingDate) : null;
  if (patch.title) {
    update.search = buildSearchTokens(tender.tenderCode, patch.tenderNumber ?? tender.tenderNumber, patch.title, tender.clientName, patch.department ?? tender.department, patch.authority ?? tender.authority);
  }
  await updateDoc(doc(getDb(), TENDERS, tender.id), update);
  logActivitySafe({
    entityType: "TENDER", entityId: tender.id, entityLabel: tender.tenderCode,
    action: patch.status && patch.status !== tender.status ? "STATUS_CHANGE" : "UPDATE",
    message: patch.status && patch.status !== tender.status
      ? `Marked tender ${tender.tenderCode} ${patch.status}`
      : `Edited tender ${tender.tenderCode}`,
    actor,
  });
}

export async function linkTenderToProject(tenderId: string, projectId: string): Promise<void> {
  await updateDoc(doc(getDb(), TENDERS, tenderId), { linkedProjectId: projectId, updatedAt: serverTimestamp() });
}

export async function trashTender(tender: Tender, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), TENDERS, tender.id), {
    deletedAt: serverTimestamp(), deletedBy: actor, updatedAt: serverTimestamp(),
  });
  logActivitySafe({
    entityType: "TENDER", entityId: tender.id, entityLabel: tender.tenderCode, action: "DELETE",
    message: `Deleted tender ${tender.tenderCode}`, actor,
  });
}

export async function restoreTender(tender: Tender, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), TENDERS, tender.id), { deletedAt: null, deletedBy: null, updatedAt: serverTimestamp() });
  logActivitySafe({
    entityType: "TENDER", entityId: tender.id, entityLabel: tender.tenderCode, action: "UPDATE",
    message: `Restored tender ${tender.tenderCode} from Trash`, actor,
  });
}

/** Super admin only, from the Trash page. */
export async function deleteTender(tender: Tender): Promise<void> {
  await deleteDoc(doc(getDb(), TENDERS, tender.id));
}
