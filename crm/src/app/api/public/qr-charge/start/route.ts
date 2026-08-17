import { createHmac, randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { sendOcppCommand } from "@/lib/ocpp/send-command.server";
import { ApiError, errorResponse } from "@/app/api/_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifies the Razorpay payment exactly like the wallet top-up /verify
 * route does (HMAC-SHA256 of "order_id|payment_id"), then — instead of
 * crediting a wallet — mints a one-time RFID token scoped to just this
 * charger (activationScope CHARGER, see rfid.ts's checkIdToken on the
 * ocpp-server side) and sends RequestStartTransaction directly. No account,
 * no app: the phone number is only for the receipt.
 */

const Body = z.object({
  chargerId: z.string().min(1),
  evseId: z.number().int().positive().optional(),
  phone: z.string().min(10).max(15),
  amountInr: z.number().min(10).max(2000),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new ApiError("Payments are not configured on this server.", 503);

    const expected = createHmac("sha256", keySecret)
      .update(`${body.razorpayOrderId}|${body.razorpayPaymentId}`)
      .digest("hex");
    if (expected !== body.razorpaySignature) {
      throw new ApiError("Payment signature does not match — this payment could not be verified.", 400);
    }

    const db = adminDb();
    const regSnap = await db.collection("chargerRegistry")
      .where("chargerId", "==", body.chargerId).where("active", "==", true).limit(1).get();
    if (regSnap.empty) throw new ApiError("This charger isn't registered or is inactive.", 404);

    const pointSnap = await db.collection("chargePoints").doc(body.chargerId).get();
    if (pointSnap.data()?.status !== "ONLINE") {
      throw new ApiError("This charger is offline right now — your payment was captured, but please contact support for a refund.", 409);
    }

    const idToken = `QR-${randomUUID()}`;
    await db.collection("rfidTokens").doc().set({
      idToken,
      label: `QR ${body.phone}`,
      status: "ACTIVE",
      activationScope: "CHARGER",
      scopeChargerIds: [body.chargerId],
      description: "App-less QR session — one-time token.",
      createdAt: FieldValue.serverTimestamp(),
    });
    await db.collection("qrChargeSessions").doc(idToken).set({
      chargerId: body.chargerId,
      evseId: body.evseId ?? 1,
      phone: body.phone,
      amountInr: body.amountInr,
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      status: "ACTIVE",
      createdAt: FieldValue.serverTimestamp(),
    });

    try {
      await sendOcppCommand(body.chargerId, "RequestStartTransaction", {
        remoteStartId: Date.now(),
        idToken: { idToken, type: "Central" },
        evseId: body.evseId ?? 1,
      });
    } catch (err) {
      await db.collection("qrChargeSessions").doc(idToken).set({ status: "FAILED", failReason: (err as Error).message }, { merge: true });
      throw new ApiError(`Payment captured, but the charger didn't respond: ${(err as Error).message}. Contact support for a refund.`, 502);
    }

    return NextResponse.json({ ok: true, idToken });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
