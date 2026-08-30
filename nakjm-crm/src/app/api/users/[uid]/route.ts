import { NextResponse } from "next/server";
import { z } from "zod";

import { ROLES, ROLE_RANK, type Role } from "@/lib/constants";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { ApiError, errorResponse, highestRole, requireCaller } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Payroll = z.object({
  monthlySalary: z.number().min(0).optional(),
  panNumber: z.string().max(20).optional(),
  pfApplicable: z.boolean().optional(),
  pfNumber: z.string().max(30).optional(),
  uanNumber: z.string().max(20).optional(),
  esiApplicable: z.boolean().optional(),
  esiNumber: z.string().max(30).optional(),
  tdsPercent: z.number().min(0).max(100).optional(),
  bankAccountNo: z.string().max(30).optional(),
  bankIfsc: z.string().max(20).optional(),
  bankName: z.string().max(80).optional(),
});

const PatchUser = z.object({
  name: z.string().min(2).max(80).optional(),
  phone: z.string().max(20).optional(),
  roles: z.array(z.enum(ROLES)).min(1).max(ROLES.length).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).max(72).optional(),
  designation: z.string().max(80).optional(),
  department: z.string().max(40).nullable().optional(),
  officeLocation: z.string().max(120).optional(),
  managerId: z.string().max(128).nullable().optional(),
  managerName: z.string().max(80).nullable().optional(),
  payroll: Payroll.optional(),
});

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

    const update: Record<string, unknown> = {};
    for (const key of ["name", "phone", "active", "designation", "department", "officeLocation", "managerId", "managerName", "payroll"] as const) {
      if (body[key] !== undefined) update[key] = body[key];
    }
    if (nextRoles && nextPrimary) {
      update.roles = nextRoles;
      update.role = nextPrimary;
    }
    if (Object.keys(update).length) await ref.update(update);

    const auth = adminAuth();
    if (nextRoles && nextPrimary) await auth.setCustomUserClaims(uid, { role: nextPrimary, roles: nextRoles });
    if (body.active !== undefined) await auth.updateUser(uid, { disabled: !body.active });
    if (body.name) await auth.updateUser(uid, { displayName: body.name });
    if (body.password) await auth.updateUser(uid, { password: body.password });
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

    await adminDb().collection("users").doc(uid).update({ active: false, deletedAt: new Date() });
    await adminAuth().deleteUser(uid);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
