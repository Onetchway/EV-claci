"use client";

/**
 * RFID/tag allow-list the OCPP server's Authorize handler checks (see
 * ocpp-server/src/rfid.ts). Empty collection = the server accepts every
 * tag; adding the first token here switches it to strict allow-list mode.
 */

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, RfidToken } from "../types";

export const RFID_TOKENS = "rfidTokens";

function mapToken(id: string, data: Record<string, unknown>): RfidToken {
  return { id, ...(data as Omit<RfidToken, "id">) };
}

export function subscribeRfidTokens(
  cb: (rows: RfidToken[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), RFID_TOKENS), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapToken(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export async function addRfidToken(idToken: string, label: string, actor: Actor): Promise<void> {
  await addDoc(collection(getDb(), RFID_TOKENS), {
    idToken: idToken.trim(),
    label: label.trim(),
    status: "ACTIVE",
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
}

export async function setRfidTokenStatus(id: string, status: "ACTIVE" | "BLOCKED"): Promise<void> {
  await updateDoc(doc(getDb(), RFID_TOKENS, id), { status });
}

export async function deleteRfidToken(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), RFID_TOKENS, id));
}
