"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Battery, Building2, Cable, Globe2, Lock, Ticket, Wifi, Zap,
} from "lucide-react";

import { Card, PageHeader, Spinner, StatCard } from "@/components/ui";
import { subscribeChargerRegistry, type ChargerRegistration } from "@/lib/db/charger-registry";
import { subscribeChargePoints, subscribeRecentSessions, type ChargePoint, type ChargeSession } from "@/lib/db/chargers";
import { subscribeTickets } from "@/lib/db/tickets";
import type { Ticket as TicketType } from "@/lib/types";

function wh(v?: number): string {
  if (v == null) return "—";
  return `${(v / 1000).toFixed(2)} kWh`;
}

const QUICK_LINKS = [
  { href: "/chargers", label: "Charger Management", icon: Zap, description: "Register, configure and command chargers." },
  { href: "/stations", label: "Station Management", icon: Building2, description: "Sites, zones, and the live charger map." },
  { href: "/sessions", label: "Sessions", icon: Battery, description: "Every live and recent charging session." },
  { href: "/tickets", label: "Ticket Management", icon: Ticket, description: "Open faults and SLA breaches." },
];

export default function CmsDashboardPage() {
  const [registry, setRegistry] = useState<ChargerRegistration[]>([]);
  const [points, setPoints] = useState<ChargePoint[]>([]);
  const [sessions, setSessions] = useState<ChargeSession[]>([]);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeChargerRegistry((rows) => { setRegistry(rows); setLoading(false); }), []);
  useEffect(() => subscribeChargePoints(setPoints), []);
  useEffect(() => subscribeRecentSessions(setSessions), []);
  useEffect(() => subscribeTickets({ status: "OPEN" }, setTickets), []);

  const stats = useMemo(() => {
    const online = points.filter((p) => p.status === "ONLINE").length;
    const active = sessions.filter((s) => s.status === "ACTIVE").length;
    const energyToday = sessions.reduce((a, s) => a + (s.energyDeliveredWh ?? 0), 0);
    return { total: registry.filter((r) => r.active).length, online, active, energyToday };
  }, [registry, points, sessions]);

  const breakdown = useMemo(() => {
    const active = registry.filter((r) => r.active);
    const ac = active.filter((r) => r.chargerPowerType === "AC").length;
    const dc = active.filter((r) => r.chargerPowerType === "DC").length;
    const publicCount = active.filter((r) => r.accessType !== "PRIVATE").length;
    const privateCount = active.filter((r) => r.accessType === "PRIVATE").length;
    // A "hub" is a site running 2+ active chargers, not a single-charger install.
    const chargersPerZone = new Map<string, number>();
    for (const r of active) {
      if (!r.zoneId) continue;
      chargersPerZone.set(r.zoneId, (chargersPerZone.get(r.zoneId) ?? 0) + 1);
    }
    const hubs = [...chargersPerZone.values()].filter((n) => n >= 2).length;
    const byConnector = new Map<string, number>();
    for (const r of active) {
      const types = [r.connectorType, ...(r.connectors ?? []).map((c) => c.connectorType)].filter(Boolean) as string[];
      for (const t of new Set(types)) byConnector.set(t, (byConnector.get(t) ?? 0) + 1);
    }
    return { ac, dc, publicCount, privateCount, hubs, byConnector: [...byConnector.entries()].sort((a, b) => b[1] - a[1]) };
  }, [registry]);

  return (
    <>
      <PageHeader
        title="CMS Dashboard"
        description="Fleet-wide summary — charger status, energy, and today's open faults."
      />

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Registered chargers" value={stats.total} icon={<Zap className="h-4 w-4" />} />
            <StatCard label="Online now" value={stats.online} tone={stats.online ? "positive" : "default"} icon={<Wifi className="h-4 w-4" />} />
            <StatCard label="Active sessions" value={stats.active} tone={stats.active ? "positive" : "default"} icon={<Battery className="h-4 w-4" />} />
            <StatCard label="Energy delivered (recent)" value={wh(stats.energyToday)} />
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            <Card title="Power type">
              <div className="flex items-center justify-around py-2 text-center">
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{breakdown.ac}</p>
                  <p className="text-xs text-ink-500">AC</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums">{breakdown.dc}</p>
                  <p className="text-xs text-ink-500">DC</p>
                </div>
              </div>
            </Card>
            <Card title="Access type">
              <div className="flex items-center justify-around py-2 text-center">
                <div>
                  <Globe2 className="mx-auto mb-1 h-4 w-4 text-ink-400" />
                  <p className="text-2xl font-semibold tabular-nums">{breakdown.publicCount}</p>
                  <p className="text-xs text-ink-500">Public</p>
                </div>
                <div>
                  <Lock className="mx-auto mb-1 h-4 w-4 text-ink-400" />
                  <p className="text-2xl font-semibold tabular-nums">{breakdown.privateCount}</p>
                  <p className="text-xs text-ink-500">Private</p>
                </div>
                <div>
                  <Building2 className="mx-auto mb-1 h-4 w-4 text-ink-400" />
                  <p className="text-2xl font-semibold tabular-nums">{breakdown.hubs}</p>
                  <p className="text-xs text-ink-500">Hubs</p>
                </div>
              </div>
            </Card>
            <Card title="Open faults">
              <div className="py-2 text-center">
                <p className={`text-2xl font-semibold tabular-nums ${tickets.length ? "text-rose-600" : ""}`}>{tickets.length}</p>
                <p className="text-xs text-ink-500">Awaiting resolution — see Ticket Management</p>
              </div>
            </Card>
          </div>

          <Card title="Connector types" className="mb-4">
            {breakdown.byConnector.length === 0 ? (
              <p className="text-sm text-ink-500">No connector data yet.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {breakdown.byConnector.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 ring-1 ring-inset ring-ink-100">
                    <Cable className="h-4 w-4 text-ink-400" />
                    <span className="text-sm font-medium">{type}</span>
                    <span className="text-sm tabular-nums text-ink-500">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_LINKS.map((l) => (
              <Link key={l.href} href={l.href}>
                <Card className="h-full transition hover:ring-2 hover:ring-brand-300">
                  <l.icon className="mb-2 h-5 w-5 text-brand-600" />
                  <p className="font-medium">{l.label}</p>
                  <p className="mt-1 text-xs text-ink-500">{l.description}</p>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
