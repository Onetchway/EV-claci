"use client";

import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";

import { getBucket, getDb } from "../firebase/client";
import type { Actor } from "../types";

const SETTINGS_DOC = "settings/app";

export interface BankDetails {
  accountName: string;
  accountNo: string;
  ifsc: string;
  bankName: string;
  branch: string;
}

export interface LetterheadSettings {
  url: string;
  storagePath: string;
  contentType: string; // "application/pdf" or an "image/*" type
  fileName: string;
  uploadedAt?: string;
}

export interface AppSettings {
  bank: BankDetails;
  letterhead: LetterheadSettings | null;
}

export function defaultSettings(): AppSettings {
  return { bank: { accountName: "", accountNo: "", ifsc: "", bankName: "", branch: "" }, letterhead: null };
}

export function subscribeSettings(cb: (s: AppSettings) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), SETTINGS_DOC),
    (snap) => cb(snap.exists() ? { ...defaultSettings(), ...(snap.data() as Partial<AppSettings>) } : defaultSettings()),
    (err) => onError?.(err as Error),
  );
}

export async function saveSettings(settings: AppSettings, actor: Actor): Promise<void> {
  await setDoc(doc(getDb(), SETTINGS_DOC), { ...settings, updatedAt: serverTimestamp(), updatedBy: actor }, { merge: true });
}

const LETTERHEAD_TYPES = ["application/pdf", "image/png", "image/jpeg"];

/**
 * Uploads the company letterhead (a PDF or PNG/JPG scan of the printed
 * letterhead) and saves it to settings. Every printed document — Quotation,
 * PO, PI, BOQ, and any future document type that uses <PrintHeader> — picks
 * this up automatically, replacing the default logo/company-block header.
 */
export async function uploadLetterhead(file: File, actor: Actor): Promise<LetterheadSettings> {
  if (!LETTERHEAD_TYPES.includes(file.type)) {
    throw new Error("Letterhead must be a PDF, PNG, or JPG file.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Letterhead file must be under 10MB.");
  }

  const path = `nakjm/settings/letterhead-${Date.now()}-${file.name}`;
  const sRef = storageRef(getBucket(), path);
  await uploadBytes(sRef, file, { contentType: file.type });
  const url = await getDownloadURL(sRef);

  const letterhead: LetterheadSettings = {
    url,
    storagePath: path,
    contentType: file.type,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
  };

  const current = await new Promise<AppSettings>((resolve) => {
    const unsub = subscribeSettings((s) => { unsub(); resolve(s); });
  });
  await saveSettings({ ...current, letterhead }, actor);

  return letterhead;
}

export async function removeLetterhead(current: AppSettings, actor: Actor): Promise<void> {
  if (!current.letterhead) return;
  try {
    await deleteObject(storageRef(getBucket(), current.letterhead.storagePath));
  } catch {
    // best-effort — if the file's already gone, still clear the setting
  }
  await saveSettings({ ...current, letterhead: null }, actor);
}
