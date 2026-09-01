"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Battery, Building2, Ticket, Wifi, Zap,
} from "lucide-react";

import { CONNECTOR_TYPE_COLOR } from "@/components/connector-icon";
import { DonutChart } from "@/components/donut-chart";
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

  /**
   * The full Available/Charging/Preparing/Faulted/Maintenance taxonomy,
   * composed from three separate signals rather than one OCPP field — no
   * single field carries all five: connector status gives
   * Available/Faulted/Reserved/Unavailable; "Maintenance" is
   * operationalStatus (an admin-set ChangeAvailability flag, not something
   * a charger reports on its own); and "Charging" vs "Preparing" both show
   * as connector status "Occupied" — only the active session's own
   * chargingState (2.0.1) tells them apart. A 1.6 session has no
   * chargingState field at all, so an occupied connector with no
   * chargingState signal defaults to "Charging" rather than an unresolved
   * bucket.
   */
  const statusTaxonomy = useMemo(() => {
    const activeChargingStateByCharger = new Map<string, string | null | undefined>();
    for (const s of sessions) {
      if (s.status === "ACTIVE") activeChargingStateByCharger.set(s.chargePointId, s.chargingState);
    }
    const counts = { Available: 0, Charging: 0, Preparing: 0, Faulted: 0, Maintenance: 0, Other: 0 };
    for (const p of points) {
      const connectors = Object.values(p.connectors ?? {});
      if (connectors.length === 0) continue;
      for (const c of connectors) {
        if (c.status === "Faulted") { counts.Faulted += 1; continue; }
        if (p.operationalStatus === "INOPERATIVE") { counts.Maintenance += 1; continue; }
        if (c.status === "Occupied") {
          const chargingState = activeChargingStateByCharger.get(p.chargePointId ?? p.id);
          if (!chargingState || chargingState === "Charging") counts.Charging += 1;
          else counts.Preparing += 1;
          continue;
        }
        if (c.status === "Available") { counts.Available += 1; continue; }
        counts.Other += 1;
      }
    }
    return counts;
  }, [points, sessions]);

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

          <Card title="Connector status" className="mb-4" subtitle="Available / Charging / Preparing / Faulted / Maintenance, live across every connected connector.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="Available" value={statusTaxonomy.Available} tone={statusTaxonomy.Available ? "positive" : "default"} />
              <StatCard label="Charging" value={statusTaxonomy.Charging} tone={statusTaxonomy.Charging ? "positive" : "default"} />
              <StatCard label="Preparing" value={statusTaxonomy.Preparing} />
              <StatCard label="Faulted" value={statusTaxonomy.Faulted} tone={statusTaxonomy.Faulted ? "negative" : "default"} />
              <StatCard label="Maintenance" value={statusTaxonomy.Maintenance} tone={statusTaxonomy.Maintenance ? "warn" : "default"} />
            </div>
          </Card>

          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            <Card title="Power type">
              <DonutChart
                slices={[
                  { label: "AC", value: breakdown.ac, color: "#1fae54" },
                  { label: "DC", value: breakdown.dc, color: "#0ea5e9" },
                ]}
              />
            </Card>
            <Card title="Access type">
              <DonutChart
                slices={[
                  { label: "Public", value: breakdown.publicCount, color: "#1fae54" },
                  { label: "Private", value: breakdown.privateCount, color: "#8b5cf6" },
                  { label: "Hubs", value: breakdown.hubs, color: "#f59e0b" },
                ]}
              />
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
              <DonutChart
                slices={breakdown.byConnector.map(([type, count]) => ({
                  label: type, value: count, color: CONNECTOR_TYPE_COLOR[type] ?? "#8590a8",
                }))}
              />
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
