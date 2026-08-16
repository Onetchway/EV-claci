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

  await db().runTransaction(async (tx) => {
    const ownerSnap = await tx.get(ownerRef);
    if (!ownerSnap.exists) return;
    const current = (ownerSnap.data()?.walletBalanceInr as number | undefined) ?? 0;
    if (ownerType === "CORPORATE_ACCOUNT") ownerName = (ownerSnap.data()?.name as string | undefined) ?? ownerName;
    tx.update(ownerRef, { walletBalanceInr: current - totalCostInr });
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

  return { ownerType, ownerId, ownerName };
}
