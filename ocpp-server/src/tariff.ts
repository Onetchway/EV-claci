/**
 * Charging-session pricing. Resolves which tariff rule applies to a charger
 * at a given moment and computes what a session costs, at TransactionEvent
 * "Ended" (see registry.ts's recordTransactionEvent).
 *
 * The tariff *data model* and CRUD live in the CRM
 * (crm/src/lib/db/tariffs.ts, crm/src/app/(app)/tariffs) — this file
 * mirrors the resolution semantics documented there. No shared package
 * exists between the two repos, so keep this in sync deliberately if the
 * resolution rules ever change on either side.
 */

import { db } from "./firebase.js";

export type TariffPricingType = "PER_KWH" | "PER_MINUTE" | "PER_SESSION";
export type TariffScope =
  | "ALL_CHARGERS" | "STATE" | "CITY" | "ZONE" | "FLEET" | "USER" | "CORPORATE"
  | "SPECIFIC_CHARGERS" | "SPECIFIC_CONNECTORS";

export interface TariffTimeWindow {
  daysOfWeek: number[];
  startMinute: number;
  endMinute: number;
}

export interface TariffDoc {
  id: string;
  name: string;
  scope: TariffScope;
  chargerIds: string[];
  connectorKeys: string[];
  zoneIds: string[];
  cities: string[];
  states: string[];
  /** Only used when scope === "FLEET" — matches the vehicle's fleetId (traced via the session's id token → its RFID card → the vehicle it's assigned to). */
  fleetIds: string[];
  /** Only used when scope === "USER" — matches the session's id token → its RFID card → the EMSP user it's assigned to. */
  emspUserIds: string[];
  /** Only used when scope === "CORPORATE" — matches that EMSP user's corporateAccountId. */
  corporateAccountIds: string[];
  pricingType: TariffPricingType;
  rate: number;
  gstPct: number;
  platformFeeInr: number;
  parkingFeeInr?: number;
  idleFeeInrPerMin?: number;
  idleGraceMinutes?: number;
  timeWindow?: TariffTimeWindow | null;
  priority: number;
  active: boolean;
}

export interface BilledCost {
  tariffId: string;
  tariffName: string;
  costBeforeGstInr: number;
  gstPct: number;
  gstInr: number;
  parkingFeeInr: number;
  idleFeeInr: number;
  totalCostInr: number;
}

function matchesTimeWindow(tw: TariffTimeWindow, at: Date): boolean {
  if (tw.daysOfWeek.length > 0 && !tw.daysOfWeek.includes(at.getDay())) return false;
  const minute = at.getHours() * 60 + at.getMinutes();
  if (tw.startMinute <= tw.endMinute) return minute >= tw.startMinute && minute < tw.endMinute;
  return minute >= tw.startMinute || minute < tw.endMinute; // window crosses midnight
}

/** Higher = more specific; used to pick the best match when several tariffs apply. */
const SCOPE_SPECIFICITY: Record<TariffScope, number> = {
  SPECIFIC_CONNECTORS: 8,
  SPECIFIC_CHARGERS: 7,
  USER: 6,
  CORPORATE: 5,
  FLEET: 4,
  ZONE: 3,
  CITY: 2,
  STATE: 1,
  ALL_CHARGERS: 0,
};
function specificity(t: TariffDoc): number {
  return SCOPE_SPECIFICITY[t.scope] + (t.timeWindow ? 1 : 0);
}

export interface ChargerContext {
  zoneId: string | null;
  state: string | null;
  city: string | null;
}

export async function loadChargerContext(chargerId: string): Promise<ChargerContext> {
  const snap = await db().collection("chargerRegistry").where("chargerId", "==", chargerId).limit(1).get();
  if (snap.empty) return { zoneId: null, state: null, city: null };
  const data = snap.docs[0]!.data();
  const zoneId = (data.zoneId as string | undefined) ?? null;
  let city: string | null = null;
  if (zoneId) {
    const zoneSnap = await db().collection("zones").doc(zoneId).get();
    city = (zoneSnap.data()?.city as string | undefined) ?? null;
  }
  return { zoneId, state: (data.state as string | undefined) ?? null, city };
}

interface UserContext {
  fleetId: string | null;
  emspUserId: string | null;
  corporateAccountId: string | null;
}

/** Traces an id token → its rfidTokens doc → whichever of a vehicle (FLEET), a driver's EMSP user (USER), or that user's corporate account (CORPORATE) the card is assigned to. */
async function loadUserContextForIdToken(idToken: string | null | undefined): Promise<UserContext> {
  const empty: UserContext = { fleetId: null, emspUserId: null, corporateAccountId: null };
  if (!idToken) return empty;
  const tokenSnap = await db().collection("rfidTokens").where("idToken", "==", idToken).limit(1).get();
  if (tokenSnap.empty) return empty;
  const tokenId = tokenSnap.docs[0]!.id;

  const [vehicleSnap, userSnap] = await Promise.all([
    db().collection("vehicles").where("rfidTokenId", "==", tokenId).limit(1).get(),
    db().collection("emspUsers").where("rfidTokenId", "==", tokenId).limit(1).get(),
  ]);

  const fleetId = vehicleSnap.empty ? null : ((vehicleSnap.docs[0]!.data().fleetId as string | undefined) ?? null);
  const emspUserId = userSnap.empty ? null : userSnap.docs[0]!.id;
  const corporateAccountId = userSnap.empty ? null : ((userSnap.docs[0]!.data().corporateAccountId as string | undefined) ?? null);
  return { fleetId, emspUserId, corporateAccountId };
}

export async function resolveTariff(
  chargerId: string,
  at: Date,
  connectorId?: number | null,
  idToken?: string | null,
): Promise<TariffDoc | null> {
  const [snap, ctx, userCtx] = await Promise.all([
    db().collection("tariffs").where("active", "==", true).get(),
    loadChargerContext(chargerId),
    loadUserContextForIdToken(idToken),
  ]);

  const connectorKey = connectorId != null ? `${chargerId}#${connectorId}` : null;

  const candidates: TariffDoc[] = [];
  for (const doc of snap.docs) {
    const t = { id: doc.id, ...doc.data() } as TariffDoc;
    if (t.scope === "SPECIFIC_CONNECTORS" && (!connectorKey || !(t.connectorKeys ?? []).includes(connectorKey))) continue;
    if (t.scope === "SPECIFIC_CHARGERS" && !t.chargerIds.includes(chargerId)) continue;
    if (t.scope === "USER" && (!userCtx.emspUserId || !(t.emspUserIds ?? []).includes(userCtx.emspUserId))) continue;
    if (t.scope === "CORPORATE" && (!userCtx.corporateAccountId || !(t.corporateAccountIds ?? []).includes(userCtx.corporateAccountId))) continue;
    if (t.scope === "FLEET" && (!userCtx.fleetId || !(t.fleetIds ?? []).includes(userCtx.fleetId))) continue;
    if (t.scope === "ZONE" && (!ctx.zoneId || !t.zoneIds.includes(ctx.zoneId))) continue;
    if (t.scope === "CITY" && (!ctx.city || !(t.cities ?? []).includes(ctx.city))) continue;
    if (t.scope === "STATE" && (!ctx.state || !t.states.includes(ctx.state))) continue;
    if (t.timeWindow && !matchesTimeWindow(t.timeWindow, at)) continue;
    candidates.push(t);
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => specificity(b) - specificity(a) || b.priority - a.priority);
  return candidates[0]!;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeCost(
  tariff: TariffDoc,
  energyWh: number | null,
  durationMinutes: number,
  idleMinutes = 0,
): BilledCost {
  let base: number;
  if (tariff.pricingType === "PER_KWH") base = tariff.rate * ((energyWh ?? 0) / 1000);
  else if (tariff.pricingType === "PER_MINUTE") base = tariff.rate * durationMinutes;
  else base = tariff.rate;

  const graceMinutes = tariff.idleGraceMinutes ?? 0;
  const billableIdleMinutes = Math.max(0, idleMinutes - graceMinutes);
  const idleFeeInr = tariff.idleFeeInrPerMin ? round2(tariff.idleFeeInrPerMin * billableIdleMinutes) : 0;
  const parkingFeeInr = (tariff.parkingFeeInr && idleMinutes > graceMinutes) ? tariff.parkingFeeInr : 0;

  const costBeforeGstInr = round2(base + tariff.platformFeeInr + idleFeeInr + parkingFeeInr);
  const gstInr = round2(costBeforeGstInr * (tariff.gstPct / 100));
  return {
    tariffId: tariff.id,
    tariffName: tariff.name,
    costBeforeGstInr,
    gstPct: tariff.gstPct,
    gstInr,
    parkingFeeInr,
    idleFeeInr,
    totalCostInr: round2(costBeforeGstInr + gstInr),
  };
}
