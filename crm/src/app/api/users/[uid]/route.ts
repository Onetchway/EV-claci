import { NextResponse } from "next/server";
import { z } from "zod";

import { ROLES, type Role } from "@/lib/constants";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { ApiError, errorResponse, requireCaller } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchUser = z.object({
  name: z.string().min(2).max(80).optional(),
  phone: z.string().max(20).optional(),
  region: z.string().max(60).nullable().optional(),
  managerId: z.string().max(128).nullable().optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  /** Set a new password for the user. */
  password: z.string().min(8).max(72).optional(),
});

function assertCanAssign(callerRole: Role, target: Role) {
  if (callerRole === "SUPER_ADMIN") return;
  if (callerRole === "ADMIN" && target === "AGENT") return;
  throw new ApiError("Only a super admin can grant or revoke admin access.", 403);
}

export async function PATCH(req: Request, { params }: { params: { uid: string } }) {
  try {
    const caller = await requireCaller(req, "ADMIN");
    const body = PatchUser.parse(await req.json());
    const { uid } = params;

    const db = adminDb();
    const ref = db.collection("users").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) throw new ApiError("User not found.", 404);

    const current = snap.data() as { role: Role };

    // Changing an admin's record — or promoting anyone into an admin role —
    // is reserved for super admins.
    if (body.role && body.role !== current.role) {
      assertCanAssign(caller.role, body.role);
      assertCanAssign(caller.role, current.role);
    }
    if (body.active === false) {
      if (uid === caller.uid) throw new ApiError("You cannot deactivate your own account.", 400);
      assertCanAssign(caller.role, current.role);
    }
    if (body.password && caller.role !== "SUPER_ADMIN" && current.role !== "AGENT") {
      throw new ApiError("Only a super admin can reset an admin's password.", 403);
    }

    const update: Record<string, unknown> = {};
    for (const key of ["name", "phone", "region", "managerId", "role", "active"] as const) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    if (Object.keys(update).length) await ref.update(update);

    const auth = adminAuth();
    if (body.role) await auth.setCustomUserClaims(uid, { role: body.role });
    if (body.active !== undefined) await auth.updateUser(uid, { disabled: !body.active });
    if (body.name) await auth.updateUser(uid, { displayName: body.name });
    if (body.password) await auth.updateUser(uid, { password: body.password });
    // Force the next request to re-mint a token so a revoked role stops working.
    if (body.role || body.active === false) await auth.revokeRefreshTokens(uid);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}

export async function DELETE(req: Request, { params }: { params: { uid: string } }) {
  try {
    const caller = await requireCaller(req, "SUPER_ADMIN");
    const { uid } = params;
    if (uid === caller.uid) throw new ApiError("You cannot delete your own account.", 400);

    // The profile is kept so historical leads keep a readable owner name; only
    // the sign-in credential is destroyed.
    await adminDb().collection("users").doc(uid).update({ active: false, deletedAt: new Date() });
    await adminAuth().deleteUser(uid);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
