"use client";

/**
 * Vendor master — charger OEMs, EPC contractors, civil/electrical/transport
 * vendors Livanto pays to build a station. Distinct from Channel Partners
 * (db/partners.ts), who Livanto pays for bringing a lead in.
 */

import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  setDoc, updateDoc,
} from "firebase/firestore";

import type { VendorCategory, VendorStatus } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, Vendor } from "../types";

export const VENDORS = "vendors";

function mapVendor(id: string, data: Record<string, unknown>): Vendor {
  return { id, ...(data as Omit<Vendor, "id">) };
}

async function nextVendorCode(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "vendors");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return `LG-VN-${String(next).padStart(4, "0")}`;
  });
}

export interface VendorDraft {
  name: string;
  category: VendorCategory;
  contactName?: string;
  phone: string;
  email?: string;
  address?: string;
  gstin?: string;
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
  paymentTerms?: string;
  notes?: string;
}

export async function createVendor(draft: VendorDraft, actor: Actor): Promise<{ id: string; code: string }> {
  const code = await nextVendorCode();
  const ref = doc(collection(getDb(), VENDORS));
  await setDoc(ref, {
    code,
    name: draft.name,
    category: draft.category,
    contactName: draft.contactName ?? "",
    phone: draft.phone,
    email: draft.email ?? "",
    address: draft.address ?? "",
    gstin: (draft.gstin ?? "").toUpperCase(),
    accountName: draft.accountName ?? "",
    bankName: draft.bankName ?? "",
    accountNumber: draft.accountNumber ?? "",
    ifsc: (draft.ifsc ?? "").toUpperCase(),
    branch: draft.branch ?? "",
    paymentTerms: draft.paymentTerms ?? "",
    notes: draft.notes ?? "",
    status: "ACTIVE" as VendorStatus,
    totalOrdered: 0,
    totalPaid: 0,
    createdAt: serverTimestamp(),
    createdBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
  return { id: ref.id, code };
}

export async function updateVendor(
  id: string,
  patch: Partial<VendorDraft> & { status?: VendorStatus },
  actor: Actor,
): Promise<void> {
  const update: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp(), updatedBy: actor };
  if (patch.gstin !== undefined) update.gstin = patch.gstin.toUpperCase();
  if (patch.ifsc !== undefined) update.ifsc = patch.ifsc.toUpperCase();
  await updateDoc(doc(getDb(), VENDORS, id), update);
}

/** Moves a vendor to Trash — hidden from normal views, recoverable until permanently deleted. */
export async function trashVendor(vendor: Vendor, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), VENDORS, vendor.id), {
    deletedAt: serverTimestamp(),
    deletedBy: actor,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

export async function restoreVendor(vendor: Vendor, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), VENDORS, vendor.id), {
    deletedAt: null,
    deletedBy: null,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
}

/** Super-admin only, from the Trash page. */
export async function deleteVendor(vendor: Vendor): Promise<void> {
  await deleteDoc(doc(getDb(), VENDORS, vendor.id));
}

export function subscribeVendors(
  cb: (rows: Vendor[]) => void,
  onError?: (e: Error) => void,
  opts?: { includeTrashed?: boolean },
): () => void {
  return onSnapshot(
    query(collection(getDb(), VENDORS), orderBy("name", "asc")),
    (snap) => {
      const rows = snap.docs.map((d) => mapVendor(d.id, d.data()));
      cb(rows.filter((v) => (opts?.includeTrashed ? !!v.deletedAt : !v.deletedAt)));
    },
    (err) => onError?.(err as Error),
  );
}

export function subscribeVendor(
  id: string,
  cb: (row: Vendor | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), VENDORS, id),
    (snap) => cb(snap.exists() ? mapVendor(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}
