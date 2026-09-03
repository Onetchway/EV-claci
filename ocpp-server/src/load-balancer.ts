/**
 * Zone load balancing — the automatic counterpart to the manual "Set
 * Unavailable" workaround the CRM's /zones page describes. Runs on the
 * same periodic sweep as the offline-connection check (see index.ts).
 *
 * For each zone with a sanctioned load cap (Zones.maxLoadKw), sums the
 * rated power of every charger currently in an Occupied connector state.
 * If that exceeds the cap, every occupied charger in the zone is throttled
 * proportionally via OCPP SetChargingProfile (a TxDefaultProfile absolute
 * limit in watts) so the zone's *live* draw comes back under the cap —
 * this is a soft cap on rated power, not a real-time meter reading, so it
 * assumes each charger draws close to its rated power while occupied.
 * Chargers that drop back under cap (or become unoccupied) get a
 * ClearChargingProfile to restore full power.
 *
 * Only works for chargers connected to *this* server instance (see
 * ocpp/commands.ts's known limitation) — same constraint as every other
 * remote command this server sends.
 */

import { db } from "./firebase.js";
import { sendCommand } from "./ocpp/commands.js";
import { connections } from "./registry.js";

/** In-memory only: the last limit (kW) sent to each charger, so an unchanged zone doesn't resend the same profile every sweep. */
const lastThrottleKw = new Map<string, number>();

interface ZoneChargerInfo {
  chargerId: string;
  powerKw: number;
  occupied: boolean;
}

async function chargersInZone(zoneId: string): Promise<ZoneChargerInfo[]> {
  const regSnap = await db()
    .collection("chargerRegistry")
    .where("zoneId", "==", zoneId)
    .where("active", "==", true)
    .get();
  if (regSnap.empty) return [];

  const infos: ZoneChargerInfo[] = [];
  for (const doc of regSnap.docs) {
    const data = doc.data();
    const chargerId = data.chargerId as string;
    const powerKw = (data.powerKw as number | undefined) ?? 0;
    const cpSnap = await db().collection("chargePoints").doc(chargerId).get();
    const connectors = cpSnap.data()?.connectors as Record<string, { status?: string }> | undefined;
    const occupied = !!connectors && Object.values(connectors).some((c) => c.status === "Occupied");
    infos.push({ chargerId, powerKw, occupied });
  }
  return infos;
}

async function setChargerLimitKw(chargerId: string, limitKw: number): Promise<void> {
  if (!connections.has(chargerId)) return; // not held by this instance — same limitation as every other command
  await sendCommand(chargerId, "SetChargingProfile", {
    evseId: 0,
    chargingProfile: {
      id: 1,
      stackLevel: 0,
      chargingProfilePurpose: "TxDefaultProfile",
      chargingProfileKind: "Absolute",
      chargingSchedule: [{
        id: 1,
        chargingRateUnit: "W",
        chargingSchedulePeriod: [{ startPeriod: 0, limit: Math.max(0, Math.round(limitKw * 1000)) }],
      }],
    },
  });
  lastThrottleKw.set(chargerId, limitKw);
}

async function clearChargerLimit(chargerId: string): Promise<void> {
  if (!connections.has(chargerId)) return;
  await sendCommand(chargerId, "ClearChargingProfile", { chargingProfileId: 1 });
  lastThrottleKw.delete(chargerId);
}

async function balanceZone(zoneId: string, maxLoadKw: number): Promise<void> {
  const chargers = await chargersInZone(zoneId);
  const occupied = chargers.filter((c) => c.occupied && c.powerKw > 0);
  const demandKw = occupied.reduce((a, c) => a + c.powerKw, 0);

  if (demandKw > maxLoadKw && maxLoadKw > 0) {
    const scale = maxLoadKw / demandKw;
    for (const c of occupied) {
      const limitKw = c.powerKw * scale;
      const already = lastThrottleKw.get(c.chargerId);
      if (already != null && Math.abs(already - limitKw) < 0.1) continue; // already at ~this limit
      await setChargerLimitKw(c.chargerId, limitKw).catch((err) => {
        console.error(`[load-balancer] failed to throttle ${c.chargerId}:`, (err as Error).message);
      });
    }
  } else {
    // Under cap — clear any throttle left over from a previous sweep.
    for (const c of chargers) {
      if (!lastThrottleKw.has(c.chargerId)) continue;
      await clearChargerLimit(c.chargerId).catch((err) => {
        console.error(`[load-balancer] failed to clear throttle on ${c.chargerId}:`, (err as Error).message);
      });
    }
  }
}

export async function sweepZoneLoads(): Promise<void> {
  const zonesSnap = await db().collection("zones").where("maxLoadKw", ">", 0).get();
  for (const zoneDoc of zonesSnap.docs) {
    const maxLoadKw = zoneDoc.data().maxLoadKw as number;
    await balanceZone(zoneDoc.id, maxLoadKw).catch((err) => {
      console.error(`[load-balancer] zone ${zoneDoc.id} sweep failed:`, (err as Error).message);
    });
  }
}
