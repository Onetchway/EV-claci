import { NextResponse } from "next/server";

import { errorResponse, requireCaller } from "@/app/api/_lib/guard";
import { getBillingInvoices } from "@/lib/platform-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const caller = await requireCaller(req, "ADMIN");
    const invoices = await getBillingInvoices(caller.orgId);
    return NextResponse.json({ data: invoices ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}
