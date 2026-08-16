"use client";

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
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

export type ZoneDraft = Pick<Zone, "name" | "maxLoadKw" | "siteType" | "address" | "discomName" | "slaHours" | "revenueSharePct">;

export async function createZone(draft: ZoneDraft, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), ZONES), {
    ...draft, createdAt: serverTimestamp(), createdBy: actor,
  });
  return ref.id;
}

export async function updateZone(id: string, draft: ZoneDraft): Promise<void> {
  await updateDoc(doc(getDb(), ZONES, id), { ...draft });
}

export async function deleteZone(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), ZONES, id));
}
