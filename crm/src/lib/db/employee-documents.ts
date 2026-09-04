"use client";

/**
 * An employee's own KYC/on-file documents (Aadhaar, PAN, address proof,
 * educational certificate, offer letter, bank proof, photo) — shown on their
 * Employee Detail page (src/app/(app)/employees/[uid]/page.tsx). Mirrors
 * db/documents.ts's upload/delete/subscribe/validateFile shape (same
 * MAX_UPLOAD_BYTES/ACCEPTED_TYPES constants, reused rather than duplicated —
 * they're generic file-upload limits, not lead-specific) but is a distinct,
 * simpler concept: stored under users/{uid}/documents (a subcollection on
 * the employee's own user doc, not a lead), with no PENDING/VERIFIED/
 * REJECTED review workflow — that's for external investor KYC compliance,
 * not an internal HR file. List + delete only.
 */

import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import type { EmployeeDocKind } from "../constants";
import { EMPLOYEE_DOC_KIND_LABEL } from "../constants";
import { getBucket, getDb } from "../firebase/client";
import type { Actor, EmployeeDocument } from "../types";
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, validateFile } from "./documents";
import { logChangeSafe } from "./change-log";

export { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, validateFile };

const sub = (uid: string) => collection(getDb(), "users", uid, "documents");

export function subscribeEmployeeDocuments(
  uid: string,
  cb: (rows: EmployeeDocument[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(sub(uid), orderBy("uploadedAt", "desc")),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, uid, ...(d.data() as Omit<EmployeeDocument, "id" | "uid">) }))),
    (err) => onError?.(err as Error),
  );
}

export interface UploadEmployeeDocOptions {
  kind: EmployeeDocKind;
  note?: string;
  onProgress?: (pct: number) => void;
}

export async function uploadEmployeeDocument(
  uid: string,
  file: File,
  opts: UploadEmployeeDocOptions,
  actor: Actor,
): Promise<EmployeeDocument> {
  const problem = validateFile(file);
  if (problem) throw new Error(problem);

  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
  const storagePath = `employees/${uid}/${opts.kind}/${Date.now()}_${safeName}`;
  const storageRef = ref(getBucket(), storagePath);

  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: { uid, kind: opts.kind, uploadedBy: actor.uid },
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
    note: opts.note ?? "",
    uploadedAt: serverTimestamp(),
    uploadedBy: actor,
  };

  const ref_ = doc(sub(uid));
  await setDoc(ref_, payload);

  logChangeSafe({
    entityType: "EMPLOYEE_DOCUMENT", entityId: ref_.id, entityLabel: `${EMPLOYEE_DOC_KIND_LABEL[opts.kind]} — ${actor.name}`,
    action: "CREATE", actor,
  });

  return { id: ref_.id, uid, ...(payload as unknown as Omit<EmployeeDocument, "id" | "uid">) };
}

export async function deleteEmployeeDocument(document: EmployeeDocument, actor: Actor): Promise<void> {
  // Remove the Firestore row first: an orphaned storage object is
  // recoverable, a row pointing at a deleted file is a broken link in the UI.
  await deleteDoc(doc(getDb(), "users", document.uid, "documents", document.id));

  try {
    await deleteObject(ref(getBucket(), document.storagePath));
  } catch (err) {
    console.error("[employee-documents] storage object could not be removed", err);
  }

  logChangeSafe({
    entityType: "EMPLOYEE_DOCUMENT", entityId: document.id, entityLabel: `${EMPLOYEE_DOC_KIND_LABEL[document.kind]} (${document.fileName})`,
    action: "DELETE", actor,
  });
}
