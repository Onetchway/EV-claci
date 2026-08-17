"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Copy, ExternalLink, FileText, Lock, MapPin as MapPinIcon, Pencil, Plus, Power, PowerOff, QrCode,
  RotateCcw, Settings2, Smartphone, Trash2, UploadCloud, Wifi, WifiOff, X, Zap,
} from "lucide-react";
import QRCode from "qrcode";

import { doc, getDoc } from "firebase/firestore";

import { useAuth, useViewer } from "@/components/auth-provider";
import { ConnectorIcon } from "@/components/connector-icon";
import {
  Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner,
  useAsyncAction, useToast,
} from "@/components/ui";
import { getDb } from "@/lib/firebase/client";
import { useSettings } from "@/hooks/use-settings";
import {
  approveSelfServeCharger, chargerWsUrl, CHARGER_TYPES, CHARGER_VENDORS, CONNECTOR_TYPES, deleteChargerRegistration, oemLabel,
  registerCharger, rejectSelfServeCharger, setChargerActive, setChargerCustomTariffId, subscribeChargerRegistry,
  updateChargerRegistration,
  type ChargerRegistration, type ChargerRegistrationDraft, type ConnectorTypeName,
} from "@/lib/db/charger-registry";
import {
  subscribeActiveSessions, subscribeChargePoints, type ChargePoint, type ChargeSession, type ConnectorStatus,
} from "@/lib/db/chargers";
import { subscribeLeads } from "@/lib/db/leads";
import { sendChargerCommand } from "@/lib/ocpp-commands";
import { subscribeRfidTokens } from "@/lib/db/rfid";
import { createTariff, setTariffActive, TARIFFS, updateTariff } from "@/lib/db/tariffs";
import { subscribeTickets } from "@/lib/db/tickets";
import { subscribeZones } from "@/lib/db/zones";
import { INDIAN_STATES, LEAD_TYPE_LABEL, LEAD_TYPES, type LeadType } from "@/lib/constants";
import { canManageChargers, canManageTariffs } from "@/lib/permissions";
import type { Lead, RevenueShareType, RfidToken, Tariff, Ticket, Zone } from "@/lib/types";
import { cn, formatDateTime, formatINR } from "@/lib/utils";

const CONNECTOR_COLOR: Record<ConnectorStatus, string> = {
  Available: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  Occupied: "bg-sky-100 text-sky-800 ring-sky-200",
  Reserved: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  Unavailable: "bg-ink-100 text-ink-600 ring-ink-200",
  Faulted: "bg-rose-100 text-rose-800 ring-rose-200",
};

const blankDraft: ChargerRegistrationDraft = {
  label: "", location: "", state: "", chargerPowerType: "DC", vendor: "Exicom", vendorOther: "", model: "",
  connectorType: undefined, powerKw: undefined, notes: "", lat: null, lng: null, zoneId: null,
  leadId: null, leadCode: null,
  reservationsEnabled: false, accessType: "PUBLIC", open24Hours: true, openingHours: "",
  heartbeatIntervalSec: 300, maxSocPercent: undefined, photoUrl: null,
  tariffMode: "STANDARD", revenueShareOverride: false,
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

/**
 * The driver-facing "Scan, Pay, Charge" QR — print/stick this on the
 * charger (or on each individual connector for a multi-gun charger).
 * Points at the public /charge page, not the OCPP connection URL above.
 * When a charger has more than one connector, a selector lets you generate
 * a QR scoped to one specific connector (?evse=N) so a driver scanning the
 * QR on connector 2 lands straight on connector 2 rather than having to
 * pick it themselves after scanning.
 */
function ChargingQr({ chargerId, connectorIds }: { chargerId: string; connectorIds: number[] }) {
  const [qr, setQr] = useState<string | null>(null);
  const [connectorId, setConnectorId] = useState<number | "">("");
  const { push } = useToast();
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/charge/${chargerId}${connectorId ? `?evse=${connectorId}` : ""}`
    : "";

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 220 }).then((dataUrl) => {
      if (!cancelled) setQr(dataUrl);
    }).catch(() => setQr(null));
    return () => { cancelled = true; };
  }, [url]);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {connectorIds.length > 1 && (
        <div className="w-full">
          <Select
            value={String(connectorId)}
            onChange={(e) => setConnectorId(e.target.value ? Number(e.target.value) : "")}
            options={[
              { value: "", label: "Whole charger (driver picks a connector)" },
              ...connectorIds.map((id) => ({ value: String(id), label: `Connector ${id} only` })),
            ]}
          />
        </div>
      )}
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="Driver charging QR code" className="h-[220px] w-[220px] rounded-lg ring-1 ring-ink-200" />
      ) : (
        <div className="flex h-[220px] w-[220px] items-center justify-center rounded-lg bg-ink-50"><Spinner /></div>
      )}
      <div className="flex w-full items-center gap-2 rounded-lg bg-ink-50 px-3 py-2">
        <code className="flex-1 truncate text-left text-xs text-ink-700">{url}</code>
        <button
          type="button"
          onClick={() => { void navigator.clipboard.writeText(url); push("Charging link copied.", "success"); }}
          className="shrink-0 rounded-md p-1.5 text-ink-500 hover:bg-ink-200 hover:text-ink-800"
          aria-label="Copy charging link"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-xs text-ink-500">
        A driver scans this to pay and start a session with no app — Scan, Pay, Charge.
        {connectorId ? " This one is scoped to a single connector." : ""} Print it and stick it on the charger{connectorIds.length > 1 ? " (or on the specific connector)" : ""}.
      </p>
    </div>
  );
}

export default function ChargersPage() {
  const { actor, profile } = useAuth();
  const viewer = useViewer();
  const { settings } = useSettings();
  const canManage = canManageChargers(viewer);

  const [points, setPoints] = useState<ChargePoint[]>([]);
  const [activeSessions, setActiveSessions] = useState<ChargeSession[]>([]);
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
  /** Holds a real chargerId (e.g. "PPL-73003"), not the Firestore doc id — the QR/URL it feeds into /charge/[chargerId] is keyed by chargerId everywhere else in the app. */
  const [chargingQrForId, setChargingQrForId] = useState<string | null>(null);
  const [approvingReg, setApprovingReg] = useState<ChargerRegistration | null>(null);
  const [approveRateType, setApproveRateType] = useState<RevenueShareType>("PERCENT");
  const [approveRateValue, setApproveRateValue] = useState("");

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
  const [customChargerId, setCustomChargerId] = useState("");
  const [customTariffId, setCustomTariffId] = useState<string | null>(null);
  const [pricingType, setPricingType] = useState<Tariff["pricingType"]>("PER_KWH");
  const [pricingRate, setPricingRate] = useState("");
  const [pricingGstPct, setPricingGstPct] = useState("18");
  const [pricingPlatformFeeInr, setPricingPlatformFeeInr] = useState("0");
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


  const { run, busy: actionBusy } = useAsyncAction();
  const { push } = useToast();

  useEffect(
    () => subscribeChargePoints((rows) => { setPoints(rows); setLoading(false); }, (e) => { setError(e.message); setLoading(false); }),
    [],
  );
  useEffect(() => subscribeChargerRegistry(setRegistry), []);
  useEffect(() => subscribeActiveSessions(setActiveSessions), []);
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
    }, actor ?? undefined), "Location updated.");
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

  const pointByChargerId = useMemo(() => new Map(points.map((p) => [p.chargePointId ?? p.id, p])), [points]);
  const activeTransactionByCharger = useMemo(
    () => new Map(activeSessions.map((s) => [s.chargePointId, s.transactionId])),
    [activeSessions],
  );
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

  /**
   * Upserts (or deactivates) the SPECIFIC_CHARGERS Tariff doc backing
   * tariffMode === "CUSTOM" — a friendlier per-charger entry point onto the
   * existing tariff engine rather than a second pricing system. Runs after
   * the charger registration write, since it needs the real chargerId
   * (only known post-create for a brand-new charger).
   */
  async function syncChargerTariff(regId: string, chargerId: string): Promise<void> {
    // Firestore rules restrict tariff writes to Admin/Super Admin/Finance —
    // pricing is a finance decision, not an ops one (see permissions.ts) —
    // so skip entirely for a viewer who can't write tariffs even if a
    // stale draft somehow still says tariffMode: "CUSTOM".
    if (!actor || !canManageTariffs(viewer)) return;
    if (draft.tariffMode === "CUSTOM") {
      const tariffDraft = {
        name: `Custom — ${draft.label.trim()}`,
        scope: "SPECIFIC_CHARGERS" as const,
        chargerIds: [chargerId], connectorKeys: [], zoneIds: [], cities: [], states: [],
        fleetIds: [], emspUserIds: [], corporateAccountIds: [],
        pricingType, rate: Number(pricingRate) || 0, gstPct: Number(pricingGstPct) || 0,
        platformFeeInr: Number(pricingPlatformFeeInr) || 0,
        priority: 100, active: true,
      };
      if (customTariffId) {
        await updateTariff(customTariffId, tariffDraft, actor);
      } else {
        const newId = await createTariff(tariffDraft, actor);
        await setChargerCustomTariffId(regId, newId);
      }
    } else if (customTariffId) {
      // Switched back to STANDARD — deactivate rather than delete, so the
      // rate history survives and switching back to CUSTOM later just
      // reactivates (and updates) the same doc instead of losing it.
      await setTariffActive(customTariffId, false, actor);
    }
  }

  async function submitRegistration() {
    if (!actor || !draft.label.trim() || !draft.location.trim()) return;
    setRegistering(true);
    try {
      if (editingRegId) {
        await updateChargerRegistration(editingRegId, { ...draft, powerKw: draft.powerKw ? Number(draft.powerKw) : undefined }, actor ?? undefined);
        const chargerId = registry.find((r) => r.id === editingRegId)?.chargerId;
        if (chargerId) await syncChargerTariff(editingRegId, chargerId);
        push("Charger updated.", "success");
        closeAddModal();
      } else {
        const { id: regId, chargerId, connectionToken } = await registerCharger(
          { ...draft, powerKw: draft.powerKw ? Number(draft.powerKw) : undefined },
          actor,
          customChargerId.trim() || undefined,
          profile?.orgId,
        );
        if (draft.tariffMode === "CUSTOM") await syncChargerTariff(regId, chargerId);
        setJustRegisteredId(chargerId);
        setJustRegisteredToken(connectionToken);
        setDraft(blankDraft);
        setCustomChargerId("");
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
      tariffMode: r.tariffMode ?? "STANDARD",
      revenueShareOverride: r.revenueShareOverride ?? false,
      revenueShareType: r.revenueShareType,
      revenueShareValue: r.revenueShareValue,
      electricityCostPerKwh: r.electricityCostPerKwh,
      revenueShareHybridPct: r.revenueShareHybridPct,
    });
    setCustomTariffId(r.customTariffId ?? null);
    setPricingType("PER_KWH"); setPricingRate(""); setPricingGstPct("18"); setPricingPlatformFeeInr("0");
    if (r.customTariffId) {
      void getDoc(doc(getDb(), TARIFFS, r.customTariffId)).then((snap) => {
        const t = snap.data() as Tariff | undefined;
        if (!t) return;
        setPricingType(t.pricingType);
        setPricingRate(String(t.rate ?? ""));
        setPricingGstPct(String(t.gstPct ?? 18));
        setPricingPlatformFeeInr(String(t.platformFeeInr ?? 0));
      });
    }
    setAddOpen(true);
  }

  function closeAddModal() {
    setAddOpen(false);
    setJustRegisteredId(null);
    setJustRegisteredToken(undefined);
    setEditingRegId(null);
    setCustomTariffId(null);
    setPricingType("PER_KWH"); setPricingRate(""); setPricingGstPct("18"); setPricingPlatformFeeInr("0");
    setDraft(blankDraft);
    setDraftLeadType("");
    setCustomChargerId("");
  }

  const viewingReg = registry.find((r) => r.id === viewingId) ?? null;
  const pendingSelfServe = useMemo(() => registry.filter((r) => r.pendingApproval), [registry]);

  function openApprove(r: ChargerRegistration) {
    setApprovingReg(r);
    setApproveRateType(r.ownerRequestedRevShareType ?? "PERCENT");
    setApproveRateValue(r.ownerRequestedRevShareValue != null ? String(r.ownerRequestedRevShareValue) : "");
  }

  async function submitApprove() {
    if (!actor || !approvingReg || !approveRateValue.trim()) return;
    await run(async () => {
      await approveSelfServeCharger(approvingReg, { type: approveRateType, value: Number(approveRateValue) }, actor);
      setApprovingReg(null);
    }, "Charger approved — it can now accept sessions.");
  }

  async function handleReject(r: ChargerRegistration) {
    const reason = window.prompt(`Reason for rejecting "${r.label}"?`);
    if (reason == null) return;
    await run(() => rejectSelfServeCharger(r.id, reason.trim() || "No reason given."), "Charger rejected.");
  }

  return (
    <>
      <PageHeader
        title="Charger Management"
        description="Register, configure and remotely command chargers. Fleet summary lives on the CMS Dashboard; live sessions are on the Sessions page."
        actions={canManage && (
          <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add charger</Button>
        )}
      />

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          {error}
        </div>
      )}

      {canManage && pendingSelfServe.length > 0 && (
        <Card
          title="Pending self-serve requests"
          subtitle="Submitted via Register My Charger — stays offline until approved."
          className="mb-4"
        >
          <div className="space-y-2">
            {pendingSelfServe.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div>
                  <p className="font-medium">{r.label}</p>
                  <p className="text-xs text-ink-500">
                    {r.location} · {r.chargerPowerType}
                    {r.ownerRequestedRevShareType && r.ownerRequestedRevShareValue != null && (
                      <> · requested {r.ownerRequestedRevShareType === "PERCENT" ? `${r.ownerRequestedRevShareValue}%` : `₹${r.ownerRequestedRevShareValue}/kWh`}</>
                    )}
                    {r.createdBy?.name && <> · submitted by {r.createdBy.name}</>}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="primary" onClick={() => openApprove(r)}>Approve</Button>
                  <Button size="sm" onClick={() => void handleReject(r)}>Reject</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
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
                        <div className="flex items-center gap-1.5">
                          {r.connectorType && <ConnectorIcon type={r.connectorType} size={20} />}
                          <span>
                            {r.chargerPowerType}{r.connectorType ? ` · ${r.connectorType}` : ""}
                            {r.connectors && r.connectors.length > 0 && ` +${r.connectors.length}`}
                          </span>
                        </div>
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
                            onClick={() => setChargingQrForId(r.chargerId)}
                            className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                            title="Driver charging QR — print this and stick it on the charger"
                          >
                            <Smartphone className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewingId(r.id)}
                            className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                            title="Installer setup only — OCPP connection URL for the charger's own config portal, not for drivers"
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
                              onClick={() => run(() => setChargerActive(r.id, !r.active, actor ?? undefined, r.label), r.active ? "Charger deactivated." : "Charger reactivated.")}
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
                                void run(() => deleteChargerRegistration(r.id, actor ?? undefined, r.label), "Charger deleted.");
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
                    onClick={() => {
                      const firstActive = rfidTokens.find((t) => t.status === "ACTIVE");
                      setStartIdToken(firstActive?.idToken ?? "STAFF-REMOTE-START");
                      setStartingFor(p.chargePointId);
                    }}
                  >
                    Remote start
                  </Button>
                  <Button
                    size="sm"
                    disabled={p.status !== "ONLINE" || !activeTransactionByCharger.get(p.chargePointId) || commandBusy === p.chargePointId + "Remote stop"}
                    title={activeTransactionByCharger.get(p.chargePointId) ? undefined : "No active session on this charger"}
                    onClick={() => void runCommand(p.chargePointId, "Remote stop", () =>
                      sendChargerCommand(p.chargePointId, "RequestStopTransaction", {
                        transactionId: activeTransactionByCharger.get(p.chargePointId),
                      }))}
                  >
                    Remote stop
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
                    disabled={p.status !== "ONLINE" || commandBusy === p.chargePointId + "Emergency stop"}
                    onClick={() => {
                      if (!window.confirm(`Emergency stop ${p.chargePointId}? This power-cycles the charger immediately and interrupts any session in progress — use Remote stop for a graceful stop instead.`)) return;
                      void runCommand(p.chargePointId, "Emergency stop", () =>
                        sendChargerCommand(p.chargePointId, "Reset", { type: "Immediate" }));
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Emergency stop
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
          <Field
            label="RFID / ID token"
            required
            className="sm:col-span-2"
            hint="Defaults to a staff test tag so you can just hit Start — change it only if you need this session attributed to a specific registered card."
          >
            {rfidTokens.filter((t) => t.status === "ACTIVE").length > 0 ? (
              <Select
                value={startIdToken}
                onChange={(e) => setStartIdToken(e.target.value)}
                options={[
                  { value: "STAFF-REMOTE-START", label: "Staff test tag (not billed to any card)" },
                  ...rfidTokens.filter((t) => t.status === "ACTIVE").map((t) => ({ value: t.idToken, label: `${t.label} (${t.idToken})` })),
                ]}
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
            {!editingRegId && (
              <Field
                label="Charger ID (optional)"
                hint="Leave blank to auto-generate. Set this to exactly match a physical charger's or test simulator's fixed Central System ID — case-sensitive, letters/numbers/hyphens/underscores only."
                className="sm:col-span-2"
              >
                <Input
                  value={customChargerId}
                  onChange={(e) => setCustomChargerId(e.target.value)}
                  placeholder="e.g. PPL-79629"
                />
              </Field>
            )}
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

            {canManageTariffs(viewer) && (
            <div className="sm:col-span-2 border-t border-ink-100 pt-4">
              <p className="text-sm font-medium text-ink-900">Pricing</p>
              <p className="mt-0.5 text-xs text-ink-500">Follow standard pricing unless this charger needs its own rate — a custom rate always wins over a zone/state/all-chargers tariff.</p>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-1.5 text-sm text-ink-700">
                  <input type="radio" checked={(draft.tariffMode ?? "STANDARD") === "STANDARD"} onChange={() => setDraft((d) => ({ ...d, tariffMode: "STANDARD" }))} />
                  Follow standard pricing
                </label>
                <label className="flex items-center gap-1.5 text-sm text-ink-700">
                  <input type="radio" checked={draft.tariffMode === "CUSTOM"} onChange={() => setDraft((d) => ({ ...d, tariffMode: "CUSTOM" }))} />
                  Custom pricing for this charger
                </label>
              </div>
              {draft.tariffMode === "CUSTOM" && (
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  <Field label="Pricing type">
                    <Select
                      value={pricingType}
                      onChange={(e) => setPricingType(e.target.value as Tariff["pricingType"])}
                      options={[{ value: "PER_KWH", label: "₹/kWh" }, { value: "PER_MINUTE", label: "₹/minute" }, { value: "PER_SESSION", label: "Flat per session" }]}
                    />
                  </Field>
                  <Field label="Rate (₹)" required><Input type="number" min={0} value={pricingRate} onChange={(e) => setPricingRate(e.target.value)} /></Field>
                  <Field label="GST %"><Input type="number" min={0} max={28} value={pricingGstPct} onChange={(e) => setPricingGstPct(e.target.value)} /></Field>
                  <Field label="Platform fee (₹)"><Input type="number" min={0} value={pricingPlatformFeeInr} onChange={(e) => setPricingPlatformFeeInr(e.target.value)} /></Field>
                </div>
              )}
            </div>
            )}

            <div className="sm:col-span-2 border-t border-ink-100 pt-4">
              <Checkbox
                label="Override this station's revenue share for this charger"
                checked={draft.revenueShareOverride ?? false}
                onChange={(v) => setDraft((d) => ({ ...d, revenueShareOverride: v }))}
              />
              <p className="mt-0.5 text-xs text-ink-500">Leave unchecked to use the site's (Zone) revenue-share settings — useful when just one charger at a site is financed/owned differently.</p>
              {draft.revenueShareOverride && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Share type">
                    <Select
                      value={draft.revenueShareType ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, revenueShareType: (e.target.value || undefined) as RevenueShareType | undefined }))}
                      options={[
                        { value: "PERCENT", label: "% of session total" }, { value: "FIXED", label: "Flat ₹ per session" },
                        { value: "PROFIT_SHARE", label: "% of profit (after electricity cost)" }, { value: "TIERED_HYBRID", label: "Flat floor + % of remaining profit" },
                      ]}
                      placeholder="None"
                    />
                  </Field>
                  <Field label={draft.revenueShareType === "FIXED" || draft.revenueShareType === "TIERED_HYBRID" ? "Value (₹)" : "Value (%)"}>
                    <Input
                      type="number" min={0}
                      value={draft.revenueShareValue ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, revenueShareValue: e.target.value ? Number(e.target.value) : undefined }))}
                    />
                  </Field>
                  {(draft.revenueShareType === "PROFIT_SHARE" || draft.revenueShareType === "TIERED_HYBRID") && (
                    <Field label="Electricity cost (₹/kWh)">
                      <Input
                        type="number" min={0}
                        value={draft.electricityCostPerKwh ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, electricityCostPerKwh: e.target.value ? Number(e.target.value) : undefined }))}
                      />
                    </Field>
                  )}
                  {draft.revenueShareType === "TIERED_HYBRID" && (
                    <Field label="Upside % above floor">
                      <Input
                        type="number" min={0} max={100}
                        value={draft.revenueShareHybridPct ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, revenueShareHybridPct: e.target.value ? Number(e.target.value) : undefined }))}
                      />
                    </Field>
                  )}
                </div>
              )}
            </div>

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
        title={viewingReg ? `Installer setup — ${viewingReg.label}` : ""}
        description="One-time technical setup, not for drivers — this is the wss:// URL the physical charger's own firmware connects to. Paste it into the charger's Central System URL setting during installation. Use the Driver charging QR (phone icon) for the customer-facing link instead."
        footer={<Button onClick={() => setViewingId(null)}>Close</Button>}
      >
        {viewingReg && <ConnectionDetails serverHost={settings.ocpp.serverHost} chargerId={viewingReg.chargerId} connectionToken={viewingReg.connectionToken} />}
      </Modal>

      <Modal
        open={!!chargingQrForId}
        onClose={() => setChargingQrForId(null)}
        title="Driver charging QR"
        footer={<Button onClick={() => setChargingQrForId(null)}>Close</Button>}
      >
        {chargingQrForId && (
          <ChargingQr
            chargerId={chargingQrForId}
            connectorIds={(() => {
              const reg = registry.find((r) => r.chargerId === chargingQrForId);
              return reg ? [1, ...(reg.connectors ?? []).map((c) => c.connectorId)] : [1];
            })()}
          />
        )}
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

      <Modal
        open={!!approvingReg}
        onClose={() => setApprovingReg(null)}
        title={`Approve ${approvingReg?.label ?? ""}`}
        description="Sets the final rate on the charger's site and activates it — it can accept sessions immediately after."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setApprovingReg(null)}>Cancel</Button>
            <Button variant="primary" loading={actionBusy} disabled={!approveRateValue.trim()} onClick={() => void submitApprove()}>Approve</Button>
          </>
        )}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rate type">
            <Select
              value={approveRateType}
              onChange={(e) => setApproveRateType(e.target.value as RevenueShareType)}
              options={[{ value: "PERCENT", label: "% of session revenue" }, { value: "FIXED", label: "Flat ₹ per kWh" }]}
            />
          </Field>
          <Field label={approveRateType === "PERCENT" ? "Percent" : "₹ per kWh"}>
            <Input type="number" min={0} value={approveRateValue} onChange={(e) => setApproveRateValue(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
