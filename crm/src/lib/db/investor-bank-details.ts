"use client";

import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import { getBucket, getDb } from "../firebase/client";
import type { InvestorBankDetails } from "../types";
import { LEADS } from "./leads";

/** Single doc per lead, id "current" — see InvestorBankDetails's doc comment in types.ts for why this lives in its own subcollection. */
const ENTRY_ID = "current";
const sub = (leadId: string) => doc(getDb(), LEADS, leadId, "investorBankDetails", ENTRY_ID);

export function subscribeInvestorBankDetails(
  leadId: string,
  cb: (details: InvestorBankDetails | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    sub(leadId),
    (snap) => cb(snap.exists() ? { id: snap.id, ...(snap.data() as Omit<InvestorBankDetails, "id">) } : null),
    (err) => onError?.(err as Error),
  );
}

export interface InvestorBankDetailsDraft {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch?: string;
}

const CHEQUE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic"];

export function validateChequeFile(file: File): string | null {
  if (file.size > 15 * 1024 * 1024) return "File is larger than 15 MB.";
  if (!CHEQUE_TYPES.includes(file.type)) return "Only PDF, JPG, PNG, WEBP or HEIC files are accepted.";
  return null;
}

/**
 * Investor-submitted only — the Firestore rule for this doc validates the
 * exact field set and types, so this always does a full overwrite (never a
 * partial merge) to keep what's sent matching what the rule expects.
 */
export async function submitInvestorBankDetails(
  leadId: string,
  draft: InvestorBankDetailsDraft,
  chequeFile: File | null,
  onProgress?: (pct: number) => void,
): Promise<void> {
  let chequeUrl: string | undefined;
  let chequeStoragePath: string | undefined;

  if (chequeFile) {
    const problem = validateChequeFile(chequeFile);
    if (problem) throw new Error(problem);
    const safeName = chequeFile.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
    const storagePath = `leads/${leadId}/investor-bank/${Date.now()}_${safeName}`;
    const storageRef = ref(getBucket(), storagePath);
    const task = uploadBytesResumable(storageRef, chequeFile, { contentType: chequeFile.type });
    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        reject,
        () => resolve(),
      );
    });
    chequeUrl = await getDownloadURL(storageRef);
    chequeStoragePath = storagePath;
  }

  await setDoc(
    sub(leadId),
    {
      accountHolderName: draft.accountHolderName.trim(),
      bankName: draft.bankName.trim(),
      accountNumber: draft.accountNumber.trim(),
      ifsc: draft.ifsc.trim().toUpperCase(),
      branch: draft.branch?.trim() ?? "",
      // Merge, and only touch the cheque fields when a new file was
      // actually uploaded this time — otherwise a plain detail edit would
      // silently wipe out a cheque submitted earlier.
      ...(chequeUrl ? { chequeUrl, chequeStoragePath } : {}),
      submittedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
