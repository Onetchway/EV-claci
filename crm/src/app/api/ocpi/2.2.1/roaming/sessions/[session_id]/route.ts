import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { ocpiErrorResponse, requireRoamingPartnerAuth } from "@/lib/ocpi/auth";
import type { OcpiResponse, OcpiSession } from "@/lib/ocpi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RECEIVER side of the Sessions module, for a partner CPO we've registered
 * with as an eMSP (lib/ocpi/roaming-client.ts) — they push session
 * lifecycle updates for a session our own idToken opened on their network.
 * Stored separately from `chargeSessions` (which is only ever our own
 * chargers): this is a session on someone else's hardware, we're just
 * tracking it so the CRM can show it and send STOP_SESSION with the real
 * partner-assigned session id.
 */
export async function PUT(req: Request, { params }: { params: { session_id: string } }) {
  let partner;
  try {
    partner = await requireRoamingPartnerAuth(req);
  } catch (err) {
    return ocpiErrorResponse(err);
  }

  const body = await req.json().catch(() => null) as OcpiSession | null;
  if (!body) return NextResponse.json({ status_code: 2001, status_message: "Invalid session body." }, { status: 400 });

  await adminDb().collection("roamingSessions").doc(`${partner.id}__${params.session_id}`).set(
    { ...body, partnerId: partner.id, partnerName: partner.businessName, receivedAt: new Date() },
    { merge: true },
  );

  const response: OcpiResponse<Record<string, never>> = {
    data: {}, status_code: 1000, status_message: "Success", timestamp: new Date().toISOString(),
  };
  return NextResponse.json(response);
}
