import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse, requireCaller } from "@/app/api/_lib/guard";
import { publicOrigin } from "@/lib/ocpi/base-url";
import { registerWithPartner } from "@/lib/ocpi/roaming-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  businessName: z.string().min(1),
  versionsUrl: z.string().url(),
  theirTokenA: z.string().min(1),
});

/** Admin-only: registers this app as an eMSP client of a partner CPO — see lib/ocpi/roaming-client.ts for the handshake this performs. */
export async function POST(req: Request) {
  try {
    await requireCaller(req, "ADMIN");
    const { businessName, versionsUrl, theirTokenA } = Body.parse(await req.json());
    const base = publicOrigin(req);
    // Defense in depth against a token pasted with embedded whitespace
    // (e.g. copied across a line-wrapped display) — a real token never
    // legitimately contains any, so strip it all rather than just the ends.
    const partner = await registerWithPartner(businessName, versionsUrl, theirTokenA.replace(/\s+/g, ""), base);
    return NextResponse.json({ ok: true, partner });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
