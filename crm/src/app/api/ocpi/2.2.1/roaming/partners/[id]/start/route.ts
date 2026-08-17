import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse, requireCaller, ApiError } from "@/app/api/_lib/guard";
import { adminDb } from "@/lib/firebase/admin";
import { publicOrigin } from "@/lib/ocpi/base-url";
import { getRoamingPartner, sendStartSessionToPartner } from "@/lib/ocpi/roaming-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  locationId: z.string().min(1),
  evseUid: z.string().optional(),
  idToken: z.string().min(1),
});

/**
 * Sends START_SESSION to a roaming partner's chargers using one of our own
 * RFID tokens — the outbound counterpart to the OCPI Commands module this
 * app already accepts inbound (api/ocpi/2.2.1/commands). Creates a
 * roamingCommands doc the CRM UI polls for the async result (see the
 * callback route), since the partner's real answer arrives later, not in
 * this response.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const caller = await requireCaller(req, "ADMIN");
    const { locationId, evseUid, idToken } = Body.parse(await req.json());
    const partner = await getRoamingPartner(params.id);
    if (!partner) throw new ApiError("Roaming partner not found.", 404);

    const rid = randomUUID();
    const base = publicOrigin(req);
    await adminDb().collection("roamingCommands").doc(rid).set({
      kind: "START_SESSION", partnerId: partner.id, partnerName: partner.businessName,
      locationId, evseUid: evseUid ?? null, idToken, result: "PENDING",
      createdAt: new Date(), createdBy: caller.uid,
    });

    const sync = await sendStartSessionToPartner(partner, locationId, evseUid, idToken, `${base}/api/ocpi/2.2.1/roaming/callback?rid=${rid}`);
    if (sync.result !== "ACCEPTED") {
      await adminDb().collection("roamingCommands").doc(rid).set({ result: sync.result, resolvedAt: new Date() }, { merge: true });
    }
    return NextResponse.json({ ok: true, rid, syncResult: sync.result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
