import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { ocpiErrorResponse, requireRegisteredParty } from "@/lib/ocpi/auth";
import { sendOcppCommand } from "@/lib/ocpp/send-command.server";
import type {
  OcpiChargingProfileResponse, OcpiChargingProfileResult, OcpiResponse, OcpiSetChargingProfileRequest,
} from "@/lib/ocpi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OCPI 2.2.1 Charging Profiles module (RECEIVER side) — lets a roaming
 * partner push a smart-charging schedule onto one of our active sessions.
 * Maps onto the same OCPP SetChargingProfile/ClearChargingProfile commands
 * ocpp-server's zone load balancer already sends (see load-balancer.ts) —
 * a TxProfile absolute limit scoped to this session's EVSE, so it doesn't
 * fight a zone-level cap on the same charger.
 *
 * Follows the same collapsed sync/async shape as the Commands module route:
 * awaits the real OCPP round-trip before responding, then best-effort
 * posts the same result to response_url rather than depending on
 * background code surviving past the handler return.
 */

function envelope(res: OcpiChargingProfileResponse) {
  const body: OcpiResponse<OcpiChargingProfileResponse> = {
    data: res, status_code: 1000, status_message: "Success", timestamp: new Date().toISOString(),
  };
  return NextResponse.json(body);
}

async function postResult(responseUrl: string, result: OcpiChargingProfileResult): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(result),
    });
  } catch {
    // Best-effort — the partner will time out and can re-poll if this delivery is lost.
  }
}

async function loadActiveSession(sessionId: string) {
  const snap = await adminDb().collection("chargeSessions").doc(sessionId).get();
  const data = snap.data();
  if (!data || data.status !== "ACTIVE") return null;
  const chargerId = data.chargePointId as string | undefined;
  const evseId = (data.evseId as number | undefined) ?? 0;
  if (!chargerId) return null;
  return { chargerId, evseId };
}

export async function PUT(req: Request, { params }: { params: { session_id: string } }) {
  try {
    await requireRegisteredParty(req);
  } catch (err) {
    return ocpiErrorResponse(err);
  }

  const body = await req.json().catch(() => null) as OcpiSetChargingProfileRequest | null;
  if (!body || typeof body.response_url !== "string" || !body.charging_profile) {
    return envelope({ result: "REJECTED", timeout: 0 });
  }

  const session = await loadActiveSession(params.session_id);
  if (!session) {
    void postResult(body.response_url, { result: "UNKNOWN_SESSION" });
    return envelope({ result: "UNKNOWN_SESSION", timeout: 0 });
  }

  let result: OcpiChargingProfileResult;
  try {
    const profile = body.charging_profile;
    await sendOcppCommand(session.chargerId, "SetChargingProfile", {
      evseId: session.evseId,
      chargingProfile: {
        id: 900_000, // reserved id range for OCPI-originated profiles, distinct from the load balancer's zone-cap profile (id 1)
        stackLevel: 1,
        chargingProfilePurpose: "TxProfile",
        chargingProfileKind: profile.start_date_time ? "Absolute" : "Relative",
        ...(profile.start_date_time && { validFrom: profile.start_date_time }),
        chargingSchedule: [{
          id: 900_000,
          chargingRateUnit: profile.charging_rate_unit,
          ...(profile.duration != null && { duration: profile.duration * 60 }),
          ...(profile.min_charging_power != null && { minChargingRate: profile.min_charging_power }),
          chargingSchedulePeriod: profile.charging_profile_period.map((p) => ({
            startPeriod: p.start_period,
            limit: p.limit,
          })),
        }],
      },
    });
    result = { result: "ACCEPTED" };
  } catch (err) {
    result = { result: "FAILED" };
    console.error("[ocpi] SetChargingProfile failed", err);
  }

  void postResult(body.response_url, result);
  return envelope({ result: result.result === "ACCEPTED" ? "ACCEPTED" : "REJECTED", timeout: 30 });
}

export async function DELETE(req: Request, { params }: { params: { session_id: string } }) {
  try {
    await requireRegisteredParty(req);
  } catch (err) {
    return ocpiErrorResponse(err);
  }

  const session = await loadActiveSession(params.session_id);
  if (!session) return envelope({ result: "UNKNOWN_SESSION", timeout: 0 });

  try {
    await sendOcppCommand(session.chargerId, "ClearChargingProfile", { chargingProfileId: 900_000 });
    return envelope({ result: "ACCEPTED", timeout: 30 });
  } catch (err) {
    console.error("[ocpi] ClearChargingProfile failed", err);
    return envelope({ result: "REJECTED", timeout: 30 });
  }
}

/** Not implemented — see module comment. Honestly reports NOT_SUPPORTED rather than faking a readback. */
export async function GET(req: Request) {
  try {
    await requireRegisteredParty(req);
  } catch (err) {
    return ocpiErrorResponse(err);
  }
  return envelope({ result: "NOT_SUPPORTED", timeout: 0 });
}
