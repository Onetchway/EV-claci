import "server-only";

import Razorpay from "razorpay";

import { ApiError } from "@/app/api/_lib/guard";

/** Shared by the order/verify/refund routes — one place for the "not configured yet" message. */
export function getRazorpayClient(): Razorpay {
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
