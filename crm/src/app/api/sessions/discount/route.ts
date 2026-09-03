import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { ApiError, errorResponse, requireCaller } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Applies a manual discount to an already-billed session — a goodwill
 * credit, a billing-dispute resolution, etc. Sessions are written only by
 * ocpp-server (Firestore rules: chargeSessions write is `false` for
 * clients), so this has to go through the Admin SDK like the refund route.
 * The original totalCostInr is preserved so the adjustment is always
 * auditable, not just overwritten.
 */

const REVISE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"];

const Body = z.object({
  sessionId: z.string().min(1),
  discountInr: z.number().positive(),
  reason: z.string().min(1).max(300),
});

export async function POST(req: Request) {
  try {
    const caller = await requireCaller(req, "FINANCE");
    if (!caller.roles.some((r) => REVISE_ROLES.includes(r))) {
      throw new ApiError("You do not have permission to adjust session pricing.", 403);
    }
    const body = Body.parse(await req.json());

    const db = adminDb();
    const ref = db.collection("chargeSessions").doc(body.sessionId);
    const snap = await ref.get();
    if (!snap.exists) throw new ApiError("Session not found.", 404);
    const session = snap.data()!;

    if (session.totalCostInr == null) throw new ApiError("This session hasn't been billed yet.", 400);
    const originalCostInr = (session.originalCostInr as number | undefined) ?? (session.totalCostInr as number);
    const newTotal = Math.max(0, Math.round((originalCostInr - body.discountInr) * 100) / 100);

    await ref.set(
      {
        originalCostInr,
        totalCostInr: newTotal,
        manualDiscountInr: Math.round(body.discountInr * 100) / 100,
        manualDiscountReason: body.reason,
        manualDiscountBy: { uid: caller.uid, name: caller.name, role: caller.role },
        manualDiscountAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, totalCostInr: newTotal });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
