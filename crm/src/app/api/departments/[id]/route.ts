import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, requireCaller } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RenameDepartment = z.object({
  name: z.string().min(1).max(80),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireCaller(req, "ADMIN");
    const body = RenameDepartment.parse(await req.json());
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
    await requireCaller(req, "ADMIN");
    await adminDb().collection("departments").doc(params.id).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
