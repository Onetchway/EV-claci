"use client";

import {
  addDoc, collection, deleteDoc, doc, increment, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import {
  DOC_KIND_LABEL, REQUIRED_DOCS_FRANCHISE, REQUIRED_DOCS_SITE,
  type DocKind, type DocStatus,
} from "../constants";
import { getBucket, getDb } from "../firebase/client";
import type { Actor, Lead, LeadDocument } from "../types";
import { logActivitySafe } from "./activity";
import { LEADS } from "./leads";

const sub = (leadId: string) => collection(getDb(), LEADS, leadId, "documents");

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
];

export function subscribeDocuments(
  leadId: string,
  cb: (rows: LeadDocument[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(sub(leadId), orderBy("uploadedAt", "desc")),
    (snap) =>
      cb(snap.docs.map((d) => ({ id: d.id, leadId, ...(d.data() as Omit<LeadDocument, "id" | "leadId">) }))),
    (err) => onError?.(err as Error),
  );
}

export interface UploadOptions {
  kind: DocKind;
  refNumber?: string;
  note?: string;
  onProgress?: (pct: number) => void;
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return "File is larger than 15 MB.";
  if (file.size === 0) return "File is empty.";
  if (!ACCEPTED_TYPES.includes(file.type)) return "Only PDF, JPG, PNG, WEBP or HEIC files are accepted.";
  return null;
}

export async function uploadDocument(
  lead: Lead,
  file: File,
  opts: UploadOptions,
  actor: Actor,
): Promise<LeadDocument> {
  const problem = validateFile(file);
  if (problem) throw new Error(problem);

  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
  const storagePath = `leads/${lead.id}/${opts.kind}/${Date.now()}_${safeName}`;
  const storageRef = ref(getBucket(), storagePath);

  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: { leadId: lead.id, kind: opts.kind, uploadedBy: actor.uid },
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => opts.onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      () => resolve(),
    );
  });

  const url = await getDownloadURL(storageRef);

  const payload = {
    kind: opts.kind,
    fileName: file.name,
    storagePath,
    url,
    contentType: file.type,
    size: file.size,
    status: "PENDING" as DocStatus,
    note: opts.note ?? "",
    refNumber: opts.refNumber ?? "",
    uploadedAt: serverTimestamp(),
    uploadedBy: actor,
    reviewedAt: null,
    reviewedBy: null,
  };

  const created = await addDoc(sub(lead.id), payload);
  await updateDoc(doc(getDb(), LEADS, lead.id), {
    docCount: increment(1),
    lastActivityAt: serverTimestamp(),
    lastActivityBy: actor.name,
  });

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "DOCUMENT_UPLOADED",
    message: `Uploaded ${DOC_KIND_LABEL[opts.kind]} (${file.name})`,
    actor,
  });

  return { id: created.id, leadId: lead.id, ...(payload as unknown as Omit<LeadDocument, "id" | "leadId">) };
}

export async function reviewDocument(
  lead: Lead,
  document: LeadDocument,
  status: Exclude<DocStatus, "PENDING">,
  actor: Actor,
  note?: string,
): Promise<void> {
  await updateDoc(doc(getDb(), LEADS, lead.id, "documents", document.id), {
    status,
    note: note ?? document.note ?? "",
    reviewedAt: serverTimestamp(),
    reviewedBy: actor,
  });

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "DOCUMENT_VERIFIED",
    message: `${DOC_KIND_LABEL[document.kind]} marked ${status.toLowerCase()}${note ? ` — ${note}` : ""}`,
    actor,
  });
}

export async function deleteDocument(lead: Lead, document: LeadDocument, actor: Actor): Promise<void> {
  // Remove the Firestore row first: an orphaned storage object is recoverable,
  // a row pointing at a deleted file is a broken link in the UI.
  await deleteDoc(doc(getDb(), LEADS, lead.id, "documents", document.id));
  await updateDoc(doc(getDb(), LEADS, lead.id), { docCount: increment(-1) });

  try {
    await deleteObject(ref(getBucket(), document.storagePath));
  } catch (err) {
    console.error("[documents] storage object could not be removed", err);
  }

  logActivitySafe({
    leadId: lead.id,
    ownerId: lead.ownerId,
    leadCode: lead.code,
    leadName: lead.client?.name,
    type: "DOCUMENT_DELETED",
    message: `Deleted ${DOC_KIND_LABEL[document.kind]} (${document.fileName})`,
    actor,
  });
}

export interface KycStatus {
  required: DocKind[];
  present: DocKind[];
  verified: DocKind[];
  missing: DocKind[];
  complete: boolean;
  pct: number;
}

/** Drives the "KYC complete" gate before a lead can reach Agreement. */
export function kycStatus(lead: Lead, docs: LeadDocument[]): KycStatus {
  const required = lead.type === "SITE" ? REQUIRED_DOCS_SITE : REQUIRED_DOCS_FRANCHISE;
  const present = required.filter((k) => docs.some((d) => d.kind === k && d.status !== "REJECTED"));
  const verified = required.filter((k) => docs.some((d) => d.kind === k && d.status === "VERIFIED"));
  const missing = required.filter((k) => !present.includes(k));
  return {
    required,
    present,
    verified,
    missing,
    complete: missing.length === 0,
    pct: required.length ? Math.round((verified.length / required.length) * 100) : 100,
  };
}
