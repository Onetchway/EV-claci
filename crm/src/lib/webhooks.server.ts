import "server-only";

import { createHmac } from "node:crypto";

import { adminDb } from "@/lib/firebase/admin";
import type { WebhookEvent } from "@/lib/constants";

/**
 * Outbound webhook delivery for events that originate in a CRM server
 * route rather than the OCPP server (payment.success/failed) — mirrors
 * ocpp-server/src/webhooks.ts's delivery + retry semantics so a receiver
 * sees one consistent signing/retry contract regardless of which service
 * dispatched an event. Fire-and-forget: never awaited by the caller.
 */
export function dispatchWebhookSafe(event: WebhookEvent, payload: Record<string, unknown>): void {
  void dispatchWebhook(event, payload).catch((err) => {
    console.error(`[webhooks] failed to dispatch ${event}`, err);
  });
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dispatchWebhook(event: WebhookEvent, payload: Record<string, unknown>): Promise<void> {
  const db = adminDb();
  const snap = await db
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
