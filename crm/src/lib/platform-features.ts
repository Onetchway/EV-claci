import "server-only";

/**
 * Asks the Alpha platform (see ../../platform/) which feature categories
 * are enabled for a given org (see lib/db/organizations.ts), via the
 * tenant-authenticated GET /api/features/me (platform/backend/src/routes/
 * features.routes.js). Mirrors the fail-open, cached pattern in
 * backend/src/utils/resolveTenant.js.
 *
 * Unlike backend/+frontend/ (one deployed instance = one tenant, so a
 * single env-var API key worked), this app is genuinely multi-tenant —
 * many orgs share one deployment — so the platform API key is per-org,
 * stored server-only in the organizationPlatformKeys collection (see
 * firestore.rules; never readable by the client SDK, same pattern as
 * organizationPaymentSecrets) and set via /api/organizations/[id]/
 * platform-key. An org with no key configured (including the default,
 * non-white-label Livanto org, and any standalone deploy) sees every
 * category enabled — this only restricts anything once an org is
 * actually onboarded onto the platform.
 */

import { adminDb } from "./firebase/admin";

type FeatureRow = { key: string; category: string; enabled: boolean };
type ModuleRow = { key: string; enabled: boolean };

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { categories: Set<string>; keys: Set<string>; expiresAt: number }>();

async function getOrgPlatformKey(orgId: string | null): Promise<string | null> {
  if (!orgId) return null;
  const snap = await adminDb().collection("organizationPlatformKeys").doc(orgId).get();
  return (snap.data()?.tenantApiKey as string | undefined) ?? null;
}

/**
 * This org's enabled modules (platform/database/schema.sql's `modules` —
 * an explicit, coarser on/off gate over a whole nav group, e.g. "hr" — see
 * GET /modules/me) and enabled individual feature keys (feature_catalog.key
 * — a finer gate within a module, e.g. "attendance" specifically). `null`
 * for both means "not onboarded onto the platform, or the platform is
 * unreachable" — everything is implicitly enabled in that case (fail
 * open, same rule the old isFeatureEnabled used per-key). Field is still
 * named `categories` for backward compat with existing callers (the
 * portal route's category check) — semantically it's now module keys,
 * which happen to share the same string values as feature_catalog's
 * category column by design (see modules migration).
 */
export async function getEnabledFeatures(
  orgId: string | null,
): Promise<{ categories: Set<string>; keys: Set<string> } | null> {
  const apiUrl = process.env.PLATFORM_API_URL;
  const cacheKey = orgId ?? "__default__";
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached;

  if (!apiUrl) return null;
  const apiKey = await getOrgPlatformKey(orgId);
  if (!apiKey) return null;

  try {
    const [featuresRes, modulesRes] = await Promise.all([
      fetch(`${apiUrl}/features/me`, { headers: { "X-Tenant-Api-Key": apiKey }, cache: "no-store" }),
      fetch(`${apiUrl}/modules/me`, { headers: { "X-Tenant-Api-Key": apiKey }, cache: "no-store" }),
    ]);
    if (!featuresRes.ok || !modulesRes.ok) return cached ?? null;
    const { data: featureData } = (await featuresRes.json()) as { data: FeatureRow[] };
    const { data: moduleData } = (await modulesRes.json()) as { data: ModuleRow[] };
    const result = {
      categories: new Set(moduleData.filter((m) => m.enabled).map((m) => m.key)),
      keys: new Set(featureData.filter((f) => f.enabled).map((f) => f.key)),
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error("[platform-features] Platform lookup failed:", (err as Error).message);
    // Fail open — never block this org's CRM on a platform outage.
    return cached ?? null;
  }
}

/** @deprecated use getEnabledFeatures — kept for the slug-based investor-portal route, which only ever needed the category check. */
export async function getEnabledCategories(orgId: string | null): Promise<Set<string> | null> {
  const result = await getEnabledFeatures(orgId);
  return result ? result.categories : null;
}
