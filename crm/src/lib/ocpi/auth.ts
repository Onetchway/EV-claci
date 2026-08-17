import "server-only";

import { createHash } from "node:crypto";

import { adminDb } from "@/lib/firebase/admin";

/**
 * OCPI's own bearer-token scheme — separate from Firebase Auth entirely,
 * since the caller here is a roaming partner's server, not a signed-in CRM
 * user. `token_a` is the one-time token we hand a partner to bootstrap
 * registration (POST /credentials only); `token_c` is what they use for
 * every request after that, once we've generated it during registration.
 */

/**
 * Same reasoning as api/v1/_lib/apikey.ts's rate limiter — best-effort,
 * in-memory, per-instance. A roaming partner's polling loop or a
 * misbehaving integration shouldn't be able to hammer these endpoints
 * unbounded just because OCPI itself doesn't mandate a rate-limit scheme.
 * Higher ceiling than /api/v1's default (120 vs 60) since a partner
 * legitimately polling locations/sessions/tariffs across several modules
 * needs more headroom than a single external dashboard integration.
 */
const OCPI_RATE_LIMIT_PER_MINUTE = 120;
const ocpiRequestLog = new Map<string, number[]>();

function checkOcpiRateLimit(token: string): void {
  const key = createHash("sha256").update(token).digest("hex");
  const now = Date.now();
  const windowStart = now - 60_000;
  const timestamps = (ocpiRequestLog.get(key) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= OCPI_RATE_LIMIT_PER_MINUTE) {
    throw new Error(`RATE_LIMITED: max ${OCPI_RATE_LIMIT_PER_MINUTE} requests/minute exceeded for this token.`);
  }
  timestamps.push(now);
  ocpiRequestLog.set(key, timestamps);
}

export interface OcpiParty {
  id: string;
  partyId: string;
  countryCode: string;
  role: string;
  status: "PENDING" | "REGISTERED" | "REVOKED";
  tokenA: string;
  tokenB?: string;
  tokenC?: string;
  partnerUrl?: string;
  businessName?: string;
}

export const OCPI_PARTIES = "ocpiParties";

/**
 * Shared error → HTTP response mapping for every OCPI route that only
 * calls one of the three auth functions above and nothing else that could
 * throw for a different reason — RATE_LIMITED gets a real 429 instead of
 * being folded into the generic 401 every other auth failure returns.
 * OCPI's own status_code/status_message envelope stays as-is (that's the
 * receiver-facing contract other implementations parse); this only fixes
 * the HTTP status line, which a generic HTTP client (not an OCPI-aware
 * one) is what actually backs off on.
 */
export function ocpiErrorResponse(err: unknown): Response {
  const message = (err as Error)?.message ?? "Unauthorized.";
  const rateLimited = message.startsWith("RATE_LIMITED:");
  return Response.json(
    { status_code: 2000, status_message: rateLimited ? message.slice("RATE_LIMITED: ".length) : message },
    { status: rateLimited ? 429 : 401 },
  );
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("token ") ? header.slice(6).trim() : null;
}

/**
 * OCPI §3.2 requires the token in the Authorization header to be
 * base64-encoded, but not every implementation follows that — some send
 * the raw token verbatim (including, previously, this app's own outbound
 * calls). A strict raw-only comparison rejects a fully spec-compliant
 * partner with "token not recognized" even though the token itself is
 * correct, just encoded — so try the token as received, and as a
 * base64-decode of what was received, and accept either.
 */
function candidateTokens(raw: string): string[] {
  const candidates = [raw];
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    if (decoded && decoded !== raw && /^[a-zA-Z0-9-]+$/.test(decoded)) candidates.push(decoded);
  } catch { /* not base64 — raw is the only candidate */ }
  return candidates;
}

/** Validates the presented token as an active (REGISTERED) party's token_c. Used by every data-pull endpoint. */
export async function requireRegisteredParty(req: Request): Promise<OcpiParty> {
  const token = bearerToken(req);
  if (!token) throw new Error("UNAUTHORIZED: missing Authorization: Token header.");
  checkOcpiRateLimit(token);
  for (const candidate of candidateTokens(token)) {
    const snap = await adminDb().collection(OCPI_PARTIES)
      .where("tokenC", "==", candidate).where("status", "==", "REGISTERED").limit(1).get();
    if (!snap.empty) return { id: snap.docs[0]!.id, ...(snap.docs[0]!.data() as Omit<OcpiParty, "id">) };
  }
  throw new Error("UNAUTHORIZED: token not recognized or not yet registered.");
}

/** Validates the presented token as a pending party's token_a. Used only by the initial POST /credentials call. */
export async function requirePendingParty(req: Request): Promise<OcpiParty> {
  const token = bearerToken(req);
  if (!token) throw new Error("UNAUTHORIZED: missing Authorization: Token header.");
  for (const candidate of candidateTokens(token)) {
    const snap = await adminDb().collection(OCPI_PARTIES)
      .where("tokenA", "==", candidate).where("status", "==", "PENDING").limit(1).get();
    if (!snap.empty) return { id: snap.docs[0]!.id, ...(snap.docs[0]!.data() as Omit<OcpiParty, "id">) };
  }
  throw new Error("UNAUTHORIZED: registration token not recognized or already used.");
}

/**
 * Validates the presented token as a token we ourselves handed to a
 * roaming partner (`ourTokenForThem` on their ocpiRoamingPartners doc —
 * see lib/ocpi/roaming-client.ts). Used by the inbound session/CDR PUT
 * endpoints a partner CPO pushes to once we've registered with them as
 * their eMSP.
 */
export async function requireRoamingPartnerAuth(req: Request): Promise<{ id: string; businessName: string }> {
  const token = bearerToken(req);
  if (!token) throw new Error("UNAUTHORIZED: missing Authorization: Token header.");
  checkOcpiRateLimit(token);
  for (const candidate of candidateTokens(token)) {
    const snap = await adminDb().collection("ocpiRoamingPartners")
      .where("ourTokenForThem", "==", candidate).where("status", "==", "REGISTERED").limit(1).get();
    if (!snap.empty) {
      const data = snap.docs[0]!.data() as { businessName?: string };
      return { id: snap.docs[0]!.id, businessName: data.businessName ?? "" };
    }
  }
  throw new Error("UNAUTHORIZED: token not recognized or partner not registered.");
}
