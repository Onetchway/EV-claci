import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { getRazorpayClient } from "@/lib/razorpay-admin.server";
import { ApiError, errorResponse } from "@/app/api/_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unauthenticated, like the rest of api/public/qr-charge/* — a QR scanner
 * has no CRM login. Bounded to a walk-up-charging-sized amount (₹10–₹2,000)
 * so this can't be repurposed as a generic anonymous payment-order minter;
 * creating a Razorpay order alone doesn't move money (only a signature-
 * verified /start call after real payment does), same trust boundary any
 * public checkout page relies on.
 */

const Body = z.object({
  chargerId: z.string().min(1),
  amountInr: z.number().min(10).max(2000),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());

    const regSnap = await adminDb().collection("chargerRegistry")
      .where("chargerId", "==", body.chargerId).where("active", "==", true).limit(1).get();
    if (regSnap.empty) throw new ApiError("This charger isn't registered or is inactive.", 404);

    const client = getRazorpayClient();
    const order = await client.orders.create({
      amount: Math.round(body.amountInr * 100),
      currency: "INR",
      notes: { chargerId: body.chargerId, kind: "qr_charge" },
    });

    return NextResponse.json({
      orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
