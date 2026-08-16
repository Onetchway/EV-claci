"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Battery, Copy, ExternalLink, FileText, Lock, MapPin as MapPinIcon, Pencil, Plus, Power, PowerOff, QrCode,
  RotateCcw, Settings2, Square, Trash2, UploadCloud, Wifi, WifiOff, X, Zap,
} from "lucide-react";
import QRCode from "qrcode";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard,
  useAsyncAction, useToast,
} from "@/components/ui";
import { useSettings } from "@/hooks/use-settings";
import {
  chargerWsUrl, CHARGER_TYPES, CHARGER_VENDORS, CONNECTOR_TYPES, deleteChargerRegistration, oemLabel,
  registerCharger, setChargerActive, subscribeChargerRegistry, updateChargerRegistration,
  type ChargerRegistration, type ChargerRegistrationDraft, type ConnectorTypeName,
} from "@/lib/db/charger-registry";
import {
  subscribeChargePoints, subscribeRecentSessions, type ChargePoint,
  type ChargeSession, type ConnectorStatus,
} from "@/lib/db/chargers";
import { subscribeLeads } from "@/lib/db/leads";
import { sendChargerCommand } from "@/lib/ocpp-commands";
import { addRfidToken, deleteRfidToken, setRfidTokenStatus, subscribeRfidTokens } from "@/lib/db/rfid";
import { subscribeTickets } from "@/lib/db/tickets";
import { subscribeZones } from "@/lib/db/zones";
import { INDIAN_STATES, LEAD_TYPE_LABEL, LEAD_TYPES, type LeadType } from "@/lib/constants";
import { canManageChargers, canManageRfid, canVerifyPayment } from "@/lib/permissions";
import { applySessionDiscount } from "@/lib/sessions-client";
import type { Lead, RfidToken, Ticket, Zone } from "@/lib/types";
import { cn, formatDateTime, formatINR } from "@/lib/utils";

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
  label: "", location: "", state: "", chargerPowerType: "DC", vendor: "Exicom", vendorOther: "", model: "",
  connectorType: undefined, powerKw: undefined, notes: "", lat: null, lng: null, zoneId: null,
  leadId: null, leadCode: null,
  reservationsEnabled: false, accessType: "PUBLIC", open24Hours: true, openingHours: "",
  heartbeatIntervalSec: 300, maxSocPercent: undefined, photoUrl: null,
};

/** Generates and displays the connection QR for a given charger, on demand — nothing is precomputed. */
function ConnectionDetails({ serverHost, chargerId, connectionToken }: { serverHost: string; chargerId: string; connectionToken?: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const { push } = useToast();
  const url = serverHost ? chargerWsUrl(serverHost, chargerId, connectionToken) : "";

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
  const canFinance = canVerifyPayment(viewer);
  const [discountBusy, setDiscountBusy] = useState<string | null>(null);

  const [points, setPoints] = useState<ChargePoint[]>([]);
  const [sessions, setSessions] = useState<ChargeSession[]>([]);
  const [registry, setRegistry] = useState<ChargerRegistration[]>([]);
  const [rfidTokens, setRfidTokens] = useState<RfidToken[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState("");
  const [chargerSearch, setChargerSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [connectorTypeFilter, setConnectorTypeFilter] = useState("");
  const [faultFilter, setFaultFilter] = useState(false);
  const [openTickets, setOpenTickets] = useState<Ticket[]>([]);

  const [locatingReg, setLocatingReg] = useState<ChargerRegistration | null>(null);
  const [locZoneId, setLocZoneId] = useState("");
  const [locLat, setLocLat] = useState("");
  const [locLng, setLocLng] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<ChargerRegistrationDraft>(blankDraft);
  const [draftLeadType, setDraftLeadType] = useState<"" | LeadType>("");
  const [leadOptions, setLeadOptions] = useState<Lead[]>([]);
  const [registering, setRegistering] = useState(false);
  const [justRegisteredId, setJustRegisteredId] = useState<string | null>(null);
  const [justRegisteredToken, setJustRegisteredToken] = useState<string | undefined>(undefined);
  const [editingRegId, setEditingRegId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const [startingFor, setStartingFor] = useState<string | null>(null);
  const [startIdToken, setStartIdToken] = useState("");
  const [startEvseId, setStartEvseId] = useState("1");
  const [firmwareFor, setFirmwareFor] = useState<string | null>(null);
  const [firmwareUrl, setFirmwareUrl] = useState("");
  const [commandBusy, setCommandBusy] = useState<string | null>(null);

  const [varsFor, setVarsFor] = useState<string | null>(null);
  const [varsMode, setVarsMode] = useState<"GET" | "SET">("GET");
  const [varComponent, setVarComponent] = useState("");
  const [varName, setVarName] = useState("");
  const [varValue, setVarValue] = useState("");
  const [varResult, setVarResult] = useState<string | null>(null);
  const [logFor, setLogFor] = useState<string | null>(null);
  const [logUrl, setLogUrl] = useState("");

  const [newTokenId, setNewTokenId] = useState("");
  const [newTokenLabel, setNewTokenLabel] = useState("");

  const { run, busy: actionBusy } = useAsyncAction();
  const { push } = useToast();

  useEffect(
    () => subscribeChargePoints((rows) => { setPoints(rows); setLoading(false); }, (e) => { setError(e.message); setLoading(false); }),
    [],
  );
  useEffect(() => subscribeRecentSessions(setSessions), []);
  useEffect(() => subscribeChargerRegistry(setRegistry), []);
  useEffect(() => subscribeRfidTokens(setRfidTokens), []);
  useEffect(() => subscribeZones(setZones), []);
  useEffect(() => subscribeTickets({}, (rows) => setOpenTickets(rows.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS"))), []);
  useEffect(() => {
    if (!draftLeadType) { setLeadOptions([]); return; }
    return subscribeLeads({ type: draftLeadType, max: 200 }, setLeadOptions);
  }, [draftLeadType]);

  function openLocate(r: ChargerRegistration) {
    setLocatingReg(r);
    setLocZoneId(r.zoneId ?? "");
    setLocLat(r.lat != null ? String(r.lat) : "");
    setLocLng(r.lng != null ? String(r.lng) : "");
  }

  async function saveLocation() {
    if (!locatingReg) return;
    await run(() => updateChargerRegistration(locatingReg.id, {
      zoneId: locZoneId || null,
      lat: locLat.trim() ? Number(locLat) : null,
      lng: locLng.trim() ? Number(locLng) : null,
    }), "Location updated.");
    setLocatingReg(null);
  }


  async function runCommand(chargerId: string, label: string, fn: () => Promise<unknown>) {
    setCommandBusy(chargerId + label);
    try {
      await fn();
      push(`${label} sent to ${chargerId}.`, "success");
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setCommandBusy(null);
    }
  }

  async function issueSessionDiscount(s: ChargeSession) {
    const cost = s.totalCostInr ?? 0;
    const amountStr = window.prompt(`Discount how much (₹) off this ${formatINR(cost)} session? Up to the full amount.`, "");
    if (amountStr == null) return;
    const amount = Number(amountStr);
    if (!amount || amount <= 0 || amount > cost) {
      push("Enter a valid amount up to the session's current total.", "error");
      return;
    }
    const reason = window.prompt("Reason for this discount (shown in the audit trail):", "");
    if (!reason?.trim()) {
      push("A reason is required.", "error");
      return;
    }
    setDiscountBusy(s.id);
    try {
      await applySessionDiscount(s.id, amount, reason.trim());
      push("Discount applied.", "success");
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setDiscountBusy(null);
    }
  }

  async function submitRemoteStart() {
    if (!startingFor || !startIdToken.trim()) return;
    await runCommand(startingFor, "Remote start", () => sendChargerCommand(startingFor, "RequestStartTransaction", {
      remoteStartId: Date.now(),
      idToken: { idToken: startIdToken.trim(), type: "Central" },
      evseId: Number(startEvseId) || 1,
    }));
    setStartingFor(null);
    setStartIdToken("");
  }

  async function submitFirmwareUpdate() {
    if (!firmwareFor || !firmwareUrl.trim()) return;
    await runCommand(firmwareFor, "Update firmware", () => sendChargerCommand(firmwareFor, "UpdateFirmware", {
      requestId: Date.now(),
      firmware: { location: firmwareUrl.trim(), retrieveDateTime: new Date().toISOString() },
    }));
    setFirmwareFor(null);
    setFirmwareUrl("");
  }

  async function submitVariable() {
    if (!varsFor || !varComponent.trim() || !varName.trim()) return;
    if (varsMode === "SET") {
      await runCommand(varsFor, "Set variable", () => sendChargerCommand(varsFor, "SetVariables", {
        setVariableData: [{
          component: { name: varComponent.trim() },
          variable: { name: varName.trim() },
          attributeValue: varValue,
        }],
      }));
      setVarsFor(null);
      setVarComponent(""); setVarName(""); setVarValue("");
    } else {
      setCommandBusy(varsFor + "Get variable");
      try {
        const result = await sendChargerCommand(varsFor, "GetVariables", {
          getVariableData: [{ component: { name: varComponent.trim() }, variable: { name: varName.trim() } }],
        });
        setVarResult(JSON.stringify(result, null, 2));
      } catch (e) {
        push((e as Error).message, "error");
      } finally {
        setCommandBusy(null);
      }
    }
  }

  async function submitDiagnostics() {
    if (!logFor || !logUrl.trim()) return;
    await runCommand(logFor, "Request diagnostics", () => sendChargerCommand(logFor, "GetLog", {
      logType: "DiagnosticsLog",
      requestId: Date.now(),
      log: { remoteLocation: logUrl.trim() },
    }));
    setLogFor(null);
    setLogUrl("");
  }

  async function addToken() {
    if (!actor || !newTokenId.trim() || !newTokenLabel.trim()) return;
    await run(async () => {
      await addRfidToken(newTokenId, newTokenLabel, actor);
      setNewTokenId("");
      setNewTokenLabel("");
    }, "RFID token added.");
  }

  const pointByChargerId = useMemo(() => new Map(points.map((p) => [p.chargePointId ?? p.id, p])), [points]);
  const zoneName = useMemo(() => new Map(zones.map((z) => [z.id, z.name])), [zones]);
  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const openTicketChargerIds = useMemo(() => new Set(openTickets.map((t) => t.chargePointId)), [openTickets]);
  const cities = useMemo(() => [...new Set(zones.map((z) => z.city).filter((c): c is string => !!c))].sort(), [zones]);
  const connectorTypeOptions = useMemo(
    () => [...new Set(registry.flatMap((r) => [r.connectorType, ...(r.connectors ?? []).map((c) => c.connectorType)].filter(Boolean)))] as string[],
    [registry],
  );

  const filteredRegistry = useMemo(() => {
    let rows = siteFilter ? registry.filter((r) => r.zoneId === siteFilter) : registry;
    if (cityFilter) rows = rows.filter((r) => r.zoneId && zoneById.get(r.zoneId)?.city === cityFilter);
    if (stateFilter) rows = rows.filter((r) => r.state === stateFilter);
    if (connectorTypeFilter) {
      rows = rows.filter((r) => r.connectorType === connectorTypeFilter || (r.connectors ?? []).some((c) => c.connectorType === connectorTypeFilter));
    }
    if (faultFilter) rows = rows.filter((r) => openTicketChargerIds.has(r.chargerId));
    const q = chargerSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        r.label.toLowerCase().includes(q)
        || r.chargerId.toLowerCase().includes(q)
        || r.location.toLowerCase().includes(q)
        || (r.zoneId && (zoneName.get(r.zoneId) ?? "").toLowerCase().includes(q)));
    }
    return rows;
  }, [registry, siteFilter, cityFilter, stateFilter, connectorTypeFilter, faultFilter, chargerSearch, zoneName, zoneById, openTicketChargerIds]);

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
      if (editingRegId) {
        await updateChargerRegistration(editingRegId, { ...draft, powerKw: draft.powerKw ? Number(draft.powerKw) : undefined });
        push("Charger updated.", "success");
        closeAddModal();
      } else {
        const { chargerId, connectionToken } = await registerCharger(
          { ...draft, powerKw: draft.powerKw ? Number(draft.powerKw) : undefined },
          actor,
        );
        setJustRegisteredId(chargerId);
        setJustRegisteredToken(connectionToken);
        setDraft(blankDraft);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRegistering(false);
    }
  }

  function openEditReg(r: ChargerRegistration) {
    setEditingRegId(r.id);
    const tsToDate = (ts: unknown) => (ts as { toDate?: () => Date } | null | undefined)?.toDate?.() ?? null;
    setDraft({
      label: r.label, location: r.location, state: r.state ?? "", chargerPowerType: r.chargerPowerType,
      vendor: r.vendor, vendorOther: r.vendorOther ?? "", model: r.model ?? "", serialNumber: r.serialNumber ?? "",
      hardwareVersion: r.hardwareVersion ?? "", simImei: r.simImei ?? "",
      installationDate: tsToDate(r.installationDate), warrantyStart: tsToDate(r.warrantyStart), warrantyEnd: tsToDate(r.warrantyEnd),
      connectorType: r.connectorType, powerKw: r.powerKw, connectors: r.connectors, notes: r.notes ?? "",
      zoneId: r.zoneId ?? null, lat: r.lat ?? null, lng: r.lng ?? null, leadId: r.leadId ?? null, leadCode: r.leadCode ?? null,
      reservationsEnabled: r.reservationsEnabled ?? false, accessType: r.accessType ?? "PUBLIC",
      open24Hours: r.open24Hours ?? true, openingHours: r.openingHours ?? "",
      heartbeatIntervalSec: r.heartbeatIntervalSec ?? 300, maxSocPercent: r.maxSocPercent,
      photoUrl: r.photoUrl ?? null,
    });
    setAddOpen(true);
  }

  function closeAddModal() {
    setAddOpen(false);
    setJustRegisteredId(null);
    setJustRegisteredToken(undefined);
    setEditingRegId(null);
    setDraft(blankDraft);
    setDraftLeadType("");
  }

  const viewingReg = registry.find((r) => r.id === viewingId) ?? null;

  return (
    <>
      <PageHeader
        title="Chargers & Stations"
        description="Live status, remote commands and fault tickets from the OCPP central system."
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


      <Card
        title="Registered chargers"
        subtitle="Only these charger IDs are allowed to connect to the OCPP server."
        actions={registry.length > 0 && (
          <>
            <Input
              value={chargerSearch}
              onChange={(e) => setChargerSearch(e.target.value)}
              placeholder="Search chargers…"
              className="w-40"
            />
            <Select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              options={zones.map((z) => ({ value: z.id, label: z.name }))}
              placeholder="All sites"
            />
            <Select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              options={cities.map((c) => ({ value: c, label: c }))}
              placeholder="All cities"
            />
            <Select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
              placeholder="All states"
            />
            <Select
              value={connectorTypeFilter}
              onChange={(e) => setConnectorTypeFilter(e.target.value)}
              options={connectorTypeOptions.map((c) => ({ value: c, label: c }))}
              placeholder="All connector types"
            />
            <Button
              size="sm"
              variant={faultFilter ? "primary" : undefined}
              onClick={() => setFaultFilter((v) => !v)}
            >
              {faultFilter ? "Faulted only ✓" : "Faulted only"}
            </Button>
          </>
        )}
        className="mb-4"
      >
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
                  <th className="th">Site</th>
                  <th className="th">Charger ID</th>
                  <th className="th">Type</th>
                  <th className="th">OEM</th>
                  <th className="th">Location</th>
                  <th className="th">Lead</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filteredRegistry.map((r) => {
                  const live = pointByChargerId.get(r.chargerId);
                  return (
                    <tr key={r.id} className="hover:bg-ink-50">
                      <td className="td font-medium">{r.label}</td>
                      <td className="td text-ink-600">{r.zoneId ? zoneName.get(r.zoneId) ?? "—" : "—"}</td>
                      <td className="td"><code className="text-xs text-ink-600">{r.chargerId}</code></td>
                      <td className="td text-ink-600">
                        {r.chargerPowerType}{r.connectorType ? ` · ${r.connectorType}` : ""}
                        {r.connectors && r.connectors.length > 0 && ` +${r.connectors.length}`}
                      </td>
                      <td className="td text-ink-600">{oemLabel(r)}</td>
                      <td className="td text-ink-600">{r.location}</td>
                      <td className="td text-ink-600">{r.leadCode ?? "—"}</td>
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
                          <Link
                            href={`/chargers/${r.id}`}
                            className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                            title="View charger details"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
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
                              onClick={() => openEditReg(r)}
                              className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                              title="Edit charger details"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => openLocate(r)}
                              className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                              title="Set zone & map location"
                            >
                              <MapPinIcon className="h-4 w-4" />
                            </button>
                          )}
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
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!window.confirm(`Delete ${r.label}? This can't be undone.`)) return;
                                void run(() => deleteChargerRegistration(r.id), "Charger deleted.");
                              }}
                              className="rounded-md p-1.5 text-ink-500 hover:bg-rose-50 hover:text-rose-700"
                              title="Delete charger"
                            >
                              <Trash2 className="h-4 w-4" />
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
                <div className="flex flex-col items-end gap-1">
                  <Badge className={p.status === "ONLINE" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
                    <span className="flex items-center gap-1">
                      {p.status === "ONLINE" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                      {p.status}
                    </span>
                  </Badge>
                  {p.operationalStatus === "INOPERATIVE" && (
                    <Badge className="bg-amber-100 text-amber-800 ring-amber-200">Unavailable</Badge>
                  )}
                </div>
              </div>

              {p.connectors && Object.keys(p.connectors).length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.values(p.connectors).map((c) => (
                    <span key={`${c.evseId}-${c.connectorId}`} className="inline-flex items-center gap-1">
                      <Badge className={cn(CONNECTOR_COLOR[c.status])}>
                        EVSE {c.evseId}/{c.connectorId} · {c.status}
                      </Badge>
                      {canManage && p.status === "ONLINE" && (
                        <button
                          type="button"
                          title={`Unlock EVSE ${c.evseId}/${c.connectorId}`}
                          disabled={commandBusy === p.chargePointId + "Unlock"}
                          onClick={() => void runCommand(p.chargePointId, "Unlock", () =>
                            sendChargerCommand(p.chargePointId, "UnlockConnector", { evseId: c.evseId, connectorId: c.connectorId }))}
                          className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 disabled:opacity-50"
                        >
                          <Lock className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-ink-400">No connector status reported yet.</p>
              )}

              <p className="mt-3 border-t border-ink-100 pt-2 text-xs text-ink-500">
                Last seen {formatDateTime(p.lastSeenAt)}
              </p>
              <p className="text-xs text-ink-500">
                Firmware {p.firmwareVersion || "unknown"}
                {p.firmwareStatus && ` · ${p.firmwareStatus}${p.firmwareStatusAt ? ` (${formatDateTime(p.firmwareStatusAt)})` : ""}`}
              </p>

              {canManage && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink-100 pt-2">
                  <Button
                    size="sm"
                    disabled={p.status !== "ONLINE" || commandBusy === p.chargePointId + "Remote start"}
                    onClick={() => setStartingFor(p.chargePointId)}
                  >
                    Remote start
                  </Button>
                  <Button
                    size="sm"
                    disabled={p.status !== "ONLINE" || commandBusy === p.chargePointId + "Reset"}
                    onClick={() => void runCommand(p.chargePointId, "Reset", () =>
                      sendChargerCommand(p.chargePointId, "Reset", { type: "OnIdle" }))}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </Button>
                  <Button
                    size="sm"
                    disabled={p.status !== "ONLINE" || commandBusy === p.chargePointId + "Set availability"}
                    onClick={() => void runCommand(p.chargePointId, "Set availability", () =>
                      sendChargerCommand(p.chargePointId, "ChangeAvailability", {
                        operationalStatus: p.operationalStatus === "INOPERATIVE" ? "Operative" : "Inoperative",
                      }))}
                  >
                    {p.operationalStatus === "INOPERATIVE" ? "Set available" : "Set unavailable"}
                  </Button>
                  <Button
                    size="sm"
                    disabled={p.status !== "ONLINE" || commandBusy === p.chargePointId + "Update firmware"}
                    onClick={() => setFirmwareFor(p.chargePointId)}
                  >
                    <UploadCloud className="h-3.5 w-3.5" /> Update firmware
                  </Button>
                  <Button
                    size="sm"
                    disabled={p.status !== "ONLINE" || commandBusy === p.chargePointId + "Clear cache"}
                    onClick={() => void runCommand(p.chargePointId, "Clear cache", () => sendChargerCommand(p.chargePointId, "ClearCache", {}))}
                  >
                    Clear cache
                  </Button>
                  <Button
                    size="sm"
                    disabled={p.status !== "ONLINE"}
                    onClick={() => {
                      setVarsFor(p.chargePointId); setVarsMode("GET"); setVarComponent(""); setVarName(""); setVarValue(""); setVarResult(null);
                    }}
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Variables
                  </Button>
                  <Button
                    size="sm"
                    disabled={p.status !== "ONLINE" || commandBusy === p.chargePointId + "Request diagnostics"}
                    onClick={() => setLogFor(p.chargePointId)}
                  >
                    <FileText className="h-3.5 w-3.5" /> Diagnostics
                  </Button>
                </div>
              )}
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
                  <th className="th">User</th>
                  <th className="th">Vehicle</th>
                  <th className="th text-right">Energy delivered</th>
                  <th className="th text-right">Cost</th>
                  {(canManage || canFinance) && <th className="th text-right">Actions</th>}
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
                    <td className="td text-ink-600">{s.walletOwnerName ?? "—"}</td>
                    <td className="td text-ink-600">{s.vehicleRegNumber ?? "—"}</td>
                    <td className="td text-right font-medium tabular-nums">{wh(s.energyDeliveredWh)}</td>
                    <td className="td text-right tabular-nums text-ink-600">
                      {s.totalCostInr != null ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span>{formatINR(s.totalCostInr)}</span>
                          {s.walletDebited && (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">
                              Paid — {s.walletOwnerName ?? "wallet"}
                            </span>
                          )}
                          {s.manualDiscountInr != null && (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600">
                              -{formatINR(s.manualDiscountInr)} discount
                            </span>
                          )}
                        </div>
                      ) : s.status === "ENDED" ? "No tariff matched" : "—"}
                    </td>
                    {(canManage || canFinance) && (
                      <td className="td text-right">
                        {canFinance && s.totalCostInr != null && (
                          <Button
                            size="sm"
                            loading={discountBusy === s.id}
                            onClick={() => void issueSessionDiscount(s)}
                          >
                            Discount
                          </Button>
                        )}
                        {canManage && s.status === "ACTIVE" && (
                          <Button
                            size="sm"
                            disabled={commandBusy === s.chargePointId + "Remote stop"}
                            onClick={() => void runCommand(s.chargePointId, "Remote stop", () =>
                              sendChargerCommand(s.chargePointId, "RequestStopTransaction", { transactionId: s.transactionId }))}
                          >
                            <Square className="h-3.5 w-3.5" /> Stop
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="RFID tokens"
        subtitle={rfidTokens.length === 0
          ? "No tokens registered — every tag is currently accepted (open mode)."
          : "Allow-list enforced — only ACTIVE tokens below can start a session."}
        className="mt-4"
      >
        {canManageRfid(viewer) && (
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <Field label="Tag ID">
              <Input value={newTokenId} onChange={(e) => setNewTokenId(e.target.value)} placeholder="e.g. 04A1B2C3" />
            </Field>
            <Field label="Label">
              <Input value={newTokenLabel} onChange={(e) => setNewTokenLabel(e.target.value)} placeholder="e.g. Driver name / card #" />
            </Field>
            <Button loading={actionBusy} disabled={!newTokenId.trim() || !newTokenLabel.trim()} onClick={() => void addToken()}>
              <Plus className="h-4 w-4" /> Add token
            </Button>
          </div>
        )}
        {rfidTokens.length === 0 ? (
          <p className="text-sm text-ink-500">Nothing registered yet.</p>
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr><th className="th">Tag ID</th><th className="th">Label</th><th className="th">Status</th>{canManageRfid(viewer) && <th className="th text-right">Actions</th>}</tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rfidTokens.map((t) => (
                  <tr key={t.id} className="hover:bg-ink-50">
                    <td className="td font-mono text-xs">{t.idToken}</td>
                    <td className="td">{t.label}</td>
                    <td className="td">
                      <Badge className={t.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-rose-100 text-rose-800 ring-rose-200"}>
                        {t.status}
                      </Badge>
                    </td>
                    {canManageRfid(viewer) && (
                      <td className="td text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => void run(() => setRfidTokenStatus(t.id, t.status === "ACTIVE" ? "BLOCKED" : "ACTIVE"))}
                          >
                            {t.status === "ACTIVE" ? "Block" : "Unblock"}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!window.confirm(`Delete tag ${t.label}? This can't be undone.`)) return;
                              void run(() => deleteRfidToken(t.id), "Token deleted.");
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!startingFor}
        onClose={() => setStartingFor(null)}
        title={`Remote start — ${startingFor ?? ""}`}
        description="Sends RequestStartTransaction as if this tag were tapped at the charger."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setStartingFor(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!startIdToken.trim()}
              loading={!!startingFor && commandBusy === startingFor + "Remote start"}
              onClick={() => void submitRemoteStart()}
            >
              Start
            </Button>
          </>
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="RFID / ID token" required className="sm:col-span-2">
            {rfidTokens.filter((t) => t.status === "ACTIVE").length > 0 ? (
              <Select
                value={startIdToken}
                onChange={(e) => setStartIdToken(e.target.value)}
                options={rfidTokens.filter((t) => t.status === "ACTIVE").map((t) => ({ value: t.idToken, label: `${t.label} (${t.idToken})` }))}
                placeholder="Choose a registered tag"
              />
            ) : (
              <Input value={startIdToken} onChange={(e) => setStartIdToken(e.target.value)} placeholder="Tag ID" />
            )}
          </Field>
          <Field label="EVSE ID">
            <Input type="number" min={1} value={startEvseId} onChange={(e) => setStartEvseId(e.target.value)} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!firmwareFor}
        onClose={() => setFirmwareFor(null)}
        title={`Update firmware — ${firmwareFor ?? ""}`}
        description="Sends UpdateFirmware with an immediate retrieve time. The charger reports progress via FirmwareStatusNotification, shown on its card once received."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setFirmwareFor(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!firmwareUrl.trim()}
              loading={!!firmwareFor && commandBusy === firmwareFor + "Update firmware"}
              onClick={() => void submitFirmwareUpdate()}
            >
              Send
            </Button>
          </>
        )}
      >
        <Field label="Firmware file URL" required>
          <Input value={firmwareUrl} onChange={(e) => setFirmwareUrl(e.target.value)} placeholder="https://…" />
        </Field>
      </Modal>

      <Modal
        open={!!varsFor}
        onClose={() => setVarsFor(null)}
        title={`Variables — ${varsFor ?? ""}`}
        description="Reads or writes an OCPP 2.0.1 Component/Variable (§ GetVariables / SetVariables) — e.g. component OCPPCommCtrlr, variable HeartbeatInterval."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setVarsFor(null)}>Close</Button>
            <Button
              variant="primary"
              disabled={!varComponent.trim() || !varName.trim() || (varsMode === "SET" && !varValue.trim())}
              loading={!!varsFor && commandBusy === varsFor + "Get variable"}
              onClick={() => void submitVariable()}
            >
              {varsMode === "GET" ? "Get" : "Set"}
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Select
            value={varsMode}
            onChange={(e) => { setVarsMode(e.target.value as "GET" | "SET"); setVarResult(null); }}
            options={[{ value: "GET", label: "Get variable" }, { value: "SET", label: "Set variable" }]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Component name" required>
              <Input value={varComponent} onChange={(e) => setVarComponent(e.target.value)} placeholder="e.g. OCPPCommCtrlr" />
            </Field>
            <Field label="Variable name" required>
              <Input value={varName} onChange={(e) => setVarName(e.target.value)} placeholder="e.g. HeartbeatInterval" />
            </Field>
          </div>
          {varsMode === "SET" && (
            <Field label="New value" required>
              <Input value={varValue} onChange={(e) => setVarValue(e.target.value)} />
            </Field>
          )}
          {varResult && (
            <Field label="Result">
              <pre className="max-h-40 overflow-auto rounded-lg bg-ink-50 p-2 text-xs">{varResult}</pre>
            </Field>
          )}
        </div>
      </Modal>

      <Modal
        open={!!logFor}
        onClose={() => setLogFor(null)}
        title={`Request diagnostics — ${logFor ?? ""}`}
        description="Sends GetLog (§ OCPP 2.0.1) asking the charger to upload its diagnostics log to a remote location you control. Progress is reported via LogStatusNotification."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setLogFor(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!logUrl.trim()}
              loading={!!logFor && commandBusy === logFor + "Request diagnostics"}
              onClick={() => void submitDiagnostics()}
            >
              Send
            </Button>
          </>
        )}
      >
        <Field label="Upload URL (where the charger should send the log)" required>
          <Input value={logUrl} onChange={(e) => setLogUrl(e.target.value)} placeholder="https://…" />
        </Field>
      </Modal>

      <Modal
        open={addOpen}
        onClose={closeAddModal}
        title={justRegisteredId ? "Charger registered" : editingRegId ? "Edit charger" : "Add charger"}
        description={justRegisteredId ? undefined : editingRegId ? undefined : "Generates a unique charger ID, connection URL and QR code — nothing needs to be typed into the charger's own settings until you're ready."}
        footer={justRegisteredId ? (
          <Button onClick={closeAddModal}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={closeAddModal}>Cancel</Button>
            <Button
              onClick={() => void submitRegistration()}
              loading={registering}
              disabled={!draft.label.trim() || !draft.location.trim() || draft.lat == null || draft.lng == null}
            >
              {editingRegId ? "Save" : "Register"}
            </Button>
          </>
        )}
      >
        {justRegisteredId ? (
          <ConnectionDetails serverHost={settings.ocpp.serverHost} chargerId={justRegisteredId} connectionToken={justRegisteredToken} />
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
            <Field label="State" className="sm:col-span-2">
              <Select
                value={draft.state ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))}
                options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
                placeholder="Optional"
              />
            </Field>
            <Field label="Charger type">
              <Select
                value={draft.chargerPowerType}
                onChange={(e) => setDraft((d) => ({ ...d, chargerPowerType: e.target.value as ChargerRegistrationDraft["chargerPowerType"] }))}
                options={CHARGER_TYPES.map((t) => ({ value: t, label: t }))}
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
            <Field label="OEM / Vendor">
              <Select
                value={draft.vendor}
                onChange={(e) => setDraft((d) => ({ ...d, vendor: e.target.value as ChargerRegistrationDraft["vendor"] }))}
                options={CHARGER_VENDORS.map((v) => ({ value: v, label: v }))}
              />
            </Field>
            {draft.vendor === "Other" && (
              <Field label="OEM name">
                <Input
                  value={draft.vendorOther ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, vendorOther: e.target.value }))}
                  placeholder="e.g. Delta, ABB"
                />
              </Field>
            )}
            <Field label="Model">
              <Input
                value={draft.model ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
                placeholder="Optional"
              />
            </Field>
            <Field label="Serial number">
              <Input
                value={draft.serialNumber ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, serialNumber: e.target.value }))}
                placeholder="Optional — off the OEM spec sheet"
              />
            </Field>
            <Field label="Hardware version" hint="Manually recorded — OCPP doesn't report this on the wire.">
              <Input
                value={draft.hardwareVersion ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, hardwareVersion: e.target.value }))}
                placeholder="Optional"
              />
            </Field>
            <Field label="SIM / IMEI">
              <Input
                value={draft.simImei ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, simImei: e.target.value }))}
                placeholder="Optional"
              />
            </Field>
            <Field label="Load / power (kW)">
              <Input
                type="number"
                min={0}
                value={draft.powerKw ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, powerKw: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="Optional"
              />
            </Field>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink-700">Additional connectors</p>
                <Button
                  size="sm"
                  onClick={() => setDraft((d) => ({
                    ...d,
                    connectors: [
                      ...(d.connectors ?? []),
                      { connectorId: (d.connectors?.length ?? 0) + 2, connectorType: CONNECTOR_TYPES[0], powerKw: undefined },
                    ],
                  }))}
                >
                  <Plus className="h-3.5 w-3.5" /> Add connector
                </Button>
              </div>
              <p className="mt-1 text-xs text-ink-500">
                Connector 1 uses the type/power above. Add a row here for each extra gun on a multi-connector EVSE
                (e.g. a DC charger with both CCS2 and CHAdeMO). Connector IDs must match what the charger reports over OCPP.
              </p>
              {(draft.connectors ?? []).length > 0 && (
                <div className="mt-2 grid gap-2">
                  {(draft.connectors ?? []).map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 text-xs text-ink-500">Connector {c.connectorId}</span>
                      <Select
                        className="flex-1"
                        value={c.connectorType}
                        onChange={(e) => setDraft((d) => ({
                          ...d,
                          connectors: (d.connectors ?? []).map((row, ri) => (ri === i ? { ...row, connectorType: e.target.value as ConnectorTypeName } : row)),
                        }))}
                        options={CONNECTOR_TYPES.map((c2) => ({ value: c2, label: c2 }))}
                      />
                      <Input
                        className="w-28"
                        type="number"
                        min={0}
                        value={c.powerKw ?? ""}
                        onChange={(e) => setDraft((d) => ({
                          ...d,
                          connectors: (d.connectors ?? []).map((row, ri) => (ri === i ? { ...row, powerKw: e.target.value ? Number(e.target.value) : undefined } : row)),
                        }))}
                        placeholder="kW"
                      />
                      <Button size="sm" onClick={() => setDraft((d) => ({ ...d, connectors: (d.connectors ?? []).filter((_, ri) => ri !== i) }))}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Field label="Zone">
              <Select
                value={draft.zoneId ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, zoneId: e.target.value || null }))}
                options={zones.map((z) => ({ value: z.id, label: z.name }))}
                placeholder="No zone"
              />
            </Field>
            <Field label="Latitude" required>
              <Input
                value={draft.lat ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, lat: e.target.value ? Number(e.target.value) : null }))}
                placeholder="e.g. 28.5355"
              />
            </Field>
            <Field label="Longitude" required>
              <Input
                value={draft.lng ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, lng: e.target.value ? Number(e.target.value) : null }))}
                placeholder="e.g. 77.3910"
              />
            </Field>
            <Field label="Lead type" hint="Optional — link this charger to the lead it belongs to.">
              <Select
                value={draftLeadType}
                onChange={(e) => { setDraftLeadType(e.target.value as typeof draftLeadType); setDraft((d) => ({ ...d, leadId: null, leadCode: null })); }}
                options={LEAD_TYPES.map((t) => ({ value: t, label: LEAD_TYPE_LABEL[t] }))}
                placeholder="None"
              />
            </Field>
            <Field label="Lead">
              <Select
                value={draft.leadId ?? ""}
                onChange={(e) => {
                  const lead = leadOptions.find((l) => l.id === e.target.value);
                  setDraft((d) => ({ ...d, leadId: lead?.id ?? null, leadCode: lead?.code ?? null }));
                }}
                options={leadOptions.map((l) => ({ value: l.id, label: `${l.code} — ${l.client.name}` }))}
                placeholder={draftLeadType ? "Choose a lead" : "Pick a lead type first"}
                disabled={!draftLeadType}
              />
            </Field>
            <Field label="Installation date">
              <Input
                type="date"
                value={draft.installationDate ? draft.installationDate.toISOString().slice(0, 10) : ""}
                onChange={(e) => setDraft((d) => ({ ...d, installationDate: e.target.value ? new Date(e.target.value) : null }))}
              />
            </Field>
            <Field label="Warranty start">
              <Input
                type="date"
                value={draft.warrantyStart ? draft.warrantyStart.toISOString().slice(0, 10) : ""}
                onChange={(e) => setDraft((d) => ({ ...d, warrantyStart: e.target.value ? new Date(e.target.value) : null }))}
              />
            </Field>
            <Field label="Warranty end">
              <Input
                type="date"
                value={draft.warrantyEnd ? draft.warrantyEnd.toISOString().slice(0, 10) : ""}
                onChange={(e) => setDraft((d) => ({ ...d, warrantyEnd: e.target.value ? new Date(e.target.value) : null }))}
              />
            </Field>
            <Field label="Access type">
              <Select
                value={draft.accessType ?? "PUBLIC"}
                onChange={(e) => setDraft((d) => ({ ...d, accessType: e.target.value as "PUBLIC" | "PRIVATE" }))}
                options={[{ value: "PUBLIC", label: "Public" }, { value: "PRIVATE", label: "Private" }]}
              />
            </Field>
            <Field label="Heartbeat interval (seconds)">
              <Input
                type="number" min={30}
                value={draft.heartbeatIntervalSec ?? 300}
                onChange={(e) => setDraft((d) => ({ ...d, heartbeatIntervalSec: Number(e.target.value) || 300 }))}
              />
            </Field>
            <Field label="Max SOC % (optional)" hint="Leave blank for no limit.">
              <Input
                type="number" min={1} max={100}
                value={draft.maxSocPercent ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, maxSocPercent: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </Field>
            <div className="flex items-center gap-4 sm:col-span-1">
              <Checkbox
                label="Open 24 hours"
                checked={draft.open24Hours ?? true}
                onChange={(v) => setDraft((d) => ({ ...d, open24Hours: v }))}
              />
              <Checkbox
                label="Reservations enabled"
                checked={draft.reservationsEnabled ?? false}
                onChange={(v) => setDraft((d) => ({ ...d, reservationsEnabled: v }))}
              />
            </div>
            {!draft.open24Hours && (
              <Field label="Opening hours" className="sm:col-span-2">
                <Input
                  value={draft.openingHours ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, openingHours: e.target.value }))}
                  placeholder="e.g. 6 AM – 11 PM"
                />
              </Field>
            )}
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
        {viewingReg && <ConnectionDetails serverHost={settings.ocpp.serverHost} chargerId={viewingReg.chargerId} connectionToken={viewingReg.connectionToken} />}
      </Modal>

      <Modal
        open={!!locatingReg}
        onClose={() => setLocatingReg(null)}
        title={locatingReg ? `Locate ${locatingReg.label}` : ""}
        description="Coordinates are entered manually — no maps API key required. Find them by right-clicking the spot in Google Maps and copying the numbers shown."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setLocatingReg(null)}>Cancel</Button>
            <Button variant="primary" loading={actionBusy} onClick={() => void saveLocation()}>Save</Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Zone">
            <Select
              value={locZoneId}
              onChange={(e) => setLocZoneId(e.target.value)}
              options={zones.map((z) => ({ value: z.id, label: z.name }))}
              placeholder="No zone"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Latitude">
              <Input value={locLat} onChange={(e) => setLocLat(e.target.value)} placeholder="e.g. 28.5355" />
            </Field>
            <Field label="Longitude">
              <Input value={locLng} onChange={(e) => setLocLng(e.target.value)} placeholder="e.g. 77.3910" />
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}
