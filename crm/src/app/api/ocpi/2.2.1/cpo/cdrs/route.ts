import { NextResponse } from "next/server";

import { requireRegisteredParty } from "@/lib/ocpi/auth";
import { mapCdrs } from "@/lib/ocpi/mappers";
import type { OcpiResponse } from "@/lib/ocpi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireRegisteredParty(req);
    const data = await mapCdrs();
    const body: OcpiResponse<typeof data> = { data, status_code: 1000, status_message: "Success", timestamp: new Date().toISOString() };
    return NextResponse.json(body);
  } catch (err) {
    const message = (err as Error).message ?? "Unauthorized.";
    return NextResponse.json({ status_code: 2000, status_message: message }, { status: 401 });
  }
}
