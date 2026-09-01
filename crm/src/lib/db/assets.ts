"use client";

/**
 * Asset register — chargers and equipment tracked from procurement through
 * their depreciable life. A purchase order's line items can be registered as
 * assets once received, but an asset can also be added standalone (e.g. an
 * asset acquired before this system existed).
 */

import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  Timestamp, updateDoc, where,
} from "firebase/firestore";

import type { AssetCategory, AssetStatus, DepreciationMethod } from "../constants";
import { getDb } from "../firebase/client";
import { getCurrentTenantId } from "../tenant";
import type { Actor, Asset } from "../types";

export const ASSETS = "assets";

function mapAsset(id: string, data: Record<string, unknown>): Asset {
  return { id, ...(data as Omit<Asset, "id">) };
}

async function nextAssetTag(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "assets");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return `LG-AS-${String(next).padStart(6, "0")}`;
  });
}

export interface AssetDraft {
  name: string;
  category: AssetCategory;
  serialNumber?: string;
  cost: number;
  purchaseDate: Date;
  method: DepreciationMethod;
  usefulLifeYears?: number;
  wdvRatePct?: number;
  salvageValue?: number;
  vendorId?: string | null;
  vendorName?: string | null;
  poId?: string | null;
  poNumber?: string | null;
  linkedProjectId?: string | null;
  linkedProjectCode?: string | null;
  warrantyUntil?: Date | null;
  notes?: string;
}

export async function createAsset(draft: AssetDraft, actor: Actor): Promise<{ id: string; assetTag: string }> {
  const assetTag = await nextAssetTag();
  const orgId = await getCurrentTenantId();
  const ref = doc(collection(getDb(), ASSETS));
  await runTransaction(getDb(), async (tx) => {
    tx.set(ref, {
      assetTag,
      orgId,
      name: draft.name,
      category: draft.category,
      serialNumber: draft.serialNumber ?? "",
      status: "IN_SERVICE" as AssetStatus,
      cost: Math.max(0, Math.round(draft.cost)),
      purchaseDate: Timestamp.fromDate(draft.purchaseDate),
      method: draft.method,
      usefulLifeYears: draft.usefulLifeYears ?? 5,
      wdvRatePct: draft.wdvRatePct ?? 15,
      salvageValue: Math.max(0, Math.round(draft.salvageValue ?? 0)),
      vendorId: draft.vendorId ?? null,
      vendorName: draft.vendorName ?? null,
      poId: draft.poId ?? null,
      poNumber: draft.poNumber ?? null,
      linkedProjectId: draft.linkedProjectId ?? null,
      linkedProjectCode: draft.linkedProjectCode ?? null,
      warrantyUntil: draft.warrantyUntil ? Timestamp.fromDate(draft.warrantyUntil) : null,
      notes: draft.notes ?? "",
      createdAt: serverTimestamp(),
      createdBy: actor,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    });
  });
  return { id: ref.id, assetTag };
}

export async function updateAsset(
  id: string,
  patch: Partial<AssetDraft> & { status?: AssetStatus },
  actor: Actor,
): Promise<void> {
  const update: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp(), updatedBy: actor };
  if (patch.purchaseDate) update.purchaseDate = Timestamp.fromDate(patch.purchaseDate);
  if (patch.warrantyUntil !== undefined) {
    update.warrantyUntil = patch.warrantyUntil ? Timestamp.fromDate(patch.warrantyUntil) : null;
  }
  await updateDoc(doc(getDb(), ASSETS, id), update);
}

/** Moves an asset to Trash — hidden from normal views, recoverable until permanently deleted. */
export async function trashAsset(asset: Asset, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), ASSETS, asset.id), {
    deletedAt: serverTimestamp(),
    deletedBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

export async function restoreAsset(asset: Asset, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), ASSETS, asset.id), {
    deletedAt: null,
    deletedBy: null,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

/** Super-admin only, from the Trash page. */
export async function deleteAsset(asset: Asset): Promise<void> {
  await deleteDoc(doc(getDb(), ASSETS, asset.id));
}

export function subscribeAssets(
  cb: (rows: Asset[]) => void,
  onError?: (e: Error) => void,
  opts?: { includeTrashed?: boolean },
): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      query(collection(getDb(), ASSETS), where("orgId", "==", orgId), orderBy("createdAt", "desc")),
      (snap) => {
        const rows = snap.docs.map((d) => mapAsset(d.id, d.data()));
        cb(rows.filter((a) => (opts?.includeTrashed ? !!a.deletedAt : !a.deletedAt)));
      },
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}

export function subscribeAsset(
  id: string,
  cb: (row: Asset | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), ASSETS, id),
    (snap) => cb(snap.exists() ? mapAsset(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}
