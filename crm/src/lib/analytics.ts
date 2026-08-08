/** Pure roll-ups over an already-fetched set of leads. No I/O here. */

import {
  SOURCE_LABEL, STAGES, STAGE_META, WON_STAGE,
  type Source, type Stage,
} from "./constants";
import type { Lead } from "./types";
import { daysBetween, toDate } from "./utils";

export interface Totals {
  total: number;
  active: number;
  won: number;
  rejected: number;
  onHold: number;
  pipelineValue: number;
  weightedValue: number;
  wonValue: number;
  collected: number;
  outstanding: number;
  conversionPct: number;
  avgDealValue: number;
  overdueFollowUps: number;
}

export function computeTotals(leads: Lead[]): Totals {
  const active = leads.filter((l) => l.status === "ACTIVE");
  const won = leads.filter((l) => l.status === "WON");
  const rejected = leads.filter((l) => l.status === "REJECTED");
  const onHold = leads.filter((l) => l.status === "ON_HOLD");
  const now = Date.now();

  const pipelineValue = active.reduce((a, l) => a + (l.value ?? 0), 0);
  const weightedValue = active.reduce(
    (a, l) => a + (l.value ?? 0) * (STAGE_META[l.stage]?.probability ?? 0),
    0,
  );
  const wonValue = won.reduce((a, l) => a + (l.value ?? 0), 0);
  const collected = leads.reduce((a, l) => a + (l.paidAmount ?? 0), 0);

  // Only leads that actually reached a decision count in the conversion rate;
  // leads still in play would otherwise drag it down unfairly.
  const decided = won.length + rejected.length;

  return {
    total: leads.length,
    active: active.length,
    won: won.length,
    rejected: rejected.length,
    onHold: onHold.length,
    pipelineValue,
    weightedValue: Math.round(weightedValue),
    wonValue,
    collected,
    outstanding: won.reduce((a, l) => a + Math.max(0, (l.value ?? 0) - (l.paidAmount ?? 0)), 0),
    conversionPct: decided ? Math.round((won.length / decided) * 100) : 0,
    avgDealValue: won.length ? Math.round(wonValue / won.length) : 0,
    overdueFollowUps: active.filter((l) => {
      const d = toDate(l.nextFollowUpAt)?.getTime();
      return d != null && d < now;
    }).length,
  };
}

export interface StageBucket {
  stage: Stage;
  label: string;
  short: string;
  count: number;
  value: number;
}

/** Funnel over live leads only — won/rejected are terminal, not stages. */
export function stageBreakdown(leads: Lead[]): StageBucket[] {
  const live = leads.filter((l) => l.status === "ACTIVE" || l.status === "ON_HOLD");
  return STAGES.map((stage) => {
    const rows = live.filter((l) => l.stage === stage);
    return {
      stage,
      label: STAGE_META[stage].label,
      short: STAGE_META[stage].short,
      count: rows.length,
      value: rows.reduce((a, l) => a + (l.value ?? 0), 0),
    };
  });
}

export interface SourceBucket {
  source: Source;
  label: string;
  count: number;
  won: number;
  rejected: number;
  value: number;
  conversionPct: number;
}

export function sourceBreakdown(leads: Lead[]): SourceBucket[] {
  const map = new Map<Source, SourceBucket>();
  for (const l of leads) {
    const key = l.source;
    const b = map.get(key) ?? {
      source: key,
      label: SOURCE_LABEL[key] ?? key,
      count: 0, won: 0, rejected: 0, value: 0, conversionPct: 0,
    };
    b.count += 1;
    if (l.status === "WON") { b.won += 1; b.value += l.value ?? 0; }
    if (l.status === "REJECTED") b.rejected += 1;
    map.set(key, b);
  }
  return [...map.values()]
    .map((b) => ({
      ...b,
      conversionPct: b.won + b.rejected ? Math.round((b.won / (b.won + b.rejected)) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export interface AgentPerformance {
  ownerId: string;
  ownerName: string;
  total: number;
  active: number;
  won: number;
  rejected: number;
  pipelineValue: number;
  wonValue: number;
  collected: number;
  conversionPct: number;
  overdue: number;
  /** Mean days from creation to reaching handover. */
  avgCycleDays: number | null;
}

export function agentPerformance(leads: Lead[]): AgentPerformance[] {
  const map = new Map<string, AgentPerformance & { cycleDays: number[] }>();
  const now = Date.now();

  for (const l of leads) {
    const key = l.ownerId || "unassigned";
    const row = map.get(key) ?? {
      ownerId: key, ownerName: l.ownerName || "Unassigned",
      total: 0, active: 0, won: 0, rejected: 0,
      pipelineValue: 0, wonValue: 0, collected: 0,
      conversionPct: 0, overdue: 0, avgCycleDays: null, cycleDays: [],
    };

    row.total += 1;
    row.collected += l.paidAmount ?? 0;

    if (l.status === "ACTIVE") {
      row.active += 1;
      row.pipelineValue += l.value ?? 0;
      const due = toDate(l.nextFollowUpAt)?.getTime();
      if (due != null && due < now) row.overdue += 1;
    }
    if (l.status === "WON") {
      row.won += 1;
      row.wonValue += l.value ?? 0;
      const days = daysBetween(l.createdAt, l.updatedAt);
      if (days != null && days >= 0) row.cycleDays.push(days);
    }
    if (l.status === "REJECTED") row.rejected += 1;

    map.set(key, row);
  }

  return [...map.values()]
    .map(({ cycleDays, ...row }) => ({
      ...row,
      conversionPct: row.won + row.rejected ? Math.round((row.won / (row.won + row.rejected)) * 100) : 0,
      avgCycleDays: cycleDays.length
        ? Math.round(cycleDays.reduce((a, d) => a + d, 0) / cycleDays.length)
        : null,
    }))
    .sort((a, b) => b.wonValue - a.wonValue || b.total - a.total);
}

export interface TrendPoint {
  month: string;
  created: number;
  won: number;
  value: number;
}

export function monthlyTrend(leads: Lead[], months = 6): TrendPoint[] {
  const buckets = new Map<string, TrendPoint>();
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, {
      month: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      created: 0, won: 0, value: 0,
    });
  }

  for (const l of leads) {
    const created = toDate(l.createdAt);
    if (!created) continue;
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key);
    if (!b) continue;
    b.created += 1;
    if (l.status === "WON") { b.won += 1; b.value += l.value ?? 0; }
  }

  return [...buckets.values()];
}

export interface ChargerDemand {
  sku: string;
  label: string;
  units: number;
  leads: number;
  value: number;
}

/** Which charger sizes the market is actually asking for. */
export function chargerDemand(leads: Lead[]): ChargerDemand[] {
  const map = new Map<string, ChargerDemand>();
  for (const l of leads) {
    for (const item of l.config ?? []) {
      const b = map.get(item.sku) ?? {
        sku: item.sku, label: item.sku.replace("DC-", "") + " kW", units: 0, leads: 0, value: 0,
      };
      b.units += item.qty;
      b.leads += 1;
      if (l.status === "WON") b.value += l.value ?? 0;
      map.set(item.sku, b);
    }
  }
  return [...map.values()].sort(
    (a, b) => Number(a.sku.replace("DC-", "")) - Number(b.sku.replace("DC-", "")),
  );
}

/** Stage-to-stage drop-off, counting every lead that ever got at least this far. */
export function funnelConversion(leads: Lead[]): { stage: Stage; label: string; reached: number; pct: number }[] {
  const order = STAGES;
  const reachedIndex = (l: Lead) => {
    if (l.status === "WON") return order.indexOf(WON_STAGE);
    return order.indexOf(l.stage);
  };
  const total = leads.length || 1;
  return order.map((stage, i) => {
    const reached = leads.filter((l) => reachedIndex(l) >= i).length;
    return { stage, label: STAGE_META[stage].short, reached, pct: Math.round((reached / total) * 100) };
  });
}
