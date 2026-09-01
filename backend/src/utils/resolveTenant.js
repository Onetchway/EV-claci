'use strict';

/**
 * Resolves the tenant a given inbound Host header belongs to, by asking
 * the platform's public GET /api/tenants/resolve endpoint (see
 * platform/backend/src/services/tenants.service.js#resolveByHost).
 *
 * Only relevant for a "shared" deployment mode instance (one CRM serving
 * several tenants by domain/subdomain). No-ops (returns null) when
 * PLATFORM_API_URL isn't set, so standalone/dedicated/isolated deploys —
 * which never need this — pay no cost and make no network call.
 *
 * Cached in-memory per host for a few minutes so this isn't a network
 * round-trip on every login.
 */

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // host -> { tenant, expiresAt }

async function resolveTenantByHost(host) {
  const apiUrl = process.env.PLATFORM_API_URL;
  if (!apiUrl || !host) return null;

  const bareHost = host.split(':')[0].toLowerCase();
  const cached = cache.get(bareHost);
  if (cached && cached.expiresAt > Date.now()) return cached.tenant;

  try {
    const response = await fetch(`${apiUrl}/tenants/resolve?host=${encodeURIComponent(bareHost)}`);
    if (!response.ok) {
      cache.set(bareHost, { tenant: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }
    const tenant = await response.json();
    cache.set(bareHost, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
    return tenant;
  } catch (err) {
    console.error('[resolveTenant] Platform lookup failed:', err.message);
    return null; // fail open to the standalone/ALLOWED_EMAIL_DOMAIN path — never block login on a platform outage
  }
}

/**
 * Same idea as resolveTenantByHost, but for a single-domain deployment that
 * routes tenants by URL path instead of subdomain (app.alpha.com/xpulse —
 * see frontend/middleware.js) rather than by Host header.
 */
const slugCache = new Map(); // slug -> { tenant, expiresAt }

async function resolveTenantBySlug(slug) {
  const apiUrl = process.env.PLATFORM_API_URL;
  if (!apiUrl || !slug) return null;

  const bareSlug = slug.toLowerCase();
  const cached = slugCache.get(bareSlug);
  if (cached && cached.expiresAt > Date.now()) return cached.tenant;

  try {
    const response = await fetch(`${apiUrl}/tenants/resolve-slug?slug=${encodeURIComponent(bareSlug)}`);
    if (!response.ok) {
      slugCache.set(bareSlug, { tenant: null, expiresAt: Date.now() + CACHE_TTL_MS });
      return null;
    }
    const tenant = await response.json();
    slugCache.set(bareSlug, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
    return tenant;
  } catch (err) {
    console.error('[resolveTenant] Platform lookup failed:', err.message);
    return null;
  }
}

module.exports = { resolveTenantByHost, resolveTenantBySlug };
