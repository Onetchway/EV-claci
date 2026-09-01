"use client";

import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { COMPANY, DEFAULT_PAYOUT_MONTHS, DEFAULT_SCOPE_ITEMS, DEFAULT_TENURE_YEARS } from "../constants";
import { DEFAULT_CLOSING } from "../loi-template";
import { getDb } from "../firebase/client";
import { getCurrentTenantId } from "../tenant";
import type { Actor, AppSettings } from "../types";
import { logActivitySafe } from "./activity";

export const SETTINGS = "settings";
/** The default (Livanto's own) org's settings document — unchanged for backward compatibility with existing data. Every other org gets its own doc, keyed by orgId (see settingsDocId below). */
export const SETTINGS_DOC = "app";

/** Multi-tenant isolation: each org's company details/bank/LOI defaults are their own document, not shared. */
async function settingsDocId(): Promise<string> {
  const orgId = await getCurrentTenantId();
  return orgId ?? SETTINGS_DOC;
}

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
      registeredAddress: COMPANY.registeredAddress,
      officeAddress: COMPANY.officeAddress,
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
      defaultGstPct: 5,
      loanToValue: 0.7,
      defaultInterestRate: 9,
      defaultTenureYears: 5,
    },
    lists: { chargerOems: [], banks: [], discoms: [], vendors: [] },
    ocpp: { serverHost: "" },
  };
}

/** Merges a stored document over the defaults so new fields never read as undefined. */
export function withDefaults(stored: Partial<AppSettings> | undefined): AppSettings {
  const base = defaultSettings();
  if (!stored) return base;
  return {
    // An empty string saved from Settings → Company (logo not yet uploaded
    // there) shouldn't blank out the logo bundled with the app — only a
    // real override should replace it.
    company: { ...base.company, ...stored.company, logoUrl: stored.company?.logoUrl || base.company.logoUrl },
    bank: { ...base.bank, ...stored.bank },
    loi: { ...base.loi, ...stored.loi },
    finance: { ...base.finance, ...stored.finance },
    lists: { ...base.lists, ...stored.lists },
    ocpp: { ...base.ocpp, ...stored.ocpp },
    updatedAt: stored.updatedAt ?? null,
    updatedBy: stored.updatedBy,
  };
}

export function subscribeSettings(
  cb: (settings: AppSettings) => void,
  onError?: (e: Error) => void,
): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void settingsDocId().then((docId) => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      doc(getDb(), SETTINGS, docId),
      (snap) => cb(withDefaults(snap.exists() ? (snap.data() as AppSettings) : undefined)),
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}

export async function saveSettings(settings: AppSettings, actor: Actor): Promise<void> {
  const { updatedAt: _ignored, ...rest } = settings;
  const docId = await settingsDocId();
  await setDoc(
    doc(getDb(), SETTINGS, docId),
    { ...rest, updatedAt: serverTimestamp(), updatedBy: actor },
    { merge: true },
  );

  logActivitySafe({
    leadId: docId,
    ownerId: actor.uid,
    leadCode: "SETTINGS",
    leadName: "Application settings",
    type: "SETTINGS_UPDATED",
    message: "Application settings updated",
    actor,
  });
}
