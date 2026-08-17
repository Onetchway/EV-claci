"use client";

import { useEffect, useMemo, useState } from "react";
import { Battery, Gauge, Wind, Zap } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { DonutChart } from "@/components/donut-chart";
import { Card, EmptyState, PageHeader, Spinner, StatCard } from "@/components/ui";
import { subscribeChargerRegistry, type ChargerRegistration } from "@/lib/db/charger-registry";
import { subscribeSessionsSince, type ChargeSession } from "@/lib/db/chargers";
import { subscribeZones } from "@/lib/db/zones";
import type { Zone } from "@/lib/types";

/**
 * kWh reporting, pulled out into its own module rather than living
 * embedded inside Dashboard/Earnings/Insights (each of which only shows a
 * slice of it — revenue-adjacent energy on Earnings, live utilisation on
 * Insights). This page is energy-only: no cost, no billing status, just
 * how much power actually moved and where.
 */

const RANGE_DAYS = 30;

function dayKey(ts: unknown): string | null {
  const millis = (ts as { toMillis?: () => number } | undefined)?.toMillis?.();
  if (!millis) return null;
  return new Date(millis).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function EnergyPage() {
  const [sessions, setSessions] = useState<ChargeSession[] | null>(null);
  const [registry, setRegistry] = useState<ChargerRegistration[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - RANGE_DAYS);
    return subscribeSessionsSince(since, setSessions);
  }, []);
  useEffect(() => subscribeChargerRegistry(setRegistry), []);
  useEffect(() => subscribeZones(setZones), []);

  const registryByChargerId = useMemo(() => new Map(registry.map((r) => [r.chargerId, r])), [registry]);
  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  const delivered = useMemo(
    () => (sessions ?? []).filter((s) => (s.energyDeliveredWh ?? 0) > 0),
    [sessions],
  );

  const totals = useMemo(() => {
    const energyWh = delivered.reduce((a, s) => a + (s.energyDeliveredWh ?? 0), 0);
    const idleMinutes = delivered.reduce((a, s) => a + (s.idleMinutes ?? 0), 0);
    return {
      energyKwh: energyWh / 1000,
      sessionCount: delivered.length,
      avgKwhPerSession: delivered.length ? energyWh / 1000 / delivered.length : 0,
      idleHours: idleMinutes / 60,
    };
  }, [delivered]);

  const trend = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const s of delivered) {
      const key = dayKey(s.endedAt ?? s.lastUpdateAt);
      if (!key) continue;
      byDay.set(key, (byDay.get(key) ?? 0) + (s.energyDeliveredWh ?? 0) / 1000);
    }
    return Array.from(byDay.entries()).map(([day, kwh]) => ({ day, kwh: Math.round(kwh * 100) / 100 }));
  }, [delivered]);

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

  const byCharger = useMemo(() => {
    const map = new Map<string, { energyWh: number; sessions: number }>();
    for (const s of delivered) {
      const entry = map.get(s.chargePointId) ?? { energyWh: 0, sessions: 0 };
      entry.energyWh += s.energyDeliveredWh ?? 0;
      entry.sessions += 1;
      map.set(s.chargePointId, entry);
    }
    return [...map.entries()]
      .map(([chargePointId, v]) => ({ chargePointId, ...v }))
      .sort((a, b) => b.energyWh - a.energyWh)
      .slice(0, 10);
  }, [delivered]);

  return (
    <>
      <PageHeader
        title="Energy"
        description={`kWh delivered across the fleet over the last ${RANGE_DAYS} days — energy only, no cost or billing status. See Earnings for the revenue side of the same sessions.`}
      />

      {sessions === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Energy delivered (30d)" value={`${totals.energyKwh.toFixed(1)} kWh`} icon={<Zap className="h-4 w-4" />} tone="positive" />
            <StatCard label="Sessions with energy" value={totals.sessionCount} icon={<Battery className="h-4 w-4" />} />
            <StatCard label="Avg. kWh / session" value={totals.avgKwhPerSession.toFixed(2)} icon={<Gauge className="h-4 w-4" />} />
            <StatCard label="Idle time (30d)" value={`${totals.idleHours.toFixed(1)} hrs`} icon={<Wind className="h-4 w-4" />} sub="Connected but not drawing power" />
          </div>

          <Card title="Energy delivered over time" subtitle="Daily total, kWh" className="mb-4">
            {trend.length === 0 ? (
              <EmptyState title="No energy delivered yet" description="Appears here once a session with energy ends." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
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

          <Card title="Top chargers by energy">
            {byCharger.length === 0 ? (
              <EmptyState title="No energy delivered yet" />
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full">
                  <thead className="border-b border-ink-200">
                    <tr>
                      <th className="th">Charger</th>
                      <th className="th text-right">Sessions</th>
                      <th className="th text-right">Energy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {byCharger.map((c) => (
                      <tr key={c.chargePointId} className="hover:bg-ink-50">
                        <td className="td font-medium">{c.chargePointId}</td>
                        <td className="td text-right tabular-nums">{c.sessions}</td>
                        <td className="td text-right font-medium tabular-nums">{(c.energyWh / 1000).toFixed(2)} kWh</td>
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
