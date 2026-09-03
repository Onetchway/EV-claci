/**
 * Outbound commands — this server calling a charge point, the reverse of
 * everything in handlers.ts. A Call is sent over the charge point's own
 * WebSocket, so it only works if that connection is being held by *this*
 * server instance right now (see registry.ts's in-memory `connections` map).
 *
 * Known limitation: with more than one Cloud Run instance running
 * (--max-instances > 1), a command can land on an instance that isn't
 * holding the target charger's connection, and will correctly report
 * "not connected here" even though the charger is online elsewhere. Fine
 * at small fleet size; a real fix needs a cross-instance dispatch layer
 * (e.g. Redis pub/sub) before this handles a large fleet — noted in the
 * README rather than silently glossed over.
 */

import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { FieldValue } from "firebase-admin/firestore";

import { connections } from "../registry.js";
import { db } from "../firebase.js";
import { logOcppMessage } from "../message-log.js";
import { encodeCall } from "./rpc.js";
import { translateForOcpp16 } from "../ocpp16/commands.js";

interface PendingCall {
  chargePointId: string;
  action: string;
  resolve: (payload: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingCall>();

export const COMMAND_QUEUE = "commandQueue";

/**
 * De-dupes retries of the *same logical command* fired by a caller that
 * itself retried the HTTP request (e.g. a CRM button double-click, or an
 * upstream retry on a 5xx). Keyed by caller-supplied idempotencyKey; a
 * second sendCommand with the same key while the first is still in flight
 * (or briefly after it settled) gets back the same promise instead of
 * sending a second Call to the charger. Not durable across a server
 * restart — that's fine, since a restart also drops the in-memory
 * WebSocket the retry would have needed anyway.
 */
const idempotencyCache = new Map<string, Promise<unknown>>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

function rememberIdempotent(key: string, result: Promise<unknown>): void {
  idempotencyCache.set(key, result);
  setTimeout(() => idempotencyCache.delete(key), IDEMPOTENCY_TTL_MS).unref?.();
}

export const COMMAND_ACTIONS = [
  "RequestStartTransaction", "RequestStopTransaction", "Reset", "UnlockConnector", "ChangeAvailability",
  "SetChargingProfile", "ClearChargingProfile", "UpdateFirmware", "ClearCache",
  "GetVariables", "SetVariables", "GetLog",
] as const;
export type CommandAction = (typeof COMMAND_ACTIONS)[number];

export class ChargerNotConnectedError extends Error {
  constructor(chargePointId: string) {
    super(`${chargePointId} is not connected to this server instance.`);
    this.name = "ChargerNotConnectedError";
  }
}

export class CommandTimeoutError extends Error {
  constructor(chargePointId: string, action: string) {
    super(`${chargePointId} did not acknowledge ${action} within the timeout.`);
    this.name = "CommandTimeoutError";
  }
}

export interface SendCommandOptions {
  timeoutMs?: number;
  /** Caller-supplied de-dupe key — see idempotencyCache above. Omit for one-shot commands where a duplicate send is harmless (e.g. UnlockConnector). */
  idempotencyKey?: string;
  /** How many additional attempts after the first, on timeout/not-connected only — never retried after a CallError, since the charger already answered. Default 2. */
  maxRetries?: number;
}

const RETRY_BACKOFF_MS = [1_000, 3_000, 8_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One attempt: send the Call, wait for the matching CallResult/CallError or timeout. No retry, no queue bookkeeping — sendCommand wraps this. */
function attemptCommand(
  chargePointId: string,
  action: CommandAction,
  payload: unknown,
  timeoutMs: number,
): Promise<unknown> {
  const conn = connections.get(chargePointId);
  if (!conn) return Promise.reject(new ChargerNotConnectedError(chargePointId));

  // Callers (CRM API routes, OCPI routes, the load balancer, depot
  // scheduling) all speak the 2.0.1 action/payload shapes unconditionally —
  // this is the one place that needs to know a charger might actually be a
  // 1.6 charger, and translate on the way out. Response shapes are left
  // untranslated: every action this server sends gets back a `.status`
  // field either way, so callers reading that need no protocol awareness.
  let wireAction: string = action;
  let wirePayload: unknown = payload;
  if (conn.protocol === "ocpp1.6") {
    try {
      const translated = translateForOcpp16(action, payload);
      wireAction = translated.action;
      wirePayload = translated.payload;
    } catch (err) {
      return Promise.reject(err);
    }
  }

  const uniqueId = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(uniqueId);
      reject(new CommandTimeoutError(chargePointId, action));
    }, timeoutMs);

    pending.set(uniqueId, { chargePointId, action, resolve, reject, timer });
    logOcppMessage(chargePointId, "OUT", "Call", wireAction, uniqueId, wirePayload);
    (conn.ws as WebSocket).send(encodeCall(uniqueId, wireAction, wirePayload));
  });
}

/**
 * Persists a record of the command to Firestore for auditability and so a
 * command that was still in flight when this process died isn't silently
 * lost from the record. This does NOT resume the original caller — that's
 * an HTTP request that has already returned or timed out on its own by the
 * time a restart happens — it just gives the queue a durable trail (visible
 * to support/ops) and lets a startup sweep close out anything left PENDING
 * as FAILED rather than leaving it stuck forever.
 */
async function logQueuedCommand(
  queueId: string,
  chargePointId: string,
  action: CommandAction,
  payload: unknown,
  idempotencyKey: string | undefined,
): Promise<void> {
  await db().collection(COMMAND_QUEUE).doc(queueId).set({
    chargePointId, action, payload: payload ?? {}, idempotencyKey: idempotencyKey ?? null,
    status: "PENDING", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  }).catch((err) => console.error(`[commands] failed to log queued command ${queueId}:`, err));
}

async function settleQueuedCommand(queueId: string, status: "ACKED" | "FAILED", detail: unknown): Promise<void> {
  await db().collection(COMMAND_QUEUE).doc(queueId).set({
    status, detail: detail ?? null, updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true }).catch((err) => console.error(`[commands] failed to settle queued command ${queueId}:`, err));
}

export function sendCommand(
  chargePointId: string,
  action: CommandAction,
  payload: unknown,
  timeoutMsOrOptions: number | SendCommandOptions = 30_000,
): Promise<unknown> {
  const opts: SendCommandOptions = typeof timeoutMsOrOptions === "number"
    ? { timeoutMs: timeoutMsOrOptions }
    : timeoutMsOrOptions;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const maxRetries = opts.maxRetries ?? 2;

  if (opts.idempotencyKey) {
    const cached = idempotencyCache.get(opts.idempotencyKey);
    if (cached) return cached;
  }

  const queueId = randomUUID();
  const run = (async () => {
    await logQueuedCommand(queueId, chargePointId, action, payload, opts.idempotencyKey);
    let lastErr: Error | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await attemptCommand(chargePointId, action, payload, timeoutMs);
        await settleQueuedCommand(queueId, "ACKED", result);
        return result;
      } catch (err) {
        lastErr = err as Error;
        // Retry only on timeout / not-connected-yet — a CallError means the
        // charger answered and rejected the command, which won't change on
        // resend. Also never retry translation errors (thrown synchronously
        // from attemptCommand for 1.6 chargers on unsupported actions).
        const retryable = lastErr instanceof CommandTimeoutError || lastErr instanceof ChargerNotConnectedError;
        if (!retryable || attempt === maxRetries) break;
        await sleep(RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)]!);
      }
    }
    await settleQueuedCommand(queueId, "FAILED", { message: lastErr?.message, name: lastErr?.name });
    throw lastErr;
  })();

  if (opts.idempotencyKey) {
    rememberIdempotent(opts.idempotencyKey, run);
  }
  return run;
}

/** Called once at startup — anything still PENDING in Firestore belongs to a process that died mid-command; there's no caller left to resolve, so mark it FAILED rather than leaving it stuck forever. */
export async function sweepAbandonedCommands(): Promise<void> {
  const snap = await db().collection(COMMAND_QUEUE).where("status", "==", "PENDING").get();
  if (snap.empty) return;
  const batch = db().batch();
  for (const doc of snap.docs) {
    batch.set(doc.ref, { status: "FAILED", detail: { message: "Server restarted before this command completed." }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  await batch.commit();
  console.log(`[commands] startup sweep marked ${snap.size} abandoned command(s) as FAILED.`);
}

/** Called from index.ts's message handler when a CallResult arrives. */
export function resolveCommand(uniqueId: string, payload: unknown): boolean {
  const p = pending.get(uniqueId);
  if (!p) return false;
  clearTimeout(p.timer);
  pending.delete(uniqueId);
  p.resolve(payload);
  return true;
}

/** Called from index.ts's message handler when a CallError arrives. */
export function rejectCommand(uniqueId: string, errorCode: string, errorDescription: string): boolean {
  const p = pending.get(uniqueId);
  if (!p) return false;
  clearTimeout(p.timer);
  pending.delete(uniqueId);
  p.reject(new Error(`${errorCode}: ${errorDescription}`));
  return true;
}
