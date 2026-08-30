"use client";

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, Holiday } from "../types";

export const HOLIDAYS = "holidays";

function mapHoliday(id: string, data: Record<string, unknown>): Holiday {
  return { id, ...(data as Omit<Holiday, "id">) };
}

export async function createHoliday(draft: { date: string; name: string }, actor: Actor): Promise<void> {
  await addDoc(collection(getDb(), HOLIDAYS), {
    ...draft,
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
  return onSnapshot(
    query(collection(getDb(), HOLIDAYS), orderBy("date")),
    (snap) => cb(snap.docs.map((d) => mapHoliday(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}
