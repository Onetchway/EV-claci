/**
 * Per-session wallet debit. Runs once a session is billed (see billSession()
 * in registry.ts) and the id token used to start it can be traced to a
 * retail EMSP user or a corporate account. If it can't — an unrecognised or
 * unlinked tag — nothing is debited and the session is left for manual
 * invoicing in the CRM, same as before this existed.
 *
 * The wallet balance is allowed to go negative here (postpaid): capping the
 * debit at the available balance would silently under-bill the session, and
 * refusing to debit at all would hide the cost entirely. A negative balance
 * is a visible signal for Finance to chase, not a bug.
 */

import { FieldValue } from "firebase-admin/firestore";

import { db } from "./firebase.js";

export interface WalletDebitResult {
  ownerType: "EMSP_USER" | "CORPORATE_ACCOUNT";
  ownerId: string;
  ownerName: string;
  newBalanceInr: number;
}

const LOW_BALANCE_THRESHOLD_INR = Number(process.env.LOW_BALANCE_THRESHOLD_INR) || 100;
const APP_URL = process.env.CRM_APP_URL || "https://app.livantogreen.com";

/**
 * Fire-and-forget low-balance alert — writes straight to the `mail`
 * collection the Firebase "Trigger Email" extension watches (same pipeline
 * the CRM's own notifications.ts queueEmailSafe uses client-side). Only
 * fires on the crossing (was above threshold, now at/below it), so a
 * postpaid account that's been negative for a week doesn't get re-emailed
 * on every single session.
 */
async function alertLowBalanceIfCrossed(
  ownerType: "EMSP_USER" | "CORPORATE_ACCOUNT",
  ownerId: string,
  previousBalance: number,
  newBalanceInr: number,
): Promise<void> {
  if (newBalanceInr > LOW_BALANCE_THRESHOLD_INR || previousBalance <= LOW_BALANCE_THRESHOLD_INR) return;
  const collection = ownerType === "CORPORATE_ACCOUNT" ? "corporateAccounts" : "emspUsers";
  const snap = await db().collection(collection).doc(ownerId).get();
  const email = ownerType === "CORPORATE_ACCOUNT"
    ? (snap.data()?.billingEmail as string | undefined)
    : (snap.data()?.email as string | undefined);
  if (!email) return;

  const balanceStr = newBalanceInr.toLocaleString("en-IN");
  await db().collection("mail").add({
    to: [email],
    message: {
      subject: `Low wallet balance — ₹${balanceStr}`,
      html:
        `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.6;max-width:520px">` +
        `<p style="margin:0 0 16px;font-weight:700;font-size:18px;color:#0f766e">Livanto Green</p>` +
        `<p>Hello,</p>` +
        `<p>Your wallet balance is now <strong>₹${balanceStr}</strong>, below the ₹${LOW_BALANCE_THRESHOLD_INR} alert threshold.</p>` +
        `<p>Top up soon to avoid a declined session at the charger.</p>` +
        `<p><a href="${APP_URL}" style="color:#0f766e">Top up now →</a></p>` +
        `<p style="margin:24px 0 0;color:#888;font-size:12px">This is an automated message from Livanto Green. Please don't reply directly to this email.</p>` +
        `</div>`,
    },
    createdAt: FieldValue.serverTimestamp(),
  }).catch((err) => console.error("[wallet] failed to queue low-balance email:", err));
}

export async function debitWalletForSession(
  idToken: string | null | undefined,
  totalCostInr: number,
  sessionId: string,
): Promise<WalletDebitResult | null> {
  if (!idToken || totalCostInr <= 0) return null;

  const tokenSnap = await db().collection("rfidTokens").where("idToken", "==", idToken).limit(1).get();
  if (tokenSnap.empty) return null;
  const tokenId = tokenSnap.docs[0]!.id;

  const userSnap = await db().collection("emspUsers").where("rfidTokenId", "==", tokenId).limit(1).get();
  if (userSnap.empty) return null;
  const userDoc = userSnap.docs[0]!;
  const user = userDoc.data();

  const corporateAccountId = user.corporateAccountId as string | null | undefined;
  const ownerType: "EMSP_USER" | "CORPORATE_ACCOUNT" = corporateAccountId ? "CORPORATE_ACCOUNT" : "EMSP_USER";
  const ownerId = corporateAccountId ?? userDoc.id;
  const ownerCollection = ownerType === "CORPORATE_ACCOUNT" ? "corporateAccounts" : "emspUsers";
  const ownerRef = db().collection(ownerCollection).doc(ownerId);

  let ownerName = user.name as string | undefined ?? "Unknown";
  let previousBalance = 0;
  let newBalanceInr = 0;

  await db().runTransaction(async (tx) => {
    const ownerSnap = await tx.get(ownerRef);
    if (!ownerSnap.exists) return;
    previousBalance = (ownerSnap.data()?.walletBalanceInr as number | undefined) ?? 0;
    newBalanceInr = previousBalance - totalCostInr;
    if (ownerType === "CORPORATE_ACCOUNT") ownerName = (ownerSnap.data()?.name as string | undefined) ?? ownerName;
    tx.update(ownerRef, { walletBalanceInr: newBalanceInr });
    tx.set(db().collection("walletTransactions").doc(), {
      ownerType,
      ownerId,
      amountInr: totalCostInr,
      type: "DEBIT",
      sessionId,
      /** The individual EMSP user who tapped the tag — distinct from ownerId when a corporate wallet is shared, and what per-employee monthly caps are measured against. */
      emspUserId: userDoc.id,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  await alertLowBalanceIfCrossed(ownerType, ownerId, previousBalance, newBalanceInr);

  return { ownerType, ownerId, ownerName, newBalanceInr };
}
