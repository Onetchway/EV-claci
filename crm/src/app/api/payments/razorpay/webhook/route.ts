import { createHmac, timingSafeEqual } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { dispatchWebhookSafe } from "@/lib/webhooks.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Razorpay webhook — the only way this app can ever observe a payment that
 * failed at checkout, since a failed payment never calls the client-side
 * success handler and so never reaches /verify. Logs `failedPayments` on
 * `payment.failed` so Finance can see attempted-but-lost revenue, not just
 * successful top-ups.
 *
 * Configure this URL (…/api/payments/razorpay/webhook) with the
 * "payment.failed" event in the Razorpay dashboard, and set
 * RAZORPAY_WEBHOOK_SECRET to the secret shown there — deliberately a
 * separate secret from RAZORPAY_KEY_SECRET, matching Razorpay's own model.
 */

export async function POST(req: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "RAZORPAY_WEBHOOK_SECRET is not configured." }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

  const sigBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  const valid = sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  if (!valid) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (payload.event === "payment.failed") {
    const entity = (payload.payload as { payment?: { entity?: Record<string, unknown> } } | undefined)
      ?.payment?.entity ?? {};
    const amountInr = typeof entity.amount === "number" ? entity.amount / 100 : 0;
    await adminDb().collection("failedPayments").add({
      razorpayOrderId: (entity.order_id as string | undefined) ?? null,
      razorpayPaymentId: (entity.id as string | undefined) ?? null,
      amountInr,
      errorCode: (entity.error_code as string | undefined) ?? null,
      errorDescription: (entity.error_description as string | undefined) ?? null,
      contact: (entity.contact as string | undefined) ?? null,
      email: (entity.email as string | undefined) ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
    dispatchWebhookSafe("payment.failed", {
      razorpayOrderId: (entity.order_id as string | undefined) ?? null,
      razorpayPaymentId: (entity.id as string | undefined) ?? null,
      amountInr,
      errorCode: (entity.error_code as string | undefined) ?? null,
      errorDescription: (entity.error_description as string | undefined) ?? null,
    });
  }

  return NextResponse.json({ ok: true });
}
