/**
 * Site (host) revenue share. Accrues once a session is billed (see
 * billSession() in registry.ts) if the charger's zone has a
 * revenueSharePct set — e.g. an RWA hosting the charger gets a cut of
 * every session's revenue. Writes to `siteRevenueShares`, a plain
 * PENDING/PAID ledger the CRM's /settlements page reviews and marks paid;
 * this module never marks anything paid itself.
 */

import { FieldValue } from "firebase-admin/firestore";

import { db } from "./firebase.js";
import { loadChargerContext } from "./tariff.js";

export async function accrueSiteRevenueShare(
  chargePointId: string,
  sessionId: string,
  totalCostInr: number,
): Promise<void> {
  if (totalCostInr <= 0) return;

  const { zoneId } = await loadChargerContext(chargePointId);
  if (!zoneId) return;

  const zoneSnap = await db().collection("zones").doc(zoneId).get();
  if (!zoneSnap.exists) return;
  const zone = zoneSnap.data()!;
  const sharePct = zone.revenueSharePct as number | undefined;
  if (!sharePct || sharePct <= 0) return;

  const shareAmountInr = Math.round(totalCostInr * (sharePct / 100) * 100) / 100;
  await db().collection("siteRevenueShares").add({
    zoneId,
    zoneName: (zone.name as string | undefined) ?? "Unknown site",
    sessionId,
    chargePointId,
    grossAmountInr: totalCostInr,
    sharePct,
    shareAmountInr,
    status: "PENDING",
    createdAt: FieldValue.serverTimestamp(),
  });
}
