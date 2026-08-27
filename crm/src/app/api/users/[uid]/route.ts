import { NextResponse } from "next/server";
import { z } from "zod";

import { ROLE_ENFORCEMENT, ROLES, ROLE_RANK, type Role } from "@/lib/constants";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { ApiError, errorResponse, highestRole, requireCaller } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchUser = z.object({
  name: z.string().min(2).max(80).optional(),
  phone: z.string().max(20).optional(),
  region: z.string().max(60).nullable().optional(),
  managerId: z.string().max(128).nullable().optional(),
  roles: z.array(z.enum(ROLES)).min(1).max(ROLES.length).optional(),
  active: z.boolean().optional(),
  /** Set a new password for the user. */
  password: z.string().min(8).max(72).optional(),
  /** Which white-label tenant this team member belongs to. Null clears it back to the default organisation. */
  orgId: z.string().max(128).nullable().optional(),
  /** Per-user page-access override — replaces the whole map. Super admin only; see lib/page-access.ts. */
  pageAccessOverrides: z.record(z.string(), z.boolean()).nullable().optional(),
  /** Exempt from the office geofence on attendance check-in/out. Admin/Super Admin are always exempt regardless of this flag. */
  bypassGeofence: z.boolean().optional(),
  /** HR access to HRMS org-wide (approve leave, mark attendance, edit roster for anyone) without the ADMIN role itself. */
  hrmsAdmin: z.boolean().optional(),
  /** Whether this person is expected to check in/out at all. Omitted/true = required (the default for a normal employee). */
  attendanceRequired: z.boolean().optional(),
});

/** Rank-based (not a literal "ADMIN" check) so PLATFORM_ADMIN/CPO_ADMIN — same rank as ADMIN, just a clearer label — grant/revoke exactly what an ADMIN could. */
function assertCanAssign(callerRole: Role, target: Role) {
  if (callerRole === "SUPER_ADMIN") return;
  if (ROLE_RANK[callerRole] >= ROLE_RANK.ADMIN && ROLE_RANK[target] < ROLE_RANK.ADMIN) return;
  throw new ApiError(`Only a super admin can grant or revoke the ${target} role.`, 403);
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

    const current = snap.data() as { role: Role; roles?: Role[] };
    const currentRoles = current.roles?.length ? current.roles : [current.role];

    // Changing an admin's record — or promoting anyone into an admin role —
    // is reserved for super admins.
    let nextRoles: Role[] | undefined;
    let nextPrimary: Role | undefined;
    if (body.roles) {
      nextRoles = [...new Set(body.roles)];
      nextPrimary = highestRole(nextRoles);
      const touched = new Set<Role>([...nextRoles, ...currentRoles]);
      for (const r of touched) {
        if (nextRoles.includes(r) === currentRoles.includes(r)) continue;
        assertCanAssign(caller.role, r);
      }
      if (uid === caller.uid && ROLE_RANK[nextPrimary] < ROLE_RANK[current.role]) {
        throw new ApiError("You cannot reduce your own access level.", 400);
      }
    }
    if (body.active === false) {
      if (uid === caller.uid) throw new ApiError("You cannot deactivate your own account.", 400);
      assertCanAssign(caller.role, current.role);
    }
    if (body.password && caller.role !== "SUPER_ADMIN" && ROLE_RANK[current.role] >= ROLE_RANK.ADMIN) {
      throw new ApiError("Only a super admin can reset an admin's password.", 403);
    }
    if (body.orgId !== undefined && caller.role !== "SUPER_ADMIN") {
      throw new ApiError("Only a super admin can assign a team member's organisation.", 403);
    }
    if (body.pageAccessOverrides !== undefined && caller.role !== "SUPER_ADMIN") {
      throw new ApiError("Only a super admin can override a team member's page access.", 403);
    }

    const update: Record<string, unknown> = {};
    for (const key of ["name", "phone", "region", "managerId", "active", "orgId", "pageAccessOverrides", "bypassGeofence", "hrmsAdmin", "attendanceRequired"] as const) {
      if (body[key] !== undefined) update[key] = body[key];
    }
    if (nextRoles && nextPrimary) {
      update.roles = nextRoles;
      update.role = nextPrimary;
    }

    if (Object.keys(update).length) await ref.update(update);

    const auth = adminAuth();
    if (nextRoles && nextPrimary) {
      // See users/route.ts's setCustomUserClaims call — same normalization
      // of a specialization role to its Firestore-rules-recognized value.
      await auth.setCustomUserClaims(uid, { role: ROLE_ENFORCEMENT[nextPrimary] ?? nextPrimary, roles: nextRoles });
    }
    if (body.active !== undefined) await auth.updateUser(uid, { disabled: !body.active });
    if (body.name) await auth.updateUser(uid, { displayName: body.name });
    if (body.password) await auth.updateUser(uid, { password: body.password });
    // Force the next request to re-mint a token so a revoked role stops working.
    if (nextRoles || body.active === false) await auth.revokeRefreshTokens(uid);

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
