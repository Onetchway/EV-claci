"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Battery, Camera, Copy, MapPin, RefreshCw, Wifi, WifiOff,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, PageHeader, Select, Spinner, StatCard, useAsyncAction, useToast,
} from "@/components/ui";
import { useSettings } from "@/hooks/use-settings";
import {
  chargerWsUrl, oemLabel, regenerateConnectionToken, subscribeChargerRegistration, uploadChargerPhoto,
  type ChargerRegistration,
} from "@/lib/db/charger-registry";
import {
  subscribeChargePoint, subscribeDowntimeEventsForCharger, subscribeOcppMessagesForCharger, subscribeSessionsForChargePoint,
  type ChargePoint, type ChargeSession, type DowntimeEvent, type OcppMessage,
} from "@/lib/db/chargers";
import { subscribeZones } from "@/lib/db/zones";
import { canManageChargers } from "@/lib/permissions";
import type { Zone } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const CONNECTOR_COLOR: Record<string, string> = {
  Available: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  Occupied: "bg-sky-100 text-sky-800 ring-sky-200",
  Reserved: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  Unavailable: "bg-ink-100 text-ink-600 ring-ink-200",
  Faulted: "bg-rose-100 text-rose-800 ring-rose-200",
};

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

function wh(v?: number): string {
  if (v == null) return "—";
  return `${(v / 1000).toFixed(2)} kWh`;
}

export default function ChargerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const viewer = useViewer();
  const canManage = canManageChargers(viewer);
  const { settings } = useSettings();
  const { push } = useToast();
  const { run, busy } = useAsyncAction();

  const [reg, setReg] = useState<ChargerRegistration | null | undefined>(undefined);
  const [live, setLive] = useState<ChargePoint | null>(null);
  const [sessions, setSessions] = useState<ChargeSession[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [downtime, setDowntime] = useState<DowntimeEvent[]>([]);
  const [messages, setMessages] = useState<OcppMessage[]>([]);
  const [tab, setTab] = useState<"usage" | "uptime" | "logs">("usage");
  const [rangeDays, setRangeDays] = useState("7");
  const [uploading, setUploading] = useState(false);

  useEffect(() => subscribeChargerRegistration(id, setReg), [id]);
  useEffect(() => subscribeZones(setZones), []);

  useEffect(() => {
    if (!reg) return;
    return subscribeChargePoint(reg.chargerId, setLive);
  }, [reg]);
  useEffect(() => {
    if (!reg) return;
    return subscribeSessionsForChargePoint(reg.chargerId, setSessions);
  }, [reg]);
  useEffect(() => {
    if (!reg) return;
    const since = new Date();
    since.setDate(since.getDate() - Number(rangeDays));
    return subscribeDowntimeEventsForCharger(reg.chargerId, since, setDowntime);
  }, [reg, rangeDays]);
  useEffect(() => {
    if (!reg) return;
    return subscribeOcppMessagesForCharger(reg.chargerId, setMessages);
  }, [reg]);

  const zoneName = useMemo(() => new Map(zones.map((z) => [z.id, z.name])), [zones]);

  const usageByDay = useMemo(() => {
    const since = Date.now() - Number(rangeDays) * 24 * 60 * 60 * 1000;
    const byDay = new Map<string, number>();
    for (const s of sessions) {
      const endedMs = (s.endedAt as { toMillis?: () => number } | undefined)?.toMillis?.()
        ?? (s.lastUpdateAt as { toMillis?: () => number } | undefined)?.toMillis?.();
      if (!endedMs || endedMs < since) continue;
      const day = new Date(endedMs).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + (s.energyDeliveredWh ?? 0) / 1000);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, kwh]) => ({ day, kwh: Math.round(kwh * 100) / 100 }));
  }, [sessions, rangeDays]);

  const uptimeStats = useMemo(() => {
    if (downtime.length === 0) return { mttrMinutes: null as number | null, outages: 0, totalDowntimeMinutes: 0 };
    const totalDowntimeMinutes = downtime.reduce((a, e) => a + e.durationMinutes, 0);
    return { mttrMinutes: Math.round(totalDowntimeMinutes / downtime.length), outages: downtime.length, totalDowntimeMinutes };
  }, [downtime]);

  async function handlePhotoSelected(file: File | undefined) {
    if (!file || !reg) return;
    setUploading(true);
    try {
      await uploadChargerPhoto(reg.id, file);
      push("Photo uploaded.", "success");
    } catch (e) {
      push(e instanceof Error ? e.message : "Upload failed.", "error");
    } finally {
      setUploading(false);
    }
  }

  const wsUrl = reg && settings.ocpp.serverHost ? chargerWsUrl(settings.ocpp.serverHost, reg.chargerId, reg.connectionToken) : "";

  if (reg === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (reg === null) return <EmptyState title="Charger not found" />;

  return (
    <>
      <Link href="/chargers" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Chargers
      </Link>
      <PageHeader
        title={reg.label}
        description={reg.chargerId}
        actions={(
          <Badge className={live?.status === "ONLINE" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
            <span className="flex items-center gap-1">
              {live?.status === "ONLINE" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {live?.status ?? "Not connected yet"}
            </span>
          </Badge>
        )}
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Card title="Photo">
            {reg.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={reg.photoUrl} alt={reg.label} className="aspect-video w-full rounded-lg object-cover" />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-ink-50 text-ink-300">
                <Camera className="h-8 w-8" />
              </div>
            )}
            {canManage && (
              <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-brand-700">
                <Camera className="h-4 w-4" />
                {uploading ? "Uploading…" : "Upload photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { void handlePhotoSelected(e.target.files?.[0]); e.target.value = ""; }}
                />
              </label>
            )}
          </Card>

          {canManage && (
            <Card title="Connection">
              <p className="mb-2 text-xs text-ink-500">
                {reg.connectionToken
                  ? "Token-secured — this URL only works for this charger."
                  : "No token set (registered before this feature) — accepted on charger ID alone."}
              </p>
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-ink-50 px-2.5 py-1.5">
                <code className="flex-1 truncate text-[11px] text-ink-700">{wsUrl || "Set OCPP server host in Settings"}</code>
                {wsUrl && (
                  <button
                    type="button"
                    onClick={() => { void navigator.clipboard.writeText(wsUrl); push("Copied.", "success"); }}
                    className="shrink-0 text-ink-500 hover:text-ink-800"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button
                size="sm"
                loading={busy}
                onClick={() => void run(async () => {
                  if (!window.confirm("Rotate this charger's connection token? The old URL stops working immediately.")) return;
                  await regenerateConnectionToken(reg.id);
                }, "Token rotated.")}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate token
              </Button>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card title="Charger details">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-500">Site</dt><dd className="text-ink-900">{reg.zoneId ? zoneName.get(reg.zoneId) ?? "—" : "Unassigned"}</dd></div>
              <div><dt className="text-xs text-ink-500">Serial number</dt><dd className="text-ink-900">{live?.serialNumber ?? reg.serialNumber ?? "—"}</dd></div>
              <div><dt className="text-xs text-ink-500">OEM / Model</dt><dd className="text-ink-900">{oemLabel(reg)}{reg.model ? ` · ${reg.model}` : ""}</dd></div>
              <div><dt className="text-xs text-ink-500">Power</dt><dd className="text-ink-900">{reg.powerKw ? `${reg.powerKw} kW` : "—"} ({reg.chargerPowerType})</dd></div>
              <div><dt className="text-xs text-ink-500">Firmware version</dt><dd className="text-ink-900">{live?.firmwareVersion ?? "—"}</dd></div>
              <div><dt className="text-xs text-ink-500">Hardware version</dt><dd className="text-ink-900">{reg.hardwareVersion || "—"}</dd></div>
              <div><dt className="text-xs text-ink-500">Access</dt><dd className="text-ink-900">{reg.accessType === "PRIVATE" ? "Private" : "Public"} · {reg.open24Hours === false ? (reg.openingHours || "Custom hours") : "Open 24 hours"}</dd></div>
              <div><dt className="text-xs text-ink-500">Heartbeat interval</dt><dd className="text-ink-900">{reg.heartbeatIntervalSec ?? 300}s</dd></div>
              <div><dt className="text-xs text-ink-500">Max SOC</dt><dd className="text-ink-900">{reg.maxSocPercent ? `${reg.maxSocPercent}%` : "No limit"}</dd></div>
              <div><dt className="text-xs text-ink-500">Reservations</dt><dd className="text-ink-900">{reg.reservationsEnabled ? "Enabled" : "Disabled"}</dd></div>
              <div><dt className="text-xs text-ink-500">Last offline</dt><dd className="text-ink-900">{live?.disconnectedAt ? formatDateTime(live.disconnectedAt) : "N/A"}</dd></div>
              <div><dt className="text-xs text-ink-500">Created</dt><dd className="text-ink-900">{reg.createdAt ? formatDateTime(reg.createdAt) : "—"}</dd></div>
              {reg.lat != null && reg.lng != null && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-ink-500">Geolocation</dt>
                  <dd className="flex items-center gap-1.5 text-ink-900">
                    {reg.lat.toFixed(6)}, {reg.lng.toFixed(6)}
                    <a
                      href={`https://www.google.com/maps?q=${reg.lat},${reg.lng}`}
                      target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                    >
                      <MapPin className="h-3.5 w-3.5" /> View on map
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card title="Connector details">
            {!live?.connectors || Object.keys(live.connectors).length === 0 ? (
              <EmptyState icon={<Battery className="h-8 w-8" />} title="No live connector status yet" />
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full">
                  <thead className="border-b border-ink-200">
                    <tr><th className="th">Connector</th><th className="th">Type</th><th className="th">Status</th><th className="th">Reported</th></tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {Object.entries(live.connectors).map(([key, c]) => (
                      <tr key={key}>
                        <td className="td font-medium">{c.connectorId}</td>
                        <td className="td text-ink-600">{c.evseId ? `EVSE ${c.evseId}` : "—"}</td>
                        <td className="td"><Badge className={CONNECTOR_COLOR[c.status] ?? ""}>{c.status}</Badge></td>
                        <td className="td text-ink-600">{c.reportedAt ? formatDateTime(c.reportedAt) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title={tab === "usage" ? "Charger usage" : tab === "uptime" ? "Charger uptime" : "OCPP message log"}
            actions={(
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg bg-ink-100 p-0.5 text-sm">
                  <button
                    type="button"
                    onClick={() => setTab("usage")}
                    className={`rounded-md px-3 py-1 ${tab === "usage" ? "bg-white shadow-sm" : "text-ink-500"}`}
                  >
                    Usage
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("uptime")}
                    className={`rounded-md px-3 py-1 ${tab === "uptime" ? "bg-white shadow-sm" : "text-ink-500"}`}
                  >
                    Uptime
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("logs")}
                    className={`rounded-md px-3 py-1 ${tab === "logs" ? "bg-white shadow-sm" : "text-ink-500"}`}
                  >
                    Logs
                  </button>
                </div>
                {tab !== "logs" && (
                  <Select value={rangeDays} onChange={(e) => setRangeDays(e.target.value)} options={RANGE_OPTIONS} />
                )}
              </div>
            )}
          >
            {tab === "logs" ? (
              messages.length === 0 ? (
                <EmptyState title="No OCPP messages yet" description="Call/CallResult/CallError frames appear here as the charger exchanges them, newest first." />
              ) : (
                <div className="max-h-[32rem] overflow-x-auto overflow-y-auto scroll-thin">
                  <table className="w-full">
                    <thead className="sticky top-0 border-b border-ink-200 bg-white">
                      <tr>
                        <th className="th">Time</th>
                        <th className="th">Dir</th>
                        <th className="th">Type</th>
                        <th className="th">Action</th>
                        <th className="th">Payload</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {messages.map((m) => (
                        <tr key={m.id}>
                          <td className="td whitespace-nowrap text-ink-500">{formatDateTime(m.createdAt)}</td>
                          <td className="td">
                            <Badge className={m.direction === "IN" ? "bg-sky-100 text-sky-800 ring-sky-200" : "bg-violet-100 text-violet-800 ring-violet-200"}>
                              {m.direction === "IN" ? "Charger → CSMS" : "CSMS → Charger"}
                            </Badge>
                          </td>
                          <td className="td">
                            <Badge className={m.messageType === "CallError" ? "bg-rose-100 text-rose-800 ring-rose-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
                              {m.messageType}
                            </Badge>
                          </td>
                          <td className="td text-ink-600">{m.action ?? "—"}</td>
                          <td className="td max-w-md truncate font-mono text-xs text-ink-500" title={m.payload}>{m.payload}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : tab === "usage" ? (
              usageByDay.length === 0 ? (
                <EmptyState icon={<Battery className="h-8 w-8" />} title="No sessions billed in this range" />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={usageByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} kWh`} />
                      <Tooltip formatter={(v: number) => `${v} kWh`} />
                      <Bar dataKey="kwh" fill="#f0501f" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )
            ) : (
              <>
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <StatCard label="MTTR" value={uptimeStats.mttrMinutes != null ? `${uptimeStats.mttrMinutes} min` : "—"} />
                  <StatCard label="Outages" value={uptimeStats.outages} />
                  <StatCard label="Downtime" value={`${Math.round(uptimeStats.totalDowntimeMinutes)} min`} />
                </div>
                {downtime.length === 0 ? (
                  <EmptyState title="No outages in this range" />
                ) : (
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full">
                      <thead className="border-b border-ink-200">
                        <tr><th className="th">Disconnected</th><th className="th">Recovered</th><th className="th text-right">Duration</th></tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {downtime.map((e) => (
                          <tr key={e.id}>
                            <td className="td text-ink-600">{formatDateTime(e.disconnectedAt)}</td>
                            <td className="td text-ink-600">{formatDateTime(e.recoveredAt)}</td>
                            <td className="td text-right tabular-nums">{Math.round(e.durationMinutes)} min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
