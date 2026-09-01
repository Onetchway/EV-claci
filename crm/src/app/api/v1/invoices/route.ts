import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { errorResponse } from "../../_lib/guard";
import { requireApiKey } from "../_lib/apikey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only recent invoices for external integrations (e.g. syncing into
 * an accounting system). Auth: `Authorization: Bearer <api key>`.
 */
export async function GET(req: Request) {
  let finish: ((status: number) => void) | undefined;
  try {
    ({ finish } = await requireApiKey(req));
    const db = adminDb();

    const snap = await db.collection("invoices").orderBy("createdAt", "desc").limit(100).get();
    const invoices = snap.docs.map((d) => {
      const inv = d.data();
      return {
        id: d.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        billToName: inv.billToName,
        billToGstin: inv.billToGstin ?? null,
        periodStart: inv.periodStart?.toDate?.() ?? null,
        periodEnd: inv.periodEnd?.toDate?.() ?? null,
        subtotalInr: inv.subtotalInr,
        gstInr: inv.gstInr,
        totalInr: inv.totalInr,
        hsnSac: inv.hsnSac ?? null,
        tdsPct: inv.tdsPct ?? null,
        tdsInr: inv.tdsInr ?? null,
      };
    });

    finish?.(200);
    return NextResponse.json({ invoices });
  } catch (err) {
    const res = errorResponse(err);
    finish?.(res.status);
    return res;
  }
}
