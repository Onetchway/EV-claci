"use client";

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import { getCurrentTenantId } from "../tenant";
import type { Actor, OfficeLocation } from "../types";

export const OFFICE_LOCATIONS = "officeLocations";

function mapOffice(id: string, data: Record<string, unknown>): OfficeLocation {
  return { id, ...(data as Omit<OfficeLocation, "id">) };
}

export interface OfficeLocationDraft {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export async function createOfficeLocation(draft: OfficeLocationDraft, actor: Actor): Promise<string> {
  const orgId = await getCurrentTenantId();
  const ref = await addDoc(collection(getDb(), OFFICE_LOCATIONS), {
    ...draft,
    orgId,
    address: draft.address ?? "",
    active: true,
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
  return ref.id;
}

export async function updateOfficeLocation(
  id: string, patch: Partial<OfficeLocationDraft> & { active?: boolean }, actor: Actor,
): Promise<void> {
  await updateDoc(doc(getDb(), OFFICE_LOCATIONS, id), {
    ...patch,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

export async function deleteOfficeLocation(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), OFFICE_LOCATIONS, id));
}

export function subscribeOfficeLocations(
  cb: (rows: OfficeLocation[]) => void,
  onError?: (e: Error) => void,
): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      query(collection(getDb(), OFFICE_LOCATIONS), where("orgId", "==", orgId), orderBy("name")),
      (snap) => cb(snap.docs.map((d) => mapOffice(d.id, d.data()))),
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}
