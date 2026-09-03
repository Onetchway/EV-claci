/**
 * RFID/tag allow-listing for the Authorize handler.
 *
 * Deliberately fail open when the registry is empty: a brand-new
 * deployment with zero tokens configured would otherwise reject every
 * driver's very first tap with no way to charge at all. The moment an
 * admin adds the first token in the CRM, the charger switches to strict
 * allow-list mode automatically — documented in the README so this isn't
 * a silent surprise.
 */

import { db } from "./firebase.js";

export const RFID_TOKENS = "rfidTokens";
/** Tokens an OCPI eMSP partner has pushed to us (we're the CPO) via the Tokens module's PUT/PATCH — see crm/src/app/api/ocpi/2.2.1/cpo/tokens. Checked only as a fallback for a tag our own rfidTokens registry doesn't know about, so a roaming partner's driver can tap here without us needing our own record of every token on their network. */
export const OCPI_PARTNER_TOKENS = "ocpiPartnerTokens";

/** Resolves the zoneId a charger belongs to, for RFID ZONE-scope checks — same lookup tariff.ts's loadChargerContext does. */
async function zoneIdForCharger(chargePointId: string): Promise<string | null> {
  const snap = await db().collection("chargerRegistry").where("chargerId", "==", chargePointId).limit(1).get();
  return snap.empty ? null : ((snap.docs[0]!.data().zoneId as string | undefined) ?? null);
}

export async function checkIdToken(idToken: string, chargePointId: string): Promise<"Accepted" | "Blocked" | "Unknown"> {
  const collection = db().collection(RFID_TOKENS);

  const [any, match] = await Promise.all([
    collection.limit(1).get(),
    collection.where("idToken", "==", idToken).limit(1).get(),
  ]);

  if (any.empty) return "Accepted"; // no tokens registered yet — open mode

  if (match.empty) return checkOcpiPartnerToken(idToken);
  const token = match.docs[0]!.data();
  const status = token.status as string | undefined;
  if (status !== "ACTIVE") return "Blocked";

  const scope = (token.activationScope as string | undefined) ?? "GLOBAL";
  if (scope === "CHARGER") {
    const chargerIds = (token.scopeChargerIds as string[] | undefined) ?? [];
    if (!chargerIds.includes(chargePointId)) return "Blocked";
  } else if (scope === "ZONE") {
    const scopeZoneId = token.scopeZoneId as string | undefined;
    const actualZoneId = await zoneIdForCharger(chargePointId);
    if (!scopeZoneId || scopeZoneId !== actualZoneId) return "Blocked";
  }
  return "Accepted";
}

/** OCPI Tokens module fallback — the pushed Token's own `valid` flag and `whitelist` field drive this; a partner-pushed token absent, invalid, or NEVER-whitelisted (meaning the partner insists on ALWAYS being asked directly, which this offline check can't do) is treated as Unknown/Blocked rather than guessed at. */
async function checkOcpiPartnerToken(idToken: string): Promise<"Accepted" | "Blocked" | "Unknown"> {
  const snap = await db().collection(OCPI_PARTNER_TOKENS).where("uid", "==", idToken).limit(1).get();
  if (snap.empty) return "Unknown";
  const token = snap.docs[0]!.data();
  if (token.whitelist === "NEVER") return "Unknown";
  return token.valid === true ? "Accepted" : "Blocked";
}

/**
 * Corporate benefit cap check — separate from checkIdToken's allow-list
 * check, since a cap only applies to an id token linked to an EMSP user
 * with monthlyCapInr set. Sums this calendar month's session-charge debits
 * *attributed to that specific user* (walletTransactions.emspUserId), not
 * the shared corporate wallet balance, so one employee's spend doesn't get
 * blamed on another's cap.
 */
export async function checkMonthlyCap(idToken: string): Promise<boolean> {
  const tokenSnap = await db().collection(RFID_TOKENS).where("idToken", "==", idToken).limit(1).get();
  if (tokenSnap.empty) return true;
  const tokenId = tokenSnap.docs[0]!.id;

  const userSnap = await db().collection("emspUsers").where("rfidTokenId", "==", tokenId).limit(1).get();
  if (userSnap.empty) return true;
  const user = userSnap.docs[0]!;
  const cap = user.data().monthlyCapInr as number | undefined;
  if (!cap || cap <= 0) return true;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const txnSnap = await db()
    .collection("walletTransactions")
    .where("emspUserId", "==", user.id)
    .where("type", "==", "DEBIT")
    .where("createdAt", ">=", monthStart)
    .get();
  const spent = txnSnap.docs.reduce((a, d) => a + ((d.data().amountInr as number | undefined) ?? 0), 0);
  return spent < cap;
}
