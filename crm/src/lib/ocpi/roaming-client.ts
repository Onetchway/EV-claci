import "server-only";

/**
 * The other half of OCPI roaming: this app has only ever been a CPO
 * (publishing our own chargers to partners, accepting their commands). This
 * module makes it an eMSP client too — registering with a partner CPO,
 * pulling their locations, and sending START_SESSION/STOP_SESSION commands
 * on their chargers so our own RFID tokens can be used on a partner's
 * network ("CPO↔CPO roaming" — we're a CPO to our own end users and an
 * eMSP to a partner CPO at the same time, which is exactly what OCPI's
 * role model allows a party to be).
 *
 * The registration handshake here is the mirror image of
 * /api/ocpi/2.2.1/credentials (where a partner registers with US as their
 * CPO): here WE call THEM, presenting the token_a they gave us out of
 * band, and store the token_c they hand back.
 */

import { randomUUID } from "node:crypto";

import { adminDb } from "@/lib/firebase/admin";
import { OCPI_COUNTRY_CODE, OCPI_PARTY_ID } from "./identity";
import type { OcpiCredentials, OcpiEndpoint } from "./types";

export const ROAMING_PARTNERS = "ocpiRoamingPartners";

export interface RoamingPartner {
  id: string;
  businessName: string;
  versionsUrl: string;
  theirTokenC?: string;
  ourTokenForThem?: string;
  endpoints?: Partial<Record<"locations" | "sessions" | "cdrs" | "commands", string>>;
  status: "PENDING" | "REGISTERED" | "REVOKED";
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Token ${token}` }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function discoverEndpoints(versionsUrl: string, token: string): Promise<{ endpoints: OcpiEndpoint[]; detailsUrl: string }> {
  const versions = await fetchJson<{ data: Array<{ version: string; url: string }> }>(versionsUrl, token);
  const v221 = versions.data?.find((v) => v.version === "2.2.1");
  if (!v221) throw new Error("Partner does not advertise OCPI 2.2.1.");
  const details = await fetchJson<{ data: { endpoints: OcpiEndpoint[] } }>(v221.url, token);
  return { endpoints: details.data?.endpoints ?? [], detailsUrl: v221.url };
}

/**
 * Performs the outbound registration handshake and stores the resulting
 * partner record. `theirTokenA` is the one-time token the partner gave us
 * out of band (their equivalent of what this app's own /ocpi page issues
 * to inbound partners).
 */
export async function registerWithPartner(
  businessName: string,
  versionsUrl: string,
  theirTokenA: string,
  ourAppUrl: string,
): Promise<RoamingPartner> {
  const { endpoints } = await discoverEndpoints(versionsUrl, theirTokenA);
  const credentialsEndpoint = endpoints.find((e) => e.identifier === "credentials" && e.role === "RECEIVER");
  if (!credentialsEndpoint) throw new Error("Partner does not expose a credentials RECEIVER endpoint.");

  const ourTokenForThem = randomUUID();
  const res = await fetch(credentialsEndpoint.url, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Token ${theirTokenA}` },
    body: JSON.stringify({
      token: ourTokenForThem,
      url: `${ourAppUrl}/api/ocpi/versions`,
      roles: [{
        role: "EMSP",
        business_details: { name: "Livanto Green" },
        party_id: OCPI_PARTY_ID,
        country_code: OCPI_COUNTRY_CODE,
      }],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Partner rejected registration: HTTP ${res.status}`);
  const body = (await res.json()) as { data: OcpiCredentials };
  const theirTokenC = body.data.token;

  // Re-discover with the new token — the definitive endpoint list may differ from the one fetched with token_a.
  const { endpoints: finalEndpoints } = await discoverEndpoints(versionsUrl, theirTokenC).catch(() => ({ endpoints }));
  const cachedEndpoints: RoamingPartner["endpoints"] = {};
  for (const mod of ["locations", "sessions", "cdrs", "commands"] as const) {
    const ep = finalEndpoints.find((e) => e.identifier === mod && e.role === "SENDER") // locations/sessions/cdrs: we pull, they send
      ?? finalEndpoints.find((e) => e.identifier === mod && e.role === "RECEIVER"); // commands: we push, they receive
    if (ep) cachedEndpoints[mod] = ep.url;
  }

  const ref = adminDb().collection(ROAMING_PARTNERS).doc();
  const partner: RoamingPartner = {
    id: ref.id, businessName, versionsUrl, theirTokenC, ourTokenForThem, endpoints: cachedEndpoints, status: "REGISTERED",
  };
  await ref.set({ ...partner, createdAt: new Date() });
  return partner;
}

export async function getRoamingPartner(id: string): Promise<RoamingPartner | null> {
  const snap = await adminDb().collection(ROAMING_PARTNERS).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<RoamingPartner, "id">) };
}

export async function pullPartnerLocations(partner: RoamingPartner): Promise<unknown[]> {
  if (!partner.endpoints?.locations || !partner.theirTokenC) throw new Error("Partner has no locations endpoint on file.");
  const body = await fetchJson<{ data: unknown[] }>(partner.endpoints.locations, partner.theirTokenC);
  return body.data ?? [];
}

export async function sendStartSessionToPartner(
  partner: RoamingPartner,
  locationId: string,
  evseUid: string | undefined,
  idToken: string,
  responseUrl: string,
): Promise<{ result: string }> {
  if (!partner.endpoints?.commands || !partner.theirTokenC) throw new Error("Partner has no commands endpoint on file.");
  const res = await fetch(`${partner.endpoints.commands.replace(/\/$/, "")}/START_SESSION`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Token ${partner.theirTokenC}` },
    body: JSON.stringify({ response_url: responseUrl, token: { uid: idToken, contract_id: idToken }, location_id: locationId, evse_uid: evseUid }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Partner returned HTTP ${res.status} for START_SESSION.`);
  const body = (await res.json()) as { data: { result: string } };
  return body.data;
}

export async function sendStopSessionToPartner(
  partner: RoamingPartner,
  sessionId: string,
  responseUrl: string,
): Promise<{ result: string }> {
  if (!partner.endpoints?.commands || !partner.theirTokenC) throw new Error("Partner has no commands endpoint on file.");
  const res = await fetch(`${partner.endpoints.commands.replace(/\/$/, "")}/STOP_SESSION`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Token ${partner.theirTokenC}` },
    body: JSON.stringify({ response_url: responseUrl, session_id: sessionId }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Partner returned HTTP ${res.status} for STOP_SESSION.`);
  const body = (await res.json()) as { data: { result: string } };
  return body.data;
}
