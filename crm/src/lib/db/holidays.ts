"use client";

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, where,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import { getCurrentTenantId } from "../tenant";
import type { Actor, Holiday } from "../types";

export const HOLIDAYS = "holidays";

function mapHoliday(id: string, data: Record<string, unknown>): Holiday {
  return { id, ...(data as Omit<Holiday, "id">) };
}

export async function createHoliday(draft: { date: string; name: string }, actor: Actor): Promise<void> {
  const orgId = await getCurrentTenantId();
  await addDoc(collection(getDb(), HOLIDAYS), {
    ...draft,
    orgId,
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
}

export async function deleteHoliday(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), HOLIDAYS, id));
}

export function subscribeHolidays(
  cb: (rows: Holiday[]) => void,
  onError?: (e: Error) => void,
): () => void {
  let unsubscribe = () => {};
  let cancelled = false;
  void getCurrentTenantId().then((orgId) => {
    if (cancelled) return;
    unsubscribe = onSnapshot(
      query(collection(getDb(), HOLIDAYS), where("orgId", "==", orgId), orderBy("date")),
      (snap) => cb(snap.docs.map((d) => mapHoliday(d.id, d.data()))),
      (err) => onError?.(err as Error),
    );
  }, (err) => onError?.(err as Error));
  return () => { cancelled = true; unsubscribe(); };
}
