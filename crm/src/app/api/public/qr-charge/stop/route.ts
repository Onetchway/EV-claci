import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { sendOcppCommand } from "@/lib/ocpp/send-command.server";
import { ApiError, errorResponse } from "@/app/api/_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ idToken: z.string().min(1) });

/** The "Stop charging" button on the public page — the one write action a QR session's own idToken is allowed, no auth beyond knowing the token (which only the page that started the session has). */
export async function POST(req: Request) {
  try {
    const { idToken } = Body.parse(await req.json());
    const db = adminDb();

    const qrSnap = await db.collection("qrChargeSessions").doc(idToken).get();
    if (!qrSnap.exists) throw new ApiError("Session not found.", 404);
    const qr = qrSnap.data()!;

    const sessSnap = await db.collection("chargeSessions")
      .where("chargePointId", "==", qr.chargerId).where("idToken", "==", idToken).where("status", "==", "ACTIVE").limit(1).get();
    if (sessSnap.empty) throw new ApiError("No active session to stop.", 409);
    const transactionId = sessSnap.docs[0]!.data().transactionId;

    await sendOcppCommand(qr.chargerId, "RequestStopTransaction", { transactionId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
