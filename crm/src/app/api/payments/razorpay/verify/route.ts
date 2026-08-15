import { createHmac } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { ApiError, errorResponse, requireCaller } from "../../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifies a completed Razorpay Checkout payment against the signature
 * Razorpay itself computed (HMAC-SHA256 of "order_id|payment_id" using the
 * key secret) — this is what stops a client from just calling this route
 * with a made-up amount and crediting their own wallet. Only after that
 * check passes does the wallet balance actually move.
 */

const Body = z.object({
  ownerType: z.enum(["EMSP_USER", "CORPORATE_ACCOUNT"]),
  ownerId: z.string().min(1),
  amountInr: z.number().positive(),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const caller = await requireCaller(req, "OPERATIONS");
    const body = Body.parse(await req.json());

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new ApiError("RAZORPAY_KEY_SECRET is not configured on this server.", 503);
    }

    const expected = createHmac("sha256", keySecret)
      .update(`${body.razorpayOrderId}|${body.razorpayPaymentId}`)
      .digest("hex");
    if (expected !== body.razorpaySignature) {
      throw new ApiError("Payment signature does not match — this payment could not be verified.", 400);
    }

    const db = adminDb();
    const collectionName = body.ownerType === "EMSP_USER" ? "emspUsers" : "corporateAccounts";
    const ownerRef = db.collection(collectionName).doc(body.ownerId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ownerRef);
      if (!snap.exists) throw new ApiError("Wallet owner not found.", 404);
      const current = (snap.data()?.walletBalanceInr as number | undefined) ?? 0;
      tx.update(ownerRef, { walletBalanceInr: current + body.amountInr });
      tx.set(db.collection("walletTransactions").doc(), {
        ownerType: body.ownerType,
        ownerId: body.ownerId,
        amountInr: body.amountInr,
        type: "TOPUP",
        razorpayOrderId: body.razorpayOrderId,
        razorpayPaymentId: body.razorpayPaymentId,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: { uid: caller.uid, name: caller.name, role: caller.role },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
