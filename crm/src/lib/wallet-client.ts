"use client";

/** Server-route call for a manual (no real payment) wallet credit — Admin SDK only, see /api/wallet/manual-credit. */

import { getFirebaseAuth } from "./firebase/client";
import type { WalletOwnerType } from "./types";

export async function manualWalletCredit(
  ownerType: WalletOwnerType,
  ownerId: string,
  amountInr: number,
  reason: string,
): Promise<{ ok: true; newBalanceInr: number }> {
  const current = getFirebaseAuth().currentUser;
  if (!current) throw new Error("Your session expired. Sign in again.");
  const token = await current.getIdToken();
  const res = await fetch("/api/wallet/manual-credit", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ ownerType, ownerId, amountInr, reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data;
}
