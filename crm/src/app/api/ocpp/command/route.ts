import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { ApiError, errorResponse, requireCaller } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-side proxy to the standalone OCPP server's POST /command/<id>
 * endpoint. Exists so the shared secret (OCPP_COMMAND_KEY) never reaches
 * the browser — the client calls this route with its normal Firebase
 * session, and this route is the only thing that knows the OCPP server's
 * command-auth key.
 */

const Body = z.object({
  chargerId: z.string().min(1),
  action: z.enum(["RequestStartTransaction", "RequestStopTransaction", "Reset", "UnlockConnector", "ChangeAvailability"]),
  payload: z.record(z.unknown()).optional().default({}),
});

const COMMAND_ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATIONS"];

export async function POST(req: Request) {
  try {
    // OPERATIONS/FINANCE share rank 2, so a plain rank threshold would let
    // Finance send charger commands too — check the exact allowed set
    // instead of relying on ROLE_RANK ordering for this one.
    const caller = await requireCaller(req, "OPERATIONS");
    if (!caller.roles.some((r) => COMMAND_ROLES.includes(r))) {
      throw new ApiError("You do not have permission to send charger commands.", 403);
    }

    const body = Body.parse(await req.json());

    // The host is the same value shown in Settings → OCPP (used there to
    // build QR codes/connection URLs) — read from the same Firestore doc
    // rather than a second env var, so there's one place to configure it.
    const settingsSnap = await adminDb().collection("settings").doc("app").get();
    const host = (settingsSnap.data()?.ocpp?.serverHost as string | undefined)?.trim();
    const key = process.env.OCPP_COMMAND_KEY;
    if (!host) {
      throw new ApiError("Set the OCPP server host in Settings → OCPP before sending remote commands.", 503);
    }
    if (!key) {
      throw new ApiError("OCPP_COMMAND_KEY must be set in this app's environment before remote commands work.", 503);
    }

    const res = await fetch(`https://${host}/command/${encodeURIComponent(body.chargerId)}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-command-key": key },
      body: JSON.stringify({ action: body.action, payload: body.payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError((data as { error?: string }).error ?? `OCPP server returned ${res.status}.`, res.status);
    }
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
