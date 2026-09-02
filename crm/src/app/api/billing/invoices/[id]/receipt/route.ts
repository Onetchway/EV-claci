import { NextResponse } from "next/server";

import { errorResponse, requireCaller } from "@/app/api/_lib/guard";
import { getBillingReceipt } from "@/lib/platform-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const caller = await requireCaller(req, "ADMIN");
    const receipt = await getBillingReceipt(caller.orgId, params.id);
    return NextResponse.json({ data: receipt });
  } catch (err) {
    return errorResponse(err);
  }
}
