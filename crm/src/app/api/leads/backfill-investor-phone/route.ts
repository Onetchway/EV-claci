import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { errorResponse, requireCaller } from "../../_lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalisePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) return digits.slice(-10);
  return digits.slice(-10) || digits;
}
const toE164India = (raw: string) => `+91${normalisePhone(raw)}`;

/**
 * Goes through the Admin SDK rather than a direct client batch write: the
 * `leads` Firestore rule requires `actorIsSelf('updatedBy')`, i.e. the write
 * must attribute itself to the caller — but this backfill only patches
 * `investorPhoneE164`, leaving each lead's existing `updatedBy` (whoever
 * last edited it) untouched, so a client-side write would be rejected for
 * any lead the calling admin didn't themselves last touch. The Admin SDK
 * has no such constraint.
 */
export async function POST(req: Request) {
  try {
    await requireCaller(req, "ADMIN");
    const db = adminDb();
    const snap = await db.collection("leads").get();

    let updated = 0;
    const BATCH_SIZE = 400;
    let batch = db.batch();
    let inBatch = 0;

    for (const doc of snap.docs) {
      const data = doc.data() as { client?: { phone?: string }; investorPhoneE164?: string | null };
      const phone = data.client?.phone;
      if (!phone) continue;
      const expected = toE164India(phone);
      if (data.investorPhoneE164 === expected) continue;
      batch.update(doc.ref, { investorPhoneE164: expected });
      updated++;
      inBatch++;
      if (inBatch >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    }
    if (inBatch > 0) await batch.commit();

    return NextResponse.json({ updated });
  } catch (err) {
    return errorResponse(err);
  }
}
