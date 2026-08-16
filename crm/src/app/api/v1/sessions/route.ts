import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { errorResponse } from "../../_lib/guard";
import { requireApiKey } from "../_lib/apikey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only recent charging sessions for external integrations. Auth:
 * `Authorization: Bearer <api key>`, same as /api/v1/chargers.
 */
export async function GET(req: Request) {
  try {
    await requireApiKey(req);
    const db = adminDb();

    const snap = await db.collection("chargeSessions").orderBy("lastUpdateAt", "desc").limit(100).get();
    const sessions = snap.docs.map((d) => {
      const s = d.data();
      return {
        id: d.id,
        chargePointId: s.chargePointId,
        transactionId: s.transactionId,
        status: s.status,
        startedAt: s.startedAt?.toDate?.() ?? null,
        endedAt: s.endedAt?.toDate?.() ?? null,
        energyDeliveredWh: s.energyDeliveredWh ?? null,
        totalCostInr: s.totalCostInr ?? null,
      };
    });

    return NextResponse.json({ sessions });
  } catch (err) {
    return errorResponse(err);
  }
}
