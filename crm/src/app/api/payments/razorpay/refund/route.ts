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
    if (txn.refunded) throw new ApiError("This top-up has already been refunded.", 400);
    if (!txn.razorpayPaymentId) throw new ApiError("This top-up has no Razorpay payment to refund.", 400);

    const client = getRazorpayClient();
    const refund = await client.payments.refund(txn.razorpayPaymentId as string, {
      amount: Math.round((txn.amountInr as number) * 100),
    });

    const ownerCollection = txn.ownerType === "EMSP_USER" ? "emspUsers" : "corporateAccounts";
    const ownerRef = db.collection(ownerCollection).doc(txn.ownerId as string);

    await db.runTransaction(async (tx) => {
      const ownerSnap = await tx.get(ownerRef);
      if (!ownerSnap.exists) throw new ApiError("Wallet owner not found.", 404);
      const current = (ownerSnap.data()?.walletBalanceInr as number | undefined) ?? 0;
      tx.update(ownerRef, { walletBalanceInr: current - (txn.amountInr as number) });
      tx.update(txnRef, { refunded: true });
      tx.set(db.collection("walletTransactions").doc(), {
        ownerType: txn.ownerType,
        ownerId: txn.ownerId,
        amountInr: txn.amountInr,
        type: "REFUND",
        refundOfId: body.walletTransactionId,
        razorpayPaymentId: txn.razorpayPaymentId,
        razorpayRefundId: refund.id,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: { uid: caller.uid, name: caller.name, role: caller.role },
      });
    });

    return NextResponse.json({ ok: true, refundId: refund.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
