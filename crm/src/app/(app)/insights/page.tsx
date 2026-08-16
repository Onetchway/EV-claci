"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, Gauge, IndianRupee, Ticket as TicketIcon, Zap } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { Card, EmptyState, PageHeader, Spinner, StatCard } from "@/components/ui";
import { subscribeChargerRegistry, type ChargerRegistration } from "@/lib/db/charger-registry";
import {
  subscribeChargePoints, subscribeDowntimeEventsSince, subscribeSessionsSince,
  type ChargePoint, type ChargeSession, type ConnectorStatus, type DowntimeEvent,
} from "@/lib/db/chargers";
import { subscribeElectricityBills } from "@/lib/db/electricity-bills";
import { subscribeSiteRevenueShares } from "@/lib/db/settlements";
import { subscribeTickets } from "@/lib/db/tickets";
import type { ElectricityBill, SiteRevenueShare, Ticket } from "@/lib/types";
import { cn, formatCompactINR, formatINR } from "@/lib/utils";

const CONNECTOR_STATUS_COLOR: Record<ConnectorStatus, string> = {
  Available: "bg-emerald-500",
  Occupied: "bg-sky-500",
  Reserved: "bg-indigo-500",
  Unavailable: "bg-ink-300",
  Faulted: "bg-rose-500",
};
const CONNECTOR_STATUS_ORDER: ConnectorStatus[] = ["Available", "Occupied", "Reserved", "Unavailable", "Faulted"];

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
  const [bills, setBills] = useState<ElectricityBill[]>([]);
  const [downtimeEvents, setDowntimeEvents] = useState<DowntimeEvent[]>([]);

  useEffect(() => subscribeChargerRegistry(setRegistry), []);
  useEffect(() => subscribeChargePoints(setPoints), []);
  useEffect(() => subscribeTickets({}, setTickets), []);
  useEffect(() => subscribeSiteRevenueShares(setShares), []);
  useEffect(() => subscribeElectricityBills(setBills), []);
  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - RANGE_DAYS);
    return subscribeSessionsSince(since, setSessions);
  }, []);
  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - RANGE_DAYS);
    return subscribeDowntimeEventsSince(since, setDowntimeEvents);
  }, []);

  const billed = useMemo(() => (sessions ?? []).filter((s) => s.totalCostInr != null), [sessions]);

  const fleet = useMemo(() => {
    const active = registry.filter((r) => r.active);
    const onlineIds = new Set(points.filter((p) => p.status === "ONLINE").map((p) => p.chargePointId ?? p.id));
    const online = active.filter((r) => onlineIds.has(r.chargerId)).length;
    return { total: active.length, online, pct: active.length ? Math.round((online / active.length) * 100) : 0 };
  }, [registry, points]);

  const reliability = useMemo(() => {
    if (downtimeEvents.length === 0) return { mttrMinutes: null as number | null, uptimePct: null as number | null, outages: 0 };
    const totalDowntimeMinutes = downtimeEvents.reduce((a, e) => a + e.durationMinutes, 0);
    const mttrMinutes = Math.round(totalDowntimeMinutes / downtimeEvents.length);
    const chargerCount = new Set(downtimeEvents.map((e) => e.chargePointId)).size || 1;
    const totalWindowMinutes = RANGE_DAYS * 24 * 60 * chargerCount;
    const uptimePct = Math.max(0, Math.round(((totalWindowMinutes - totalDowntimeMinutes) / totalWindowMinutes) * 1000) / 10);
    return { mttrMinutes, uptimePct, outages: downtimeEvents.length };
  }, [downtimeEvents]);

  const slaCompliance = useMemo(() => {
    const closed = tickets.filter((t) => (t.status === "RESOLVED" || t.status === "CLOSED") && t.resolvedAt && t.slaDueAt);
    if (closed.length === 0) return null;
    const onTime = closed.filter((t) => (toMillis(t.resolvedAt) ?? 0) <= (toMillis(t.slaDueAt) ?? 0)).length;
    return { pct: Math.round((onTime / closed.length) * 100), onTime, total: closed.length };
  }, [tickets]);

  const openTickets = useMemo(() => tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length, [tickets]);

  const revenue = useMemo(() => {
    const since = Date.now() - RANGE_DAYS * 24 * 60 * 60 * 1000;
    const sessionRevenue = billed.reduce((a, s) => a + (s.totalCostInr ?? 0), 0);
    const shareOwed = shares
      .filter((r) => (toMillis(r.createdAt) ?? 0) >= since)
      .reduce((a, r) => a + r.shareAmountInr, 0);
    return { sessionRevenue, shareOwed, net: sessionRevenue - shareOwed };
  }, [billed, shares]);

  const connectorStatusCounts = useMemo(() => {
    const counts = new Map<ConnectorStatus, number>();
    for (const p of points) {
      for (const c of Object.values(p.connectors ?? {})) {
        counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
      }
    }
    return counts;
  }, [points]);
  const totalConnectors = useMemo(
    () => [...connectorStatusCounts.values()].reduce((a, n) => a + n, 0),
    [connectorStatusCounts],
  );

  const connectorTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of registry) {
      if (!r.active) continue;
      if (r.connectorType) counts.set(r.connectorType, (counts.get(r.connectorType) ?? 0) + 1);
      for (const c of r.connectors ?? []) counts.set(c.connectorType, (counts.get(c.connectorType) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [registry]);

  /**
   * A session with multiple revenue-share recipients (site host + partner,
   * say) now produces one siteRevenueShares entry per recipient, all
   * carrying the same grossAmountInr — summing grossAmountInr across every
   * entry would multiply a session's revenue by however many parties split
   * it. Dedupe to one gross figure per session first; shareOwed below still
   * sums every entry, since that's genuinely the total paid out across
   * every recipient.
   */
  const grossBySession = useMemo(() => {
    const map = new Map<string, { zoneId: string; zoneName: string; grossAmountInr: number }>();
    for (const s of shares) {
      if (s.kind !== "SESSION" || !s.sessionId) continue;
      if (!map.has(s.sessionId)) map.set(s.sessionId, { zoneId: s.zoneId, zoneName: s.zoneName, grossAmountInr: s.grossAmountInr });
    }
    return [...map.values()];
  }, [shares]);

  /** Revenue per individual charger (30d), unlike siteRevenue which rolls up by site — straight from billed sessions, not the revenue-share ledger, so it isn't affected by however many parties split a session. */
  const revenuePerCharger = useMemo(() => {
    const byCharger = new Map<string, number>();
    for (const s of billed) byCharger.set(s.chargePointId, (byCharger.get(s.chargePointId) ?? 0) + (s.totalCostInr ?? 0));
    return [...byCharger.entries()]
      .map(([chargePointId, revenue]) => ({ chargePointId, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [billed]);

  const siteRevenue = useMemo(() => {
    const byZone = new Map<string, number>();
    for (const g of grossBySession) byZone.set(g.zoneName, (byZone.get(g.zoneName) ?? 0) + g.grossAmountInr);
    return [...byZone.entries()]
      .map(([site, revenue]) => ({ site, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [grossBySession]);

  /**
   * All-time per-site P&L: gross session revenue minus what's owed across
   * every revenue-share recipient minus logged electricity bills.
   * Electricity is manual bookkeeping input (no meter integration), so a
   * site with no bills logged shows "—" rather than a profit figure that's
   * silently ignoring a real cost.
   */
  const stationProfit = useMemo(() => {
    const byZone = new Map<string, { zoneName: string; revenue: number; shareOwed: number; electricity: number; hasBills: boolean }>();
    for (const g of grossBySession) {
      const entry = byZone.get(g.zoneId) ?? { zoneName: g.zoneName, revenue: 0, shareOwed: 0, electricity: 0, hasBills: false };
      entry.revenue += g.grossAmountInr;
      byZone.set(g.zoneId, entry);
    }
    for (const s of shares) {
      const entry = byZone.get(s.zoneId) ?? { zoneName: s.zoneName, revenue: 0, shareOwed: 0, electricity: 0, hasBills: false };
      entry.shareOwed += s.shareAmountInr;
      byZone.set(s.zoneId, entry);
    }
    for (const b of bills) {
      const entry = byZone.get(b.zoneId) ?? { zoneName: b.zoneName, revenue: 0, shareOwed: 0, electricity: 0, hasBills: false };
      entry.electricity += b.amountInr;
      entry.hasBills = true;
      byZone.set(b.zoneId, entry);
    }
    return [...byZone.entries()]
      .map(([zoneId, e]) => ({ zoneId, ...e, profit: e.revenue - e.shareOwed - e.electricity }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [grossBySession, shares, bills]);

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

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="MTTR (30d)"
          value={reliability.mttrMinutes != null ? `${reliability.mttrMinutes} min` : "—"}
          icon={<Zap className="h-4 w-4" />}
        />
        <StatCard
          label="Fleet uptime (30d)"
          value={reliability.uptimePct != null ? `${reliability.uptimePct}%` : "—"}
          tone={reliability.uptimePct != null && reliability.uptimePct < 95 ? "warn" : "default"}
          icon={<Gauge className="h-4 w-4" />}
        />
        <StatCard label="Outages (30d)" value={reliability.outages} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard
          label="Utilisation (live)"
          value={totalConnectors > 0 ? `${Math.round(((connectorStatusCounts.get("Occupied") ?? 0) / totalConnectors) * 100)}%` : "—"}
          icon={<Gauge className="h-4 w-4" />}
        />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card title="Connector status" subtitle={`${totalConnectors} connector${totalConnectors === 1 ? "" : "s"} reporting`}>
          {totalConnectors === 0 ? (
            <p className="text-sm text-ink-500">No connector status reported yet.</p>
          ) : (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-ink-100">
                {CONNECTOR_STATUS_ORDER.filter((s) => connectorStatusCounts.get(s)).map((s) => (
                  <div
                    key={s}
                    className={cn(CONNECTOR_STATUS_COLOR[s], "h-full")}
                    style={{ width: `${((connectorStatusCounts.get(s) ?? 0) / totalConnectors) * 100}%` }}
                    title={`${s}: ${connectorStatusCounts.get(s)}`}
                  />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
                {CONNECTOR_STATUS_ORDER.filter((s) => connectorStatusCounts.get(s)).map((s) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", CONNECTOR_STATUS_COLOR[s])} />
                    <span className="text-ink-600">{s}</span>
                    <span className="ml-auto tabular-nums font-medium text-ink-800">{connectorStatusCounts.get(s)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card title="Connector types" subtitle="Across active registered chargers" className="lg:col-span-2">
          {connectorTypeCounts.length === 0 ? (
            <p className="text-sm text-ink-500">No connector types recorded yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {connectorTypeCounts.map(([type, count]) => {
                const max = connectorTypeCounts[0]![1];
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between text-xs text-ink-600">
                      <span>{type}</span>
                      <span className="tabular-nums font-medium text-ink-800">{count}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
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

        <Card title="Top sites by gross revenue (all time)" className="lg:col-span-2">
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

        <Card title="Revenue per charger (30d)" className="lg:col-span-2">
          {revenuePerCharger.length === 0 ? (
            <EmptyState icon={<Banknote className="h-8 w-8" />} title="No billed sessions in the last 30 days" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenuePerCharger} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => formatCompactINR(v)} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="chargePointId" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                  <Bar dataKey="revenue" fill="#2f7de1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Station profit (all time)"
        subtitle="Gross revenue minus site payouts minus logged electricity bills — log bills on /settlements"
        className="mt-4"
      >
        {stationProfit.length === 0 ? (
          <EmptyState icon={<Banknote className="h-8 w-8" />} title="No site activity yet" />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Site</th>
                  <th className="th text-right">Gross revenue</th>
                  <th className="th text-right">Owed to host</th>
                  <th className="th text-right">Electricity</th>
                  <th className="th text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {stationProfit.map((s) => (
                  <tr key={s.zoneId} className="hover:bg-ink-50">
                    <td className="td font-medium">{s.zoneName}</td>
                    <td className="td text-right tabular-nums text-ink-600">{formatINR(s.revenue)}</td>
                    <td className="td text-right tabular-nums text-rose-600">-{formatINR(s.shareOwed)}</td>
                    <td className="td text-right tabular-nums text-rose-600">{s.hasBills ? `-${formatINR(s.electricity)}` : "—"}</td>
                    <td className="td text-right tabular-nums font-medium">
                      {s.hasBills ? formatINR(s.profit) : <span className="text-ink-400" title="No electricity bill logged yet — profit would overstate the real margin">Needs bill</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {billed.length === 0 && sessions !== null && (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-ink-500">
          <Zap className="h-4 w-4" /> No billed sessions in the last {RANGE_DAYS} days yet.
        </p>
      )}
    </>
  );
}
