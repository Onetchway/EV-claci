import { NextResponse } from "next/server";

import { errorResponse, requireCaller, ApiError } from "@/app/api/_lib/guard";
import { getRoamingPartner, pullPartnerLocations } from "@/lib/ocpi/roaming-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live-proxies a GET of the partner's own locations list — not synced into our Firestore, so this is always current as of the request rather than a cached copy that can drift. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireCaller(req, "ADMIN");
    const partner = await getRoamingPartner(params.id);
    if (!partner) throw new ApiError("Roaming partner not found.", 404);
    const locations = await pullPartnerLocations(partner);
    return NextResponse.json({ ok: true, locations });
  } catch (err) {
    return errorResponse(err);
  }
}
