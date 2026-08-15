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
export type TariffScope = "ALL_CHARGERS" | "STATE" | "ZONE" | "SPECIFIC_CHARGERS";

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
  zoneIds: string[];
  states: string[];
  pricingType: TariffPricingType;
  rate: number;
  gstPct: number;
  platformFeeInr: number;
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
  SPECIFIC_CHARGERS: 3,
  ZONE: 2,
  STATE: 1,
  ALL_CHARGERS: 0,
};
function specificity(t: TariffDoc): number {
  return SCOPE_SPECIFICITY[t.scope] + (t.timeWindow ? 1 : 0);
}

interface ChargerContext {
  zoneId: string | null;
  state: string | null;
}

async function loadChargerContext(chargerId: string): Promise<ChargerContext> {
  const snap = await db().collection("chargerRegistry").where("chargerId", "==", chargerId).limit(1).get();
  if (snap.empty) return { zoneId: null, state: null };
  const data = snap.docs[0]!.data();
  return { zoneId: (data.zoneId as string | undefined) ?? null, state: (data.state as string | undefined) ?? null };
}

export async function resolveTariff(chargerId: string, at: Date): Promise<TariffDoc | null> {
  const [snap, ctx] = await Promise.all([
    db().collection("tariffs").where("active", "==", true).get(),
    loadChargerContext(chargerId),
  ]);

  const candidates: TariffDoc[] = [];
  for (const doc of snap.docs) {
    const t = { id: doc.id, ...doc.data() } as TariffDoc;
    if (t.scope === "SPECIFIC_CHARGERS" && !t.chargerIds.includes(chargerId)) continue;
    if (t.scope === "ZONE" && (!ctx.zoneId || !t.zoneIds.includes(ctx.zoneId))) continue;
    if (t.scope === "STATE" && (!ctx.state || !t.states.includes(ctx.state))) continue;
    if (t.timeWindow && !matchesTimeWindow(t.timeWindow, at)) continue;
    candidates.push(t);
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => specificity(b) - specificity(a) || b.priority - a.priority);
  return candidates[0]!;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeCost(tariff: TariffDoc, energyWh: number | null, durationMinutes: number): BilledCost {
  let base: number;
  if (tariff.pricingType === "PER_KWH") base = tariff.rate * ((energyWh ?? 0) / 1000);
  else if (tariff.pricingType === "PER_MINUTE") base = tariff.rate * durationMinutes;
  else base = tariff.rate;

  const costBeforeGstInr = round2(base + tariff.platformFeeInr);
  const gstInr = round2(costBeforeGstInr * (tariff.gstPct / 100));
  return {
    tariffId: tariff.id,
    tariffName: tariff.name,
    costBeforeGstInr,
    gstPct: tariff.gstPct,
    gstInr,
    totalCostInr: round2(costBeforeGstInr + gstInr),
  };
}
