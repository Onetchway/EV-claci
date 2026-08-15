"use client";

import { useEffect, useMemo, useState } from "react";
import { Battery, Wifi, WifiOff, Zap } from "lucide-react";

import {
  Badge, Card, EmptyState, PageHeader, Spinner, StatCard,
} from "@/components/ui";
import {
  subscribeChargePoints, subscribeRecentSessions, type ChargePoint,
  type ChargeSession, type ConnectorStatus,
} from "@/lib/db/chargers";
import { cn, formatDateTime } from "@/lib/utils";

const CONNECTOR_COLOR: Record<ConnectorStatus, string> = {
  Available: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  Occupied: "bg-sky-100 text-sky-800 ring-sky-200",
  Reserved: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  Unavailable: "bg-ink-100 text-ink-600 ring-ink-200",
  Faulted: "bg-rose-100 text-rose-800 ring-rose-200",
};

function wh(v?: number): string {
  if (v == null) return "—";
  return `${(v / 1000).toFixed(2)} kWh`;
}

function durationMinutes(session: ChargeSession): string {
  const start = session.startedAt as { toMillis?: () => number } | undefined;
  const end = session.endedAt as { toMillis?: () => number } | undefined;
  const startMs = start?.toMillis?.();
  if (!startMs) return "—";
  const endMs = end?.toMillis?.() ?? Date.now();
  const mins = Math.max(0, Math.round((endMs - startMs) / 60000));
  return mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)} hr`;
}

export default function ChargersPage() {
  const [points, setPoints] = useState<ChargePoint[]>([]);
  const [sessions, setSessions] = useState<ChargeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => subscribeChargePoints((rows) => { setPoints(rows); setLoading(false); }, (e) => { setError(e.message); setLoading(false); }),
    [],
  );
  useEffect(() => subscribeRecentSessions(setSessions), []);

  const stats = useMemo(() => {
    const online = points.filter((p) => p.status === "ONLINE").length;
    const active = sessions.filter((s) => s.status === "ACTIVE").length;
    const energyToday = sessions.reduce((a, s) => a + (s.energyDeliveredWh ?? 0), 0);
    return { total: points.length, online, active, energyToday };
  }, [points, sessions]);

  return (
    <>
      <PageHeader
        title="Chargers & Stations"
        description="Live status from the OCPP central system — Phase 1: connection, status and session logs. No remote control yet."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Charge points" value={stats.total} icon={<Zap className="h-4 w-4" />} />
        <StatCard label="Online now" value={stats.online} tone={stats.online ? "positive" : "default"} icon={<Wifi className="h-4 w-4" />} />
        <StatCard label="Active sessions" value={stats.active} tone={stats.active ? "positive" : "default"} icon={<Battery className="h-4 w-4" />} />
        <StatCard label="Energy delivered (recent)" value={wh(stats.energyToday)} />
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : points.length === 0 ? (
        <EmptyState
          icon={<WifiOff className="h-8 w-8" />}
          title="No charge points connected yet"
          description="Once a charger connects to the OCPP central system, it shows up here automatically — nothing to configure on this page."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {points.map((p) => (
            <div key={p.id} className="card card-pad">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{p.chargePointId}</p>
                  <p className="truncate text-xs text-ink-500">{p.vendorName || "Unknown vendor"} {p.model ? `· ${p.model}` : ""}</p>
                </div>
                <Badge className={p.status === "ONLINE" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
                  <span className="flex items-center gap-1">
                    {p.status === "ONLINE" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {p.status}
                  </span>
                </Badge>
              </div>

              {p.connectors && Object.keys(p.connectors).length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.values(p.connectors).map((c) => (
                    <Badge key={`${c.evseId}-${c.connectorId}`} className={cn(CONNECTOR_COLOR[c.status])}>
                      EVSE {c.evseId}/{c.connectorId} · {c.status}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-ink-400">No connector status reported yet.</p>
              )}

              <p className="mt-3 border-t border-ink-100 pt-2 text-xs text-ink-500">
                Last seen {formatDateTime(p.lastSeenAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      <Card title="Recent sessions" subtitle={`${sessions.length} session${sessions.length === 1 ? "" : "s"}`} className="mt-4">
        {sessions.length === 0 ? (
          <EmptyState icon={<Battery className="h-8 w-8" />} title="No sessions yet" />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Charge point</th>
                  <th className="th">Status</th>
                  <th className="th">Started</th>
                  <th className="th">Duration</th>
                  <th className="th text-right">Energy delivered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-ink-50">
                    <td className="td font-medium">{s.chargePointId}</td>
                    <td className="td">
                      <Badge className={s.status === "ACTIVE" ? "bg-sky-100 text-sky-800 ring-sky-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="td text-ink-600">{formatDateTime(s.startedAt)}</td>
                    <td className="td text-ink-600">{durationMinutes(s)}</td>
                    <td className="td text-right font-medium tabular-nums">{wh(s.energyDeliveredWh)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
