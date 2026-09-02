import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-to-server only — called by the Alpha platform (platform/backend's
 * tenants.service.js) right after a super admin creates a tenant, so
 * "create a tenant in super admin" actually results in a working CRM login
 * instead of just a database row. Never called from a browser: authenticated
 * by a shared secret (this deploy's own, set once when this CRM instance is
 * onboarded onto the platform), not a Firebase ID token — there's no signed-in
 * user yet, that's the whole point of this route.
 *
 * Idempotent by slug: calling it again for the same tenant reuses the
 * existing org and, if the admin account already exists, just re-stamps its
 * orgId/role rather than erroring — so a retried platform request (or
 * re-running the same provisioning call) never creates a duplicate org.
 */

const Body = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers, and hyphens"),
  name: z.string().min(1).max(200),
  adminEmail: z.string().email(),
  adminName: z.string().min(1).max(120),
  /** Omit to have the route generate one, returned once in the response. */
  adminPassword: z.string().min(8).max(72).optional(),
  /**
   * This tenant's own platform API key (tenants.api_key on the platform
   * side) -- stored into organizationPlatformKeys so this org's CRM nav
   * immediately reflects whatever feature set the super admin set for it
   * (see lib/platform-features.ts), instead of failing open to "every
   * feature enabled" until someone manually visits Settings and pastes it
   * in via api/organizations/[id]/platform-key. Optional so provisioning
   * still works for a platform build that hasn't wired this through yet.
   */
  tenantApiKey: z.string().min(1).max(200).optional(),
});

function randomPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

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
    const auth = adminAuth();

    const existingOrg = await db.collection("organizations").where("slug", "==", body.slug).limit(1).get();
    let orgId: string;
    if (!existingOrg.empty) {
      orgId = existingOrg.docs[0].id;
    } else {
      const orgRef = await db.collection("organizations").add({
        name: body.name,
        slug: body.slug,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: null,
      });
      orgId = orgRef.id;
    }

    const existingUser = await auth.getUserByEmail(body.adminEmail).catch(() => null);
    const password = body.adminPassword ?? randomPassword();
    let uid: string;

    if (existingUser) {
      uid = existingUser.uid;
      await auth.updateUser(uid, { password: body.adminPassword ? password : undefined });
    } else {
      const created = await auth.createUser({
        email: body.adminEmail,
        password,
        displayName: body.adminName,
        emailVerified: false,
      });
      uid = created.uid;
    }

    // Same claim shape as api/users/route.ts's own createUser — ADMIN is
    // the highest a tenant's own team gets; SUPER_ADMIN stays reserved for
    // Livanto's own staff.
    await auth.setCustomUserClaims(uid, { role: "ADMIN", roles: ["ADMIN"], orgId });

    if (body.tenantApiKey) {
      await db.collection("organizationPlatformKeys").doc(orgId).set({
        tenantApiKey: body.tenantApiKey, updatedAt: FieldValue.serverTimestamp(), updatedBy: null,
      });
    }

    await db.collection("users").doc(uid).set(
      {
        uid,
        email: body.adminEmail,
        name: body.adminName,
        role: "ADMIN",
        roles: ["ADMIN"],
        orgId,
        phone: "",
        managerId: null,
        region: null,
        active: true,
        photoURL: null,
        updatedAt: FieldValue.serverTimestamp(),
        ...(existingUser ? {} : { createdAt: FieldValue.serverTimestamp(), createdBy: null, lastLoginAt: null }),
      },
      { merge: true },
    );

    return NextResponse.json({
      orgId,
      uid,
      // Only meaningful the first time — a re-provision of an existing
      // account keeps its password unless the caller explicitly passed one.
      temporaryPassword: existingUser && !body.adminPassword ? undefined : password,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    console.error("[provision-tenant]", err);
    return NextResponse.json({ error: (err as Error).message ?? "Provisioning failed." }, { status: 500 });
  }
}
