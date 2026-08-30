"use client";

import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, VendorRating } from "../types";
import { logActivitySafe } from "./activity";
import { updateVendor } from "./vendors";

export const VENDOR_RATINGS = "vendorRatings";

function mapRating(id: string, data: Record<string, unknown>): VendorRating {
  return { id, ...(data as Omit<VendorRating, "id">) };
}

export function subscribeVendorRatings(vendorId: string, cb: (rows: VendorRating[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), VENDOR_RATINGS), where("vendorId", "==", vendorId)),
    (snap) => cb(
      snap.docs.map((d) => mapRating(d.id, d.data()))
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)),
    ),
    (err) => onError?.(err as Error),
  );
}

/**
 * Records a rating and recomputes the vendor's denormalized average `rating`
 * field (what the vendor list/cards already display) from the full history.
 */
export async function rateVendor(params: {
  vendorId: string;
  vendorName: string;
  projectId?: string | null;
  projectName?: string | null;
  score: number;
  notes?: string;
  existingRatings: VendorRating[];
}, actor: Actor): Promise<void> {
  if (params.score < 1 || params.score > 5) throw new Error("Rating must be between 1 and 5.");

  const ref = doc(collection(getDb(), VENDOR_RATINGS));
  await setDoc(ref, {
    vendorId: params.vendorId,
    vendorName: params.vendorName,
    projectId: params.projectId ?? null,
    projectName: params.projectName ?? null,
    score: params.score,
    notes: params.notes ?? "",
    ratedBy: actor,
    createdAt: serverTimestamp(),
  });

  const scores = [...params.existingRatings.map((r) => r.score), params.score];
  const average = Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10;
  await updateVendor(params.vendorId, { rating: average });

  logActivitySafe({
    entityType: "VENDOR", entityId: params.vendorId, entityLabel: params.vendorName, action: "UPDATE",
    message: `${actor.name} rated ${params.vendorName} ${params.score}/5${params.projectName ? ` on ${params.projectName}` : ""}`, actor,
  });
}
