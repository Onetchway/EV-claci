"use client";

import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor } from "../types";

const SETTINGS_DOC = "settings/app";

export interface BankDetails {
  accountName: string;
  accountNo: string;
  ifsc: string;
  bankName: string;
  branch: string;
}

export interface AppSettings {
  bank: BankDetails;
}

export function defaultSettings(): AppSettings {
  return { bank: { accountName: "", accountNo: "", ifsc: "", bankName: "", branch: "" } };
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
