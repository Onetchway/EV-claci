import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { errorResponse } from "../../_lib/guard";
import { requireApiKey } from "../_lib/apikey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only recent fault/offline tickets for external integrations (e.g. a
 * partner NOC dashboard). Auth: `Authorization: Bearer <api key>`.
 */
export async function GET(req: Request) {
  try {
    await requireApiKey(req);
    const db = adminDb();

    const snap = await db.collection("tickets").orderBy("createdAt", "desc").limit(100).get();
    const tickets = snap.docs.map((d) => {
      const t = d.data();
      return {
        id: d.id,
        chargePointId: t.chargePointId,
        type: t.type,
        faultClass: t.faultClass ?? null,
        status: t.status,
        description: t.description,
        openedAt: t.openedAt?.toDate?.() ?? null,
        resolvedAt: t.resolvedAt?.toDate?.() ?? null,
        slaDueAt: t.slaDueAt?.toDate?.() ?? null,
      };
    });

    return NextResponse.json({ tickets });
  } catch (err) {
    return errorResponse(err);
  }
}
