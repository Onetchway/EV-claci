import { NextResponse } from "next/server";
import { z } from "zod";

import { sendOcppCommand, type OcppCommandAction } from "@/lib/ocpp/send-command.server";
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

    const data = await sendOcppCommand(body.chargerId, body.action as OcppCommandAction, body.payload).catch((err) => {
      throw new ApiError((err as Error).message, 503);
    });
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
