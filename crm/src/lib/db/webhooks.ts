"use client";

/**
 * Developer webhook subscriptions. Dispatch happens from ocpp-server (see
 * ocpp-server/src/webhooks.ts), the only thing that knows about both event
 * types (session.ended, ticket.opened) — this module only manages the
 * subscription records.
 */

import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";

import type { WebhookEvent } from "../constants";
import { getDb } from "../firebase/client";
import type { Actor, WebhookSubscription } from "../types";

export const WEBHOOKS = "webhookSubscriptions";

function mapWebhook(id: string, data: Record<string, unknown>): WebhookSubscription {
  return { id, ...(data as Omit<WebhookSubscription, "id">) };
}

export function subscribeWebhooks(
  cb: (rows: WebhookSubscription[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), WEBHOOKS), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapWebhook(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

/** Generates a signing secret, stores the subscription, and returns the secret — shown once. */
export async function createWebhook(url: string, events: WebhookEvent[], actor: Actor): Promise<string> {
  const secret = `whsec_${[...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  await addDoc(collection(getDb(), WEBHOOKS), {
    url: url.trim(),
    secret,
    events,
    active: true,
    createdAt: serverTimestamp(),
    createdBy: actor,
  });
  return secret;
}

export async function setWebhookActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(getDb(), WEBHOOKS, id), { active });
}

export async function deleteWebhook(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), WEBHOOKS, id));
}
