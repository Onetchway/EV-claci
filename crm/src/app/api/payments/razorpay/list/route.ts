import { NextResponse } from "next/server";
import { z } from "zod";

import { getRazorpayClient } from "@/lib/razorpay-admin.server";
import { ApiError, errorResponse, requireCaller } from "../../../_lib/guard";

const RECONCILE_ROLES = ["SUPER_ADMIN", "ADMIN", "FINANCE", "OPERATIONS"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lists captured Razorpay payments in a date range — the CRM side of
 * reconciliation (see /reconciliation). Only exposes what's needed to
 * cross-check against walletTransactions; the Razorpay key stays server-side.
 * Razorpay's API caps a single page at 100 — for ranges wider than that,
 * this is a known limitation rather than paginating silently, since a
 * reconciliation run should say so rather than quietly missing rows.
 */

const Query = z.object({
  from: z.coerce.number().int().positive(),
  to: z.coerce.number().int().positive(),
});

export async function GET(req: Request) {
  try {
    const caller = await requireCaller(req, "OPERATIONS");
    if (!caller.roles.some((r) => RECONCILE_ROLES.includes(r))) {
      throw new ApiError("Reconciliation is restricted to Finance, Operations and Admin.", 403);
    }
    const { searchParams } = new URL(req.url);
    const { from, to } = Query.parse({ from: searchParams.get("from"), to: searchParams.get("to") });

    const razorpay = getRazorpayClient();
    const result = await razorpay.payments.all({ from, to, count: 100 });

    const payments = result.items
      .filter((p) => p.status === "captured")
      .map((p) => ({
        id: p.id,
        amountInr: Number(p.amount) / 100,
        createdAt: p.created_at,
        email: p.email,
        contact: p.contact,
      }));

    return NextResponse.json({ ok: true, payments, truncated: result.items.length >= 100 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
