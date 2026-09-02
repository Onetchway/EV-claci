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
  const connectorEntries = point?.connectors
    ? (Object.entries(point.connectors) as Array<[string, { status?: string }]>)
    : [];
  const connectors = connectorEntries.map(([id, c]) => ({ id, status: c.status ?? "Unavailable" }));
  const available = connectors.some((c) => c.status === "Available");

  const tariff = tariffSnap.docs[0]?.data();

  const reviewSnap = await db.collection("chargerReviews").where("chargerId", "==", chargerId).get();
  const ratings = reviewSnap.docs.map((d) => d.data().rating as number);
  const reviewCount = ratings.length;
  const reviewAverage = reviewCount > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / reviewCount) * 100) / 100 : null;

  // The QR-scan landing page is unauthenticated and shows before any org
  // context exists client-side, so it resolves the owning tenant's own
  // name/logo here (same doc Settings → Company writes to) rather than
  // hardcoding Livanto's branding for every tenant's chargers.
  let companyName: string | null = null;
  let companyLogoUrl: string | null = null;
  if (reg.orgId) {
    const settingsSnap = await db.collection("settings").doc(reg.orgId).get();
    const company = settingsSnap.data()?.company as { shortName?: string; logoUrl?: string } | undefined;
    companyName = company?.shortName?.trim() || null;
    companyLogoUrl = company?.logoUrl?.trim() || null;
  }

  return NextResponse.json({
    companyName,
    companyLogoUrl,
    label: reg.label,
    location: reg.location,
    chargerPowerType: reg.chargerPowerType,
    connectorType: reg.connectorType ?? null,
    powerKw: reg.powerKw ?? null,
    online,
    available,
    // Per-connector live status (e.g. "Connector 1: Available", "Connector
    // 2: Charging") — same detail a driver expects to see before scanning,
    // not just a single yes/no for the whole station.
    connectors,
    estimatedRatePerKwh: tariff?.rate ?? null,
    reviewAverage,
    reviewCount,
  });
}
