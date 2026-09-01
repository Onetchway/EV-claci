import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, requireCaller } from "@/app/api/_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Write-only, by design — same "set it, don't display it" pattern as
 * payment-secret/route.ts. Super Admin only: this is the key the Alpha
 * platform (see ../../../../platform/) issues when onboarding this org as
 * a tenant, letting this org's own team see the features its plan
 * actually enables (see lib/platform-features.ts) instead of everything.
 */

const Body = z.object({
  tenantApiKey: z.string().min(1).max(200).nullable(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const caller = await requireCaller(req, "SUPER_ADMIN");
    const { tenantApiKey } = Body.parse(await req.json());

    const db = adminDb();
    const orgSnap = await db.collection("organizations").doc(params.id).get();
    if (!orgSnap.exists) return NextResponse.json({ error: "Organisation not found." }, { status: 404 });

    if (tenantApiKey === null) {
      await db.collection("organizationPlatformKeys").doc(params.id).delete();
    } else {
      await db.collection("organizationPlatformKeys").doc(params.id).set({
        tenantApiKey, updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
