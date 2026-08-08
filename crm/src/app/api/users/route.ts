import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ROLES, type Role } from "@/lib/constants";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { ApiError, errorResponse, requireCaller } from "../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateUser = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  phone: z.string().max(20).optional().default(""),
  role: z.enum(ROLES),
  region: z.string().max(60).optional().nullable(),
  managerId: z.string().max(128).optional().nullable(),
  password: z.string().min(8).max(72).optional(),
});

/** Only a super admin may mint another admin. */
function assertCanAssign(callerRole: Role, target: Role) {
  if (callerRole === "SUPER_ADMIN") return;
  if (callerRole === "ADMIN" && target === "AGENT") return;
  throw new ApiError("Only a super admin can create admin accounts.", 403);
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
    assertCanAssign(caller.role, body.role);

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

    // Custom claims let the Firestore security rules check the role without an
    // extra document read on every single request.
    await auth.setCustomUserClaims(created.uid, { role: body.role });

    await db.collection("users").doc(created.uid).set({
      uid: created.uid,
      email: body.email,
      name: body.name,
      phone: body.phone ?? "",
      role: body.role,
      region: body.region ?? null,
      managerId: body.managerId ?? null,
      active: true,
      photoURL: null,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: caller.uid,
      lastLoginAt: null,
    });

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
