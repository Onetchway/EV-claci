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

/**
 * Multi-tenant isolation: each org's company details/bank/LOI defaults are
 * their own document, not shared. `isTenantScoped` tells the caller whether
 * this is a real per-org doc (a signed-in user with an orgId claim) as
 * opposed to the legacy/no-claim "app" doc — see withDefaults below for why
 * that distinction matters.
 */
async function settingsDocId(): Promise<{ docId: string; isTenantScoped: boolean }> {
  const orgId = await getCurrentTenantId();
  return { docId: orgId ?? SETTINGS_DOC, isTenantScoped: Boolean(orgId) };
}

/**
 * Falls back to the values compiled into the app -- this is Livanto's own
 * real business identity (legal name, bank account, LOI terms), so it must
 * only ever be used for Livanto's own legacy "app" doc, never as a
 * multi-tenant fallback (see blankSettings below and withDefaults'
 * isTenantScoped parameter). Saving writes the whole document, which keeps
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
      model: COMPANY.model,
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

/**
 * The fallback for every *other* tenant's not-yet-configured settings doc.
 * Deliberately blank on company/bank/LOI identity -- until a tenant admin
 * fills in Settings → Company, their invoices/agreements/LOIs must read as
 * "not yet configured", never silently show Livanto's own legal name and
 * bank account (which would be a real financial/legal misdirection, not
 * just a branding glitch). Operational defaults (tenure, payout months,
 * scope items, closing line, GST/finance assumptions) stay -- those are
 * generic starting points any tenant can use as-is.
 */
export function blankSettings(): AppSettings {
  return {
    company: {
      legalName: "", shortName: "", registeredAddress: "", officeAddress: "",
      gstin: "", cin: "", email: "", phone: "", website: "", logoUrl: "",
    },
    bank: { accountName: "", bankName: "", accountNumber: "", ifsc: "", branch: "" },
    loi: {
      tenureYears: DEFAULT_TENURE_YEARS,
      payoutMonths: DEFAULT_PAYOUT_MONTHS,
      signatory: "",
      arbitrationSeat: "",
      jurisdiction: "",
      model: "",
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

/**
 * Merges a stored document over the defaults so new fields never read as
 * undefined. `isTenantScoped` (true for any real per-org doc; false only
 * for Livanto's own legacy "app" doc) picks which fallback identity backs
 * an unset field -- see blankSettings' doc comment for why this matters.
 */
export function withDefaults(stored: Partial<AppSettings> | undefined, isTenantScoped = false): AppSettings {
  const base = isTenantScoped ? blankSettings() : defaultSettings();
  if (!stored) return base;
  return {
    // An empty string saved from Settings → Company (logo not yet uploaded
    // there) shouldn't blank out the logo bundled with the app — only a
    // real override should replace it. Only applies to the legacy doc;
    // a tenant-scoped doc's base logo is already blank, so this is a no-op
    // there and every tenant's own saved logo still wins.
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
  void settingsDocId().then(({ docId, isTenantScoped }) => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      doc(getDb(), SETTINGS, docId),
      (snap) => cb(withDefaults(snap.exists() ? (snap.data() as AppSettings) : undefined, isTenantScoped)),
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}

export async function saveSettings(settings: AppSettings, actor: Actor): Promise<void> {
  const { updatedAt: _ignored, ...rest } = settings;
  const { docId } = await settingsDocId();
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
