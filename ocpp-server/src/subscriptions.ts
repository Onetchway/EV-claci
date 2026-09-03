/**
 * Subscription discount + renewal. The plan/subscription records
 * themselves are managed in the CRM (crm/src/lib/db/subscriptions.ts) —
 * this module only reads them at bill time to discount a session, and
 * periodically re-debits the wallet for a subscription past its renewsAt
 * date (see sweepSubscriptionRenewals, run on an interval from index.ts).
 */

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { db } from "./firebase.js";

const RENEWAL_DAYS = 30;

/**
 * Given the id token used to start a session, returns the discount % to
 * apply if that user has an active subscription — null if not, so
 * billSession can leave the tariff cost untouched.
 */
export async function subscriptionDiscountFor(idToken: string | null | undefined): Promise<number | null> {
  if (!idToken) return null;

  const tokenSnap = await db().collection("rfidTokens").where("idToken", "==", idToken).limit(1).get();
  if (tokenSnap.empty) return null;
  const tokenId = tokenSnap.docs[0]!.id;

  const userSnap = await db().collection("emspUsers").where("rfidTokenId", "==", tokenId).limit(1).get();
  if (userSnap.empty) return null;

  const subSnap = await db()
    .collection("userSubscriptions")
    .where("emspUserId", "==", userSnap.docs[0]!.id)
    .where("status", "==", "ACTIVE")
    .limit(1)
    .get();
  if (subSnap.empty) return null;

  const discountPct = subSnap.docs[0]!.data().discountPct as number | undefined;
  return discountPct && discountPct > 0 ? discountPct : null;
}

/**
 * Runs periodically: any ACTIVE subscription whose renewsAt has passed gets
 * re-debited (allowed to go negative — same postpaid stance as session
 * billing) and pushed forward another 30 days. Never auto-cancels on
 * non-payment; that's a business decision for staff to make in the CRM.
 */
export async function sweepSubscriptionRenewals(): Promise<void> {
  const now = Timestamp.now();
  const due = await db()
    .collection("userSubscriptions")
    .where("status", "==", "ACTIVE")
    .where("renewsAt", "<=", now)
    .get();

  for (const subDoc of due.docs) {
    const sub = subDoc.data();
    const emspUserId = sub.emspUserId as string;
    const monthlyPriceInr = sub.monthlyPriceInr as number;

    const userRef = db().collection("emspUsers").doc(emspUserId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) continue;
    const current = (userSnap.data()?.walletBalanceInr as number | undefined) ?? 0;

    const nextRenewsAt = new Date(Date.now() + RENEWAL_DAYS * 24 * 60 * 60 * 1000);

    await db().runTransaction(async (tx) => {
      tx.update(userRef, { walletBalanceInr: current - monthlyPriceInr });
      tx.set(db().collection("walletTransactions").doc(), {
        ownerType: "EMSP_USER",
        ownerId: emspUserId,
        emspUserId,
        amountInr: monthlyPriceInr,
        type: "DEBIT",
        note: `Subscription renewal: ${sub.planName as string}`,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(subDoc.ref, { renewsAt: nextRenewsAt });
    });
  }
}
