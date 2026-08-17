import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { ocpiErrorResponse, requireRegisteredParty } from "@/lib/ocpi/auth";
import type { OcpiHubClientInfo, OcpiResponse } from "@/lib/ocpi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RECEIVER side of the 2.2.1 HubClientInfo module — a hub we're connected
 * through pushes the live connect/offline status of every other party on
 * the hub here. We don't operate as a hub ourselves (that's a distinct,
 * much larger role — routing OCPI traffic between other parties), only
 * RECEIVER: accepting these pushes so the CRM can show, at a glance,
 * whether a given roaming partner is actually reachable right now before
 * a driver hits a dead end mid-session.
 */
export async function PUT(req: Request, { params }: { params: { country_code: string; party_id: string } }) {
  try {
    await requireRegisteredParty(req);
  } catch (err) {
    return ocpiErrorResponse(err);
  }

  const body = await req.json().catch(() => null) as Partial<OcpiHubClientInfo> | null;
  if (!body) return NextResponse.json({ status_code: 2001, status_message: "Invalid HubClientInfo body." }, { status: 400 });

  await adminDb().collection("hubClientInfo").doc(`${params.country_code}_${params.party_id}`).set(
    { ...body, country_code: params.country_code, party_id: params.party_id, receivedAt: new Date() },
    { merge: true },
  );

  const response: OcpiResponse<Record<string, never>> = {
    data: {}, status_code: 1000, status_message: "Success", timestamp: new Date().toISOString(),
  };
  return NextResponse.json(response);
}
