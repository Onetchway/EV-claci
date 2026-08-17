import { NextResponse } from "next/server";

import type { OcpiEndpoint, OcpiResponse } from "@/lib/ocpi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lists the modules we implement and where — the second step of OCPI's discovery handshake. */
export async function GET(req: Request) {
  const base = new URL(req.url).origin;
  const endpoints: OcpiEndpoint[] = [
    { identifier: "credentials", role: "RECEIVER", url: `${base}/api/ocpi/2.2.1/credentials` },
    { identifier: "locations", role: "SENDER", url: `${base}/api/ocpi/2.2.1/cpo/locations` },
    { identifier: "tariffs", role: "SENDER", url: `${base}/api/ocpi/2.2.1/cpo/tariffs` },
    { identifier: "sessions", role: "SENDER", url: `${base}/api/ocpi/2.2.1/cpo/sessions` },
    { identifier: "cdrs", role: "SENDER", url: `${base}/api/ocpi/2.2.1/cpo/cdrs` },
    { identifier: "commands", role: "RECEIVER", url: `${base}/api/ocpi/2.2.1/commands` },
    { identifier: "chargingprofiles", role: "RECEIVER", url: `${base}/api/ocpi/2.2.1/chargingprofiles` },
    // eMSP-side endpoints — this app also registers with partner CPOs as an
    // eMSP client (lib/ocpi/roaming-client.ts) to let our own RFID tokens
    // roam onto their networks; these two accept the session/CDR pushes
    // that come back once a partner registration is complete.
    { identifier: "sessions", role: "RECEIVER", url: `${base}/api/ocpi/2.2.1/roaming/sessions` },
    { identifier: "cdrs", role: "RECEIVER", url: `${base}/api/ocpi/2.2.1/roaming/cdrs` },
    // A roaming eMSP partner pushes their token whitelist to us here — we're
    // the CPO/RECEIVER for this module, the reverse direction of locations/
    // tariffs/sessions/cdrs above.
    { identifier: "tokens", role: "RECEIVER", url: `${base}/api/ocpi/2.2.1/cpo/tokens` },
    // A connected hub pushes every other party's live connect status here —
    // RECEIVER only, we don't operate as a hub ourselves.
    { identifier: "hubclientinfo", role: "RECEIVER", url: `${base}/api/ocpi/2.2.1/hubclientinfo` },
  ];
  const body: OcpiResponse<{ version: string; endpoints: OcpiEndpoint[] }> = {
    data: { version: "2.2.1", endpoints },
    status_code: 1000,
    status_message: "Success",
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(body);
}
