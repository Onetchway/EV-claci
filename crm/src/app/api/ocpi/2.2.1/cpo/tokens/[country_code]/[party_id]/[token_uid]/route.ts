import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { requireRegisteredParty } from "@/lib/ocpi/auth";
import type { OcpiResponse, OcpiToken } from "@/lib/ocpi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RECEIVER side of the Tokens module — we're the CPO here, so a roaming
 * eMSP partner pushes their token whitelist to us via PUT (full object) or
 * PATCH (partial update), and revokes with DELETE. Stored in
 * ocpiPartnerTokens, keyed by country_code/party_id/token_uid exactly as
 * OCPI addresses it; ocpp-server's rfid.ts checkIdToken falls back to this
 * collection for a tag our own rfidTokens registry doesn't recognize, so
 * the partner's driver can charge here without us keeping our own copy of
 * every token on their network ahead of time.
 */

function docId(countryCode: string, partyId: string, tokenUid: string): string {
  return `${countryCode}_${partyId}_${tokenUid}`;
}

async function upsert(req: Request, params: { country_code: string; party_id: string; token_uid: string }, merge: boolean) {
  let party;
  try {
    party = await requireRegisteredParty(req);
  } catch (err) {
    return NextResponse.json({ status_code: 2000, status_message: (err as Error).message }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as Partial<OcpiToken> | null;
  if (!body) return NextResponse.json({ status_code: 2001, status_message: "Invalid token body." }, { status: 400 });

  await adminDb().collection("ocpiPartnerTokens").doc(docId(params.country_code, params.party_id, params.token_uid)).set(
    {
      ...body,
      country_code: params.country_code,
      party_id: params.party_id,
      uid: params.token_uid,
      partyDocId: party.id,
      receivedAt: new Date(),
    },
    { merge },
  );

  const response: OcpiResponse<Record<string, never>> = {
    data: {}, status_code: 1000, status_message: "Success", timestamp: new Date().toISOString(),
  };
  return NextResponse.json(response);
}

export async function PUT(req: Request, { params }: { params: { country_code: string; party_id: string; token_uid: string } }) {
  return upsert(req, params, false);
}

export async function PATCH(req: Request, { params }: { params: { country_code: string; party_id: string; token_uid: string } }) {
  return upsert(req, params, true);
}

export async function DELETE(req: Request, { params }: { params: { country_code: string; party_id: string; token_uid: string } }) {
  try {
    await requireRegisteredParty(req);
  } catch (err) {
    return NextResponse.json({ status_code: 2000, status_message: (err as Error).message }, { status: 401 });
  }

  await adminDb().collection("ocpiPartnerTokens").doc(docId(params.country_code, params.party_id, params.token_uid)).delete();

  const response: OcpiResponse<Record<string, never>> = {
    data: {}, status_code: 1000, status_message: "Success", timestamp: new Date().toISOString(),
  };
  return NextResponse.json(response);
}
