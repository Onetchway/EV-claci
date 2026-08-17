import { NextResponse } from "next/server";

import { errorResponse, requireCaller, ApiError } from "@/app/api/_lib/guard";
import { getCachedPartnerLocations, getRoamingPartner } from "@/lib/ocpi/roaming-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serves the partner's location list from a short-TTL cache (see getCachedPartnerLocations) rather than hitting their endpoint on every page load — pass ?refresh=1 to force a live re-pull. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireCaller(req, "ADMIN");
    const partner = await getRoamingPartner(params.id);
    if (!partner) throw new ApiError("Roaming partner not found.", 404);
    const force = new URL(req.url).searchParams.get("refresh") === "1";
    const locations = await getCachedPartnerLocations(partner, force);
    return NextResponse.json({ ok: true, locations });
  } catch (err) {
    return errorResponse(err);
  }
}
