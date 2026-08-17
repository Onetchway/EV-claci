/**
 * Outbound webhook delivery. Reads subscriptions the CRM's Developer page
 * manages (webhookSubscriptions), HMAC-signs each delivery with the
 * subscription's own secret so the receiver can verify it came from here,
 * and fires them off in the background — never holds up ticket-opening or
 * session-billing. Each delivery gets up to 3 attempts with a short
 * backoff before being given up on; a slow or dead endpoint still can't
 * block anything, since dispatchWebhookSafe never awaits this.
 */

import { createHmac } from "node:crypto";

import { db } from "./firebase.js";

export type WebhookEvent =
  | "session.ended" | "ticket.opened" | "ticket.sla_breached"
  | "charger.online" | "charger.offline"
  | "payment.success" | "payment.failed"
  | "workflow.custom";

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-livanto-signature": signature },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) return;
        throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        const isLastAttempt = attempt === MAX_ATTEMPTS;
        console.error(`[webhooks] delivery to ${url} failed (attempt ${attempt}/${MAX_ATTEMPTS})`, err);
        if (isLastAttempt) return;
        await sleep(RETRY_DELAYS_MS[attempt - 1]!);
      }
    }
  }));
}
