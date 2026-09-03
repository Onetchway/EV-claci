/**
 * OCPP-J message framing (OCPP 2.0.1 §4) — every message on the wire is a
 * JSON array, not an object. This module only encodes/decodes that
 * envelope; the action-specific payload shapes live in handlers.ts.
 */

export const CALL = 2;
export const CALL_RESULT = 3;
export const CALL_ERROR = 4;

export type CallMessage = [typeof CALL, string, string, unknown];
export type CallResultMessage = [typeof CALL_RESULT, string, unknown];
export type CallErrorMessage = [typeof CALL_ERROR, string, string, string, Record<string, unknown>];

export type OcppMessage = CallMessage | CallResultMessage | CallErrorMessage;

export function isCall(msg: unknown[]): msg is CallMessage {
  return msg[0] === CALL;
}
export function isCallResult(msg: unknown[]): msg is CallResultMessage {
  return msg[0] === CALL_RESULT;
}
export function isCallError(msg: unknown[]): msg is CallErrorMessage {
  return msg[0] === CALL_ERROR;
}

export function parseFrame(raw: string): OcppMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length < 3) return null;
  const [type] = parsed;
  if (type === CALL && parsed.length === 4) return parsed as CallMessage;
  if (type === CALL_RESULT && parsed.length === 3) return parsed as CallResultMessage;
  if (type === CALL_ERROR && parsed.length === 5) return parsed as CallErrorMessage;
  return null;
}

export function encodeCallResult(uniqueId: string, payload: unknown): string {
  return JSON.stringify([CALL_RESULT, uniqueId, payload]);
}

export function encodeCallError(uniqueId: string, code: string, description: string): string {
  return JSON.stringify([CALL_ERROR, uniqueId, code, description, {}]);
}

export function encodeCall(uniqueId: string, action: string, payload: unknown): string {
  return JSON.stringify([CALL, uniqueId, action, payload]);
}

/** OCPP-J's standard error codes (§4.2.3) — we only need a handful for Phase 1. */
export const OcppErrorCode = {
  NotImplemented: "NotImplemented",
  InternalError: "InternalError",
  ProtocolError: "ProtocolError",
  FormationViolation: "FormationViolation",
} as const;
