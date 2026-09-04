"use client";

/**
 * Expense claims — an employee groups line items (travel, hotel, daily
 * allowance, other) into one claim, submits it, and it moves through a
 * fixed two-stage approval: manager, then finance. Only ever editable or
 * deletable by its owner while still DRAFT — once submitted it's frozen
 * except for the two decisions being recorded on it.
 */

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp,
  Timestamp, updateDoc, where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";

import type { ExpenseCategory, ExpenseClaimStatus } from "../constants";
import { AUTO_CALC_CATEGORIES } from "../constants";
import { getBucket, getDb } from "../firebase/client";
import { getCurrentTenantId } from "../tenant";
import type { Actor, ExpenseClaim, ExpenseItem, ExpenseRates } from "../types";
import { MAX_UPLOAD_BYTES } from "./documents";
import { logChangeSafe } from "./change-log";

export const EXPENSE_CLAIMS = "expenseClaims";

function mapClaim(id: string, data: Record<string, unknown>): ExpenseClaim {
  return { id, ...(data as Omit<ExpenseClaim, "id">) };
}

async function nextClaimNo(): Promise<string> {
  const db = getDb();
  const ref = doc(db, "counters", "expenseClaims");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = ((snap.data()?.value as number) ?? 0) + 1;
    tx.set(ref, { value: next }, { merge: true });
    return `LG-EX-${String(next).padStart(6, "0")}`;
  });
}

/** km x rate for travel, the flat rate itself for Daily Allowance, or the manually typed amount for Hotel/Other. */
export function computeItemAmount(category: ExpenseCategory, km: number | undefined, rate: number | undefined, manualAmount: number): number {
  if (!AUTO_CALC_CATEGORIES.includes(category)) return manualAmount;
  if (category === "DAILY_ALLOWANCE") return rate ?? 0;
  return Math.round((km ?? 0) * (rate ?? 0));
}

/** The rate an item of this category should snapshot right now, from Settings → Expense. */
export function rateFor(category: ExpenseCategory, rates: ExpenseRates): number | undefined {
  if (category === "TRAVEL_BIKE") return rates.bikeRatePerKm;
  if (category === "TRAVEL_CAR") return rates.carRatePerKm;
  if (category === "DAILY_ALLOWANCE") return rates.dailyAllowanceRate;
  return undefined;
}

export interface ExpenseItemDraft {
  category: ExpenseCategory;
  date: Date;
  description?: string;
  km?: number;
  rate?: number;
  amount: number;
  receiptUrl?: string | null;
  receiptName?: string | null;
}

function draftItem(it: ExpenseItemDraft): ExpenseItem {
  return {
    id: crypto.randomUUID(),
    category: it.category,
    date: Timestamp.fromDate(it.date),
    description: it.description ?? "",
    km: it.km,
    rate: it.rate,
    amount: it.amount,
    receiptUrl: it.receiptUrl ?? null,
    receiptName: it.receiptName ?? null,
  };
}

function monthOf(items: ExpenseItemDraft[]): string {
  const dates = items.map((it) => it.date).sort((a, b) => a.getTime() - b.getTime());
  const d = dates[0] ?? new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function createClaim(uid: string, userName: string, title: string, items: ExpenseItemDraft[], actor: Actor): Promise<{ id: string }> {
  const claimNo = await nextClaimNo();
  const orgId = await getCurrentTenantId();
  const totalAmount = items.reduce((s, it) => s + it.amount, 0);
  const docRef = await addDoc(collection(getDb(), EXPENSE_CLAIMS), {
    claimNo, uid, userName, orgId,
    managerId: null,
    month: monthOf(items),
    title,
    items: items.map(draftItem),
    totalAmount,
    status: "DRAFT" as ExpenseClaimStatus,
    managerDecision: null,
    financeDecision: null,
    submittedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  logChangeSafe({ entityType: "EXPENSE_CLAIM", entityId: docRef.id, entityLabel: `${claimNo} — ${title}`, action: "CREATE", actor });
  return { id: docRef.id };
}

/** Only valid while the claim is still DRAFT — enforced by Firestore rules, not just the UI. */
export async function updateClaimItems(claim: ExpenseClaim, title: string, items: ExpenseItemDraft[], actor: Actor): Promise<void> {
  const totalAmount = items.reduce((s, it) => s + it.amount, 0);
  await updateDoc(doc(getDb(), EXPENSE_CLAIMS, claim.id), {
    title, items: items.map(draftItem), totalAmount, month: monthOf(items), updatedAt: serverTimestamp(),
  });
  logChangeSafe({ entityType: "EXPENSE_CLAIM", entityId: claim.id, entityLabel: `${claim.claimNo} — ${title}`, action: "UPDATE", actor });
}

export async function deleteClaim(claim: ExpenseClaim): Promise<void> {
  await deleteDoc(doc(getDb(), EXPENSE_CLAIMS, claim.id));
}

/** DRAFT -> SUBMITTED. Snapshots the employee's current manager so a later reporting-line change never reroutes it. */
export async function submitClaim(claim: ExpenseClaim, managerId: string | null, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), EXPENSE_CLAIMS, claim.id), {
    status: "SUBMITTED" as ExpenseClaimStatus,
    managerId,
    managerDecision: { status: "PENDING" },
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  logChangeSafe({
    entityType: "EXPENSE_CLAIM", entityId: claim.id, entityLabel: claim.claimNo, action: "UPDATE", actor,
    changes: [{ field: "status", from: "DRAFT", to: "SUBMITTED" }],
  });
}

export async function decideManager(claim: ExpenseClaim, approve: boolean, actor: Actor, note?: string): Promise<void> {
  const status: ExpenseClaimStatus = approve ? "MANAGER_APPROVED" : "REJECTED";
  await updateDoc(doc(getDb(), EXPENSE_CLAIMS, claim.id), {
    status,
    managerDecision: { status: approve ? "APPROVED" : "REJECTED", by: actor, at: serverTimestamp(), note: note ?? "" },
    financeDecision: approve ? { status: "PENDING" } : null,
    updatedAt: serverTimestamp(),
  });
  logChangeSafe({
    entityType: "EXPENSE_CLAIM", entityId: claim.id, entityLabel: claim.claimNo, action: "UPDATE", actor,
    changes: [{ field: "status", from: claim.status, to: status }],
  });
}

export async function decideFinance(claim: ExpenseClaim, approve: boolean, actor: Actor, note?: string): Promise<void> {
  const status: ExpenseClaimStatus = approve ? "FINANCE_APPROVED" : "REJECTED";
  await updateDoc(doc(getDb(), EXPENSE_CLAIMS, claim.id), {
    status,
    financeDecision: { status: approve ? "APPROVED" : "REJECTED", by: actor, at: serverTimestamp(), note: note ?? "" },
    updatedAt: serverTimestamp(),
  });
  logChangeSafe({
    entityType: "EXPENSE_CLAIM", entityId: claim.id, entityLabel: claim.claimNo, action: "UPDATE", actor,
    changes: [{ field: "status", from: claim.status, to: status }],
  });
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

const ACCEPTED_RECEIPT_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic"];

export function validateReceiptFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return "File is larger than 15 MB.";
  if (file.size === 0) return "File is empty.";
  if (!ACCEPTED_RECEIPT_TYPES.includes(file.type)) return "Only PDF, JPG, PNG, WEBP or HEIC files are accepted.";
  return null;
}

/** Uploaded under a temp claim id before the claim itself exists yet (a new claim's items are drafted client-side first) — storagePath just needs to be unique, not tied to a real claim doc. */
export async function uploadReceipt(
  claimKey: string, file: File, actor: Actor, onProgress?: (pct: number) => void,
): Promise<{ url: string; name: string }> {
  const problem = validateReceiptFile(file);
  if (problem) throw new Error(problem);

  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-120);
  const storagePath = `expenses/${claimKey}/${Date.now()}_${safeName}`;
  const storageRef = ref(getBucket(), storagePath);

  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: { uploadedBy: actor.uid },
  });
  await new Promise<void>((resolve, reject) => {
    task.on("state_changed", (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)), reject, () => resolve());
  });

  const url = await getDownloadURL(storageRef);
  return { url, name: file.name };
}

export async function deleteReceiptByUrl(url: string): Promise<void> {
  try {
    await deleteObject(ref(getBucket(), url));
  } catch {
    /* best-effort — an already-gone or externally-hosted file shouldn't block removing it from the item */
  }
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export function subscribeClaim(id: string, cb: (row: ExpenseClaim | null) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    doc(getDb(), EXPENSE_CLAIMS, id),
    (snap) => cb(snap.exists() ? mapClaim(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export function subscribeMyClaims(uid: string, cb: (rows: ExpenseClaim[]) => void, onError?: (e: Error) => void): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      query(collection(getDb(), EXPENSE_CLAIMS), where("orgId", "==", orgId), where("uid", "==", uid), orderBy("createdAt", "desc")),
      (snap) => cb(snap.docs.map((d) => mapClaim(d.id, d.data()))),
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}

/** Every claim in the org — used for the manager/finance approval queues (filtered client-side by status/managerId) and the employee-wise/team-wise monthly reports. */
export function subscribeAllClaims(cb: (rows: ExpenseClaim[]) => void, onError?: (e: Error) => void): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      query(collection(getDb(), EXPENSE_CLAIMS), where("orgId", "==", orgId), orderBy("createdAt", "desc")),
      (snap) => cb(snap.docs.map((d) => mapClaim(d.id, d.data()))),
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}
