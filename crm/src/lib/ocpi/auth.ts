import "server-only";

import { adminDb } from "@/lib/firebase/admin";

/**
 * OCPI's own bearer-token scheme — separate from Firebase Auth entirely,
 * since the caller here is a roaming partner's server, not a signed-in CRM
 * user. `token_a` is the one-time token we hand a partner to bootstrap
 * registration (POST /credentials only); `token_c` is what they use for
 * every request after that, once we've generated it during registration.
 */

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

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("token ") ? header.slice(6).trim() : null;
}

/** Validates the presented token as an active (REGISTERED) party's token_c. Used by every data-pull endpoint. */
export async function requireRegisteredParty(req: Request): Promise<OcpiParty> {
  const token = bearerToken(req);
  if (!token) throw new Error("UNAUTHORIZED: missing Authorization: Token header.");
  const snap = await adminDb().collection(OCPI_PARTIES)
    .where("tokenC", "==", token).where("status", "==", "REGISTERED").limit(1).get();
  if (snap.empty) throw new Error("UNAUTHORIZED: token not recognized or not yet registered.");
  return { id: snap.docs[0]!.id, ...(snap.docs[0]!.data() as Omit<OcpiParty, "id">) };
}

/** Validates the presented token as a pending party's token_a. Used only by the initial POST /credentials call. */
export async function requirePendingParty(req: Request): Promise<OcpiParty> {
  const token = bearerToken(req);
  if (!token) throw new Error("UNAUTHORIZED: missing Authorization: Token header.");
  const snap = await adminDb().collection(OCPI_PARTIES)
    .where("tokenA", "==", token).where("status", "==", "PENDING").limit(1).get();
  if (snap.empty) throw new Error("UNAUTHORIZED: registration token not recognized or already used.");
  return { id: snap.docs[0]!.id, ...(snap.docs[0]!.data() as Omit<OcpiParty, "id">) };
}
