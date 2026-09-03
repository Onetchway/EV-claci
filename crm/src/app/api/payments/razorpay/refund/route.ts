import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { getRazorpayClient } from "@/lib/razorpay-admin.server";
import { ApiError, errorResponse, requireCaller } from "../../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Refunds a wallet top-up: calls Razorpay's refund API against the original
 * payment, then claws the credited amount back out of the wallet in the
 * same transaction that logs the REFUND row — so the wallet balance and
 * the Razorpay-side refund can never disagree with each other. Money-
 * sensitive, so gated tighter than a normal top-up (Finance and up, not
 * Operations).
 */

const REFUND_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE"];

const Body = z.object({
  walletTransactionId: z.string().min(1),
  /** Omit for a full refund of whatever remains unrefunded; pass a smaller amount for a partial refund. */
  amountInr: z.number().positive().optional(),
});

export async function POST(req: Request) {
  try {
    const caller = await requireCaller(req, "FINANCE");
    if (!caller.roles.some((r) => REFUND_ROLES.includes(r))) {
      throw new ApiError("You do not have permission to issue refunds.", 403);
    }
    const body = Body.parse(await req.json());

    const db = adminDb();
    const txnRef = db.collection("walletTransactions").doc(body.walletTransactionId);
    const txnSnap = await txnRef.get();
    if (!txnSnap.exists) throw new ApiError("Transaction not found.", 404);
    const txn = txnSnap.data()!;

    if (txn.type !== "TOPUP") throw new ApiError("Only a top-up can be refunded.", 400);
    if (txn.refunded) throw new ApiError("This top-up has already been refunded in full.", 400);
    if (!txn.razorpayPaymentId) throw new ApiError("This top-up has no Razorpay payment to refund.", 400);

    const alreadyRefundedInr = (txn.refundedAmountInr as number | undefined) ?? 0;
    const remainingInr = Math.round(((txn.amountInr as number) - alreadyRefundedInr) * 100) / 100;
    if (remainingInr <= 0) throw new ApiError("This top-up has already been refunded in full.", 400);
    const refundInr = body.amountInr ?? remainingInr;
    if (refundInr > remainingInr) {
      throw new ApiError(`Only ₹${remainingInr} remains available to refund on this top-up.`, 400);
    }

    const client = getRazorpayClient();
    const refund = await client.payments.refund(txn.razorpayPaymentId as string, {
      amount: Math.round(refundInr * 100),
    });

    const ownerCollection = txn.ownerType === "EMSP_USER" ? "emspUsers" : "corporateAccounts";
    const ownerRef = db.collection(ownerCollection).doc(txn.ownerId as string);
    const newRefundedTotal = Math.round((alreadyRefundedInr + refundInr) * 100) / 100;
    const isFullyRefunded = newRefundedTotal >= (txn.amountInr as number);

    await db.runTransaction(async (tx) => {
      const ownerSnap = await tx.get(ownerRef);
      if (!ownerSnap.exists) throw new ApiError("Wallet owner not found.", 404);
      const current = (ownerSnap.data()?.walletBalanceInr as number | undefined) ?? 0;
      tx.update(ownerRef, { walletBalanceInr: current - refundInr });
      tx.update(txnRef, { refunded: isFullyRefunded, refundedAmountInr: newRefundedTotal });
      tx.set(db.collection("walletTransactions").doc(), {
        ownerType: txn.ownerType,
        ownerId: txn.ownerId,
        amountInr: refundInr,
        type: "REFUND",
        refundOfId: body.walletTransactionId,
        razorpayPaymentId: txn.razorpayPaymentId,
        razorpayRefundId: refund.id,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: { uid: caller.uid, name: caller.name, role: caller.role },
      });
    });

    return NextResponse.json({ ok: true, refundId: refund.id, refundedInr: refundInr, fullyRefunded: isFullyRefunded });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
