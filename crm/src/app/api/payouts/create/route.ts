import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { ApiError, errorResponse, requireCaller } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-triggered only — there is no scheduled/automatic payout anywhere
 * in this app, deliberately: this route moves real money via RazorpayX
 * Payouts, so every run is one explicit click against a specific site's
 * specific pending entries, never a background sweep. Needs
 * RAZORPAYX_ACCOUNT_NUMBER (the RazorpayX virtual/current account payouts
 * draw from) alongside the existing RAZORPAY_KEY_ID/SECRET — same
 * Razorpay account, RazorpayX just needs enabling on it.
 *
 * Uses raw fetch against Razorpay's REST API (Basic Auth with
 * key_id:key_secret) rather than the `razorpay` npm package, which
 * doesn't have first-class Payouts/Contacts/Fund Accounts support —
 * these are documented REST endpoints under the same credentials.
 */

const RAZORPAY_API = "https://api.razorpay.com/v1";

const Body = z.object({
  zoneId: z.string().min(1),
  /** The specific siteRevenueShares doc ids being paid out — marked PAID only after the payout is actually created. */
  shareIds: z.array(z.string().min(1)).min(1).max(500),
  mode: z.enum(["IMPS", "NEFT"]).default("IMPS"),
});

function authHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

async function razorpayFetch(path: string, keyId: string, keySecret: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${RAZORPAY_API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: authHeader(keyId, keySecret) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as { error?: { description?: string } }).error?.description ?? `Razorpay returned HTTP ${res.status}.`;
    throw new ApiError(message, 502);
  }
  return data;
}

export async function POST(req: Request) {
  try {
    const caller = await requireCaller(req, "FINANCE");
    const body = Body.parse(await req.json());

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER;
    if (!keyId || !keySecret || !accountNumber) {
      throw new ApiError(
        "Automated payouts aren't configured yet — set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and " +
          "RAZORPAYX_ACCOUNT_NUMBER in this app's environment (RazorpayX must be enabled on the account).",
        503,
      );
    }

    const db = adminDb();
    const zoneRef = db.collection("zones").doc(body.zoneId);
    const zoneSnap = await zoneRef.get();
    if (!zoneSnap.exists) throw new ApiError("Site not found.", 404);
    const zone = zoneSnap.data()!;

    const bankAccountNumber = zone.bankAccountNumber as string | undefined;
    const bankIfscCode = zone.bankIfscCode as string | undefined;
    const bankAccountName = zone.bankAccountName as string | undefined;
    if (!bankAccountNumber || !bankIfscCode || !bankAccountName) {
      throw new ApiError("This site has no bank details on file — add them on Station Management before paying out.", 400);
    }

    const shareRefs = body.shareIds.map((id) => db.collection("siteRevenueShares").doc(id));
    const shareSnaps = await db.getAll(...shareRefs);
    let totalInr = 0;
    for (const snap of shareSnaps) {
      if (!snap.exists) throw new ApiError(`Settlement entry ${snap.id} not found.`, 404);
      const share = snap.data()!;
      if (share.zoneId !== body.zoneId) throw new ApiError(`Settlement entry ${snap.id} doesn't belong to this site.`, 400);
      if (share.status !== "PENDING") throw new ApiError(`Settlement entry ${snap.id} isn't pending.`, 400);
      totalInr += share.shareAmountInr as number;
    }
    if (totalInr <= 0) throw new ApiError("Nothing to pay out.", 400);

    const bankKey = `${bankAccountNumber}|${bankIfscCode}`;
    let contactId = zone.razorpayContactId as string | undefined;
    let fundAccountId = zone.razorpayFundAccountId as string | undefined;
    const cachedBankKey = zone.razorpayFundAccountBankKey as string | undefined;

    if (!contactId) {
      const contact = await razorpayFetch("/contacts", keyId, keySecret, {
        name: bankAccountName, type: "vendor", reference_id: body.zoneId,
      });
      contactId = contact.id as string;
    }

    if (!fundAccountId || cachedBankKey !== bankKey) {
      const fundAccount = await razorpayFetch("/fund_accounts", keyId, keySecret, {
        contact_id: contactId,
        account_type: "bank_account",
        bank_account: { name: bankAccountName, ifsc: bankIfscCode, account_number: bankAccountNumber },
      });
      fundAccountId = fundAccount.id as string;
    }

    await zoneRef.set({ razorpayContactId: contactId, razorpayFundAccountId: fundAccountId, razorpayFundAccountBankKey: bankKey }, { merge: true });

    const payout = await razorpayFetch("/payouts", keyId, keySecret, {
      account_number: accountNumber,
      fund_account_id: fundAccountId,
      amount: Math.round(totalInr * 100),
      currency: "INR",
      mode: body.mode,
      purpose: "payout",
      queue_if_low_balance: true,
      reference_id: `settlement-${body.zoneId}-${Date.now()}`,
      narration: "Livanto Green settlement",
    });

    const batch = db.batch();
    for (const ref of shareRefs) {
      batch.update(ref, {
        status: "PAID", paidAt: new Date(), payoutId: payout.id ?? null, payoutMode: "AUTO", paidBy: caller.uid,
      });
    }
    await batch.commit();

    return NextResponse.json({ ok: true, payoutId: payout.id, status: payout.status, amountInr: totalInr });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
