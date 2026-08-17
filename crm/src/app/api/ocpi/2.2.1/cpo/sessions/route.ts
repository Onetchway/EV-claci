import { NextResponse } from "next/server";

import { ocpiErrorResponse, requireRegisteredParty } from "@/lib/ocpi/auth";
import { mapSessions } from "@/lib/ocpi/mappers";
import type { OcpiResponse } from "@/lib/ocpi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireRegisteredParty(req);
    const data = await mapSessions();
    const body: OcpiResponse<typeof data> = { data, status_code: 1000, status_message: "Success", timestamp: new Date().toISOString() };
    return NextResponse.json(body);
  } catch (err) {
    return ocpiErrorResponse(err);
  }
}
