/**
 * Raw OCPP protocol message log — every Call/CallResult/CallError in each
 * direction, persisted so the CRM's charger detail page can show engineers
 * exactly what was exchanged during a troubleshooting session. Payloads are
 * truncated defensively (a runaway GetLog/diagnostics payload shouldn't blow
 * up a Firestore document). Entries carry a 7-day `expireAt` — pair with a
 * Firestore TTL policy on ocppMessages.expireAt so this collection doesn't
 * grow unbounded; writes here are fire-and-forget and never block the
 * charger's own message handling.
 */

import { db } from "./firebase.js";

const MAX_PAYLOAD_CHARS = 4000;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type OcppMessageDirection = "IN" | "OUT";
export type OcppMessageType = "Call" | "CallResult" | "CallError";

export function logOcppMessage(
  chargePointId: string,
  direction: OcppMessageDirection,
  messageType: OcppMessageType,
  action: string | null,
  uniqueId: string,
  payload: unknown,
): void {
  let payloadStr: string;
  try {
    payloadStr = JSON.stringify(payload ?? {});
  } catch {
    payloadStr = String(payload);
  }
  if (payloadStr.length > MAX_PAYLOAD_CHARS) {
    payloadStr = `${payloadStr.slice(0, MAX_PAYLOAD_CHARS)}…(truncated)`;
  }

  db()
    .collection("ocppMessages")
    .add({
      chargePointId,
      direction,
      messageType,
      action,
      uniqueId,
      payload: payloadStr,
      createdAt: new Date(),
      expireAt: new Date(Date.now() + TTL_MS),
    })
    .catch((err) => console.error(`[message-log] failed to persist ${chargePointId} ${messageType}:`, err));
}
