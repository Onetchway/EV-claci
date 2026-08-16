"use client";

/**
 * White-label tenant registry — see types.ts's Organization comment for
 * what this is and, importantly, what it isn't yet (no data isolation).
 */

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, Organization } from "../types";

export const ORGANIZATIONS = "organizations";

function mapOrg(id: string, data: Record<string, unknown>): Organization {
  const d = data as Omit<Organization, "id">;
  return { ...d, id, active: d.active ?? true };
}

export function subscribeOrganization(
  id: string,
  cb: (row: Organization | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), ORGANIZATIONS, id),
    (snap) => cb(snap.exists() ? mapOrg(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export function subscribeOrganizations(
  cb: (rows: Organization[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), ORGANIZATIONS), orderBy("name", "asc")),
    (snap) => cb(snap.docs.map((d) => mapOrg(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export type OrganizationDraft = Pick<Organization, "name" | "logoUrl" | "primaryColorHex" | "customDomain">;

export async function createOrganization(draft: OrganizationDraft, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), ORGANIZATIONS), {
    ...draft, active: true, createdAt: serverTimestamp(), createdBy: actor,
  });
  return ref.id;
}

export async function updateOrganization(id: string, draft: OrganizationDraft): Promise<void> {
  await updateDoc(doc(getDb(), ORGANIZATIONS, id), { ...draft });
}

export async function setOrganizationActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(getDb(), ORGANIZATIONS, id), { active });
}

export async function deleteOrganization(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), ORGANIZATIONS, id));
}
