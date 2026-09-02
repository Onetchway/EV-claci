import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-to-server only — called by the Alpha platform (platform/backend's
 * tenants.service.js) when a super admin edits a tenant's branding after
 * creation. Unlike provision-tenant's logoUrl/primaryColorHex (set once, at
 * creation, and never touched again since a tenant may have since customized
 * it themselves), this route is an explicit, deliberate overwrite — the
 * super admin editing it from the Organization page is the "customization"
 * here, so it always wins.
 */

const Body = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers, and hyphens"),
  logoUrl: z.string().url().max(2000).nullable().optional(),
  primaryColorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a hex color like #4f46e5").nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const secret = process.env.PLATFORM_PROVISION_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "This CRM instance has no PLATFORM_PROVISION_SECRET configured — provisioning is disabled." },
        { status: 503 },
      );
    }
    if (req.headers.get("x-provision-secret") !== secret) {
      return NextResponse.json({ error: "Invalid provisioning secret." }, { status: 401 });
    }

    const body = Body.parse(await req.json());
    const db = adminDb();

    const existingOrg = await db.collection("organizations").where("slug", "==", body.slug).limit(1).get();
    if (existingOrg.empty) {
      return NextResponse.json({ error: `No organization with slug "${body.slug}".` }, { status: 404 });
    }

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (body.logoUrl !== undefined) update.logoUrl = body.logoUrl || FieldValue.delete();
    if (body.primaryColorHex !== undefined) update.primaryColorHex = body.primaryColorHex || FieldValue.delete();

    await existingOrg.docs[0].ref.set(update, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    console.error("[update-branding]", err);
    return NextResponse.json({ error: (err as Error).message ?? "Branding update failed." }, { status: 500 });
  }
}
