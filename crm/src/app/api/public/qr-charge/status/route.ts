import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Polled by the public charging page — a QR user has no Firebase Auth
 * session, so the usual client-SDK onSnapshot live-listener pattern this
 * app uses everywhere else isn't available to them (Firestore rules
 * require signedIn()). This proxies just the fields the page needs.
 */
export async function GET(req: Request) {
  const idToken = new URL(req.url).searchParams.get("idToken");
  if (!idToken) return NextResponse.json({ error: "Missing idToken." }, { status: 400 });

  const db = adminDb();
  const qrSnap = await db.collection("qrChargeSessions").doc(idToken).get();
  if (!qrSnap.exists) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  const qr = qrSnap.data()!;

  const sessSnap = await db.collection("chargeSessions")
    .where("chargePointId", "==", qr.chargerId).where("idToken", "==", idToken).limit(1).get();
  const session = sessSnap.docs[0]?.data();

  return NextResponse.json({
    status: qr.status,
    amountInr: qr.amountInr,
    finalCostInr: qr.finalCostInr ?? null,
    sessionStatus: session?.status ?? null,
    energyDeliveredWh: session?.energyDeliveredWh ?? 0,
    startedAt: session?.startedAt?.toDate?.()?.toISOString?.() ?? null,
  });
}
