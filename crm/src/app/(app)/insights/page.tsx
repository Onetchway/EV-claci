"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, Gauge, IndianRupee, Ticket as TicketIcon, Zap } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { Card, EmptyState, PageHeader, Spinner, StatCard } from "@/components/ui";
import { subscribeChargerRegistry, type ChargerRegistration } from "@/lib/db/charger-registry";
import { subscribeChargePoints, subscribeSessionsSince, type ChargePoint, type ChargeSession } from "@/lib/db/chargers";
import { subscribeSiteRevenueShares } from "@/lib/db/settlements";
import { subscribeTickets } from "@/lib/db/tickets";
import type { SiteRevenueShare, Ticket } from "@/lib/types";
import { formatCompactINR, formatINR } from "@/lib/utils";

const RANGE_DAYS = 30;

function toMillis(ts: unknown): number | null {
  return (ts as { toMillis?: () => number } | undefined)?.toMillis?.() ?? null;
}

export default function InsightsPage() {
  const [registry, setRegistry] = useState<ChargerRegistration[]>([]);
  const [points, setPoints] = useState<ChargePoint[]>([]);
  const [sessions, setSessions] = useState<ChargeSession[] | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [shares, setShares] = useState<SiteRevenueShare[]>([]);

  useEffect(() => subscribeChargerRegistry(setRegistry), []);
  useEffect(() => subscribeChargePoints(setPoints), []);
  useEffect(() => subscribeTickets({}, setTickets), []);
  useEffect(() => subscribeSiteRevenueShares(setShares), []);
  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - RANGE_DAYS);
    return subscribeSessionsSince(since, setSessions);
  }, []);

  const billed = useMemo(() => (sessions ?? []).filter((s) => s.totalCostInr != null), [sessions]);

  const fleet = useMemo(() => {
    const active = registry.filter((r) => r.active);
    const onlineIds = new Set(points.filter((p) => p.status === "ONLINE").map((p) => p.chargePointId ?? p.id));
    const online = active.filter((r) => onlineIds.has(r.chargerId)).length;
    return { total: active.length, online, pct: active.length ? Math.round((online / active.length) * 100) : 0 };
  }, [registry, points]);

  const slaCompliance = useMemo(() => {
    const closed = tickets.filter((t) => (t.status === "RESOLVED" || t.status === "CLOSED") && t.resolvedAt && t.slaDueAt);
    if (closed.length === 0) return null;
    const onTime = closed.filter((t) => (toMillis(t.resolvedAt) ?? 0) <= (toMillis(t.slaDueAt) ?? 0)).length;
    return { pct: Math.round((onTime / closed.length) * 100), onTime, total: closed.length };
  }, [tickets]);

  const openTickets = useMemo(() => tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length, [tickets]);

  const revenue = useMemo(() => {
    const sessionRevenue = billed.reduce((a, s) => a + (s.totalCostInr ?? 0), 0);
    const shareOwed = shares.reduce((a, r) => a + r.shareAmountInr, 0);
    return { sessionRevenue, shareOwed, net: sessionRevenue - shareOwed };
  }, [billed, shares]);

  const siteRevenue = useMemo(() => {
    const byZone = new Map<string, number>();
    for (const s of shares) byZone.set(s.zoneName, (byZone.get(s.zoneName) ?? 0) + s.grossAmountInr);
    return [...byZone.entries()]
      .map(([site, revenue]) => ({ site, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [shares]);

  return (
    <>
      <PageHeader
        title="Business Insights"
        description="Cross-cutting operational metrics — fleet health, SLA compliance, and revenue by site — pulled from what's already tracked elsewhere (Chargers, Tickets, Settlements). For day-to-day revenue trend, see Earnings & Statistics."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Fleet online now" value={`${fleet.online} / ${fleet.total}`} tone={fleet.pct < 80 ? "warn" : "default"} icon={<Gauge className="h-4 w-4" />} />
        <StatCard label="Open tickets" value={openTickets} tone={openTickets ? "warn" : "default"} icon={<TicketIcon className="h-4 w-4" />} />
        <StatCard
          label="SLA compliance (30d closed)"
          value={slaCompliance ? `${slaCompliance.pct}%` : "—"}
          tone={slaCompliance && slaCompliance.pct < 80 ? "negative" : "default"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard label="Net revenue (30d, after site share)" value={formatCompactINR(revenue.net)} icon={<IndianRupee className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Revenue breakdown (30d)" className="lg:col-span-1">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-500">Gross session revenue</dt><dd className="tabular-nums">{formatINR(revenue.sessionRevenue)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-500">Owed to site hosts</dt><dd className="tabular-nums text-rose-600">-{formatINR(revenue.shareOwed)}</dd></div>
            <div className="flex justify-between border-t border-ink-100 pt-2 font-medium"><dt>Net</dt><dd className="tabular-nums">{formatINR(revenue.net)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-ink-500">
            Owed-to-site-hosts includes both PENDING and PAID settlement entries — see /settlements for what's actually been paid out.
          </p>
        </Card>

        <Card title="Top sites by gross revenue (30d)" className="lg:col-span-2">
          {siteRevenue.length === 0 ? (
            <EmptyState icon={<Banknote className="h-8 w-8" />} title="No revenue-share activity yet" description="Set a revenue share % on a zone (Zones & Load Balancing) to see sites here." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={siteRevenue} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatCompactINR(v)} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="site" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                  <Bar dataKey="revenue" fill="#1cb567" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {billed.length === 0 && sessions !== null && (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-ink-500">
          <Zap className="h-4 w-4" /> No billed sessions in the last {RANGE_DAYS} days yet.
        </p>
      )}
    </>
  );
}
