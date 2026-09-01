import "server-only";

/**
 * Asks the Alpha platform (see ../../platform/) which features are enabled
 * for this tenant, via the tenant-authenticated GET /api/features/me (see
 * platform/backend/src/routes/features.routes.js). Mirrors the fail-open,
 * cached pattern in backend/src/utils/resolveTenant.js.
 *
 * No-ops (returns null) when PLATFORM_API_URL/PLATFORM_TENANT_API_KEY aren't
 * set, so a standalone deploy of this CRM pays no cost and every feature
 * gate below defaults to "on" — this only restricts anything once a tenant
 * is actually onboarded onto the platform.
 */

type FeatureRow = { key: string; enabled: boolean };

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { features: Set<string>; expiresAt: number } | null = null;

async function fetchEnabledFeatures(): Promise<Set<string> | null> {
  const apiUrl = process.env.PLATFORM_API_URL;
  const apiKey = process.env.PLATFORM_TENANT_API_KEY;
  if (!apiUrl || !apiKey) return null;

  if (cache && cache.expiresAt > Date.now()) return cache.features;

  try {
    const response = await fetch(`${apiUrl}/features/me`, {
      headers: { "X-Tenant-Api-Key": apiKey },
      cache: "no-store",
    });
    if (!response.ok) return cache?.features ?? null;
    const { data } = (await response.json()) as { data: FeatureRow[] };
    const features = new Set(data.filter((f) => f.enabled).map((f) => f.key));
    cache = { features, expiresAt: Date.now() + CACHE_TTL_MS };
    return features;
  } catch (err) {
    console.error("[platform-features] Platform lookup failed:", (err as Error).message);
    // Fail open — never block this tenant's CRM on a platform outage.
    return cache?.features ?? null;
  }
}

/**
 * True when this tenant is not onboarded onto the platform (standalone
 * deploy), or when the platform is unreachable, or when the platform says
 * the feature is on. False only when the platform explicitly says off.
 */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const features = await fetchEnabledFeatures();
  if (features === null) return true;
  return features.has(key);
}
