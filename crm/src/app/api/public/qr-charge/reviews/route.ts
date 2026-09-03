import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public — same landing page that shows "Scan, Pay, Charge" also shows the
 * charger's rating before anyone commits to using it, same as any
 * consumer charging app. Aggregated on read rather than kept as a running
 * counter on the charger doc: review volume per charger is small enough
 * (hundreds, not millions) that this stays cheap, and it avoids a second
 * place the count/average could drift out of sync.
 */
export async function GET(req: Request) {
  const chargerId = new URL(req.url).searchParams.get("chargerId");
  if (!chargerId) return NextResponse.json({ error: "Missing chargerId." }, { status: 400 });

  const snap = await adminDb().collection("chargerReviews")
    .where("chargerId", "==", chargerId).orderBy("createdAt", "desc").limit(200).get();

  const ratings = snap.docs.map((d) => d.data().rating as number);
  const count = ratings.length;
  const average = count > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / count) * 100) / 100 : null;

  const recent = snap.docs.slice(0, 10).map((d) => {
    const r = d.data();
    return { rating: r.rating as number, comment: (r.comment as string | null) ?? null, createdAt: r.createdAt?.toDate?.()?.toISOString?.() ?? null };
  });

  return NextResponse.json({ average, count, recent });
}
