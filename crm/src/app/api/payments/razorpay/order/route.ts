import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, errorResponse, requireCaller } from "../../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Creates a Razorpay order for a wallet top-up. Needs RAZORPAY_KEY_ID and
 * RAZORPAY_KEY_SECRET set in this app's environment — until they are, this
 * route returns a clear 503 rather than a confusing SDK error. Once set,
 * this endpoint + /verify (which checks the payment signature) are a
 * complete, working Razorpay integration — nothing else to wire up.
 */

const Body = z.object({
  ownerType: z.enum(["EMSP_USER", "CORPORATE_ACCOUNT"]),
  ownerId: z.string().min(1),
  amountInr: z.number().positive().max(500000),
});

function razorpay(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new ApiError(
      "Razorpay isn't configured yet — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in this app's environment " +
        "(Firebase App Hosting → your backend → Environment variables) to enable wallet top-ups.",
      503,
    );
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function POST(req: Request) {
  try {
    await requireCaller(req, "OPERATIONS");
    const body = Body.parse(await req.json());

    const client = razorpay();
    const order = await client.orders.create({
      amount: Math.round(body.amountInr * 100), // paise
      currency: "INR",
      notes: { ownerType: body.ownerType, ownerId: body.ownerId },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
