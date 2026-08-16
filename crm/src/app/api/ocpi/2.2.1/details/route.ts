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
  ];
  const body: OcpiResponse<{ version: string; endpoints: OcpiEndpoint[] }> = {
    data: { version: "2.2.1", endpoints },
    status_code: 1000,
    status_message: "Success",
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(body);
}
