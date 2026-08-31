"use client";

import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { COMPANY_INFO } from "../constants";
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

export interface CompanyInfo {
  name: string;
  gstin: string;
  cin: string;
  email: string;
  website: string;
  registeredAddress: string;
  officeAddress: string;
  logoUrl: string;
}

export interface AppSettings {
  bank: BankDetails;
  company: CompanyInfo;
}

/** Seeded from the deploy-time COMPANY_INFO constant so a fresh install prints correctly before anyone edits Settings. */
export function defaultSettings(): AppSettings {
  return {
    bank: { accountName: "", accountNo: "", ifsc: "", bankName: "", branch: "" },
    company: {
      name: COMPANY_INFO.name,
      gstin: COMPANY_INFO.gstin,
      cin: COMPANY_INFO.cin,
      email: COMPANY_INFO.email,
      website: COMPANY_INFO.website,
      registeredAddress: COMPANY_INFO.registeredAddress,
      officeAddress: COMPANY_INFO.officeAddress,
      logoUrl: "/logo.png",
    },
  };
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
