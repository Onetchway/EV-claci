import { NextResponse } from "next/server";

import { errorResponse, requireCaller } from "@/app/api/_lib/guard";
import { getBillingOverview } from "@/lib/platform-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Settings (where this is surfaced) is already admin-only — see page.tsx's viewerIsAdmin gate — so this matches that rather than opening billing to every team member. */
export async function GET(req: Request) {
  try {
    const caller = await requireCaller(req, "ADMIN");
    const overview = await getBillingOverview(caller.orgId);
    return NextResponse.json({ data: overview });
  } catch (err) {
    return errorResponse(err);
  }
}
