/**
 * Outbound OCPI push notifications. This CPO's OCPI implementation
 * (crm/src/app/api/ocpi/2.2.1/**) was pull-only — a partner had to poll our
 * GET /cpo/{locations,sessions,cdrs} endpoints for anything new. This
 * pushes PUTs to each REGISTERED partner's own receiver endpoints instead,
 * fired from the exact places charger/session/CDR state actually changes,
 * mirroring the existing dispatchWebhookSafe pattern in webhooks.ts:
 * fire-and-forget, never awaited by the caller, a slow or dead partner
 * can't block charging.
 *
 * A partner's receiver endpoint URL isn't known until we ask for it (the
 * OCPI version/endpoint discovery handshake — §4/§5 of the spec), so it's
 * discovered once and cached on the party's ocpiParties doc under
 * `endpoints.<module>`.
 *
 * Kept self-contained here (own minimal OCPI types + identity constants)
 * rather than importing from the CRM app — this is a separate deployable
 * with its own Firestore access, same pattern webhooks.ts already uses.
 * Keep OCPI_COUNTRY_CODE/OCPI_PARTY_ID in sync with
 * crm/src/lib/ocpi/identity.ts if either ever changes.
 */

import { db } from "./firebase.js";

export const OCPI_COUNTRY_CODE = "IN";
export const OCPI_PARTY_ID = "LGN";

type OcpiModule = "locations" | "sessions" | "cdrs";

interface OcpiParty {
  id: string;
  status: string;
  partnerUrl?: string;
  tokenB?: string;
  endpoints?: Partial<Record<OcpiModule, string>>;
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getRegisteredParties(): Promise<OcpiParty[]> {
  const snap = await db().collection("ocpiParties").where("status", "==", "REGISTERED").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OcpiParty, "id">) }));
}

/** Discovers (and caches) a partner's RECEIVER endpoint URL for a module via the OCPI version handshake. */
async function resolveReceiverEndpoint(party: OcpiParty, mod: OcpiModule): Promise<string | null> {
  const cached = party.endpoints?.[mod];
  if (cached) return cached;
  if (!party.partnerUrl || !party.tokenB) return null;

  try {
    const versionsRes = await fetch(party.partnerUrl, {
      headers: { Authorization: `Token ${party.tokenB}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!versionsRes.ok) return null;
    const versionsBody = (await versionsRes.json()) as { data?: Array<{ version: string; url: string }> };
    const v221 = versionsBody.data?.find((v) => v.version === "2.2.1");
    if (!v221) return null;

    const detailsRes = await fetch(v221.url, {
      headers: { Authorization: `Token ${party.tokenB}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!detailsRes.ok) return null;
    const detailsBody = (await detailsRes.json()) as {
      data?: { endpoints?: Array<{ identifier: string; role: string; url: string }> };
    };
    const endpoint = detailsBody.data?.endpoints?.find((e) => e.identifier === mod && e.role === "RECEIVER");
    if (!endpoint) return null;

    await db().collection("ocpiParties").doc(party.id).set(
      { endpoints: { [mod]: endpoint.url } },
      { merge: true },
    );
    return endpoint.url;
  } catch (err) {
    console.error(`[ocpi-push] endpoint discovery failed for party ${party.id}/${mod}`, err);
    return null;
  }
}

async function putToPartner(party: OcpiParty, mod: OcpiModule, id: string, data: Record<string, unknown>): Promise<void> {
  const endpointBase = await resolveReceiverEndpoint(party, mod);
  if (!endpointBase || !party.tokenB) return;
  const url = `${endpointBase.replace(/\/$/, "")}/${OCPI_COUNTRY_CODE}/${OCPI_PARTY_ID}/${id}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json", Authorization: `Token ${party.tokenB}` },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return;
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      console.error(`[ocpi-push] PUT ${url} failed (attempt ${attempt}/${MAX_ATTEMPTS})`, err);
      if (isLastAttempt) return;
      await sleep(RETRY_DELAYS_MS[attempt - 1]!);
    }
  }
}

async function pushOcpiUpdate(mod: OcpiModule, id: string, data: Record<string, unknown>): Promise<void> {
  const parties = await getRegisteredParties();
  if (parties.length === 0) return;
  await Promise.all(parties.map((party) => putToPartner(party, mod, id, data)));
}

/**
 * Fire-and-forget push. Takes a payload builder (not the payload itself) so
 * the Firestore reads needed to assemble a full OCPI object also happen in
 * the background, off the caller's hot path — a charger status update or
 * session event should never wait on this.
 */
export function pushOcpiUpdateSafe(mod: OcpiModule, id: string, buildPayload: () => Promise<Record<string, unknown> | null>): void {
  void (async () => {
    try {
      const data = await buildPayload();
      if (!data) return;
      await pushOcpiUpdate(mod, id, data);
    } catch (err) {
      console.error(`[ocpi-push] failed to push ${mod}/${id}`, err);
    }
  })();
}
