"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Battery, Copy, Plus, Power, PowerOff, QrCode, Wifi, WifiOff, Zap,
} from "lucide-react";
import QRCode from "qrcode";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard,
  useAsyncAction, useToast,
} from "@/components/ui";
import { useSettings } from "@/hooks/use-settings";
import {
  chargerWsUrl, CHARGER_VENDORS, CONNECTOR_TYPES, registerCharger, setChargerActive,
  subscribeChargerRegistry, type ChargerRegistration, type ChargerRegistrationDraft,
} from "@/lib/db/charger-registry";
import {
  subscribeChargePoints, subscribeRecentSessions, type ChargePoint,
  type ChargeSession, type ConnectorStatus,
} from "@/lib/db/chargers";
import { canManageChargers } from "@/lib/permissions";
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

const blankDraft: ChargerRegistrationDraft = {
  label: "", location: "", vendor: "Exicom", model: "", connectorType: undefined, powerKw: undefined, notes: "",
};

/** Generates and displays the connection QR for a given charger, on demand — nothing is precomputed. */
function ConnectionDetails({ serverHost, chargerId }: { serverHost: string; chargerId: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const { push } = useToast();
  const url = serverHost ? chargerWsUrl(serverHost, chargerId) : "";

  useEffect(() => {
    if (!url) { setQr(null); return; }
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 220 }).then((dataUrl) => {
      if (!cancelled) setQr(dataUrl);
    }).catch(() => setQr(null));
    return () => { cancelled = true; };
  }, [url]);

  if (!serverHost) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
        Set the OCPP server host in Settings → OCPP before connection URLs can be generated.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="Connection QR code" className="h-[220px] w-[220px] rounded-lg ring-1 ring-ink-200" />
      ) : (
        <div className="flex h-[220px] w-[220px] items-center justify-center rounded-lg bg-ink-50"><Spinner /></div>
      )}
      <div className="flex w-full items-center gap-2 rounded-lg bg-ink-50 px-3 py-2">
        <code className="flex-1 truncate text-left text-xs text-ink-700">{url}</code>
        <button
          type="button"
          onClick={() => { void navigator.clipboard.writeText(url); push("Connection URL copied.", "success"); }}
          className="shrink-0 rounded-md p-1.5 text-ink-500 hover:bg-ink-200 hover:text-ink-800"
          aria-label="Copy connection URL"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-xs text-ink-500">
        Scan with your phone to copy this URL, or paste it into the charger's Central System URL setting
        in its vendor config portal.
      </p>
    </div>
  );
}

export default function ChargersPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const { settings } = useSettings();
  const canManage = canManageChargers(viewer);

  const [points, setPoints] = useState<ChargePoint[]>([]);
  const [sessions, setSessions] = useState<ChargeSession[]>([]);
  const [registry, setRegistry] = useState<ChargerRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<ChargerRegistrationDraft>(blankDraft);
  const [registering, setRegistering] = useState(false);
  const [justRegisteredId, setJustRegisteredId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const { run } = useAsyncAction();

  useEffect(
    () => subscribeChargePoints((rows) => { setPoints(rows); setLoading(false); }, (e) => { setError(e.message); setLoading(false); }),
    [],
  );
  useEffect(() => subscribeRecentSessions(setSessions), []);
  useEffect(() => subscribeChargerRegistry(setRegistry), []);

  const pointByChargerId = useMemo(() => new Map(points.map((p) => [p.chargePointId ?? p.id, p])), [points]);

  const stats = useMemo(() => {
    const online = points.filter((p) => p.status === "ONLINE").length;
    const active = sessions.filter((s) => s.status === "ACTIVE").length;
    const energyToday = sessions.reduce((a, s) => a + (s.energyDeliveredWh ?? 0), 0);
    return { total: registry.filter((r) => r.active).length, online, active, energyToday };
  }, [points, sessions, registry]);

  async function submitRegistration() {
    if (!actor || !draft.label.trim() || !draft.location.trim()) return;
    setRegistering(true);
    try {
      const chargerId = await registerCharger(
        { ...draft, powerKw: draft.powerKw ? Number(draft.powerKw) : undefined },
        actor,
      );
      setJustRegisteredId(chargerId);
      setDraft(blankDraft);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRegistering(false);
    }
  }

  function closeAddModal() {
    setAddOpen(false);
    setJustRegisteredId(null);
    setDraft(blankDraft);
  }

  const viewingReg = registry.find((r) => r.id === viewingId) ?? null;

  return (
    <>
      <PageHeader
        title="Chargers & Stations"
        description="Live status from the OCPP central system — Phase 1: connection, status and session logs. No remote control yet."
        actions={canManage && (
          <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add charger</Button>
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Registered chargers" value={stats.total} icon={<Zap className="h-4 w-4" />} />
        <StatCard label="Online now" value={stats.online} tone={stats.online ? "positive" : "default"} icon={<Wifi className="h-4 w-4" />} />
        <StatCard label="Active sessions" value={stats.active} tone={stats.active ? "positive" : "default"} icon={<Battery className="h-4 w-4" />} />
        <StatCard label="Energy delivered (recent)" value={wh(stats.energyToday)} />
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          {error}
        </div>
      )}

      <Card title="Registered chargers" subtitle="Only these charger IDs are allowed to connect to the OCPP server." className="mb-4">
        {registry.length === 0 ? (
          <EmptyState
            icon={<QrCode className="h-8 w-8" />}
            title="No chargers registered yet"
            description={canManage ? "Register a charger to generate its connection URL and QR code." : "Ask an admin to register a charger."}
            action={canManage ? <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add charger</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Label</th>
                  <th className="th">Charger ID</th>
                  <th className="th">Vendor</th>
                  <th className="th">Location</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {registry.map((r) => {
                  const live = pointByChargerId.get(r.chargerId);
                  return (
                    <tr key={r.id} className="hover:bg-ink-50">
                      <td className="td font-medium">{r.label}</td>
                      <td className="td"><code className="text-xs text-ink-600">{r.chargerId}</code></td>
                      <td className="td text-ink-600">{r.vendor}</td>
                      <td className="td text-ink-600">{r.location}</td>
                      <td className="td">
                        {!r.active ? (
                          <Badge className="bg-ink-100 text-ink-500 ring-ink-200">Deactivated</Badge>
                        ) : live?.status === "ONLINE" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">
                            <span className="flex items-center gap-1"><Wifi className="h-3 w-3" /> Online</span>
                          </Badge>
                        ) : (
                          <Badge className="bg-ink-100 text-ink-600 ring-ink-200">
                            <span className="flex items-center gap-1"><WifiOff className="h-3 w-3" /> {live ? "Offline" : "Not connected yet"}</span>
                          </Badge>
                        )}
                      </td>
                      <td className="td text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingId(r.id)}
                            className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                            title="View connection details"
                          >
                            <QrCode className="h-4 w-4" />
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => run(() => setChargerActive(r.id, !r.active), r.active ? "Charger deactivated." : "Charger reactivated.")}
                              className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                              title={r.active ? "Deactivate (revoke connection access)" : "Reactivate"}
                            >
                              {r.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : points.length === 0 ? (
        <EmptyState
          icon={<WifiOff className="h-8 w-8" />}
          title="No charge points connected yet"
          description="Once a registered charger connects to the OCPP central system, its live status shows up here automatically."
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

      <Modal
        open={addOpen}
        onClose={closeAddModal}
        title={justRegisteredId ? "Charger registered" : "Add charger"}
        description={justRegisteredId ? undefined : "Generates a unique charger ID, connection URL and QR code — nothing needs to be typed into the charger's own settings until you're ready."}
        footer={justRegisteredId ? (
          <Button onClick={closeAddModal}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={closeAddModal}>Cancel</Button>
            <Button
              onClick={() => void submitRegistration()}
              loading={registering}
              disabled={!draft.label.trim() || !draft.location.trim()}
            >
              Register
            </Button>
          </>
        )}
      >
        {justRegisteredId ? (
          <ConnectionDetails serverHost={settings.ocpp.serverHost} chargerId={justRegisteredId} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Label" required className="sm:col-span-2">
              <Input
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                placeholder="e.g. Lobby DC-01"
              />
            </Field>
            <Field label="Location" required className="sm:col-span-2">
              <Input
                value={draft.location}
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                placeholder="e.g. Site name / address"
              />
            </Field>
            <Field label="Vendor">
              <Select
                value={draft.vendor}
                onChange={(e) => setDraft((d) => ({ ...d, vendor: e.target.value as ChargerRegistrationDraft["vendor"] }))}
                options={CHARGER_VENDORS.map((v) => ({ value: v, label: v }))}
              />
            </Field>
            <Field label="Model">
              <Input
                value={draft.model ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
                placeholder="Optional"
              />
            </Field>
            <Field label="Connector type">
              <Select
                value={draft.connectorType ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, connectorType: (e.target.value || undefined) as ChargerRegistrationDraft["connectorType"] }))}
                options={CONNECTOR_TYPES.map((c) => ({ value: c, label: c }))}
                placeholder="Optional"
              />
            </Field>
            <Field label="Power (kW)">
              <Input
                type="number"
                min={0}
                value={draft.powerKw ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, powerKw: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="Optional"
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Input
                value={draft.notes ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Optional"
              />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!viewingReg}
        onClose={() => setViewingId(null)}
        title={viewingReg ? `Connect ${viewingReg.label}` : ""}
        footer={<Button onClick={() => setViewingId(null)}>Close</Button>}
      >
        {viewingReg && <ConnectionDetails serverHost={settings.ocpp.serverHost} chargerId={viewingReg.chargerId} />}
      </Modal>
    </>
  );
}
