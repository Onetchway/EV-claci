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

export async function checkIdToken(idToken: string): Promise<"Accepted" | "Blocked" | "Unknown"> {
  const collection = db().collection(RFID_TOKENS);

  const [any, match] = await Promise.all([
    collection.limit(1).get(),
    collection.where("idToken", "==", idToken).limit(1).get(),
  ]);

  if (any.empty) return "Accepted"; // no tokens registered yet — open mode

  if (match.empty) return "Unknown";
  const status = match.docs[0]!.data().status as string | undefined;
  return status === "ACTIVE" ? "Accepted" : "Blocked";
}
