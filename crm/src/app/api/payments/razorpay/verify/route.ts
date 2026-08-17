import { createHmac } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { dispatchWebhookSafe } from "@/lib/webhooks.server";
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
  /** Optional promo code — validated and redeemed here, never trusted from the client beyond the code string itself. */
  couponCode: z.string().max(40).optional(),
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

    let bonusInr = 0;
    let newBalanceInr = 0;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ownerRef);
      if (!snap.exists) throw new ApiError("Wallet owner not found.", 404);

      let couponRef: FirebaseFirestore.DocumentReference | null = null;
      let couponUsedCount = 0;
      if (body.couponCode) {
        const couponQuery = await tx.get(
          db.collection("coupons").where("code", "==", body.couponCode.trim().toUpperCase()).limit(1),
        );
        if (couponQuery.empty) throw new ApiError(`Coupon "${body.couponCode}" not found.`, 400);
        const couponDoc = couponQuery.docs[0]!;
        const coupon = couponDoc.data();
        if (!coupon.active) throw new ApiError("This coupon is no longer active.", 400);
        const expiresAt = coupon.expiresAt as FirebaseFirestore.Timestamp | null | undefined;
        if (expiresAt && expiresAt.toMillis() < Date.now()) throw new ApiError("This coupon has expired.", 400);
        couponUsedCount = (coupon.usedCount as number | undefined) ?? 0;
        if (coupon.maxUses && couponUsedCount >= coupon.maxUses) {
          throw new ApiError("This coupon has reached its redemption limit.", 400);
        }
        const restrictedOwnerId = coupon.restrictedToOwnerId as string | null | undefined;
        if (restrictedOwnerId && restrictedOwnerId !== body.ownerId) {
          throw new ApiError("This coupon isn't valid for this account.", 400);
        }
        const restrictedCity = coupon.restrictedToCity as string | null | undefined;
        const restrictedState = coupon.restrictedToState as string | null | undefined;
        if (restrictedCity || restrictedState) {
          // Only an EMSP_USER has a personal registered city/state — a corporate account top-up isn't tied to one person's address.
          const ownerCity = body.ownerType === "EMSP_USER" ? (snap.data()?.city as string | undefined) : undefined;
          const ownerState = body.ownerType === "EMSP_USER" ? (snap.data()?.state as string | undefined) : undefined;
          const cityOk = !restrictedCity || (ownerCity?.trim().toLowerCase() === restrictedCity.trim().toLowerCase());
          const stateOk = !restrictedState || (ownerState?.trim().toLowerCase() === restrictedState.trim().toLowerCase());
          if (!cityOk || !stateOk) {
            throw new ApiError("This coupon isn't valid for your registered location.", 400);
          }
        }
        bonusInr = coupon.type === "PERCENT"
          ? Math.round(body.amountInr * ((coupon.value as number) / 100) * 100) / 100
          : (coupon.value as number);
        couponRef = couponDoc.ref;
      }

      const current = (snap.data()?.walletBalanceInr as number | undefined) ?? 0;
      const credited = body.amountInr + bonusInr;
      newBalanceInr = current + credited;
      tx.update(ownerRef, { walletBalanceInr: newBalanceInr });
      tx.set(db.collection("walletTransactions").doc(), {
        ownerType: body.ownerType,
        ownerId: body.ownerId,
        amountInr: credited,
        type: "TOPUP",
        razorpayOrderId: body.razorpayOrderId,
        razorpayPaymentId: body.razorpayPaymentId,
        ...(body.couponCode && { couponCode: body.couponCode.trim().toUpperCase(), couponBonusInr: bonusInr }),
        createdAt: FieldValue.serverTimestamp(),
        createdBy: { uid: caller.uid, name: caller.name, role: caller.role },
      });
      if (couponRef) tx.update(couponRef, { usedCount: couponUsedCount + 1 });
    });

    dispatchWebhookSafe("payment.success", {
      ownerType: body.ownerType,
      ownerId: body.ownerId,
      amountInr: body.amountInr + bonusInr,
      razorpayPaymentId: body.razorpayPaymentId,
    });

    return NextResponse.json({ ok: true, bonusInr, newBalanceInr });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
