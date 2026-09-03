"use client";

/** Manually-entered DISCOM electricity bills per site — see types.ts's ElectricityBill doc comment. */

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, ElectricityBill } from "../types";

export const ELECTRICITY_BILLS = "electricityBills";

function mapBill(id: string, data: Record<string, unknown>): ElectricityBill {
  return { id, ...(data as Omit<ElectricityBill, "id">) };
}

export function subscribeElectricityBills(
  cb: (rows: ElectricityBill[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), ELECTRICITY_BILLS), orderBy("periodStart", "desc")),
    (snap) => cb(snap.docs.map((d) => mapBill(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export type ElectricityBillDraft = {
  zoneId: string;
  zoneName: string;
  amountInr: number;
  periodStart: Date;
  periodEnd: Date;
  notes?: string;
};

export async function createElectricityBill(draft: ElectricityBillDraft, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), ELECTRICITY_BILLS), {
    ...draft, createdAt: serverTimestamp(), createdBy: actor,
  });
  return ref.id;
}

export async function deleteElectricityBill(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), ELECTRICITY_BILLS, id));
}
