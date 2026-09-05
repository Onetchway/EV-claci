import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ROLE_ENFORCEMENT, ROLES, ROLE_RANK, type Role } from "@/lib/constants";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { ApiError, errorResponse, highestRole, nextEmployeeCode, requireCaller } from "../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateUser = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  phone: z.string().max(20).optional().default(""),
  /** A user may hold several roles; their abilities are the union. */
  roles: z.array(z.enum(ROLES)).min(1).max(ROLES.length),
  region: z.string().max(60).optional().nullable(),
  managerId: z.string().max(128).optional().nullable(),
  designation: z.string().max(80).optional(),
  departmentId: z.string().max(128).optional().nullable(),
  officeLocationId: z.string().max(128).optional().nullable(),
  password: z.string().min(8).max(72).optional(),
});

/** Only a super admin may grant admin or above. Rank-based (not a literal "ADMIN" check) so PLATFORM_ADMIN/CPO_ADMIN — same rank as ADMIN, just a clearer label — grant exactly what an ADMIN could. */
function assertCanAssign(callerRole: Role, target: Role) {
  if (callerRole === "SUPER_ADMIN") return;
  if (ROLE_RANK[callerRole] >= ROLE_RANK.ADMIN && ROLE_RANK[target] < ROLE_RANK.ADMIN) return;
  throw new ApiError(`Only a super admin can grant the ${target} role.`, 403);
}

function randomPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function GET(req: Request) {
  try {
    await requireCaller(req, "ADMIN");
    const snap = await adminDb().collection("users").orderBy("name").get();
    return NextResponse.json({
      users: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const caller = await requireCaller(req, "ADMIN");
    const body = CreateUser.parse(await req.json());
    const roles = [...new Set(body.roles)];
    for (const r of roles) assertCanAssign(caller.role, r);
    const primary = highestRole(roles);

    const auth = adminAuth();
    const db = adminDb();

    const existing = await auth.getUserByEmail(body.email).catch(() => null);
    if (existing) throw new ApiError("An account with that email already exists.", 409);

    const password = body.password ?? randomPassword();
    const employeeCode = await nextEmployeeCode();

    const created = await auth.createUser({
      email: body.email,
      password,
      displayName: body.name,
      emailVerified: false,
    });

    // Custom claims let the Firestore security rules check the role without an
    // extra document read on every request. The rules key off the single
    // highest role; the full list travels alongside for the app's own checks.
    // A "specialization" role (PLATFORM_ADMIN, CPO_ADMIN, NOC_OPERATOR,
    // CORPORATE_ADMIN — see constants.ts's ROLE_ENFORCEMENT) is normalized
    // to its underlying role here, since that's the only value Firestore's
    // security rules actually recognize — the Firestore user doc below
    // still stores the real, specific role for display and app-side checks.
    await auth.setCustomUserClaims(created.uid, { role: ROLE_ENFORCEMENT[primary] ?? primary, roles });

    await db.collection("users").doc(created.uid).set({
      uid: created.uid,
      email: body.email,
      name: body.name,
      phone: body.phone ?? "",
      employeeCode,
      role: primary,
      roles,
      region: body.region ?? null,
      managerId: body.managerId ?? null,
      designation: body.designation ?? "",
      departmentId: body.departmentId ?? null,
      officeLocationId: body.officeLocationId ?? null,
      active: true,
      photoURL: null,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: caller.uid,
      lastLoginAt: null,
    });

    // Beyond the temp password shown once to the admin below (still useful
    // if email delivery isn't set up), queue a real "set your password"
    // email — the point that actually lets an external account (Site
    // Owner, Fleet Manager, white-label CMS staff) sign in without an
    // admin relaying a password out of band. Best-effort: a failure here
    // shouldn't fail user creation, since the temp password is still a
    // working fallback.
    try {
      const resetLink = await auth.generatePasswordResetLink(body.email);
      await db.collection("mail").add({
        to: [body.email],
        message: {
          subject: "Set your Livanto Green password",
          html: `<p>Hi ${body.name},</p><p>An account has been created for you on the Livanto Green platform. Set your password to sign in:</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you weren't expecting this, you can ignore this email.</p>`,
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error("[users] failed to queue welcome email", err);
    }

    return NextResponse.json({
      uid: created.uid,
      // Returned once so the admin can hand it over; it is never stored.
      temporaryPassword: body.password ? undefined : password,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
