"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Battery, Search, Square } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Spinner, StatCard, useToast,
} from "@/components/ui";
import { subscribeChargerRegistry, type ChargerRegistration } from "@/lib/db/charger-registry";
import { subscribeRecentSessions, type ChargeSession } from "@/lib/db/chargers";
import { subscribeZones } from "@/lib/db/zones";
import { sendChargerCommand } from "@/lib/ocpp-commands";
import { canManageChargers, canVerifyPayment } from "@/lib/permissions";
import { applySessionDiscount } from "@/lib/sessions-client";
import type { Zone } from "@/lib/types";
import { formatDateTime, formatINR } from "@/lib/utils";

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

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "ENDED", label: "Ended" },
];

export default function SessionsPage() {
  const viewer = useViewer();
  const canManage = canManageChargers(viewer);
  const canFinance = canVerifyPayment(viewer);
  const { push } = useToast();

  const [sessions, setSessions] = useState<ChargeSession[]>([]);
  const [registry, setRegistry] = useState<ChargerRegistration[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [commandBusy, setCommandBusy] = useState<string | null>(null);
  const [discountBusy, setDiscountBusy] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [connectorTypeFilter, setConnectorTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => subscribeRecentSessions((rows) => { setSessions(rows); setLoading(false); }, () => setLoading(false)), []);
  useEffect(() => subscribeChargerRegistry(setRegistry), []);
  useEffect(() => subscribeZones(setZones), []);

  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const regByChargerId = useMemo(() => new Map(registry.map((r) => [r.chargerId, r])), [registry]);

  const cities = useMemo(() => [...new Set(zones.map((z) => z.city).filter((c): c is string => !!c))].sort(), [zones]);
  const connectorTypeOptions = useMemo(
    () => [...new Set(registry.flatMap((r) => [r.connectorType, ...(r.connectors ?? []).map((c) => c.connectorType)].filter(Boolean)))] as string[],
    [registry],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      const reg = regByChargerId.get(s.chargePointId);
      const zone = reg?.zoneId ? zoneById.get(reg.zoneId) : undefined;
      if (cityFilter && zone?.city !== cityFilter) return false;
      if (stateFilter && reg?.state !== stateFilter) return false;
      if (connectorTypeFilter) {
        const types = [reg?.connectorType, ...(reg?.connectors ?? []).map((c) => c.connectorType)].filter(Boolean) as string[];
        if (!types.includes(connectorTypeFilter)) return false;
      }
      if (!q) return true;
      const hay = [s.chargePointId, s.walletOwnerName, s.vehicleRegNumber].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [sessions, statusFilter, cityFilter, stateFilter, connectorTypeFilter, search, regByChargerId, zoneById]);

  const stats = useMemo(() => {
    const active = sessions.filter((s) => s.status === "ACTIVE").length;
    const energyToday = sessions.reduce((a, s) => a + (s.energyDeliveredWh ?? 0), 0);
    return { total: sessions.length, active, energyToday };
  }, [sessions]);

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

  return (
    <>
      <PageHeader
        title="Sessions"
        description="Every live and recent charging session across the fleet, newest first."
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Sessions (recent)" value={stats.total} icon={<Battery className="h-4 w-4" />} />
        <StatCard label="Active now" value={stats.active} tone={stats.active ? "positive" : "default"} />
        <StatCard label="Energy delivered" value={wh(stats.energyToday)} />
      </div>

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-5">
          <Field label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Charger, user, vehicle…" />
            </div>
          </Field>
          <Field label="Status">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={STATUS_OPTIONS} />
          </Field>
          <Field label="City">
            <Select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} options={[{ value: "", label: "All cities" }, ...cities.map((c) => ({ value: c, label: c }))]} />
          </Field>
          <Field label="State">
            <Select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} options={[{ value: "", label: "All states" }, ...[...new Set(registry.map((r) => r.state).filter(Boolean))].sort().map((s) => ({ value: s as string, label: s as string }))]} />
          </Field>
          <Field label="Connector type">
            <Select value={connectorTypeFilter} onChange={(e) => setConnectorTypeFilter(e.target.value)} options={[{ value: "", label: "All types" }, ...connectorTypeOptions.map((t) => ({ value: t, label: t }))]} />
          </Field>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Battery className="h-8 w-8" />} title="No sessions match" />
      ) : (
        <Card>
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
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-ink-50">
                    <td className="td font-medium">
                      <Link href={`/sessions/${s.id}`} className="text-brand-700 hover:underline">{s.chargePointId}</Link>
                    </td>
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
        </Card>
      )}
    </>
  );
}
