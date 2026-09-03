"use client";

/**
 * Site revenue-share ledger — written by ocpp-server at session-bill time
 * (see accrueSiteRevenueShare in ocpp-server/src/revenue-share.ts). This
 * module only reads it and moves an entry PENDING → PAID; the amount owed
 * is never computed or edited from the CRM.
 */

import {
  collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, writeBatch,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { SiteRevenueShare } from "../types";

export const SITE_REVENUE_SHARES = "siteRevenueShares";

function mapShare(id: string, data: Record<string, unknown>): SiteRevenueShare {
  return { id, ...(data as Omit<SiteRevenueShare, "id">) };
}

export function subscribeSiteRevenueShares(
  cb: (rows: SiteRevenueShare[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), SITE_REVENUE_SHARES), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapShare(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export async function markRevenueSharePaid(id: string): Promise<void> {
  await updateDoc(doc(getDb(), SITE_REVENUE_SHARES, id), { status: "PAID", paidAt: serverTimestamp() });
}

/** A "monthly settlements" run — marks every given PENDING entry PAID in one batch, instead of one-by-one. Firestore batches cap at 500 writes; callers filter to a manageable set (e.g. one site's pending entries) before calling this. */
export async function markRevenueSharesPaidBatch(ids: string[]): Promise<void> {
  const batch = writeBatch(getDb());
  for (const id of ids) batch.update(doc(getDb(), SITE_REVENUE_SHARES, id), { status: "PAID", paidAt: serverTimestamp() });
  await batch.commit();
}
