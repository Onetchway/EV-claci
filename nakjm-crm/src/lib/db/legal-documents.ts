"use client";

import {
  collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query,
  serverTimestamp, setDoc, updateDoc, where, Timestamp,
} from "firebase/firestore";

import type { LegalDocStatus, LegalDocType } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, LegalDocument } from "../types";
import { logActivitySafe } from "./activity";

export const LEGAL_DOCUMENTS = "legalDocuments";

function mapLegalDocument(id: string, data: Record<string, unknown>): LegalDocument {
  return { id, ...(data as Omit<LegalDocument, "id">) };
}

export function subscribeLegalDocumentsForProject(
  projectId: string, docType: LegalDocType, cb: (rows: LegalDocument[]) => void, onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), LEGAL_DOCUMENTS), where("projectId", "==", projectId), where("docType", "==", docType)),
    (snap) => cb(snap.docs.map((d) => mapLegalDocument(d.id, d.data())).sort((a, b) => b.version - a.version)),
    (err) => onError?.(err as Error),
  );
}

export function subscribeLegalDocumentsForClient(
  clientId: string, docType: LegalDocType, cb: (rows: LegalDocument[]) => void, onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), LEGAL_DOCUMENTS), where("clientId", "==", clientId), where("docType", "==", docType)),
    (snap) => cb(snap.docs.map((d) => mapLegalDocument(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

/** Org-wide — the top-level EOI or Agreements list page, filtered by docType. */
export function subscribeLegalDocuments(docType: LegalDocType, cb: (rows: LegalDocument[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), LEGAL_DOCUMENTS), where("docType", "==", docType)),
    (snap) => cb(snap.docs.map((d) => mapLegalDocument(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export async function getLegalDocument(id: string): Promise<LegalDocument | null> {
  const snap = await getDoc(doc(getDb(), LEGAL_DOCUMENTS, id));
  return snap.exists() ? mapLegalDocument(snap.id, snap.data()) : null;
}

export function subscribeLegalDocument(id: string, cb: (row: LegalDocument | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), LEGAL_DOCUMENTS, id),
    (snap) => cb(snap.exists() ? mapLegalDocument(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export interface LegalDocumentDraft {
  docType: LegalDocType;
  docNo: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  status?: LegalDocStatus;
  docDate?: Date | null;
  validUntil?: Date | null;
  subject: string;
  body: string;
  terms?: string;
  notes?: string;
}

export async function createLegalDocument(draft: LegalDocumentDraft, actor?: Actor): Promise<LegalDocument> {
  const ref = doc(collection(getDb(), LEGAL_DOCUMENTS));
  const payload = {
    docType: draft.docType,
    docNo: draft.docNo,
    projectId: draft.projectId,
    projectName: draft.projectName,
    clientId: draft.clientId,
    clientName: draft.clientName,
    version: 1,
    status: draft.status ?? "DRAFT",
    docDate: draft.docDate ? Timestamp.fromDate(draft.docDate) : Timestamp.now(),
    validUntil: draft.validUntil ? Timestamp.fromDate(draft.validUntil) : null,
    subject: draft.subject,
    body: draft.body,
    terms: draft.terms ?? "",
    notes: draft.notes ?? "",
    rootDocId: null,
    revisedFrom: null,
    approval: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  if (actor) {
    logActivitySafe({
      entityType: draft.docType, entityId: ref.id, entityLabel: draft.docNo, action: "CREATE",
      message: `Created ${draft.docType === "EOI" ? "EOI" : "agreement"} ${draft.docNo}`, actor, projectId: draft.projectId,
    });
  }
  return { id: ref.id, ...(payload as unknown as Omit<LegalDocument, "id">) };
}

/** Every version sharing one lineage, same convention as Quotation/BOQ. */
export function subscribeLegalDocumentLineage(rootDocId: string, cb: (rows: LegalDocument[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), LEGAL_DOCUMENTS), where("rootDocId", "==", rootDocId)),
    (snap) => {
      const revisions = snap.docs.map((d) => mapLegalDocument(d.id, d.data()));
      void getDoc(doc(getDb(), LEGAL_DOCUMENTS, rootDocId)).then((rootSnap) => {
        const root = rootSnap.exists() ? [mapLegalDocument(rootSnap.id, rootSnap.data())] : [];
        cb([...root, ...revisions].sort((a, b) => a.version - b.version));
      });
    },
    (err) => onError?.(err as Error),
  );
}

/** Creates a new DRAFT version carrying the same content forward. */
export async function reviseLegalDocument(document: LegalDocument, actor: Actor): Promise<LegalDocument> {
  const rootId = document.rootDocId ?? document.id;
  const siblingsSnap = await getDocs(query(collection(getDb(), LEGAL_DOCUMENTS), where("rootDocId", "==", rootId)));
  const maxSiblingVersion = siblingsSnap.docs.reduce((max, d) => Math.max(max, (d.data().version as number) || 0), document.version);

  const ref = doc(collection(getDb(), LEGAL_DOCUMENTS));
  const payload = {
    docType: document.docType,
    docNo: document.docNo,
    projectId: document.projectId,
    projectName: document.projectName,
    clientId: document.clientId,
    clientName: document.clientName,
    version: maxSiblingVersion + 1,
    status: "DRAFT" as LegalDocStatus,
    docDate: Timestamp.now(),
    validUntil: document.validUntil ?? null,
    subject: document.subject,
    body: document.body,
    terms: document.terms ?? "",
    notes: document.notes ?? "",
    rootDocId: rootId,
    revisedFrom: document.id,
    approval: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: document.docType, entityId: ref.id, entityLabel: document.docNo, action: "CREATE",
    message: `${actor.name} created v${payload.version} of ${document.docNo}, revised from v${document.version}`, actor, projectId: document.projectId,
  });
  return { id: ref.id, ...(payload as unknown as Omit<LegalDocument, "id">) };
}

export async function updateLegalDocumentStatus(
  id: string, status: LegalDocStatus, actor?: Actor, context?: { docType: LegalDocType; docNo: string; projectId: string },
): Promise<void> {
  await updateDoc(doc(getDb(), LEGAL_DOCUMENTS, id), { status, updatedAt: serverTimestamp() });
  if (actor && context) {
    logActivitySafe({
      entityType: context.docType, entityId: id, entityLabel: context.docNo, action: "STATUS_CHANGE",
      message: `Marked ${context.docNo} ${status}`, actor, projectId: context.projectId,
    });
  }
}

/**
 * Sign-off: requires the approver to type their own name as confirmation
 * (a lightweight internal e-sign, not a cryptographic signature), records
 * who/when/what they typed, and moves status to ACCEPTED in the same write.
 */
export async function approveLegalDocument(document: LegalDocument, signatureName: string, note: string | undefined, actor: Actor): Promise<void> {
  if (signatureName.trim().toLowerCase() !== actor.name.trim().toLowerCase()) {
    throw new Error("Type your name exactly as shown to confirm approval.");
  }
  await updateDoc(doc(getDb(), LEGAL_DOCUMENTS, document.id), {
    status: "ACCEPTED",
    approval: { approvedBy: actor, approvedAt: serverTimestamp(), signatureName: signatureName.trim(), note: note ?? "" },
    updatedAt: serverTimestamp(),
  });
  logActivitySafe({
    entityType: document.docType, entityId: document.id, entityLabel: document.docNo, action: "STATUS_CHANGE",
    message: `${actor.name} accepted ${document.docNo}`, actor, projectId: document.projectId,
  });
}

export type LegalDocumentPatch = Partial<Pick<LegalDocumentDraft, "docNo" | "docDate" | "validUntil" | "subject" | "body" | "terms" | "notes">>;

export async function updateLegalDocument(document: LegalDocument, patch: LegalDocumentPatch, actor: Actor): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.docNo !== undefined) update.docNo = patch.docNo;
  if (patch.docDate !== undefined) update.docDate = patch.docDate ? Timestamp.fromDate(patch.docDate) : null;
  if (patch.validUntil !== undefined) update.validUntil = patch.validUntil ? Timestamp.fromDate(patch.validUntil) : null;
  if (patch.subject !== undefined) update.subject = patch.subject;
  if (patch.body !== undefined) update.body = patch.body;
  if (patch.terms !== undefined) update.terms = patch.terms;
  if (patch.notes !== undefined) update.notes = patch.notes;
  await updateDoc(doc(getDb(), LEGAL_DOCUMENTS, document.id), update);
  logActivitySafe({
    entityType: document.docType, entityId: document.id, entityLabel: document.docNo, action: "UPDATE",
    message: `Edited ${document.docNo}`, actor, projectId: document.projectId,
  });
}

export async function deleteLegalDocument(document: LegalDocument, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), LEGAL_DOCUMENTS, document.id));
  logActivitySafe({
    entityType: document.docType, entityId: document.id, entityLabel: document.docNo, action: "DELETE",
    message: `Deleted ${document.docNo}`, actor, projectId: document.projectId,
  });
}
