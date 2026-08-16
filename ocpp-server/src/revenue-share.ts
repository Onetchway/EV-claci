/**
 * Site (host) revenue share. Accrues once a session is billed (see
 * billSession() in registry.ts) if the charger's zone has a
 * revenueShareType set — e.g. an RWA hosting the charger gets a cut of
 * every session's revenue, either a % of the total or a flat ₹ amount.
 * Writes to `siteRevenueShares`, a plain PENDING/PAID ledger the CRM's
 * /settlements page reviews and marks paid; this module never marks
 * anything paid itself.
 */

import { FieldValue } from "firebase-admin/firestore";

import { db } from "./firebase.js";
import { loadChargerContext } from "./tariff.js";

type RevenueShareType = "PERCENT" | "FIXED";

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
  const shareType = zone.revenueShareType as RevenueShareType | undefined;
  const shareValue = zone.revenueShareValue as number | undefined;
  if (!shareType || !shareValue || shareValue <= 0) return;

  const shareAmountInr = shareType === "PERCENT"
    ? Math.round(totalCostInr * (shareValue / 100) * 100) / 100
    : Math.min(shareValue, totalCostInr);

  await db().collection("siteRevenueShares").add({
    zoneId,
    zoneName: (zone.name as string | undefined) ?? "Unknown site",
    sessionId,
    chargePointId,
    grossAmountInr: totalCostInr,
    shareType,
    shareRate: shareValue,
    shareAmountInr,
    status: "PENDING",
    createdAt: FieldValue.serverTimestamp(),
  });
}
