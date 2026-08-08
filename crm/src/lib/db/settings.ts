"use client";

import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { COMPANY, DEFAULT_PAYOUT_MONTHS, DEFAULT_SCOPE_ITEMS, DEFAULT_TENURE_YEARS } from "../constants";
import { DEFAULT_CLOSING } from "../loi-template";
import { getDb } from "../firebase/client";
import type { Actor, AppSettings } from "../types";
import { logActivitySafe } from "./activity";

export const SETTINGS = "settings";
export const SETTINGS_DOC = "app";

/**
 * Falls back to the values compiled into the app, so a fresh project works
 * before anyone visits Settings. Saving writes the whole document, which keeps
 * the shape predictable for the LOI generator that reads it.
 */
export function defaultSettings(): AppSettings {
  return {
    company: {
      legalName: COMPANY.legalName,
      shortName: COMPANY.shortName,
      address: COMPANY.address,
      gstin: COMPANY.gstin,
      cin: COMPANY.cin,
      email: COMPANY.email,
      phone: COMPANY.phone,
      website: COMPANY.website,
      logoUrl: COMPANY.logoUrl,
    },
    bank: {
      accountName: COMPANY.bank.accountName,
      bankName: COMPANY.bank.bankName,
      accountNumber: COMPANY.bank.accountNumber,
      ifsc: COMPANY.bank.ifsc,
      branch: "",
    },
    loi: {
      tenureYears: DEFAULT_TENURE_YEARS,
      payoutMonths: DEFAULT_PAYOUT_MONTHS,
      signatory: COMPANY.signatory,
      arbitrationSeat: COMPANY.arbitrationSeat,
      jurisdiction: COMPANY.jurisdiction,
      scopeItems: [...DEFAULT_SCOPE_ITEMS],
      closing: DEFAULT_CLOSING,
    },
    finance: {
      defaultGstPct: 18,
      loanToValue: 0.7,
      defaultInterestRate: 9,
      defaultTenureYears: 5,
    },
    lists: { chargerOems: [], banks: [], discoms: [], vendors: [] },
  };
}

/** Merges a stored document over the defaults so new fields never read as undefined. */
export function withDefaults(stored: Partial<AppSettings> | undefined): AppSettings {
  const base = defaultSettings();
  if (!stored) return base;
  return {
    company: { ...base.company, ...stored.company },
    bank: { ...base.bank, ...stored.bank },
    loi: { ...base.loi, ...stored.loi },
    finance: { ...base.finance, ...stored.finance },
    lists: { ...base.lists, ...stored.lists },
    updatedAt: stored.updatedAt ?? null,
    updatedBy: stored.updatedBy,
  };
}

export function subscribeSettings(
  cb: (settings: AppSettings) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), SETTINGS, SETTINGS_DOC),
    (snap) => cb(withDefaults(snap.exists() ? (snap.data() as AppSettings) : undefined)),
    (err) => onError?.(err as Error),
  );
}

export async function saveSettings(settings: AppSettings, actor: Actor): Promise<void> {
  const { updatedAt: _ignored, ...rest } = settings;
  await setDoc(
    doc(getDb(), SETTINGS, SETTINGS_DOC),
    { ...rest, updatedAt: serverTimestamp(), updatedBy: actor },
    { merge: true },
  );

  logActivitySafe({
    leadId: SETTINGS_DOC,
    ownerId: actor.uid,
    leadCode: "SETTINGS",
    leadName: "Application settings",
    type: "SETTINGS_UPDATED",
    message: "Application settings updated",
    actor,
  });
}
