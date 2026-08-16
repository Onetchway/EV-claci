"use client";

import { useEffect, useMemo, useState } from "react";
import { Battery, IndianRupee, TrendingUp, Zap } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { Card, EmptyState, PageHeader, Spinner, StatCard } from "@/components/ui";
import { subscribeSessionsSince, type ChargeSession } from "@/lib/db/chargers";
import { formatCompactINR, formatINR } from "@/lib/utils";

const RANGE_DAYS = 30;

function dayKey(ts: unknown): string | null {
  const millis = (ts as { toMillis?: () => number } | undefined)?.toMillis?.();
  if (!millis) return null;
  return new Date(millis).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function EarningsPage() {
  const [sessions, setSessions] = useState<ChargeSession[] | null>(null);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - RANGE_DAYS);
    return subscribeSessionsSince(since, setSessions);
  }, []);

  const billed = useMemo(() => (sessions ?? []).filter((s) => s.totalCostInr != null), [sessions]);

  const totals = useMemo(() => {
    const revenue = billed.reduce((a, s) => a + (s.totalCostInr ?? 0), 0);
    const energyWh = billed.reduce((a, s) => a + (s.energyDeliveredWh ?? 0), 0);
    return {
      revenue,
      energyKwh: energyWh / 1000,
      sessionCount: billed.length,
      avgPerSession: billed.length ? revenue / billed.length : 0,
      unbilledCount: (sessions ?? []).length - billed.length,
    };
  }, [billed, sessions]);

  const trend = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const s of billed) {
      const key = dayKey(s.endedAt ?? s.lastUpdateAt);
      if (!key) continue;
      byDay.set(key, (byDay.get(key) ?? 0) + (s.totalCostInr ?? 0));
    }
    return Array.from(byDay.entries()).map(([day, revenue]) => ({ day, revenue }));
  }, [billed]);

  const topChargers = useMemo(() => {
    const byCharger = new Map<string, { revenue: number; energyWh: number; sessions: number }>();
    for (const s of billed) {
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
  }, [billed]);

  return (
    <>
      <PageHeader
        title="Earnings"
        description={`Revenue from billed charging sessions over the last ${RANGE_DAYS} days.`}
      />

      {sessions === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Revenue (30d)" value={formatCompactINR(totals.revenue)} icon={<IndianRupee className="h-4 w-4" />} tone="positive" />
            <StatCard label="Energy delivered" value={`${totals.energyKwh.toFixed(1)} kWh`} icon={<Zap className="h-4 w-4" />} />
            <StatCard label="Billed sessions" value={totals.sessionCount} icon={<Battery className="h-4 w-4" />} sub={totals.unbilledCount ? `${totals.unbilledCount} unbilled (no tariff matched)` : undefined} />
            <StatCard label="Avg. revenue / session" value={formatINR(totals.avgPerSession)} icon={<TrendingUp className="h-4 w-4" />} />
          </div>

          <Card title="Revenue over time" subtitle="Daily total, billed sessions only" className="mb-4">
            {trend.length === 0 ? (
              <EmptyState title="No billed sessions yet" description="Revenue appears here once sessions end against an active tariff." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="earningsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f0501f" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#f0501f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompactINR(v)} />
                    <Tooltip formatter={(v: number) => formatINR(v)} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#f0501f" strokeWidth={2} fill="url(#earningsFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="Top chargers by revenue">
            {topChargers.length === 0 ? (
              <EmptyState title="No billed sessions yet" />
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
