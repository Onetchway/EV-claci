"use client";

/**
 * Vendor performance ratings — one immutable rating event per occasion
 * (e.g. after a PO closes out), never edited after creation. The vendor's
 * own avgRating/ratingCount are denormalized in the same transaction that
 * writes the rating, so list views never need a join.
 */

import {
  collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, where,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import { getCurrentTenantId } from "../tenant";
import type { Actor, VendorRating } from "../types";
import { VENDORS } from "./vendors";

export const VENDOR_RATINGS = "vendorRatings";

function mapRating(id: string, data: Record<string, unknown>): VendorRating {
  return { id, ...(data as Omit<VendorRating, "id">) };
}

export interface RateVendorInput {
  vendorId: string;
  rating: number;
  note?: string;
  poId?: string | null;
  poNo?: string | null;
}

export async function rateVendor(input: RateVendorInput, actor: Actor): Promise<void> {
  if (input.rating < 1 || input.rating > 5) throw new Error("Rating must be between 1 and 5.");
  const db = getDb();
  const orgId = await getCurrentTenantId();
  const ratingRef = doc(collection(db, VENDOR_RATINGS));
  const vendorRef = doc(db, VENDORS, input.vendorId);

  await runTransaction(db, async (tx) => {
    const vendorSnap = await tx.get(vendorRef);
    if (!vendorSnap.exists()) throw new Error("Vendor not found.");
    const prevAvg = (vendorSnap.data().avgRating as number) ?? 0;
    const prevCount = (vendorSnap.data().ratingCount as number) ?? 0;
    const nextCount = prevCount + 1;
    const nextAvg = (prevAvg * prevCount + input.rating) / nextCount;

    tx.set(ratingRef, {
      vendorId: input.vendorId,
      rating: input.rating,
      note: input.note ?? "",
      poId: input.poId ?? null,
      poNo: input.poNo ?? null,
      orgId,
      createdAt: serverTimestamp(),
      createdBy: actor,
    });
    tx.update(vendorRef, { avgRating: nextAvg, ratingCount: nextCount, updatedAt: serverTimestamp() });
  });
}

export function subscribeVendorRatings(
  vendorId: string,
  cb: (rows: VendorRating[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), VENDOR_RATINGS), where("vendorId", "==", vendorId), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapRating(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}
