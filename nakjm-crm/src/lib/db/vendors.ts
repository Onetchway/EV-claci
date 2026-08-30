"use client";

import {
  collection, doc, getDoc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";

import type { VendorCategory } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, Vendor } from "../types";
import { buildSearchTokens } from "../utils";
import { logActivitySafe } from "./activity";

export const VENDORS = "vendors";

function mapVendor(id: string, data: Record<string, unknown>): Vendor {
  return { id, ...(data as Omit<Vendor, "id">) };
}

export interface VendorFilters {
  active?: boolean;
  category?: VendorCategory;
  search?: string;
}

export function applyVendorFilters(rows: Vendor[], f: VendorFilters): Vendor[] {
  const needle = f.search?.trim().toLowerCase();
  return rows.filter((v) => {
    if (f.active !== undefined && v.active !== f.active) return false;
    if (f.category && v.category !== f.category) return false;
    if (needle) {
      const hay = [v.name, v.contactName, v.contactEmail, v.contactPhone].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(needle) && !(v.search ?? []).some((t) => t.startsWith(needle))) return false;
    }
    return true;
  });
}

export function subscribeVendors(
  filters: VendorFilters,
  cb: (rows: Vendor[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), VENDORS), orderBy("createdAt", "desc")),
    (snap) => cb(applyVendorFilters(snap.docs.map((d) => mapVendor(d.id, d.data())), filters)),
    (err) => onError?.(err as Error),
  );
}

export function subscribeVendor(id: string, cb: (v: Vendor | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), VENDORS, id),
    (snap) => cb(snap.exists() ? mapVendor(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export async function getVendor(id: string): Promise<Vendor | null> {
  const snap = await getDoc(doc(getDb(), VENDORS, id));
  return snap.exists() ? mapVendor(snap.id, snap.data()) : null;
}

export async function listActiveVendors(): Promise<Vendor[]> {
  const snap = await getDocs(query(collection(getDb(), VENDORS), where("active", "==", true)));
  return snap.docs.map((d) => mapVendor(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name));
}

export interface VendorDraft {
  name: string;
  category: VendorCategory;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  gstin?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankName?: string;
  rating?: number;
  notes?: string;
}

export async function createVendor(draft: VendorDraft, actor?: Actor): Promise<Vendor> {
  const db = getDb();
  const ref = doc(collection(db, VENDORS));
  const payload = {
    ...draft,
    active: true,
    search: buildSearchTokens(draft.name, draft.contactName, draft.contactEmail, draft.contactPhone),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  if (actor) logActivitySafe({ entityType: "VENDOR", entityId: ref.id, entityLabel: draft.name, action: "CREATE", message: `Added vendor ${draft.name}`, actor });
  return { id: ref.id, ...(payload as unknown as Omit<Vendor, "id">) };
}

export async function updateVendor(id: string, patch: Partial<VendorDraft & { active: boolean }>): Promise<void> {
  const update: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() };
  if (patch.name || patch.contactName || patch.contactEmail || patch.contactPhone) {
    const existing = await getVendor(id);
    update.search = buildSearchTokens(
      patch.name ?? existing?.name,
      patch.contactName ?? existing?.contactName,
      patch.contactEmail ?? existing?.contactEmail,
      patch.contactPhone ?? existing?.contactPhone,
    );
  }
  await updateDoc(doc(getDb(), VENDORS, id), update);
}
