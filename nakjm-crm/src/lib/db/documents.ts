"use client";

import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";

import { getDb, getBucket } from "../firebase/client";
import type { Actor, NakjmDocument } from "../types";
import { logActivitySafe } from "./activity";

export const DOCUMENTS = "documents";

function mapDoc(id: string, data: Record<string, unknown>): NakjmDocument {
  return { id, ...(data as Omit<NakjmDocument, "id">) };
}

export function subscribeDocumentsForProject(projectId: string, cb: (rows: NakjmDocument[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), DOCUMENTS), where("projectId", "==", projectId)),
    (snap) => cb(snap.docs.map((d) => mapDoc(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

/** Org-wide — the top-level Documents page across every project. */
export function subscribeDocuments(cb: (rows: NakjmDocument[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), DOCUMENTS)),
    (snap) => cb(snap.docs.map((d) => mapDoc(d.id, d.data())).sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))),
    (err) => onError?.(err as Error),
  );
}

export async function deleteDocument(document: NakjmDocument, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), DOCUMENTS, document.id));
  logActivitySafe({
    entityType: "DOCUMENT", entityId: document.id, entityLabel: document.fileName, action: "DELETE",
    message: `Deleted document ${document.fileName}`, actor, projectId: document.projectId,
  });
}

/** Uploads a file (client PO, work order, BOQ source) to Storage and records it in Firestore. */
export async function uploadDocument(params: {
  file: File;
  projectId?: string | null;
  linkedEntityType?: NakjmDocument["linkedEntityType"];
  linkedEntityId?: string | null;
  docType: NakjmDocument["docType"];
  notes?: string;
  actor: Actor;
}): Promise<NakjmDocument> {
  const path = `nakjm/${params.projectId ?? "unfiled"}/${Date.now()}-${params.file.name}`;
  const sRef = storageRef(getBucket(), path);
  await uploadBytes(sRef, params.file, { contentType: params.file.type });
  const downloadUrl = await getDownloadURL(sRef);

  const ref = doc(collection(getDb(), DOCUMENTS));
  const payload = {
    projectId: params.projectId ?? null,
    linkedEntityType: params.linkedEntityType ?? null,
    linkedEntityId: params.linkedEntityId ?? null,
    docType: params.docType,
    fileName: params.file.name,
    storagePath: path,
    downloadUrl,
    mimeType: params.file.type,
    sizeBytes: params.file.size,
    notes: params.notes ?? "",
    uploadedBy: params.actor,
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  logActivitySafe({
    entityType: "DOCUMENT", entityId: ref.id, entityLabel: params.file.name, action: "CREATE",
    message: `Uploaded ${params.file.name}`, actor: params.actor, projectId: params.projectId,
  });
  return { id: ref.id, ...(payload as unknown as Omit<NakjmDocument, "id">) };
}
