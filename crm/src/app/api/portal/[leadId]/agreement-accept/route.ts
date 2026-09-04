import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { ApiError, errorResponse, requireInvestorForLead } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The investor clicks Accept on the portal's Agreement page
 * (/portal/[leadId]/agreement). Same shape as eoi-accept/route.ts — see
 * _lib/guard.ts for the identity/ownership boundary. "ACCEPTED" here is
 * deliberately distinct from "SIGNED": ACCEPTED records the investor's
 * portal click, SIGNED is staff recording that the fully executed document
 * was later collected — two different real-world events on the same
 * document, not one relabeled.
 */
export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  try {
    const { uid, phoneE164, db, leadRef, lead } = await requireInvestorForLead(req, params.leadId);

    const agreement = lead.agreement as { status?: string } | undefined;
    if (!agreement) throw new ApiError("No Franchise Agreement has been issued on this lead.", 404);
    if (agreement.status !== "ISSUED") {
      throw new ApiError(
        agreement.status === "ACCEPTED"
          ? "This Franchise Agreement has already been accepted."
          : "This Franchise Agreement isn't available to accept right now.",
        400,
        "NOT_ACCEPTABLE",
      );
    }

    const investorName = (lead.client as { name?: string } | undefined)?.name ?? "The investor";
    const acceptedBy = { name: investorName, phone: phoneE164 };

    await leadRef.update({
      "agreement.status": "ACCEPTED",
      "agreement.acceptedAt": FieldValue.serverTimestamp(),
      "agreement.acceptedBy": acceptedBy,
      updatedAt: FieldValue.serverTimestamp(),
      lastActivityAt: FieldValue.serverTimestamp(),
      lastActivityBy: `${investorName} (investor)`,
    });

    // Same audit-trail shape as setAgreementStatus() (lib/db/leads.ts)
    // writes from the CRM side — see eoi-accept/route.ts's comment on why
    // this is written directly rather than through logActivitySafe.
    await db.collection("activities").add({
      leadId: params.leadId,
      ownerId: lead.ownerId ?? null,
      leadCode: lead.code ?? null,
      leadName: investorName,
      type: "AGREEMENT_UPDATED",
      message: "Franchise Agreement accepted by the investor from the portal",
      changes: [],
      actor: { uid, name: `${investorName} (investor)`, role: "VIEWER" },
      at: FieldValue.serverTimestamp(),
      followUpAt: null,
      mentions: [],
    });

    if (lead.ownerId) {
      await db.collection("notifications").add({
        uid: lead.ownerId,
        title: `${lead.code ?? "A lead"} — investor accepted the Agreement`,
        body: `${investorName} accepted the Franchise Agreement from the portal.`,
        leadId: params.leadId,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
