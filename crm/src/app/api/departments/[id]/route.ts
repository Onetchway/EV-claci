import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { ApiError, errorResponse, requireCaller } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RenameDepartment = z.object({
  name: z.string().min(1).max(80),
});

async function assertSameOrg(callerOrgId: string | null, deptId: string): Promise<void> {
  const snap = await adminDb().collection("departments").doc(deptId).get();
  if (snap.exists && (snap.data()?.orgId ?? null) !== callerOrgId) {
    throw new ApiError("Department not found.", 404);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const caller = await requireCaller(req, "ADMIN");
    const body = RenameDepartment.parse(await req.json());
    await assertSameOrg(caller.orgId, params.id);
    await adminDb().collection("departments").doc(params.id).update({ name: body.name.trim() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const caller = await requireCaller(req, "ADMIN");
    await assertSameOrg(caller.orgId, params.id);
    await adminDb().collection("departments").doc(params.id).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
