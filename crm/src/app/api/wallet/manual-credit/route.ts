import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { ApiError, errorResponse, requireCaller } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Credits a wallet without a real Razorpay payment — a goodwill credit, a
 * refund settled outside the app, a promo not modeled as a coupon. Tightly
 * gated (Super Admin / Admin only) since it moves spendable balance with no
 * money actually received; the reason is mandatory so there's always an
 * audit trail for why free credit was issued.
 */

const CREDIT_ROLES = ["SUPER_ADMIN", "ADMIN"];

const Body = z.object({
  ownerType: z.enum(["EMSP_USER", "CORPORATE_ACCOUNT"]),
  ownerId: z.string().min(1),
  amountInr: z.number().positive(),
  reason: z.string().min(1).max(300),
});

export async function POST(req: Request) {
  try {
    const caller = await requireCaller(req, "ADMIN");
    if (!caller.roles.some((r) => CREDIT_ROLES.includes(r))) {
      throw new ApiError("Manual wallet credit is restricted to Super Admin and Admin.", 403);
    }
    const body = Body.parse(await req.json());

    const db = adminDb();
    const collectionName = body.ownerType === "EMSP_USER" ? "emspUsers" : "corporateAccounts";
    const ownerRef = db.collection(collectionName).doc(body.ownerId);

    let newBalanceInr = 0;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ownerRef);
      if (!snap.exists) throw new ApiError("Wallet owner not found.", 404);
      const current = (snap.data()?.walletBalanceInr as number | undefined) ?? 0;
      newBalanceInr = current + body.amountInr;
      tx.update(ownerRef, { walletBalanceInr: newBalanceInr });
      tx.set(db.collection("walletTransactions").doc(), {
        ownerType: body.ownerType,
        ownerId: body.ownerId,
        amountInr: body.amountInr,
        type: "TOPUP",
        note: `Manual credit: ${body.reason}`,
        manualCredit: true,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: { uid: caller.uid, name: caller.name, role: caller.role },
      });
    });

    return NextResponse.json({ ok: true, newBalanceInr });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
