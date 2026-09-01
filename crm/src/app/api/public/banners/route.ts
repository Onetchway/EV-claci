import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unauthenticated — any driver-facing surface can read this without a
 * login (there's no mobile app yet; the app-less QR charging page is the
 * one that currently does). Returns the single most-recently-created
 * active banner campaign whose start/end window (if set) covers now, or
 * null if none applies — deliberately just one, not a carousel, since
 * there's no surface built to rotate through several yet.
 */
export async function GET() {
  const now = new Date();
  const snap = await adminDb().collection("campaigns")
    .where("active", "==", true).where("showAsBanner", "==", true)
    .orderBy("createdAt", "desc").limit(20).get();

  for (const doc of snap.docs) {
    const c = doc.data();
    const startAt = c.startAt?.toDate?.() as Date | undefined;
    const endAt = c.endAt?.toDate?.() as Date | undefined;
    if (startAt && startAt > now) continue;
    if (endAt && endAt < now) continue;
    return NextResponse.json({
      banner: { message: c.message, imageUrl: c.bannerImageUrl ?? null, linkUrl: c.bannerLinkUrl ?? null },
    });
  }
  return NextResponse.json({ banner: null });
}
