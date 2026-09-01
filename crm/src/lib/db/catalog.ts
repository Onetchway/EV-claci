"use client";

/**
 * Chargers added on the Catalogue page beyond the six DC options in
 * src/lib/catalog.ts, which are the verified franchise investment model and
 * stay hardcoded. A custom entry can be AC or DC, priced manually, and
 * becomes selectable in every lead's charger configurator the moment it's
 * saved — useChargerCatalog() keeps src/lib/catalog.ts's runtime registry
 * (setCustomCatalog) in sync so buildQuote() can resolve it from anywhere.
 */

import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";

import type { ChargerSpec } from "../catalog";
import { getDb } from "../firebase/client";
import { getCurrentTenantId } from "../tenant";
import type { Actor } from "../types";

export const CHARGER_CATALOG = "chargerCatalog";

export type CustomChargerDoc = ChargerSpec & { id: string; active: boolean; createdBy?: Actor; createdAt?: unknown };

function mapDoc(id: string, data: Record<string, unknown>): CustomChargerDoc {
  const doc = data as Omit<CustomChargerDoc, "id">;
  return { ...doc, id, active: doc.active ?? true };
}

/**
 * Returns every custom charger, active or not — buildQuote() needs to
 * resolve an archived sku too, or a lead that already used it would
 * silently lose that line from its quote. Callers that populate a picker
 * for NEW quotations should filter to `.active`.
 */
export function subscribeCustomCatalog(
  cb: (rows: CustomChargerDoc[]) => void,
  onError?: (e: Error) => void,
): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      query(collection(getDb(), CHARGER_CATALOG), where("orgId", "==", orgId), orderBy("kw", "asc")),
      (snap) => cb(snap.docs.map((d) => mapDoc(d.id, d.data()))),
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}

export async function addCustomCharger(spec: Omit<ChargerSpec, "sku"> & { sku?: string }, actor: Actor): Promise<void> {
  const sku = spec.sku?.trim() || `CUSTOM-${spec.kw}KW-${Date.now().toString(36).toUpperCase()}`;
  const orgId = await getCurrentTenantId();
  await addDoc(collection(getDb(), CHARGER_CATALOG), {
    ...spec,
    sku,
    orgId,
    active: true,
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
}

export async function updateCustomCharger(id: string, patch: Partial<ChargerSpec>): Promise<void> {
  await updateDoc(doc(getDb(), CHARGER_CATALOG, id), { ...patch });
}

/**
 * Archives rather than deletes — a hard delete would make getSpec() unable
 * to resolve the sku, silently dropping the line from every lead's quote
 * that already used it. Archiving just hides it from the picker for new
 * quotations while historical leads keep resolving correctly.
 */
export async function archiveCustomCharger(id: string): Promise<void> {
  await updateDoc(doc(getDb(), CHARGER_CATALOG, id), { active: false });
}
