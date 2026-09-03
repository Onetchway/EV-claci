import { NextResponse } from "next/server";
import { z } from "zod";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unauthenticated, like the rest of api/public/qr-charge/* — a QR user has
 * no Firebase session. Not open to anyone who just knows a chargerId
 * though: a review must name a real qrChargeSessions doc (the idToken the
 * charging page already has once its own session ends) that actually
 * belongs to that charger, so this can't be spammed against a charger the
 * caller never used. One review per session — the session id is also the
 * review doc id, so a second POST just overwrites the first rather than
 * padding the count.
 */
const Body = z.object({
  chargerId: z.string().min(1),
  sessionId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { chargerId, sessionId, rating, comment } = parsed.data;

  const db = adminDb();
  const qrSnap = await db.collection("qrChargeSessions").doc(sessionId).get();
  if (!qrSnap.exists || qrSnap.data()?.chargerId !== chargerId) {
    return NextResponse.json({ error: "No matching charging session found — reviews are only accepted for a session you actually started." }, { status: 403 });
  }

  await db.collection("chargerReviews").doc(sessionId).set({
    chargerId,
    sessionId,
    rating,
    comment: comment?.trim() || null,
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
