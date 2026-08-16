import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { requireRegisteredParty } from "@/lib/ocpi/auth";
import { sendOcppCommand } from "@/lib/ocpp/send-command.server";
import type {
  OcpiCommandResponse, OcpiCommandResult, OcpiCommandType, OcpiResponse,
  OcpiStartSessionRequest, OcpiStopSessionRequest, OcpiUnlockConnectorRequest,
} from "@/lib/ocpi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED: OcpiCommandType[] = ["START_SESSION", "STOP_SESSION", "UNLOCK_CONNECTOR"];

function envelope(cmdResponse: OcpiCommandResponse) {
  const body: OcpiResponse<OcpiCommandResponse> = {
    data: cmdResponse, status_code: 1000, status_message: "Success", timestamp: new Date().toISOString(),
  };
  return NextResponse.json(body);
}

/**
 * OCPI 2.2.1 Commands module (RECEIVER side) — lets a roaming partner
 * (eMSP/hub) start/stop a session or unlock a connector on our chargers.
 * RESERVE_NOW/CANCEL_RESERVATION aren't supported: reservations aren't a
 * concept this CRM's OCPP layer has built yet, so honestly reporting
 * NOT_SUPPORTED beats faking acceptance.
 *
 * Spec-correct behaviour is a fast synchronous CommandResponse (ACCEPTED/
 * REJECTED) followed by an async POST of the real CommandResult to the
 * partner's response_url once the action actually completes. This
 * implementation deliberately collapses those two steps into one request:
 * it awaits the real OCPP round-trip (typically well under a second) before
 * responding, then best-effort posts the same result to response_url. That
 * trades a slightly slower sync response for not depending on background
 * code continuing to run after this handler returns — not guaranteed on
 * every serverless-style host, and not worth the risk of a silently-dropped
 * callback for a Phase-1 integration.
 */
export async function POST(req: Request, { params }: { params: { command: string } }) {
  try {
    await requireRegisteredParty(req);
  } catch (err) {
    return NextResponse.json({ status_code: 2000, status_message: (err as Error).message }, { status: 401 });
  }

  const command = params.command.toUpperCase() as OcpiCommandType;
  if (!SUPPORTED.includes(command)) {
    return envelope({ result: "NOT_SUPPORTED", timeout: 0 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.response_url !== "string") {
    return envelope({ result: "REJECTED", timeout: 0, message: { language: "en", text: "Missing response_url." } });
  }

  let result: OcpiCommandResult;
  try {
    if (command === "START_SESSION") {
      const req2 = body as OcpiStartSessionRequest;
      const reg = await adminDb().collection("chargerRegistry")
        .where("chargerId", "==", req2.location_id).where("active", "==", true).limit(1).get();
      if (reg.empty) {
        result = { result: "REJECTED", message: { language: "en", text: "Unknown or inactive location." } };
      } else {
        await sendOcppCommand(req2.location_id, "RequestStartTransaction", {
          remoteStartId: Date.now(),
          idToken: { idToken: req2.token.contract_id ?? req2.token.uid, type: "Central" },
          evseId: 1,
        });
        result = { result: "ACCEPTED" };
      }
    } else if (command === "STOP_SESSION") {
      const req2 = body as OcpiStopSessionRequest;
      const chargePointId = req2.session_id.split("__")[0];
      const sessionSnap = chargePointId ? await adminDb().collection("chargeSessions").doc(req2.session_id).get() : null;
      const transactionId = sessionSnap?.data()?.transactionId as string | undefined;
      if (!chargePointId || !transactionId) {
        result = { result: "REJECTED", message: { language: "en", text: "Unknown session_id." } };
      } else {
        await sendOcppCommand(chargePointId, "RequestStopTransaction", { transactionId });
        result = { result: "ACCEPTED" };
      }
    } else {
      const req2 = body as OcpiUnlockConnectorRequest;
      const reg = await adminDb().collection("chargerRegistry")
        .where("chargerId", "==", req2.location_id).where("active", "==", true).limit(1).get();
      if (reg.empty) {
        result = { result: "REJECTED", message: { language: "en", text: "Unknown or inactive location." } };
      } else {
        await sendOcppCommand(req2.location_id, "UnlockConnector", { evseId: 1, connectorId: 1 });
        result = { result: "ACCEPTED" };
      }
    }
  } catch (err) {
    result = { result: "FAILED", message: { language: "en", text: (err as Error).message } };
  }

  try {
    await fetch(body.response_url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result),
    });
  } catch {
    // Best-effort — the partner will time out and can re-poll if this delivery is lost.
  }

  const syncResult: OcpiCommandResponse["result"] = result.result === "ACCEPTED" ? "ACCEPTED" : "REJECTED";
  return envelope({ result: syncResult, timeout: 30, message: result.message });
}
