"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Battery, Gauge, IndianRupee, TrendingUp, Wind, Zap,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { DateRangeFilter } from "@/components/date-range-filter";
import { DonutChart } from "@/components/donut-chart";
import { Card, EmptyState, PageHeader, Spinner, StatCard } from "@/components/ui";
import { subscribeChargerRegistry, type ChargerRegistration } from "@/lib/db/charger-registry";
import { subscribeSessionsSince, type ChargeSession } from "@/lib/db/chargers";
import { subscribeZones } from "@/lib/db/zones";
import { defaultDateRangeState, rangeLabel, rangeSince, rangeUntil, type DateRangeState } from "@/lib/date-range";
import type { Zone } from "@/lib/types";
import { formatCompactINR, formatINR } from "@/lib/utils";

/**
 * Earnings & Statistics — revenue and kWh reporting in one place. Used to
 * be two separate nav items (Earnings, Energy) with almost the same date
 * filter and the same session data underneath; merged into one page so
 * there's a single filtered range instead of switching pages to see the
 * ₹ and kWh sides of the same sessions.
 */

function tsMillis(ts: unknown): number | null {
  return (ts as { toMillis?: () => number } | undefined)?.toMillis?.() ?? null;
}

function trendKey(ts: unknown, monthly: boolean): string | null {
  const millis = tsMillis(ts);
  if (!millis) return null;
  return new Date(millis).toLocaleDateString("en-IN", monthly ? { month: "short", year: "2-digit" } : { day: "2-digit", month: "short" });
}

export default function EarningsPage() {
  const [range, setRange] = useState<DateRangeState>(defaultDateRangeState());
  const [sessions, setSessions] = useState<ChargeSession[] | null>(null);
  const [registry, setRegistry] = useState<ChargerRegistration[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  useEffect(() => subscribeSessionsSince(rangeSince(range), setSessions), [range.preset, range.year, range.customFrom]);
  useEffect(() => subscribeChargerRegistry(setRegistry), []);
  useEffect(() => subscribeZones(setZones), []);

  const registryByChargerId = useMemo(() => new Map(registry.map((r) => [r.chargerId, r])), [registry]);
  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  const until = useMemo(() => rangeUntil(range), [range.preset, range.year, range.customTo]);
  const inRange = useMemo(() => {
    if (!until) return sessions ?? [];
    const untilMs = until.getTime();
    return (sessions ?? []).filter((s) => {
      const ms = tsMillis(s.endedAt ?? s.lastUpdateAt);
      return ms == null || ms < untilMs;
    });
  }, [sessions, until]);

  const monthly = range.preset === "year" || (range.preset === "custom" && !!range.customFrom && !!range.customTo
    && (new Date(range.customTo).getTime() - new Date(range.customFrom).getTime()) > 1000 * 60 * 60 * 24 * 120);

  const billed = useMemo(() => inRange.filter((s) => s.totalCostInr != null), [inRange]);
  const delivered = useMemo(() => inRange.filter((s) => (s.energyDeliveredWh ?? 0) > 0), [inRange]);

  const totals = useMemo(() => {
    const revenue = billed.reduce((a, s) => a + (s.totalCostInr ?? 0), 0);
    const energyWh = delivered.reduce((a, s) => a + (s.energyDeliveredWh ?? 0), 0);
    const idleMinutes = delivered.reduce((a, s) => a + (s.idleMinutes ?? 0), 0);
    return {
      revenue,
      energyKwh: energyWh / 1000,
      billedCount: billed.length,
      avgPerSession: billed.length ? revenue / billed.length : 0,
      unbilledCount: inRange.length - billed.length,
      avgKwhPerSession: delivered.length ? energyWh / 1000 / delivered.length : 0,
      idleHours: idleMinutes / 60,
    };
  }, [billed, delivered, inRange]);

  const revenueTrend = useMemo(() => {
    const byPeriod = new Map<string, number>();
    for (const s of billed) {
      const key = trendKey(s.endedAt ?? s.lastUpdateAt, monthly);
      if (!key) continue;
      byPeriod.set(key, (byPeriod.get(key) ?? 0) + (s.totalCostInr ?? 0));
    }
    return Array.from(byPeriod.entries()).map(([day, revenue]) => ({ day, revenue }));
  }, [billed, monthly]);

  const energyTrend = useMemo(() => {
    const byPeriod = new Map<string, number>();
    for (const s of delivered) {
      const key = trendKey(s.endedAt ?? s.lastUpdateAt, monthly);
      if (!key) continue;
      byPeriod.set(key, (byPeriod.get(key) ?? 0) + (s.energyDeliveredWh ?? 0) / 1000);
    }
    return Array.from(byPeriod.entries()).map(([day, kwh]) => ({ day, kwh: Math.round(kwh * 100) / 100 }));
  }, [delivered, monthly]);

  const acDcSplit = useMemo(() => {
    let ac = 0;
    let dc = 0;
    for (const s of delivered) {
      const powerType = registryByChargerId.get(s.chargePointId)?.chargerPowerType;
      if (powerType === "DC") dc += s.energyDeliveredWh ?? 0;
      else ac += s.energyDeliveredWh ?? 0;
    }
    return { ac: ac / 1000, dc: dc / 1000 };
  }, [delivered, registryByChargerId]);

  const bySite = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of delivered) {
      const zoneId = registryByChargerId.get(s.chargePointId)?.zoneId;
      const name = zoneId ? (zoneById.get(zoneId)?.name ?? "Unknown site") : "Unassigned";
      map.set(name, (map.get(name) ?? 0) + (s.energyDeliveredWh ?? 0) / 1000);
    }
    return [...map.entries()].map(([site, kwh]) => ({ site, kwh })).sort((a, b) => b.kwh - a.kwh).slice(0, 10);
  }, [delivered, registryByChargerId, zoneById]);

  const topChargers = useMemo(() => {
    const byCharger = new Map<string, { revenue: number; energyWh: number; sessions: number }>();
    for (const s of inRange) {
      if (s.totalCostInr == null && !(s.energyDeliveredWh ?? 0)) continue;
      const entry = byCharger.get(s.chargePointId) ?? { revenue: 0, energyWh: 0, sessions: 0 };
      entry.revenue += s.totalCostInr ?? 0;
      entry.energyWh += s.energyDeliveredWh ?? 0;
      entry.sessions += 1;
      byCharger.set(s.chargePointId, entry);
    }
    return Array.from(byCharger.entries())
      .map(([chargePointId, v]) => ({ chargePointId, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [inRange]);

  return (
    <>
      <PageHeader
        title="Earnings & Statistics"
        description={`Revenue and energy delivered over ${rangeLabel(range)}. Filter below by preset range, calendar year, or a custom date range.`}
      />

      <DateRangeFilter state={range} onChange={setRange} />

      {sessions === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
            <StatCard label="Revenue" value={formatCompactINR(totals.revenue)} icon={<IndianRupee className="h-4 w-4" />} tone="positive" />
            <StatCard label="Energy delivered" value={`${totals.energyKwh.toFixed(1)} kWh`} icon={<Zap className="h-4 w-4" />} tone="positive" />
            <StatCard label="Billed sessions" value={totals.billedCount} icon={<Battery className="h-4 w-4" />} sub={totals.unbilledCount ? `${totals.unbilledCount} unbilled (no tariff matched)` : undefined} />
            <StatCard label="Avg. revenue / session" value={formatINR(totals.avgPerSession)} icon={<TrendingUp className="h-4 w-4" />} />
            <StatCard label="Avg. kWh / session" value={totals.avgKwhPerSession.toFixed(2)} icon={<Gauge className="h-4 w-4" />} />
            <StatCard label="Idle time" value={`${totals.idleHours.toFixed(1)} hrs`} icon={<Wind className="h-4 w-4" />} sub="Connected but not drawing power" />
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Card title="Revenue over time" subtitle="Billed sessions only">
              {revenueTrend.length === 0 ? (
                <EmptyState title="No billed sessions yet" description="Revenue appears here once sessions end against an active tariff." />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrend} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="earningsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1fae54" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#1fae54" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactINR(v)} />
                      <Tooltip formatter={(v: number) => formatINR(v)} />
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#1fae54" strokeWidth={2} fill="url(#earningsFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card title="Energy delivered over time" subtitle="kWh">
              {energyTrend.length === 0 ? (
                <EmptyState title="No energy delivered yet" description="Appears here once a session with energy ends." />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={energyTrend} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v} kWh`} />
                      <Tooltip formatter={(v: number) => `${v} kWh`} />
                      <Area type="monotone" dataKey="kwh" name="Energy" stroke="#0ea5e9" strokeWidth={2} fill="url(#energyFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Card title="AC vs DC">
              <DonutChart
                slices={[
                  { label: "AC", value: Math.round(acDcSplit.ac * 100) / 100, color: "#1fae54" },
                  { label: "DC", value: Math.round(acDcSplit.dc * 100) / 100, color: "#0ea5e9" },
                ]}
              />
            </Card>
            <Card title="Top sites by energy">
              {bySite.length === 0 ? (
                <EmptyState title="No energy delivered yet" />
              ) : (
                <div className="space-y-2">
                  {bySite.map((s) => (
                    <div key={s.site} className="flex items-center justify-between text-sm">
                      <span className="text-ink-700">{s.site}</span>
                      <span className="tabular-nums font-medium text-ink-900">{s.kwh.toFixed(1)} kWh</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card title="Top chargers by revenue">
            {topChargers.length === 0 ? (
              <EmptyState title="No billed or energy sessions yet" />
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full">
                  <thead className="border-b border-ink-200">
                    <tr>
                      <th className="th">Charger</th>
                      <th className="th text-right">Sessions</th>
                      <th className="th text-right">Energy</th>
                      <th className="th text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {topChargers.map((c) => (
                      <tr key={c.chargePointId} className="hover:bg-ink-50">
                        <td className="td font-medium">{c.chargePointId}</td>
                        <td className="td text-right tabular-nums">{c.sessions}</td>
                        <td className="td text-right tabular-nums">{(c.energyWh / 1000).toFixed(2)} kWh</td>
                        <td className="td text-right font-medium tabular-nums">{formatINR(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
