import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { errorResponse } from "../../_lib/guard";
import { requireApiKey } from "../_lib/apikey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only charger list for external integrations: registration details
 * joined with live status, the same join /chargers does client-side.
 * Auth: `Authorization: Bearer <api key>` — issued and revoked from the
 * CRM's Developer page.
 */
export async function GET(req: Request) {
  let finish: ((status: number) => void) | undefined;
  try {
    ({ finish } = await requireApiKey(req));
    const db = adminDb();

    const [registrySnap, pointsSnap] = await Promise.all([
      db.collection("chargerRegistry").where("active", "==", true).get(),
      db.collection("chargePoints").get(),
    ]);
    const pointByChargerId = new Map(pointsSnap.docs.map((d) => [d.data().chargePointId as string, d.data()]));

    const chargers = registrySnap.docs.map((d) => {
      const r = d.data();
      const live = pointByChargerId.get(r.chargerId as string);
      return {
        chargerId: r.chargerId,
        label: r.label,
        location: r.location,
        chargerPowerType: r.chargerPowerType,
        connectorType: r.connectorType ?? null,
        powerKw: r.powerKw ?? null,
        lat: r.lat ?? null,
        lng: r.lng ?? null,
        status: live?.status ?? "OFFLINE",
        firmwareVersion: live?.firmwareVersion ?? null,
      };
    });

    finish?.(200);
    return NextResponse.json({ chargers });
  } catch (err) {
    const res = errorResponse(err);
    finish?.(res.status);
    return res;
  }
}
