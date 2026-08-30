import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ROLES, ROLE_RANK, type Role } from "@/lib/constants";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { ApiError, errorResponse, highestRole, requireCaller } from "../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateUser = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  phone: z.string().max(20).optional().default(""),
  roles: z.array(z.enum(ROLES)).min(1).max(ROLES.length),
  password: z.string().min(8).max(72).optional(),
});

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
    return NextResponse.json({ users: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
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

    const created = await auth.createUser({
      email: body.email,
      password,
      displayName: body.name,
      emailVerified: false,
    });

    // Custom claims let the Firestore security rules check the role without
    // an extra document read on every request.
    await auth.setCustomUserClaims(created.uid, { role: primary, roles });

    await db.collection("users").doc(created.uid).set({
      uid: created.uid,
      email: body.email,
      name: body.name,
      phone: body.phone ?? "",
      role: primary,
      roles,
      active: true,
      photoURL: null,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: caller.uid,
      lastLoginAt: null,
    });

    const resetLink = await auth.generatePasswordResetLink(body.email).catch(() => null);

    return NextResponse.json({
      uid: created.uid,
      temporaryPassword: body.password ? undefined : password,
      resetLink,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
