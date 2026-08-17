/**
 * The public origin to embed in OCPI discovery/credentials responses (the
 * versions.url, endpoint URLs, etc. a roaming partner then calls back).
 *
 * `new URL(req.url).origin` looks right but isn't reliable behind a proxy:
 * on Firebase App Hosting (itself Cloud Run under the hood) the app process
 * only sees the internal listen address, so req.url's origin can resolve to
 * something like http://0.0.0.0:8080 instead of https://app.livantogreen.com
 * — a partner that discovers us at the real host then gets handed back an
 * unreachable internal URL for every subsequent step, and the whole OCPI
 * handshake fails on their end even though our first response succeeded.
 * The proxy sets x-forwarded-host/x-forwarded-proto to the real public
 * values, so prefer those; req.url's origin is only a fallback for local
 * dev (no proxy in front).
 */
export function publicOrigin(req: Request): string {
  const headers = req.headers;
  const forwardedHost = headers.get("x-forwarded-host");
  const host = forwardedHost ?? headers.get("host");
  if (!host) return new URL(req.url).origin;
  const proto = headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}
