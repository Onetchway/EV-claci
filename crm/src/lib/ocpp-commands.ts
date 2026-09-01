"use client";

/** Calls the CRM's own /api/ocpp/command route, which proxies to the standalone OCPP server. */

import { getFirebaseAuth } from "./firebase/client";

export type ChargerCommandAction =
  | "RequestStartTransaction" | "RequestStopTransaction" | "Reset" | "UnlockConnector" | "ChangeAvailability"
  | "UpdateFirmware" | "ClearCache" | "GetVariables" | "SetVariables" | "GetLog";

export async function sendChargerCommand(
  chargerId: string,
  action: ChargerCommandAction,
  payload: Record<string, unknown> = {},
): Promise<unknown> {
  const current = getFirebaseAuth().currentUser;
  if (!current) throw new Error("Your session expired. Sign in again.");
  const token = await current.getIdToken();
  const res = await fetch("/api/ocpp/command", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ chargerId, action, payload }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; result?: unknown };
  if (!res.ok) throw new Error(body.error ?? `Command failed (${res.status}).`);
  return body.result;
}
