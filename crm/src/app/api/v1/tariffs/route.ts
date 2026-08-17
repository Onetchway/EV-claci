import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { errorResponse } from "../../_lib/guard";
import { requireApiKey } from "../_lib/apikey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only active tariffs for external integrations (e.g. a partner app
 * showing a driver the rate before they plug in). Auth: `Authorization:
 * Bearer <api key>`, same as /api/v1/chargers.
 */
export async function GET(req: Request) {
  let finish: ((status: number) => void) | undefined;
  try {
    ({ finish } = await requireApiKey(req));
    const db = adminDb();

    const snap = await db.collection("tariffs").where("active", "==", true).get();
    const tariffs = snap.docs.map((d) => {
      const t = d.data();
      return {
        id: d.id,
        name: t.name,
        scope: t.scope,
        pricingType: t.pricingType,
        rate: t.rate,
        gstPct: t.gstPct,
        platformFeeInr: t.platformFeeInr ?? 0,
        idleFeeInrPerMin: t.idleFeeInrPerMin ?? 0,
        idleGraceMinutes: t.idleGraceMinutes ?? 0,
        parkingFeeInr: t.parkingFeeInr ?? 0,
        priority: t.priority ?? 0,
      };
    });

    finish?.(200);
    return NextResponse.json({ tariffs });
  } catch (err) {
    const res = errorResponse(err);
    finish?.(res.status);
    return res;
  }
}
