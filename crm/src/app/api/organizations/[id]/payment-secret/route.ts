import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, requireCaller } from "@/app/api/_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Write-only, by design — this never returns the existing secret back
 * (same "set it, don't display it" pattern the developer API keys page
 * uses). Super Admin only: a white-label tenant's own Razorpay key
 * secret is exactly as sensitive as the platform's own
 * RAZORPAY_KEY_SECRET env var, just per-tenant.
 */

const Body = z.object({
  razorpayKeySecret: z.string().min(1).max(200).nullable(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const caller = await requireCaller(req, "SUPER_ADMIN");
    const { razorpayKeySecret } = Body.parse(await req.json());

    const db = adminDb();
    const orgSnap = await db.collection("organizations").doc(params.id).get();
    if (!orgSnap.exists) return NextResponse.json({ error: "Organisation not found." }, { status: 404 });

    if (razorpayKeySecret === null) {
      await db.collection("organizationPaymentSecrets").doc(params.id).delete();
    } else {
      await db.collection("organizationPaymentSecrets").doc(params.id).set({
        razorpayKeySecret, updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
