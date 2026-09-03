import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { ocpiErrorResponse, requireRoamingPartnerAuth } from "@/lib/ocpi/auth";
import type { OcpiCdr, OcpiResponse } from "@/lib/ocpi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** RECEIVER side of the CDRs module for roaming partners — see the sessions route in this same directory for the full explanation. A partner posts the settlement record once a roaming session on their network ends. */
export async function PUT(req: Request, { params }: { params: { cdr_id: string } }) {
  let partner;
  try {
    partner = await requireRoamingPartnerAuth(req);
  } catch (err) {
    return ocpiErrorResponse(err);
  }

  const body = await req.json().catch(() => null) as OcpiCdr | null;
  if (!body) return NextResponse.json({ status_code: 2001, status_message: "Invalid CDR body." }, { status: 400 });

  await adminDb().collection("roamingCdrs").doc(`${partner.id}__${params.cdr_id}`).set(
    { ...body, partnerId: partner.id, partnerName: partner.businessName, receivedAt: new Date() },
    { merge: true },
  );

  const response: OcpiResponse<Record<string, never>> = {
    data: {}, status_code: 1000, status_message: "Success", timestamp: new Date().toISOString(),
  };
  return NextResponse.json(response);
}
