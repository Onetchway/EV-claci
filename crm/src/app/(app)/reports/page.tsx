"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, FileClock, Globe2, Terminal } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Button, Card, EmptyState, Field, Input, PageHeader, Select, Spinner,
} from "@/components/ui";
import { subscribeChargerRegistry, type ChargerRegistration } from "@/lib/db/charger-registry";
import {
  subscribeChargePoints, subscribeOcppMessagesForCharger, subscribeSessionsSince,
  type ChargePoint, type ChargeSession, type OcppMessage,
} from "@/lib/db/chargers";
import { subscribeAllWalletTransactions, subscribeEmspUsers } from "@/lib/db/emsp-users";
import { subscribeZones } from "@/lib/db/zones";
import { canManageChargers } from "@/lib/permissions";
import type { EmspUser, WalletTransaction, Zone } from "@/lib/types";
import { downloadCsv, formatDateTime, formatINR } from "@/lib/utils";

type ReportKind = "SESSIONS" | "TRANSACTIONS" | "USERS" | "CHARGERS";

const REPORT_OPTIONS: { value: ReportKind; label: string }[] = [
  { value: "SESSIONS", label: "Sessions" },
  { value: "TRANSACTIONS", label: "Payment transactions" },
  { value: "USERS", label: "Users" },
  { value: "CHARGERS", label: "Chargers" },
];

const DEFAULT_FROM = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

export default function ReportsPage() {
  const viewer = useViewer();
  const canManage = canManageChargers(viewer);

  const [tab, setTab] = useState<"builder" | "logs">("builder");
  const [kind, setKind] = useState<ReportKind>("SESSIONS");

  const [registry, setRegistry] = useState<ChargerRegistration[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [points, setPoints] = useState<ChargePoint[]>([]);
  const [users, setUsers] = useState<EmspUser[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [sessions, setSessions] = useState<ChargeSession[]>([]);

  const [from, setFrom] = useState(DEFAULT_FROM());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [powerTypeFilter, setPowerTypeFilter] = useState("");
  const [connectorTypeFilter, setConnectorTypeFilter] = useState("");
  const [accessTypeFilter, setAccessTypeFilter] = useState("");
  const [hubOnly, setHubOnly] = useState(false);

  const [logChargerId, setLogChargerId] = useState("");
  const [logMessages, setLogMessages] = useState<OcppMessage[]>([]);

  useEffect(() => subscribeChargerRegistry(setRegistry), []);
  useEffect(() => subscribeZones(setZones), []);
  useEffect(() => subscribeChargePoints(setPoints), []);
  useEffect(() => subscribeEmspUsers(setUsers), []);
  useEffect(() => subscribeAllWalletTransactions(setTransactions), []);
  useEffect(() => {
    const since = new Date(`${from}T00:00:00`);
    return subscribeSessionsSince(since, setSessions);
  }, [from]);
  useEffect(() => {
    if (!logChargerId) { setLogMessages([]); return; }
    return subscribeOcppMessagesForCharger(logChargerId, setLogMessages);
  }, [logChargerId]);

  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const regByChargerId = useMemo(() => new Map(registry.map((r) => [r.chargerId, r])), [registry]);
  const pointByChargerId = useMemo(() => new Map(points.map((p) => [p.chargePointId ?? p.id, p])), [points]);

  // A "hub" is a site running 2+ active chargers.
  const chargersPerZone = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of registry.filter((r) => r.active)) {
      if (!r.zoneId) continue;
      m.set(r.zoneId, (m.get(r.zoneId) ?? 0) + 1);
    }
    return m;
  }, [registry]);

  const cities = useMemo(() => [...new Set(zones.map((z) => z.city).filter((c): c is string => !!c))].sort(), [zones]);
  const states = useMemo(() => [...new Set(registry.map((r) => r.state).filter((s): s is string => !!s))].sort(), [registry]);
  const connectorTypeOptions = useMemo(
    () => [...new Set(registry.flatMap((r) => [r.connectorType, ...(r.connectors ?? []).map((c) => c.connectorType)].filter(Boolean)))] as string[],
    [registry],
  );

  function chargerPasses(r: ChargerRegistration | undefined): boolean {
    if (!r) return !stateFilter && !cityFilter && !powerTypeFilter && !connectorTypeFilter && !accessTypeFilter && !hubOnly;
    const zone = r.zoneId ? zoneById.get(r.zoneId) : undefined;
    if (stateFilter && r.state !== stateFilter) return false;
    if (cityFilter && zone?.city !== cityFilter) return false;
    if (powerTypeFilter && r.chargerPowerType !== powerTypeFilter) return false;
    if (accessTypeFilter && (r.accessType ?? "PUBLIC") !== accessTypeFilter) return false;
    if (connectorTypeFilter) {
      const types = [r.connectorType, ...(r.connectors ?? []).map((c) => c.connectorType)].filter(Boolean) as string[];
      if (!types.includes(connectorTypeFilter)) return false;
    }
    if (hubOnly && (chargersPerZone.get(r.zoneId ?? "") ?? 0) < 2) return false;
    return true;
  }

  const toTs = new Date(`${to}T23:59:59`).getTime();

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const at = (s.lastUpdateAt ?? s.startedAt) as { toMillis?: () => number } | undefined;
      const ms = at?.toMillis?.();
      if (ms && ms > toTs) return false;
      return chargerPasses(regByChargerId.get(s.chargePointId));
    });
  }, [sessions, regByChargerId, toTs, stateFilter, cityFilter, powerTypeFilter, connectorTypeFilter, accessTypeFilter, hubOnly, chargersPerZone, zoneById]);

  const filteredChargers = useMemo(() => registry.filter((r) => chargerPasses(r)), [
    registry, stateFilter, cityFilter, powerTypeFilter, connectorTypeFilter, accessTypeFilter, hubOnly, chargersPerZone, zoneById,
  ]);

  const previewCount = kind === "SESSIONS" ? filteredSessions.length
    : kind === "TRANSACTIONS" ? transactions.length
      : kind === "USERS" ? users.length
        : filteredChargers.length;

  function exportReport() {
    if (kind === "SESSIONS") {
      downloadCsv("sessions-report.csv", [
        ["Charger ID", "Status", "City", "State", "Connector Type", "Access Type", "Started", "Ended", "Energy (kWh)", "Cost (INR)", "User"],
        ...filteredSessions.map((s) => {
          const reg = regByChargerId.get(s.chargePointId);
          const zone = reg?.zoneId ? zoneById.get(reg.zoneId) : undefined;
          return [
            s.chargePointId, s.status, zone?.city ?? "", reg?.state ?? "",
            reg?.connectorType ?? "", reg?.accessType ?? "PUBLIC",
            formatDateTime(s.startedAt), s.endedAt ? formatDateTime(s.endedAt) : "",
            s.energyDeliveredWh != null ? (s.energyDeliveredWh / 1000).toFixed(2) : "",
            s.totalCostInr ?? "", s.walletOwnerName ?? "",
          ];
        }),
      ]);
    } else if (kind === "TRANSACTIONS") {
      downloadCsv("transactions-report.csv", [
        ["Date", "Owner Type", "Owner ID", "Type", "Amount (INR)", "Razorpay Payment ID", "Note"],
        ...transactions.map((t) => [
          formatDateTime(t.createdAt), t.ownerType, t.ownerId, t.type, t.amountInr, t.razorpayPaymentId ?? "", t.note ?? "",
        ]),
      ]);
    } else if (kind === "USERS") {
      downloadCsv("users-report.csv", [
        ["Name", "Phone", "Email", "Type", "Wallet Balance (INR)", "Active"],
        ...users.map((u) => [u.name, u.phone, u.email ?? "", u.type, u.walletBalanceInr ?? 0, u.active ? "Yes" : "No"]),
      ]);
    } else {
      downloadCsv("chargers-report.csv", [
        ["Charger ID", "Label", "City", "State", "Power Type", "Connector Type", "Power (kW)", "Access Type", "Hub", "Online", "Active"],
        ...filteredChargers.map((r) => {
          const zone = r.zoneId ? zoneById.get(r.zoneId) : undefined;
          const live = pointByChargerId.get(r.chargerId);
          return [
            r.chargerId, r.label, zone?.city ?? "", r.state ?? "", r.chargerPowerType,
            r.connectorType ?? "", r.powerKw ?? "", r.accessType ?? "PUBLIC",
            (chargersPerZone.get(r.zoneId ?? "") ?? 0) >= 2 ? "Yes" : "No",
            live?.status === "ONLINE" ? "Yes" : "No", r.active ? "Yes" : "No",
          ];
        }),
      ]);
    }
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Multi-filter downloadable reports across sessions, payments, users and chargers, plus audit trails."
      />

      <div className="mb-4 flex gap-1 rounded-lg bg-ink-100 p-0.5 text-sm w-fit">
        <button
          type="button"
          onClick={() => setTab("builder")}
          className={`rounded-md px-3 py-1.5 ${tab === "builder" ? "bg-white shadow-sm" : "text-ink-500"}`}
        >
          Report builder
        </button>
        <button
          type="button"
          onClick={() => setTab("logs")}
          className={`rounded-md px-3 py-1.5 ${tab === "logs" ? "bg-white shadow-sm" : "text-ink-500"}`}
        >
          Audit &amp; OCPP logs
        </button>
      </div>

      {tab === "builder" ? (
        <>
          <Card className="mb-4">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Report">
                <Select value={kind} onChange={(e) => setKind(e.target.value as ReportKind)} options={REPORT_OPTIONS} />
              </Field>
              {kind === "SESSIONS" && (
                <>
                  <Field label="From">
                    <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </Field>
                  <Field label="To">
                    <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                  </Field>
                </>
              )}
              {(kind === "SESSIONS" || kind === "CHARGERS") && (
                <>
                  <Field label="State">
                    <Select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} options={[{ value: "", label: "All states" }, ...states.map((s) => ({ value: s, label: s }))]} />
                  </Field>
                  <Field label="City">
                    <Select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} options={[{ value: "", label: "All cities" }, ...cities.map((c) => ({ value: c, label: c }))]} />
                  </Field>
                  <Field label="Power type">
                    <Select value={powerTypeFilter} onChange={(e) => setPowerTypeFilter(e.target.value)} options={[{ value: "", label: "AC & DC" }, { value: "AC", label: "AC only" }, { value: "DC", label: "DC only" }]} />
                  </Field>
                  <Field label="Connector type">
                    <Select value={connectorTypeFilter} onChange={(e) => setConnectorTypeFilter(e.target.value)} options={[{ value: "", label: "All types" }, ...connectorTypeOptions.map((t) => ({ value: t, label: t }))]} />
                  </Field>
                  <Field label="Access type">
                    <Select value={accessTypeFilter} onChange={(e) => setAccessTypeFilter(e.target.value)} options={[{ value: "", label: "Public & private" }, { value: "PUBLIC", label: "Public only" }, { value: "PRIVATE", label: "Private only" }]} />
                  </Field>
                  <Field label="Hubs">
                    <Select value={hubOnly ? "1" : ""} onChange={(e) => setHubOnly(e.target.value === "1")} options={[{ value: "", label: "All sites" }, { value: "1", label: "Hubs only (2+ chargers)" }]} />
                  </Field>
                </>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{REPORT_OPTIONS.find((o) => o.value === kind)?.label}</p>
                <p className="text-sm text-ink-500">{previewCount} row{previewCount === 1 ? "" : "s"} match the current filters.</p>
              </div>
              <Button variant="primary" onClick={exportReport} disabled={previewCount === 0}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            </div>
          </Card>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="CMS Audit Log">
            <p className="mb-3 text-sm text-ink-500">Every create/update/assign/status-change action taken in the CRM, attributable to the staff member who did it.</p>
            <Link href="/logs"><Button><FileClock className="h-4 w-4" /> Open Audit Log</Button></Link>
          </Card>
          <Card title="OCPP message log">
            <p className="mb-3 text-sm text-ink-500">Raw Call/CallResult/CallError frames exchanged with a charger — pick one to view its trail, or open its own detail page.</p>
            <Field label="Charger">
              <Select
                value={logChargerId}
                onChange={(e) => setLogChargerId(e.target.value)}
                options={[{ value: "", label: "Select a charger…" }, ...registry.map((r) => ({ value: r.chargerId, label: r.label }))]}
              />
            </Field>
            {logChargerId && (
              logMessages.length === 0 ? (
                <EmptyState title="No messages yet for this charger" />
              ) : (
                <div className="mt-3 max-h-96 overflow-x-auto overflow-y-auto scroll-thin">
                  <table className="w-full">
                    <thead className="sticky top-0 border-b border-ink-200 bg-white">
                      <tr><th className="th">Time</th><th className="th">Dir</th><th className="th">Type</th><th className="th">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {logMessages.map((m) => (
                        <tr key={m.id}>
                          <td className="td whitespace-nowrap text-ink-500">{formatDateTime(m.createdAt)}</td>
                          <td className="td">{m.direction}</td>
                          <td className="td">{m.messageType}</td>
                          <td className="td text-ink-600">{m.action ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
            {logChargerId && (
              <Link href={`/chargers/${registry.find((r) => r.chargerId === logChargerId)?.id ?? ""}`} className="mt-3 inline-block">
                <Button size="sm"><Terminal className="h-3.5 w-3.5" /> Full charger detail</Button>
              </Link>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
