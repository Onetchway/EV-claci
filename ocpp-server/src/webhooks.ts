/**
 * Outbound webhook delivery for session.ended and ticket.opened. Reads
 * subscriptions the CRM's Developer page manages (webhookSubscriptions),
 * HMAC-signs each delivery with the subscription's own secret so the
 * receiver can verify it came from here, and fires them off without
 * waiting or retrying — a slow or dead endpoint must never hold up
 * ticket-opening or session-billing.
 */

import { createHmac } from "node:crypto";

import { db } from "./firebase.js";

type WebhookEvent = "session.ended" | "ticket.opened";

export function dispatchWebhookSafe(event: WebhookEvent, payload: Record<string, unknown>): void {
  void dispatchWebhook(event, payload).catch((err) => {
    console.error(`[webhooks] failed to dispatch ${event}`, err);
  });
}

async function dispatchWebhook(event: WebhookEvent, payload: Record<string, unknown>): Promise<void> {
  const snap = await db()
    .collection("webhookSubscriptions")
    .where("events", "array-contains", event)
    .where("active", "==", true)
    .get();
  if (snap.empty) return;

  const body = JSON.stringify({ event, data: payload, sentAt: new Date().toISOString() });

  await Promise.all(snap.docs.map(async (doc) => {
    const { url, secret } = doc.data() as { url: string; secret: string };
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    try {
      await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-livanto-signature": signature },
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      console.error(`[webhooks] delivery to ${url} failed`, err);
    }
  }));
}
