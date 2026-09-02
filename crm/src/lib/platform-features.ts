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
const cache = new Map<string, { categories: Set<string>; keys: Set<string>; expiresAt: number }>();

async function getOrgPlatformKey(orgId: string | null): Promise<string | null> {
  if (!orgId) return null;
  const snap = await adminDb().collection("organizationPlatformKeys").doc(orgId).get();
  return (snap.data()?.tenantApiKey as string | undefined) ?? null;
}

/**
 * This org's enabled feature categories (every category with at least one
 * enabled feature) and enabled feature keys (platform/database/schema.sql's
 * feature_catalog.key/category), fetched together since they come from the
 * same platform call. `null` for both means "not onboarded onto the
 * platform, or the platform is unreachable" — everything is implicitly
 * enabled in that case (fail-open, same rule the old isFeatureEnabled used
 * per-key): categories gate whole nav groups (a coarse first pass, e.g. no
 * "hr" category enabled hides the whole HRMS group), keys gate individual
 * nav items within a group the super admin left on but turned one feature
 * of off (e.g. HR stays on but Attendance specifically is disabled).
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
    const response = await fetch(`${apiUrl}/features/me`, {
      headers: { "X-Tenant-Api-Key": apiKey },
      cache: "no-store",
    });
    if (!response.ok) return cached ?? null;
    const { data } = (await response.json()) as { data: FeatureRow[] };
    const enabled = data.filter((f) => f.enabled);
    const result = {
      categories: new Set(enabled.map((f) => f.category)),
      keys: new Set(enabled.map((f) => f.key)),
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
