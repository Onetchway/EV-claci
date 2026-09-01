import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, requireCaller } from "../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateDepartment = z.object({
  name: z.string().min(1).max(80),
});

/**
 * Goes through the Admin SDK (like /api/users) rather than a direct client
 * Firestore write gated by `isAdmin()` in the rules — that check reads the
 * ID token's role *custom claim*, which can silently drift from the
 * Firestore profile (e.g. the first-run bootstrap account never gets one
 * set, since only the Admin SDK can set claims). requireCaller reads the
 * Firestore role directly, so this route works regardless of claim drift.
 */
export async function POST(req: Request) {
  try {
    const caller = await requireCaller(req, "ADMIN");
    const body = CreateDepartment.parse(await req.json());

    const ref = await adminDb().collection("departments").add({
      name: body.name.trim(),
      orgId: caller.orgId,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: { uid: caller.uid, name: caller.name, role: caller.role },
    });

    return NextResponse.json({ id: ref.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
