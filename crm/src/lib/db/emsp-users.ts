"use client";

/** Driver-facing (EMSP) users and the corporate accounts some of them bill to. */

import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit as fsLimit, onSnapshot, orderBy, query, serverTimestamp,
  updateDoc, where,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, CorporateAccount, EmspUser, WalletOwnerType, WalletTransaction } from "../types";

export const CORPORATE_ACCOUNTS = "corporateAccounts";
export const EMSP_USERS = "emspUsers";
export const WALLET_TRANSACTIONS = "walletTransactions";

function mapAccount(id: string, data: Record<string, unknown>): CorporateAccount {
  return { id, ...(data as Omit<CorporateAccount, "id">) };
}
function mapUser(id: string, data: Record<string, unknown>): EmspUser {
  return { id, ...(data as Omit<EmspUser, "id">) };
}

export function subscribeCorporateAccounts(
  cb: (rows: CorporateAccount[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), CORPORATE_ACCOUNTS), orderBy("name", "asc")),
    (snap) => cb(snap.docs.map((d) => mapAccount(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export async function createCorporateAccount(
  draft: { name: string; gstin?: string; billingEmail?: string },
  actor: Actor,
): Promise<string> {
  const ref = await addDoc(collection(getDb(), CORPORATE_ACCOUNTS), {
    ...draft, createdAt: serverTimestamp(), createdBy: actor,
  });
  return ref.id;
}

export async function updateCorporateAccount(
  id: string,
  draft: { name: string; gstin?: string; billingEmail?: string },
): Promise<void> {
  await updateDoc(doc(getDb(), CORPORATE_ACCOUNTS, id), { ...draft });
}

export async function deleteCorporateAccount(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), CORPORATE_ACCOUNTS, id));
}

export function subscribeEmspUsers(
  cb: (rows: EmspUser[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), EMSP_USERS), orderBy("name", "asc")),
    (snap) => cb(snap.docs.map((d) => mapUser(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export type EmspUserDraft = Omit<EmspUser, "id" | "active" | "createdAt" | "createdBy">;

export async function createEmspUser(draft: EmspUserDraft, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), EMSP_USERS), {
    ...draft, active: true, createdAt: serverTimestamp(), createdBy: actor,
  });
  return ref.id;
}

export async function setEmspUserActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(getDb(), EMSP_USERS, id), { active });
}

export type EmspUserEditDraft = Pick<EmspUser, "name" | "phone" | "email" | "type" | "corporateAccountId">;

export async function updateEmspUser(id: string, draft: EmspUserEditDraft): Promise<void> {
  await updateDoc(doc(getDb(), EMSP_USERS, id), { ...draft });
}

export async function deleteEmspUser(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), EMSP_USERS, id));
}

export async function getEmspUser(id: string): Promise<EmspUser | null> {
  const snap = await getDoc(doc(getDb(), EMSP_USERS, id));
  return snap.exists() ? mapUser(snap.id, snap.data()) : null;
}

export function subscribeEmspUser(
  id: string,
  cb: (row: EmspUser | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), EMSP_USERS, id),
    (snap) => cb(snap.exists() ? mapUser(snap.id, snap.data()) : null),
    (err) => onError?.(err as Error),
  );
}

export async function getCorporateAccount(id: string): Promise<CorporateAccount | null> {
  const snap = await getDoc(doc(getDb(), CORPORATE_ACCOUNTS, id));
  return snap.exists() ? mapAccount(snap.id, snap.data()) : null;
}

/** Links (or unlinks) the RFID tag this user taps to start a session — what makes automatic per-session wallet debit actually resolve to them. */
export async function setEmspUserRfidToken(id: string, rfidTokenId: string | null): Promise<void> {
  await updateDoc(doc(getDb(), EMSP_USERS, id), { rfidTokenId });
}

/** Sets (or clears, with null) this employee's monthly corporate benefit cap. Enforced by ocpp-server at Authorize, not just shown here. */
export async function setEmspUserMonthlyCap(id: string, monthlyCapInr: number | null): Promise<void> {
  await updateDoc(doc(getDb(), EMSP_USERS, id), { monthlyCapInr });
}

function mapTransaction(id: string, data: Record<string, unknown>): WalletTransaction {
  return { id, ...(data as Omit<WalletTransaction, "id">) };
}

export function subscribeWalletTransactions(
  ownerType: WalletOwnerType,
  ownerId: string,
  cb: (rows: WalletTransaction[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), WALLET_TRANSACTIONS), where("ownerType", "==", ownerType), where("ownerId", "==", ownerId)),
    (snap) => {
      const rows = snap.docs.map((d) => mapTransaction(d.id, d.data()));
      rows.sort((a, b) => {
        const am = (a.createdAt as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;
        const bm = (b.createdAt as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;
        return bm - am;
      });
      cb(rows);
    },
    (err) => onError?.(err as Error),
  );
}

/** One-off fetch (not live) of TOPUP transactions with a Razorpay payment ID in a date range — for Razorpay reconciliation, which runs on demand rather than staying subscribed. */
export async function getRazorpayTopupsBetween(from: Date, to: Date): Promise<WalletTransaction[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), WALLET_TRANSACTIONS),
      where("type", "==", "TOPUP"),
      where("createdAt", ">=", from),
      where("createdAt", "<=", to),
    ),
  );
  return snap.docs.map((d) => mapTransaction(d.id, d.data())).filter((t) => !!t.razorpayPaymentId);
}

/** Cross-customer ledger — every wallet top-up/debit/refund, newest first, for the Payment Transactions page. Not owner-scoped, unlike subscribeWalletTransactions. */
export function subscribeAllWalletTransactions(
  cb: (rows: WalletTransaction[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), WALLET_TRANSACTIONS), orderBy("createdAt", "desc"), fsLimit(500)),
    (snap) => cb(snap.docs.map((d) => mapTransaction(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}
