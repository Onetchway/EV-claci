import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { OCPI_COUNTRY_CODE, OCPI_PARTY_ID } from "@/lib/ocpi/identity";
import { OCPI_PARTIES, requirePendingParty } from "@/lib/ocpi/auth";
import type { OcpiCredentials, OcpiResponse } from "@/lib/ocpi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The OCPI registration handshake (§3 of the spec): a partner calls this
 * once, presenting the one-time token_a we gave them out of band (see
 * lib/db/ocpi-parties.ts / the CRM's OCPI Roaming page) plus their own
 * credentials. We store their token/URL, mint our own token_c for them to
 * use on every subsequent call, and hand it back.
 */

const Body = z.object({
  token: z.string().min(1),
  url: z.string().url(),
  roles: z.array(z.object({
    role: z.string(),
    business_details: z.object({ name: z.string() }),
    party_id: z.string(),
    country_code: z.string(),
  })).min(1),
});

export async function POST(req: Request) {
  try {
    const party = await requirePendingParty(req);
    const body = Body.parse(await req.json());
    const tokenC = randomUUID();

    await adminDb().collection(OCPI_PARTIES).doc(party.id).update({
      status: "REGISTERED",
      tokenB: body.token,
      tokenC,
      partnerUrl: body.url,
      businessName: body.roles[0]?.business_details.name ?? "",
      registeredAt: FieldValue.serverTimestamp(),
    });

    const base = new URL(req.url).origin;
    const ourCredentials: OcpiCredentials = {
      token: tokenC,
      url: `${base}/api/ocpi/versions`,
      roles: [{
        role: "CPO",
        business_details: { name: "Livanto Green" },
        party_id: OCPI_PARTY_ID,
        country_code: OCPI_COUNTRY_CODE,
      }],
    };
    const response: OcpiResponse<OcpiCredentials> = {
      data: ourCredentials, status_code: 1000, status_message: "Success", timestamp: new Date().toISOString(),
    };
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ status_code: 2001, status_message: err.issues[0]?.message ?? "Invalid credentials payload." }, { status: 400 });
    }
    const message = (err as Error).message ?? "Registration failed.";
    const status = message.startsWith("UNAUTHORIZED") ? 401 : 400;
    return NextResponse.json({ status_code: 2000, status_message: message }, { status });
  }
}
