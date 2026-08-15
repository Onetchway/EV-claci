import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { OCPI_COUNTRY_CODE, OCPI_PARTY_ID } from "./identity";
import type {
  OcpiCdr, OcpiConnector, OcpiEvse, OcpiLocation, OcpiSession, OcpiTariff,
} from "./types";

const CONNECTOR_STANDARD: Record<string, string> = {
  "Type 2": "IEC_62196_T2",
  CCS2: "IEC_62196_T2_COMBO",
  CHAdeMO: "CHADEMO",
  "GB/T": "GBT_AC",
  "Bharat AC-001": "IEC_62196_T2",
  "Bharat DC-001": "GBT_DC",
};

const CONNECTOR_STATUS: Record<string, OcpiEvse["status"]> = {
  Available: "AVAILABLE",
  Occupied: "CHARGING",
  Reserved: "RESERVED",
  Unavailable: "INOPERATIVE",
  Faulted: "OUTOFORDER",
};

function toIso(ts: unknown): string {
  const d = (ts as { toDate?: () => Date } | undefined)?.toDate?.();
  return (d ?? new Date()).toISOString();
}

/** One OCPI Location per registered+located charger — a charger without lat/lng can't be published, since OCPI requires coordinates. */
export async function mapLocations(): Promise<OcpiLocation[]> {
  const db = adminDb();
  const [registrySnap, pointsSnap] = await Promise.all([
    db.collection("chargerRegistry").where("active", "==", true).get(),
    db.collection("chargePoints").get(),
  ]);
  const pointByChargerId = new Map(pointsSnap.docs.map((d) => [d.id, d.data()]));

  return registrySnap.docs
    .map((doc) => doc.data())
    .filter((r) => r.lat != null && r.lng != null)
    .map((r): OcpiLocation => {
      const live = pointByChargerId.get(r.chargerId);
      const connectors: OcpiConnector[] = r.connectorType ? [{
        id: "1",
        standard: CONNECTOR_STANDARD[r.connectorType] ?? "IEC_62196_T2",
        format: "CABLE",
        power_type: r.chargerPowerType === "DC" ? "DC" : "AC_3_PHASE",
        max_voltage: 400,
        max_amperage: r.powerKw ? Math.round((r.powerKw * 1000) / 400) : 32,
        max_electric_power: (r.powerKw ?? 0) * 1000,
        last_updated: toIso(live?.lastSeenAt),
      }] : [];

      const connectorStatuses = live?.connectors ? Object.values(live.connectors as Record<string, { status: string }>) : [];
      const evseStatus: OcpiEvse["status"] = live?.status !== "ONLINE"
        ? "OUTOFORDER"
        : (CONNECTOR_STATUS[connectorStatuses[0]?.status ?? "Available"] ?? "UNKNOWN");

      return {
        country_code: OCPI_COUNTRY_CODE,
        party_id: OCPI_PARTY_ID,
        id: r.chargerId,
        publish: true,
        name: r.label,
        address: r.location,
        city: r.location,
        country: "IND",
        coordinates: { latitude: String(r.lat), longitude: String(r.lng) },
        evses: [{
          uid: r.chargerId,
          evse_id: `${OCPI_COUNTRY_CODE}*${OCPI_PARTY_ID}*E${r.chargerId}`,
          status: evseStatus,
          connectors,
          last_updated: toIso(live?.lastSeenAt),
        }],
        last_updated: toIso(live?.lastSeenAt ?? r.createdAt),
      };
    });
}

/** One OCPI Tariff per active ALL_CHARGERS-scope tariff — zone/state/charger-specific tariffs aren't mapped yet (OCPI ties a tariff to a location differently than our scope model). */
export async function mapTariffs(): Promise<OcpiTariff[]> {
  const snap = await adminDb().collection("tariffs").where("active", "==", true).where("scope", "==", "ALL_CHARGERS").get();
  return snap.docs.map((doc) => {
    const t = doc.data();
    const priceType = t.pricingType === "PER_KWH" ? "ENERGY" : t.pricingType === "PER_MINUTE" ? "TIME" : "FLAT";
    return {
      country_code: OCPI_COUNTRY_CODE,
      party_id: OCPI_PARTY_ID,
      id: doc.id,
      currency: "INR",
      elements: [{ price_components: [{ type: priceType as "ENERGY" | "TIME" | "FLAT", price: t.rate, vat: t.gstPct, step_size: 1 }] }],
      last_updated: toIso(t.updatedAt ?? t.createdAt),
    };
  });
}

export async function mapSessions(): Promise<OcpiSession[]> {
  const snap = await adminDb().collection("chargeSessions").orderBy("lastUpdateAt", "desc").limit(200).get();
  return snap.docs.map((doc) => {
    const s = doc.data();
    return {
      country_code: OCPI_COUNTRY_CODE,
      party_id: OCPI_PARTY_ID,
      id: doc.id,
      start_date_time: toIso(s.startedAt),
      end_date_time: s.endedAt ? toIso(s.endedAt) : undefined,
      kwh: (s.energyDeliveredWh ?? 0) / 1000,
      currency: "INR",
      status: s.status === "ACTIVE" ? "ACTIVE" : "COMPLETED",
      last_updated: toIso(s.lastUpdateAt),
    };
  });
}

/** Only sessions that both ended AND were successfully billed become a CDR — an unbilled session has no cost to report. */
export async function mapCdrs(): Promise<OcpiCdr[]> {
  const snap = await adminDb().collection("chargeSessions").where("status", "==", "ENDED").orderBy("lastUpdateAt", "desc").limit(200).get();
  return snap.docs
    .map((doc) => doc.data())
    .filter((s) => s.totalCostInr != null)
    .map((s, i): OcpiCdr => ({
      country_code: OCPI_COUNTRY_CODE,
      party_id: OCPI_PARTY_ID,
      id: `${s.chargePointId}__${s.transactionId ?? i}`,
      start_date_time: toIso(s.startedAt),
      end_date_time: toIso(s.endedAt),
      total_energy: (s.energyDeliveredWh ?? 0) / 1000,
      total_cost: { excl_vat: s.costBeforeGstInr ?? 0, incl_vat: s.totalCostInr ?? 0 },
      currency: "INR",
      last_updated: toIso(s.lastUpdateAt),
    }));
}
