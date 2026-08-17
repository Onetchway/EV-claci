/**
 * Site (host) revenue share. Accrues once a session is billed (see
 * billSession() in registry.ts) if the charger's zone has a
 * revenueShareType set — the primary site host's cut, a % of the total, a
 * flat ₹ amount, or a ₹-per-kWh rate. Any additionalRevenueShares configured on the
 * zone (other parties splitting the same session — a CPO partner, an
 * equipment financier) accrue their own entries too, all in one write.
 * Writes to `siteRevenueShares`, a plain PENDING/PAID ledger the CRM's
 * /settlements page reviews and marks paid; this module never marks
 * anything paid itself.
 */

import { FieldValue } from "firebase-admin/firestore";

import { db } from "./firebase.js";
import { loadChargerContext } from "./tariff.js";

type RevenueShareType = "PERCENT" | "FIXED" | "PROFIT_SHARE" | "TIERED_HYBRID" | "PER_KWH";
interface AdditionalRevenueShare {
  name: string;
  type: RevenueShareType;
  value: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * PROFIT_SHARE and TIERED_HYBRID both need to know the session's energy
 * (to compute electricity cost) and the zone's electricityCostPerKwh — the
 * other two types don't, so those two params are optional and only
 * additional-revenue-share entries (which are always PERCENT/FIXED today)
 * never need them.
 */
function computeShareAmount(
  type: RevenueShareType,
  value: number,
  totalCostInr: number,
  energyDeliveredWh: number,
  electricityCostPerKwh: number,
  hybridPct: number,
): number {
  const electricityCostInr = electricityCostPerKwh > 0 ? (energyDeliveredWh / 1000) * electricityCostPerKwh : 0;
  if (type === "PERCENT") return round2(totalCostInr * (value / 100));
  if (type === "FIXED") return round2(Math.min(value, totalCostInr));
  if (type === "PER_KWH") return round2((energyDeliveredWh / 1000) * value);
  if (type === "PROFIT_SHARE") {
    const profit = Math.max(0, totalCostInr - electricityCostInr);
    return round2(profit * (value / 100));
  }
  // TIERED_HYBRID: a flat floor (value), plus hybridPct% of whatever profit remains after electricity cost and that floor.
  const floor = Math.min(value, totalCostInr);
  const remainingProfit = Math.max(0, totalCostInr - electricityCostInr - floor);
  return round2(floor + remainingProfit * (hybridPct / 100));
}

export async function accrueSiteRevenueShare(
  chargePointId: string,
  sessionId: string,
  totalCostInr: number,
  energyDeliveredWh: number,
): Promise<void> {
  if (totalCostInr <= 0) return;

  const { zoneId } = await loadChargerContext(chargePointId);
  if (!zoneId) return;

  const [zoneSnap, regSnap] = await Promise.all([
    db().collection("zones").doc(zoneId).get(),
    db().collection("chargerRegistry").where("chargerId", "==", chargePointId).limit(1).get(),
  ]);
  if (!zoneSnap.exists) return;
  const zone = zoneSnap.data()!;
  const zoneName = (zone.name as string | undefined) ?? "Unknown site";

  // A charger with its own revenueShareOverride prices the primary
  // "Site host" entry off its own fields instead of the zone's — e.g. one
  // fast charger at a site financed by a different partner than the rest.
  // additionalRevenueShares (other parties splitting the same session)
  // stay zone-level only: those are about the site as a whole, not a
  // single charger, so a per-charger override doesn't touch them.
  const reg = regSnap.docs[0]?.data();
  const useOverride = reg?.revenueShareOverride === true;
  const source = useOverride ? reg! : zone;
  const electricityCostPerKwh = (source.electricityCostPerKwh as number | undefined) ?? 0;
  const hybridPct = (source.revenueShareHybridPct as number | undefined) ?? 0;

  const entries: Record<string, unknown>[] = [];

  const shareType = source.revenueShareType as RevenueShareType | undefined;
  const shareValue = source.revenueShareValue as number | undefined;
  if (shareType && shareValue && shareValue > 0) {
    entries.push({
      zoneId, zoneName, recipientName: "Site host", kind: "SESSION",
      sessionId, chargePointId, grossAmountInr: totalCostInr,
      shareType, shareRate: shareValue,
      shareAmountInr: computeShareAmount(shareType, shareValue, totalCostInr, energyDeliveredWh, electricityCostPerKwh, hybridPct),
      status: "PENDING", createdAt: FieldValue.serverTimestamp(),
    });
  }

  const additional = (zone.additionalRevenueShares as AdditionalRevenueShare[] | undefined) ?? [];
  for (const a of additional) {
    if (!a.name || !a.value || a.value <= 0) continue;
    entries.push({
      zoneId, zoneName, recipientName: a.name, kind: "SESSION",
      sessionId, chargePointId, grossAmountInr: totalCostInr,
      shareType: a.type, shareRate: a.value,
      shareAmountInr: computeShareAmount(a.type, a.value, totalCostInr, energyDeliveredWh, electricityCostPerKwh, hybridPct),
      status: "PENDING", createdAt: FieldValue.serverTimestamp(),
    });
  }

  if (entries.length === 0) return;
  const batch = db().batch();
  for (const entry of entries) batch.set(db().collection("siteRevenueShares").doc(), entry);
  await batch.commit();
}
