import { NextResponse } from "next/server";

import { OCPI_VERSION } from "@/lib/ocpi/identity";
import type { OcpiResponse, OcpiVersion } from "@/lib/ocpi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** OCPI's own discovery step — a roaming partner hits this first, unauthenticated, to find what versions we support. */
export async function GET(req: Request) {
  const base = new URL(req.url).origin;
  const body: OcpiResponse<OcpiVersion[]> = {
    data: [{ version: OCPI_VERSION, url: `${base}/api/ocpi/2.2.1/details` }],
    status_code: 1000,
    status_message: "Success",
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(body);
}
