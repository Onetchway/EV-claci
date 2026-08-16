"use client";

/**
 * Read-only API keys for external integrations under /api/v1/*. The raw
 * key only ever exists client-side for a moment (generated here, shown
 * once, then discarded) — only its SHA-256 hash is ever written to
 * Firestore, and the /api/v1/* routes hash an incoming key the same way
 * before comparing.
 */

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import type { Actor, ApiKey } from "../types";

export const API_KEYS = "apiKeys";

function mapKey(id: string, data: Record<string, unknown>): ApiKey {
  return { id, ...(data as Omit<ApiKey, "id">) };
}

export function subscribeApiKeys(
  cb: (rows: ApiKey[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), API_KEYS), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapKey(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

async function sha256Hex(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Generates a new key, stores only its hash, and returns the raw key — the only time it's ever visible. */
export async function createApiKey(name: string, actor: Actor): Promise<string> {
  const raw = `lg_${[...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  const keyHash = await sha256Hex(raw);
  await addDoc(collection(getDb(), API_KEYS), {
    name: name.trim(),
    keyHash,
    prefix: raw.slice(0, 11),
    active: true,
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
  return raw;
}

export async function setApiKeyActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(getDb(), API_KEYS, id), { active });
}

export async function deleteApiKey(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), API_KEYS, id));
}
