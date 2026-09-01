"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Plus } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, useAsyncAction,
} from "@/components/ui";
import { subscribeChargerRegistry, type ChargerRegistration } from "@/lib/db/charger-registry";
import {
  cancelChargingSchedule, createChargingSchedule, subscribeChargingSchedules, type ChargingScheduleDraft,
} from "@/lib/db/charging-schedules";
import { subscribeFleets, subscribeVehicles } from "@/lib/db/fleets";
import { subscribeRfidTokens } from "@/lib/db/rfid";
import {
  CHARGING_SCHEDULE_STATUS_COLOR, CHARGING_SCHEDULE_STATUS_LABEL,
} from "@/lib/constants";
import { canManageFleets } from "@/lib/permissions";
import type { ChargingSchedule, Fleet, RfidToken, Vehicle } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export default function DepotChargingPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = canManageFleets(viewer);
  const { run, busy } = useAsyncAction();

  const [schedules, setSchedules] = useState<ChargingSchedule[] | null>(null);
  const [registry, setRegistry] = useState<ChargerRegistration[]>([]);
  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rfidTokens, setRfidTokens] = useState<RfidToken[]>([]);

  const [open, setOpen] = useState(false);
  const [chargerId, setChargerId] = useState("");
  const [evseId, setEvseId] = useState("1");
  const [fleetId, setFleetId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [manualIdToken, setManualIdToken] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  useEffect(() => subscribeChargingSchedules(setSchedules), []);
  useEffect(() => subscribeChargerRegistry(setRegistry), []);
  useEffect(() => subscribeFleets(setFleets), []);
  useEffect(() => subscribeRfidTokens(setRfidTokens), []);
  useEffect(() => {
    if (!fleetId) { setVehicles([]); return; }
    return subscribeVehicles(fleetId, setVehicles);
  }, [fleetId]);

  const chargerById = useMemo(() => new Map(registry.map((r) => [r.chargerId, r])), [registry]);
  const rfidByTokenId = useMemo(() => new Map(rfidTokens.map((t) => [t.id, t])), [rfidTokens]);

  const upcoming = useMemo(() => (schedules ?? []).filter((s) => s.status === "SCHEDULED"), [schedules]);
  const history = useMemo(() => (schedules ?? []).filter((s) => s.status !== "SCHEDULED"), [schedules]);

  function openNew() {
    setChargerId(""); setEvseId("1"); setFleetId(""); setVehicleId(""); setManualIdToken(""); setScheduledAt("");
    setOpen(true);
  }

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
  const resolvedIdToken = selectedVehicle?.rfidTokenId ? rfidByTokenId.get(selectedVehicle.rfidTokenId)?.idToken : undefined;

  async function submit() {
    if (!actor || !chargerId || !scheduledAt) return;
    const idToken = resolvedIdToken || manualIdToken.trim();
    if (!idToken) return;
    const draft: ChargingScheduleDraft = {
      chargerId,
      evseId: Number(evseId) || 1,
      vehicleId: selectedVehicle?.id ?? null,
      vehicleRegNumber: selectedVehicle?.regNumber ?? null,
      fleetId: fleetId || null,
      idToken,
      idTokenLabel: selectedVehicle ? `${selectedVehicle.regNumber} (${selectedVehicle.carLabel})` : rfidTokens.find((t) => t.idToken === idToken)?.label,
      scheduledStartAt: new Date(scheduledAt),
    };
    await run(async () => {
      await createChargingSchedule(draft, actor);
      setOpen(false);
    }, "Charging scheduled.");
  }

  return (
    <>
      <PageHeader
        title="Depot / Scheduled Charging"
        description="Queue a remote start for a future time — overnight depot charging, staggering a fleet instead of everyone tapping in at once. The OCPP server fires the RequestStartTransaction itself when it's due."
        actions={canManage && <Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" /> Schedule charging</Button>}
      />

      {schedules === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : (
        <div className="grid gap-4">
          <Card title="Upcoming" subtitle={`${upcoming.length} scheduled`}>
            {upcoming.length === 0 ? (
              <EmptyState icon={<CalendarClock className="h-8 w-8" />} title="Nothing scheduled" />
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full">
                  <thead className="border-b border-ink-200">
                    <tr>
                      <th className="th">Charger</th><th className="th">Vehicle / Token</th>
                      <th className="th">Scheduled for</th><th className="th">Status</th>
                      {canManage && <th className="th text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {upcoming.map((s) => (
                      <tr key={s.id} className="hover:bg-ink-50">
                        <td className="td font-medium">{chargerById.get(s.chargerId)?.label ?? s.chargerId}</td>
                        <td className="td text-ink-600">{s.idTokenLabel ?? s.idToken}</td>
                        <td className="td text-ink-600">{formatDateTime(s.scheduledStartAt)}</td>
                        <td className="td"><Badge className={CHARGING_SCHEDULE_STATUS_COLOR[s.status]}>{CHARGING_SCHEDULE_STATUS_LABEL[s.status]}</Badge></td>
                        {canManage && (
                          <td className="td text-right">
                            <Button size="sm" onClick={() => void run(() => cancelChargingSchedule(s.id))}>Cancel</Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {history.length > 0 && (
            <Card title="History">
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full">
                  <thead className="border-b border-ink-200">
                    <tr>
                      <th className="th">Charger</th><th className="th">Vehicle / Token</th>
                      <th className="th">Scheduled for</th><th className="th">Status</th><th className="th">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {history.map((s) => (
                      <tr key={s.id}>
                        <td className="td text-ink-600">{chargerById.get(s.chargerId)?.label ?? s.chargerId}</td>
                        <td className="td text-ink-600">{s.idTokenLabel ?? s.idToken}</td>
                        <td className="td text-ink-600">{formatDateTime(s.scheduledStartAt)}</td>
                        <td className="td"><Badge className={CHARGING_SCHEDULE_STATUS_COLOR[s.status]}>{CHARGING_SCHEDULE_STATUS_LABEL[s.status]}</Badge></td>
                        <td className="td text-ink-500">{s.failReason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Schedule charging"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!chargerId || !scheduledAt || !(resolvedIdToken || manualIdToken.trim())}
              onClick={() => void submit()}
            >
              Schedule
            </Button>
          </>
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Charger" required className="sm:col-span-2">
            <Select
              value={chargerId}
              onChange={(e) => setChargerId(e.target.value)}
              options={[{ value: "", label: "Select…" }, ...registry.filter((r) => r.active).map((r) => ({ value: r.chargerId, label: r.label }))]}
            />
          </Field>
          <Field label="EVSE / connector">
            <Input type="number" min={1} value={evseId} onChange={(e) => setEvseId(e.target.value)} />
          </Field>
          <Field label="Start time" required>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </Field>
          <Field label="Fleet" hint="Optional — pick a vehicle to auto-resolve its RFID card.">
            <Select
              value={fleetId}
              onChange={(e) => { setFleetId(e.target.value); setVehicleId(""); }}
              options={[{ value: "", label: "None" }, ...fleets.map((f) => ({ value: f.id, label: f.name }))]}
            />
          </Field>
          {fleetId && (
            <Field label="Vehicle">
              <Select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                options={[{ value: "", label: "Select…" }, ...vehicles.filter((v) => v.rfidTokenId).map((v) => ({ value: v.id, label: `${v.regNumber} (${v.carLabel})` }))]}
              />
            </Field>
          )}
          {!selectedVehicle && (
            <Field label="RFID / ID token" required={!selectedVehicle} className="sm:col-span-2" hint="Used when not scheduling against a fleet vehicle.">
              {rfidTokens.filter((t) => t.status === "ACTIVE").length > 0 ? (
                <Select
                  value={manualIdToken}
                  onChange={(e) => setManualIdToken(e.target.value)}
                  options={[{ value: "", label: "Select…" }, ...rfidTokens.filter((t) => t.status === "ACTIVE").map((t) => ({ value: t.idToken, label: `${t.label} (${t.idToken})` }))]}
                />
              ) : (
                <Input value={manualIdToken} onChange={(e) => setManualIdToken(e.target.value)} placeholder="Tag ID" />
              )}
            </Field>
          )}
        </div>
      </Modal>
    </>
  );
}
