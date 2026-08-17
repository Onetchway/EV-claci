"use client";

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import { logChangeSafe } from "./change-log";
import type { Actor, Zone } from "../types";

export const ZONES = "zones";

function mapZone(id: string, data: Record<string, unknown>): Zone {
  return { id, ...(data as Omit<Zone, "id">) };
}

export function subscribeZones(
  cb: (rows: Zone[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), ZONES), orderBy("name", "asc")),
    (snap) => cb(snap.docs.map((d) => mapZone(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export type ZoneDraft = Pick<Zone,
  "name" | "maxLoadKw" | "siteType" | "address" | "city" | "pincode" | "state" | "pocName" | "pocPhone" |
  "discomName" | "slaHours" | "revenueShareType" | "revenueShareValue" | "revenueShareMinGuaranteeInr" |
  "electricityCostPerKwh" | "revenueShareHybridPct" |
  "additionalRevenueShares" | "ownerUid" |
  "bankAccountNumber" | "bankIfscCode" | "bankAccountName" | "bankName"
>;

export async function createZone(draft: ZoneDraft, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), ZONES), {
    ...draft, createdAt: serverTimestamp(), createdBy: actor,
  });
  logChangeSafe({ entityType: "ZONE", entityId: ref.id, entityLabel: draft.name, action: "CREATE", actor });
  return ref.id;
}

export async function updateZone(id: string, draft: ZoneDraft, actor?: Actor): Promise<void> {
  await updateDoc(doc(getDb(), ZONES, id), { ...draft });
  if (actor) logChangeSafe({ entityType: "ZONE", entityId: id, entityLabel: draft.name, action: "UPDATE", actor });
}

export async function deleteZone(id: string, actor?: Actor, name?: string): Promise<void> {
  await deleteDoc(doc(getDb(), ZONES, id));
  if (actor) logChangeSafe({ entityType: "ZONE", entityId: id, entityLabel: name ?? id, action: "DELETE", actor });
}
