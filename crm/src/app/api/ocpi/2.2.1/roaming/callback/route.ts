import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import type { OcpiCommandResult } from "@/lib/ocpi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where a partner CPO posts the real (async) CommandResult once a
 * START_SESSION/STOP_SESSION we sent them actually resolves — the
 * response_url we hand them in roaming-client.ts's send*ToPartner. Not
 * bearer-authenticated: the correlation id in the URL (?rid=) is itself
 * the unguessable secret, same trust model OCPI's response_url pattern
 * relies on generally. Just logs the outcome against the roamingCommands
 * doc that started the request — the CRM UI polls that doc, it doesn't
 * block on this callback arriving.
 */
export async function POST(req: Request) {
  const rid = new URL(req.url).searchParams.get("rid");
  const body = await req.json().catch(() => null) as OcpiCommandResult | null;
  if (!rid || !body) return NextResponse.json({ ok: false }, { status: 400 });

  await adminDb().collection("roamingCommands").doc(rid).set(
    { result: body.result, message: body.message ?? null, resolvedAt: new Date() },
    { merge: true },
  );
  return NextResponse.json({ ok: true });
}
