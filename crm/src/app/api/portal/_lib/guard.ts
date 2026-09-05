import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import { adminAuth, adminConfigured, adminDb } from "@/lib/firebase/admin";
import { ApiError } from "../../_lib/guard";

export { ApiError, errorResponse } from "../../_lib/guard";

/**
 * The investor portal signs in with phone number + OTP only — never a CRM
 * profile or role (see lib/portal-auth.tsx and firestore.rules'
 * investorSignedIn()/ownsLeadAsInvestor()). There is deliberately no
 * Firestore rule letting that client write leads/{leadId} directly: a
 * client-writable rule on a nested map field (eoi/agreement) can't actually
 * constrain which sub-keys change — Firestore's diff().affectedKeys() only
 * sees the top-level field name changed, not which keys inside it — so a
 * naive rule would let an investor rewrite the whole document, legal text
 * and amounts included. This helper is the trust boundary instead: every
 * portal write route re-verifies the caller's token and re-checks lead
 * ownership itself via the Admin SDK, which bypasses rules on purpose
 * because this code IS the enforcement.
 */
export interface InvestorCaller {
  uid: string;
  /** +91XXXXXXXXXX, straight from the verified token — the exact form Lead.investorPhoneE164 is kept in. */
  phoneE164: string;
  db: Firestore;
  leadRef: FirebaseFirestore.DocumentReference;
  /** Raw Firestore data for the lead — already confirmed to belong to this investor. */
  lead: FirebaseFirestore.DocumentData;
}

/**
 * Verifies the bearer token is a phone-auth (portal) session, then confirms
 * the token's phone number matches this exact lead's `investorPhoneE164` —
 * the same field and comparison firestore.rules' ownsLeadAsInvestor() uses,
 * kept in lockstep so "what the investor could already read" and "what they
 * can now act on" never diverge. This is what stops investor A from acting
 * on investor B's lead: the token phone number comes from Firebase's own
 * verified OTP session, not anything the client sends, and it must equal
 * the specific lead's own investor phone.
 */
export async function requireInvestorForLead(req: Request, leadId: string): Promise<InvestorCaller> {
  if (!adminConfigured()) {
    throw new ApiError("This server has no Firebase Admin credentials configured.", 503);
  }

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new ApiError("Missing bearer token.", 401);

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(token, true);
  } catch {
    throw new ApiError("Invalid or expired session. Sign in again.", 401);
  }

  if (decoded.firebase.sign_in_provider !== "phone") {
    throw new ApiError("This action is only available from the investor portal.", 403);
  }
  const phoneE164 = decoded.phone_number as string | undefined;
  if (!phoneE164) throw new ApiError("No verified phone number on this session.", 403);

  const db = adminDb();
  const leadRef = db.collection("leads").doc(leadId);
  const snap = await leadRef.get();
  if (!snap.exists) throw new ApiError("Lead not found.", 404);
  const lead = snap.data()!;

  if (lead.investorPhoneE164 !== phoneE164) {
    throw new ApiError("You do not have access to this document.", 403);
  }

  return { uid: decoded.uid, phoneE164, db, leadRef, lead };
}
