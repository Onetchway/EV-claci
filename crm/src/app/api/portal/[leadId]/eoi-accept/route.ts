import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { ApiError, errorResponse, requireInvestorForLead } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The investor clicks Accept on the portal's EOI page (/portal/[leadId]/eoi).
 * See _lib/guard.ts for the identity/ownership boundary this route sits
 * behind; from here on this is just the narrow state transition itself —
 * only eoi.status, eoi.acceptedAt and eoi.acceptedBy are ever touched, never
 * the letter's own content.
 */
export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  try {
    const { uid, phoneE164, db, leadRef, lead } = await requireInvestorForLead(req, params.leadId);

    const eoi = lead.eoi as { status?: string } | undefined;
    if (!eoi) throw new ApiError("No Letter of Intent has been issued on this lead.", 404);
    if (eoi.status !== "ISSUED") {
      throw new ApiError(
        eoi.status === "ACCEPTED"
          ? "This Letter of Intent has already been accepted."
          : "This Letter of Intent isn't available to accept right now.",
        400,
        "NOT_ACCEPTABLE",
      );
    }

    const investorName = (lead.client as { name?: string } | undefined)?.name ?? "The investor";
    const acceptedBy = { name: investorName, phone: phoneE164 };

    await leadRef.update({
      "eoi.status": "ACCEPTED",
      "eoi.acceptedAt": FieldValue.serverTimestamp(),
      "eoi.acceptedBy": acceptedBy,
      updatedAt: FieldValue.serverTimestamp(),
      lastActivityAt: FieldValue.serverTimestamp(),
      lastActivityBy: `${investorName} (investor)`,
    });

    // Same audit-trail shape as setEoiStatus() (lib/db/leads.ts) writes from
    // the CRM side — logActivitySafe itself is client-SDK-only ("use
    // client"), so this route replicates its exact document shape directly
    // via the Admin SDK rather than importing it.
    await db.collection("activities").add({
      leadId: params.leadId,
      ownerId: lead.ownerId ?? null,
      leadCode: lead.code ?? null,
      leadName: investorName,
      type: "EOI_UPDATED",
      message: "Letter of Intent accepted by the investor from the portal",
      changes: [],
      actor: { uid, name: `${investorName} (investor)`, role: "VIEWER" },
      at: FieldValue.serverTimestamp(),
      followUpAt: null,
      mentions: [],
    });

    if (lead.ownerId) {
      await db.collection("notifications").add({
        uid: lead.ownerId,
        title: `${lead.code ?? "A lead"} — investor accepted the EOI`,
        body: `${investorName} accepted the Letter of Intent from the portal.`,
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
