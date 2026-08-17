import "server-only";

import Razorpay from "razorpay";

import { ApiError } from "@/app/api/_lib/guard";
import { adminDb } from "./firebase/admin";

/** Shared by the order/verify/refund routes — one place for the "not configured yet" message. Pass an override to use a white-label tenant's own account instead of the platform's. */
export function getRazorpayClient(override?: { keyId: string; keySecret: string }): Razorpay {
  const keyId = override?.keyId ?? process.env.RAZORPAY_KEY_ID;
  const keySecret = override?.keySecret ?? process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new ApiError(
      "Razorpay isn't configured yet — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in this app's environment " +
        "(Firebase App Hosting → your backend → Environment variables) to enable wallet top-ups.",
      503,
      "RAZORPAY_NOT_CONFIGURED",
    );
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

/**
 * Resolves which Razorpay account a wallet top-up should run against: the
 * owner's own tenant account if their org has one configured, otherwise
 * the platform's. Shared by both /order (creates with these keys) and
 * /verify (must check the payment signature with the exact same secret
 * that created the order) — those two MUST agree, so this is the one
 * place either of them is allowed to make that decision.
 */
export async function resolveRazorpayKeysForOwner(
  ownerType: "EMSP_USER" | "CORPORATE_ACCOUNT",
  ownerId: string,
): Promise<{ keyId: string; keySecret: string } | undefined> {
  const db = adminDb();
  const ownerCollection = ownerType === "EMSP_USER" ? "emspUsers" : "corporateAccounts";
  const ownerSnap = await db.collection(ownerCollection).doc(ownerId).get();
  const orgId = ownerSnap.data()?.orgId as string | undefined;
  if (!orgId) return undefined;

  const [orgSnap, secretSnap] = await Promise.all([
    db.collection("organizations").doc(orgId).get(),
    db.collection("organizationPaymentSecrets").doc(orgId).get(),
  ]);
  const keyId = orgSnap.data()?.razorpayKeyId as string | undefined;
  const keySecret = secretSnap.data()?.razorpayKeySecret as string | undefined;
  return keyId && keySecret ? { keyId, keySecret } : undefined;
}
