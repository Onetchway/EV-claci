"use client";

/**
 * Receipt uploads attached to an expense claim's line items. Mirrors
 * employee-documents.ts's upload shape (same MAX_UPLOAD_BYTES/ACCEPTED_TYPES,
 * reused rather than duplicated — they're generic file-upload limits, not
 * specific to any one module) but the file isn't tracked in its own
 * Firestore collection: it's just a URL/path/name stored inline on the
 * ExpenseLineItem it belongs to (see db/expense-claims.ts), since a receipt
 * has no independent lifecycle of its own — it lives and dies with the
 * claim's DRAFT editing.
 */

import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import { getBucket } from "../firebase/client";
import type { Actor } from "../types";
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, validateFile } from "./documents";

export { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, validateFile };

export interface UploadedReceipt {
  url: string;
  fileName: string;
  storagePath: string;
}

/** Storage path: expenses/{uid}/{claimId}/{Date.now()}_{safeName} — see firebase/storage.rules for the matching authorization. */
export async function uploadExpenseReceipt(
  uid: string,
  claimId: string,
  file: File,
  actor: Actor,
  onProgress?: (pct: number) => void,
): Promise<UploadedReceipt> {
  const problem = validateFile(file);
  if (problem) throw new Error(problem);

  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
  const storagePath = `expenses/${uid}/${claimId}/${Date.now()}_${safeName}`;
  const storageRef = ref(getBucket(), storagePath);

  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: { uid, claimId, uploadedBy: actor.uid },
  });

  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      () => resolve(),
    );
  });

  const url = await getDownloadURL(storageRef);
  return { url, fileName: file.name, storagePath };
}

export async function deleteExpenseReceipt(storagePath: string): Promise<void> {
  try {
    await deleteObject(ref(getBucket(), storagePath));
  } catch (err) {
    console.error("[expense-receipts] storage object could not be removed", err);
  }
}
