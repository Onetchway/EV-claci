"use client";

/** Driver-facing (EMSP) users and the corporate accounts some of them bill to. */

import {
  addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, CorporateAccount, EmspUser } from "../types";

export const CORPORATE_ACCOUNTS = "corporateAccounts";
export const EMSP_USERS = "emspUsers";

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
