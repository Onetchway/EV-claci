import "server-only";

/**
 * Server-side helper for POSTing to the standalone OCPP server's
 * /command/<id> endpoint. Factored out of /api/ocpp/command/route.ts so
 * the OCPI Commands module (crm/src/app/api/ocpi/2.2.1/commands) can send
 * the same remote-start/stop without going through a signed-in CRM user —
 * an OCPI partner is authenticated by its own bearer token, not Firebase
 * Auth, so it can't call the CRM-user-only route.
 */

import { adminDb } from "@/lib/firebase/admin";

export type OcppCommandAction = "RequestStartTransaction" | "RequestStopTransaction" | "Reset" | "UnlockConnector" | "ChangeAvailability";

export async function sendOcppCommand(
  chargerId: string,
  action: OcppCommandAction,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const settingsSnap = await adminDb().collection("settings").doc("app").get();
  const host = (settingsSnap.data()?.ocpp?.serverHost as string | undefined)?.trim();
  const key = process.env.OCPP_COMMAND_KEY;
  if (!host) throw new Error("OCPP server host is not set in Settings → OCPP.");
  if (!key) throw new Error("OCPP_COMMAND_KEY is not set in this app's environment.");

  const res = await fetch(`https://${host}/command/${encodeURIComponent(chargerId)}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-command-key": key },
    body: JSON.stringify({ action, payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `OCPP server returned ${res.status}.`);
  return data;
}
