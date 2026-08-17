import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unauthenticated — this is what a QR scan hits first, before any payment
 * or session exists. Returns just enough to render the "Scan, Pay, Charge"
 * landing screen: whether the charger is real/active/online, and a
 * best-effort rate to show. The real, exact tariff resolution (scope
 * matching, time windows, priority) only happens in ocpp-server at billing
 * time — this is a display estimate, not a quote, and the page says so.
 */
export async function GET(req: Request) {
  const chargerId = new URL(req.url).searchParams.get("chargerId");
  if (!chargerId) return NextResponse.json({ error: "Missing chargerId." }, { status: 400 });

  const db = adminDb();
  const regSnap = await db.collection("chargerRegistry").where("chargerId", "==", chargerId).where("active", "==", true).limit(1).get();
  if (regSnap.empty) return NextResponse.json({ error: "This charger isn't registered or is inactive." }, { status: 404 });
  const reg = regSnap.docs[0]!.data();

  const [pointSnap, tariffSnap] = await Promise.all([
    db.collection("chargePoints").doc(chargerId).get(),
    db.collection("tariffs").where("active", "==", true).where("scope", "==", "ALL_CHARGERS").where("pricingType", "==", "PER_KWH").limit(1).get(),
  ]);
  const point = pointSnap.data();
  const online = point?.status === "ONLINE";
  const connectors = point?.connectors ? (Object.values(point.connectors) as Array<{ status?: string }>) : [];
  const available = connectors.some((c) => c.status === "Available");

  const tariff = tariffSnap.docs[0]?.data();

  return NextResponse.json({
    label: reg.label,
    location: reg.location,
    chargerPowerType: reg.chargerPowerType,
    connectorType: reg.connectorType ?? null,
    powerKw: reg.powerKw ?? null,
    online,
    available,
    estimatedRatePerKwh: tariff?.rate ?? null,
  });
}
