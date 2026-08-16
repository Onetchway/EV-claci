"use client";

/**
 * Wallet top-up promo codes. This module only manages the coupon records —
 * redemption (validating + incrementing usedCount) happens server-side in
 * /api/payments/razorpay/verify, inside the same transaction that credits
 * the wallet, so a coupon can never be over-redeemed by a racing client.
 */

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, Coupon } from "../types";

export const COUPONS = "coupons";

function mapCoupon(id: string, data: Record<string, unknown>): Coupon {
  const d = data as Omit<Coupon, "id">;
  return { ...d, id, usedCount: d.usedCount ?? 0 };
}

export function subscribeCoupons(
  cb: (rows: Coupon[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), COUPONS), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapCoupon(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export type CouponDraft = Pick<Coupon, "code" | "type" | "value" | "maxUses" | "restrictedToOwnerType" | "restrictedToOwnerId" | "restrictedToOwnerName"> & { expiresAt?: Date };

export async function createCoupon(draft: CouponDraft, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), COUPONS), {
    ...draft,
    code: draft.code.trim().toUpperCase(),
    active: true,
    usedCount: 0,
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
  return ref.id;
}

export async function updateCoupon(id: string, draft: CouponDraft): Promise<void> {
  await updateDoc(doc(getDb(), COUPONS, id), { ...draft, code: draft.code.trim().toUpperCase() });
}

export async function setCouponActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(getDb(), COUPONS, id), { active });
}

export async function deleteCoupon(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COUPONS, id));
}
