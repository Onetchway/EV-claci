import "server-only";

/**
 * Asks the Alpha platform (see ../../platform/) for this org's own billing
 * state — plan, MRR, next billing date, invoice history, and payment
 * receipts — via the tenant-authenticated GET /billing/me* routes
 * (platform/backend/src/routes/billingMe.routes.js). Same per-org API key
 * lookup as lib/platform-features.ts: an org with no key configured (not
 * onboarded onto the platform) simply has no billing view to show.
 */

import { adminDb } from "./firebase/admin";

export interface BillingOverview {
  name: string;
  status: string;
  billing_plan_name: string | null;
  billing_model: string | null;
  mrr: string;
  currency: string;
  next_billing_at: string | null;
  trial_ends_at: string | null;
  credit_balance: number;
}

export interface BillingInvoice {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  total_amount: string;
  currency: string;
  status: string;
  due_at: string;
  paid_at: string | null;
}

export interface BillingReceipt {
  receipt_number: string;
  payment_id: string;
  gateway_payment_id: string | null;
  auto_charged: boolean;
  amount: string;
  currency: string;
  paid_at: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  tenant_name: string;
  contact_name: string;
  contact_email: string;
}

async function getOrgPlatformKey(orgId: string | null): Promise<string | null> {
  if (!orgId) return process.env.PLATFORM_TENANT_API_KEY ?? null;
  const snap = await adminDb().collection("organizationPlatformKeys").doc(orgId).get();
  return (snap.data()?.tenantApiKey as string | undefined) ?? null;
}

async function platformFetch(apiKey: string, path: string): Promise<Response> {
  const apiUrl = process.env.PLATFORM_API_URL;
  if (!apiUrl) throw new Error("This CRM instance has no PLATFORM_API_URL configured.");
  return fetch(`${apiUrl}${path}`, { headers: { "X-Tenant-Api-Key": apiKey }, cache: "no-store" });
}

/** null = this org isn't onboarded onto the platform (no key configured) — not an error, just nothing to show. */
export async function getBillingOverview(orgId: string | null): Promise<BillingOverview | null> {
  const apiKey = await getOrgPlatformKey(orgId);
  if (!apiKey) return null;
  const res = await platformFetch(apiKey, "/billing/me");
  if (!res.ok) throw new Error(`Platform billing lookup failed (${res.status}).`);
  return (await res.json()) as BillingOverview;
}

export async function getBillingInvoices(orgId: string | null): Promise<BillingInvoice[] | null> {
  const apiKey = await getOrgPlatformKey(orgId);
  if (!apiKey) return null;
  const res = await platformFetch(apiKey, "/billing/me/invoices");
  if (!res.ok) throw new Error(`Platform invoice lookup failed (${res.status}).`);
  const { data } = (await res.json()) as { data: BillingInvoice[] };
  return data;
}

export async function getBillingReceipt(orgId: string | null, invoiceId: string): Promise<BillingReceipt> {
  const apiKey = await getOrgPlatformKey(orgId);
  if (!apiKey) throw new Error("This org is not onboarded onto the billing platform.");
  const res = await platformFetch(apiKey, `/billing/me/invoices/${invoiceId}/receipt`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Receipt lookup failed (${res.status}).`);
  }
  return (await res.json()) as BillingReceipt;
}
