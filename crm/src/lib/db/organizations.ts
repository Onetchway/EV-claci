"use client";

/**
 * White-label tenant registry — see types.ts's Organization comment for
 * what this is and, importantly, what it isn't yet (no data isolation).
 */

import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
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

export type OrganizationDraft = Pick<Organization, "name" | "slug" | "logoUrl" | "primaryColorHex" | "customDomain" | "acLicenseTotal" | "dcLicenseTotal" | "razorpayKeyId">;

// Path-based tenant resolution (app.alpha.com/{slug} — see
// src/middleware.ts) — reads the org whose slug matches the current URL's
// tenant segment, so the app can validate the slug and, for a user
// creation flow, scope the new account's orgId claim to it.
export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const snap = await getDocs(query(collection(getDb(), ORGANIZATIONS), where("slug", "==", slug)));
  return snap.empty ? null : mapOrg(snap.docs[0].id, snap.docs[0].data());
}

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
