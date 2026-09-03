"use client";

/** Server-route calls for chargeSessions writes — the collection is Admin-SDK-only (Firestore rules: write is `false` for clients), since ocpp-server is its sole normal writer. */

import { getFirebaseAuth } from "./firebase/client";

export async function applySessionDiscount(
  sessionId: string,
  discountInr: number,
  reason: string,
): Promise<{ ok: true; totalCostInr: number }> {
  const current = getFirebaseAuth().currentUser;
  if (!current) throw new Error("Your session expired. Sign in again.");
  const token = await current.getIdToken();
  const res = await fetch("/api/sessions/discount", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionId, discountInr, reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data;
}
