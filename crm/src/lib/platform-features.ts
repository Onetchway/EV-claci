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

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { categories: Set<string>; expiresAt: number }>();

async function getOrgPlatformKey(orgId: string | null): Promise<string | null> {
  if (!orgId) return null;
  const snap = await adminDb().collection("organizationPlatformKeys").doc(orgId).get();
  return (snap.data()?.tenantApiKey as string | undefined) ?? null;
}

/**
 * Every feature category (platform/database/schema.sql's feature_catalog.
 * category — general/sales/operations/finance/hr/settings) that has at
 * least one enabled feature for this org. `null` means "not onboarded
 * onto the platform, or the platform is unreachable" — every category is
 * implicitly enabled in that case, same fail-open rule as isFeatureEnabled
 * used to apply per-key.
 */
export async function getEnabledCategories(orgId: string | null): Promise<Set<string> | null> {
  const apiUrl = process.env.PLATFORM_API_URL;
  const cacheKey = orgId ?? "__default__";
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.categories;

  if (!apiUrl) return null;
  const apiKey = await getOrgPlatformKey(orgId);
  if (!apiKey) return null;

  try {
    const response = await fetch(`${apiUrl}/features/me`, {
      headers: { "X-Tenant-Api-Key": apiKey },
      cache: "no-store",
    });
    if (!response.ok) return cached?.categories ?? null;
    const { data } = (await response.json()) as { data: FeatureRow[] };
    const categories = new Set(data.filter((f) => f.enabled).map((f) => f.category));
    cache.set(cacheKey, { categories, expiresAt: Date.now() + CACHE_TTL_MS });
    return categories;
  } catch (err) {
    console.error("[platform-features] Platform lookup failed:", (err as Error).message);
    // Fail open — never block this org's CRM on a platform outage.
    return cached?.categories ?? null;
  }
}
