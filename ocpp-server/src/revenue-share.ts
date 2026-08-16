/**
 * Site (host) revenue share. Accrues once a session is billed (see
 * billSession() in registry.ts) if the charger's zone has a
 * revenueShareType set — the primary site host's cut, either a % of the
 * total or a flat ₹ amount. Any additionalRevenueShares configured on the
 * zone (other parties splitting the same session — a CPO partner, an
 * equipment financier) accrue their own entries too, all in one write.
 * Writes to `siteRevenueShares`, a plain PENDING/PAID ledger the CRM's
 * /settlements page reviews and marks paid; this module never marks
 * anything paid itself.
 */

import { FieldValue } from "firebase-admin/firestore";

import { db } from "./firebase.js";
import { loadChargerContext } from "./tariff.js";

type RevenueShareType = "PERCENT" | "FIXED";
interface AdditionalRevenueShare {
  name: string;
  type: RevenueShareType;
  value: number;
}

function computeShareAmount(type: RevenueShareType, value: number, totalCostInr: number): number {
  return type === "PERCENT"
    ? Math.round(totalCostInr * (value / 100) * 100) / 100
    : Math.min(value, totalCostInr);
}

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
  const zoneName = (zone.name as string | undefined) ?? "Unknown site";

  const entries: Record<string, unknown>[] = [];

  const shareType = zone.revenueShareType as RevenueShareType | undefined;
  const shareValue = zone.revenueShareValue as number | undefined;
  if (shareType && shareValue && shareValue > 0) {
    entries.push({
      zoneId, zoneName, recipientName: "Site host", kind: "SESSION",
      sessionId, chargePointId, grossAmountInr: totalCostInr,
      shareType, shareRate: shareValue, shareAmountInr: computeShareAmount(shareType, shareValue, totalCostInr),
      status: "PENDING", createdAt: FieldValue.serverTimestamp(),
    });
  }

  const additional = (zone.additionalRevenueShares as AdditionalRevenueShare[] | undefined) ?? [];
  for (const a of additional) {
    if (!a.name || !a.value || a.value <= 0) continue;
    entries.push({
      zoneId, zoneName, recipientName: a.name, kind: "SESSION",
      sessionId, chargePointId, grossAmountInr: totalCostInr,
      shareType: a.type, shareRate: a.value, shareAmountInr: computeShareAmount(a.type, a.value, totalCostInr),
      status: "PENDING", createdAt: FieldValue.serverTimestamp(),
    });
  }

  if (entries.length === 0) return;
  const batch = db().batch();
  for (const entry of entries) batch.set(db().collection("siteRevenueShares").doc(), entry);
  await batch.commit();
}
