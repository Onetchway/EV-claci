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

import { connections } from "../registry.js";
import { logOcppMessage } from "../message-log.js";
import { encodeCall } from "./rpc.js";

interface PendingCall {
  chargePointId: string;
  action: string;
  resolve: (payload: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingCall>();

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

export function sendCommand(
  chargePointId: string,
  action: CommandAction,
  payload: unknown,
  timeoutMs = 30_000,
): Promise<unknown> {
  const conn = connections.get(chargePointId);
  if (!conn) return Promise.reject(new ChargerNotConnectedError(chargePointId));

  const uniqueId = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(uniqueId);
      reject(new CommandTimeoutError(chargePointId, action));
    }, timeoutMs);

    pending.set(uniqueId, { chargePointId, action, resolve, reject, timer });
    logOcppMessage(chargePointId, "OUT", "Call", action, uniqueId, payload);
    (conn.ws as WebSocket).send(encodeCall(uniqueId, action, payload));
  });
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
