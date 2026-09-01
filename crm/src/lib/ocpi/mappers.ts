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

/**
 * Scopes that can be resolved statically, for a specific charger, with no
 * per-session context (no id token, no time window) — what a roaming
 * partner's connector.tariff_ids needs. USER/CORPORATE/FLEET/
 * SPECIFIC_CONNECTORS and any time-windowed tariff are session-specific and
 * left out, same reasoning ocpp-server/src/tariff.ts's resolveTariff uses
 * per-session, just without the session-only inputs here. Order matches
 * that file's SCOPE_SPECIFICITY (most specific first) since only one
 * tariff_id is published per connector.
 */
const LOCATION_SCOPE_ORDER = ["SPECIFIC_CHARGERS", "ZONE", "CITY", "STATE", "ALL_CHARGERS"] as const;

interface LocationScopedTariff {
  id: string;
  scope: (typeof LOCATION_SCOPE_ORDER)[number];
  chargerIds: string[];
  zoneIds: string[];
  cities: string[];
  states: string[];
  timeWindow?: unknown;
}

function tariffForCharger(
  tariffs: LocationScopedTariff[],
  chargerId: string,
  zoneId: string | null,
  city: string | null,
  state: string | null,
): string | undefined {
  // Static publication skips anything time-windowed — a partner reading
  // this once has no way to know when the window applies.
  const eligible = tariffs.filter((t) => !t.timeWindow);
  for (const scope of LOCATION_SCOPE_ORDER) {
    const match = eligible.find((t) => {
      if (t.scope !== scope) return false;
      if (scope === "SPECIFIC_CHARGERS") return t.chargerIds.includes(chargerId);
      if (scope === "ZONE") return !!zoneId && t.zoneIds.includes(zoneId);
      if (scope === "CITY") return !!city && t.cities.includes(city);
      if (scope === "STATE") return !!state && t.states.includes(state);
      return true; // ALL_CHARGERS
    });
    if (match) return match.id;
  }
  return undefined;
}

/** One OCPI Location per registered+located charger — a charger without lat/lng can't be published, since OCPI requires coordinates. */
export async function mapLocations(): Promise<OcpiLocation[]> {
  const db = adminDb();
  const [registrySnap, pointsSnap, zonesSnap, tariffsSnap] = await Promise.all([
    db.collection("chargerRegistry").where("active", "==", true).get(),
    db.collection("chargePoints").get(),
    db.collection("zones").get(),
    db.collection("tariffs").where("active", "==", true)
      .where("scope", "in", LOCATION_SCOPE_ORDER as unknown as string[]).get(),
  ]);
  const pointByChargerId = new Map(pointsSnap.docs.map((d) => [d.id, d.data()]));
  const cityByZoneId = new Map(zonesSnap.docs.map((d) => [d.id, d.data().city as string | undefined]));
  const locationScopedTariffs: LocationScopedTariff[] = tariffsSnap.docs.map((d) => {
    const t = d.data();
    return {
      id: d.id,
      scope: t.scope,
      chargerIds: t.chargerIds ?? [],
      zoneIds: t.zoneIds ?? [],
      cities: t.cities ?? [],
      states: t.states ?? [],
      timeWindow: t.timeWindow ?? null,
    };
  });

  return registrySnap.docs
    .map((doc) => doc.data())
    .filter((r) => r.lat != null && r.lng != null)
    .map((r): OcpiLocation => {
      const live = pointByChargerId.get(r.chargerId);
      const zoneId = (r.zoneId as string | undefined) ?? null;
      const tariffId = tariffForCharger(
        locationScopedTariffs, r.chargerId as string, zoneId,
        zoneId ? (cityByZoneId.get(zoneId) ?? null) : null, (r.state as string | undefined) ?? null,
      );
      const connectors: OcpiConnector[] = r.connectorType ? [{
        id: "1",
        standard: CONNECTOR_STANDARD[r.connectorType] ?? "IEC_62196_T2",
        format: "CABLE",
        power_type: r.chargerPowerType === "DC" ? "DC" : "AC_3_PHASE",
        max_voltage: 400,
        max_amperage: r.powerKw ? Math.round((r.powerKw * 1000) / 400) : 32,
        max_electric_power: (r.powerKw ?? 0) * 1000,
        ...(tariffId && { tariff_ids: [tariffId] }),
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

/**
 * One OCPI Tariff per active, non-time-windowed tariff whose scope resolves
 * statically to a location (ALL_CHARGERS/SPECIFIC_CHARGERS/ZONE/CITY/
 * STATE — see LOCATION_SCOPE_ORDER above). USER/CORPORATE/FLEET/
 * SPECIFIC_CONNECTORS and time-windowed tariffs are session-specific and
 * can't be published as a standing price a partner reads once.
 */
export async function mapTariffs(): Promise<OcpiTariff[]> {
  const snap = await adminDb().collection("tariffs").where("active", "==", true)
    .where("scope", "in", LOCATION_SCOPE_ORDER as unknown as string[]).get();
  return snap.docs.filter((doc) => !doc.data().timeWindow).map((doc) => {
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
/** Reads the persisted `cdrs` collection (written once at billing time — see ocpp-server/src/registry.ts's billSession) rather than reconstructing CDRs live from chargeSessions on every request. */
export async function mapCdrs(): Promise<OcpiCdr[]> {
  const snap = await adminDb().collection("cdrs").orderBy("createdAt", "desc").limit(200).get();
  return snap.docs.map((doc) => {
    const c = doc.data();
    return {
      country_code: OCPI_COUNTRY_CODE,
      party_id: OCPI_PARTY_ID,
      id: doc.id,
      start_date_time: toIso(c.startedAt),
      end_date_time: toIso(c.endedAt),
      total_energy: (c.energyDeliveredWh ?? 0) / 1000,
      total_cost: { excl_vat: c.costBeforeGstInr ?? 0, incl_vat: c.totalCostInr ?? 0 },
      currency: c.currency ?? "INR",
      last_updated: toIso(c.createdAt),
    };
  });
}
