"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Car, Plus, Trash2, User } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, useAsyncAction,
} from "@/components/ui";
import { subscribeSessionsForVehicles, type ChargeSession } from "@/lib/db/chargers";
import { addOdometerReading, subscribeOdometerReadings } from "@/lib/db/odometer";
import {
  assignVehicleDriver, assignVehicleRfidToken, createDriver, createVehicle, deleteDriver, deleteVehicle,
  subscribeDrivers, subscribeFleets, subscribeVehicles,
} from "@/lib/db/fleets";
import { EV_CAR_CATALOG, findCar, OTHER_CAR_ID } from "@/lib/ev-cars";
import { subscribeRfidTokens } from "@/lib/db/rfid";
import { canManageFleets } from "@/lib/permissions";
import type { Driver, Fleet, OdometerReading, RfidToken, Vehicle } from "@/lib/types";
import { formatCompactINR, formatDate } from "@/lib/utils";

export default function FleetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = canManageFleets(viewer);
  const { run, busy } = useAsyncAction();

  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rfidTokens, setRfidTokens] = useState<RfidToken[]>([]);
  const [vehicleSessions, setVehicleSessions] = useState<ChargeSession[]>([]);
  const [odometerReadings, setOdometerReadings] = useState<OdometerReading[]>([]);

  const [odoFor, setOdoFor] = useState<Vehicle | null>(null);
  const [odoKm, setOdoKm] = useState("");
  const [odoDate, setOdoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [odoNotes, setOdoNotes] = useState("");

  const [vOpen, setVOpen] = useState(false);
  const [vReg, setVReg] = useState("");
  const [vCarId, setVCarId] = useState(EV_CAR_CATALOG[0]!.id);
  const [vOtherMake, setVOtherMake] = useState("");
  const [vOtherBattery, setVOtherBattery] = useState("");

  const [dOpen, setDOpen] = useState(false);
  const [dName, setDName] = useState("");
  const [dPhone, setDPhone] = useState("");
  const [dLicense, setDLicense] = useState("");

  useEffect(() => subscribeFleets(setFleets), []);
  useEffect(() => subscribeVehicles(id, setVehicles), [id]);
  useEffect(() => subscribeDrivers(id, setDrivers), [id]);
  useEffect(() => subscribeRfidTokens(setRfidTokens), []);
  useEffect(
    () => subscribeSessionsForVehicles(vehicles.map((v) => v.id), setVehicleSessions),
    [vehicles],
  );
  useEffect(
    () => subscribeOdometerReadings(vehicles.map((v) => v.id), setOdometerReadings),
    [vehicles],
  );

  const usageByVehicle = useMemo(() => {
    const map = new Map<string, { sessions: number; energyWh: number; costInr: number }>();
    for (const s of vehicleSessions) {
      if (!s.vehicleId) continue;
      const entry = map.get(s.vehicleId) ?? { sessions: 0, energyWh: 0, costInr: 0 };
      entry.sessions += 1;
      entry.energyWh += s.energyDeliveredWh ?? 0;
      entry.costInr += s.totalCostInr ?? 0;
      map.set(s.vehicleId, entry);
    }
    return map;
  }, [vehicleSessions]);

  const fleet = fleets.find((f) => f.id === id);
  const driverName = useMemo(() => new Map(drivers.map((d) => [d.id, d.name])), [drivers]);

  const readingsByVehicle = useMemo(() => {
    const map = new Map<string, OdometerReading[]>();
    for (const r of odometerReadings) {
      const list = map.get(r.vehicleId) ?? [];
      list.push(r);
      map.set(r.vehicleId, list);
    }
    return map;
  }, [odometerReadings]);

  /** Cost-per-km since the earliest odometer reading — session cost has no odometer-matched window, so this is lifetime-since-first-reading, not a period figure. Needs at least 2 readings to have a km delta. */
  const costPerKmByVehicle = useMemo(() => {
    const map = new Map<string, { latestKm: number; costPerKm: number | null }>();
    for (const [vehicleId, readings] of readingsByVehicle.entries()) {
      if (readings.length === 0) continue;
      const first = readings[0]!;
      const latest = readings[readings.length - 1]!;
      const kmDriven = latest.odometerKm - first.odometerKm;
      const costInr = usageByVehicle.get(vehicleId)?.costInr ?? 0;
      map.set(vehicleId, { latestKm: latest.odometerKm, costPerKm: kmDriven > 0 ? costInr / kmDriven : null });
    }
    return map;
  }, [readingsByVehicle, usageByVehicle]);

  async function submitOdometer() {
    if (!actor || !odoFor || !odoKm.trim() || !odoDate) return;
    await run(async () => {
      await addOdometerReading({
        vehicleId: odoFor.id, odometerKm: Number(odoKm), readingDate: new Date(odoDate), notes: odoNotes.trim() || undefined,
      }, actor);
      setOdoFor(null); setOdoKm(""); setOdoNotes("");
    }, "Odometer reading logged.");
  }

  async function submitVehicle() {
    if (!actor || !vReg.trim()) return;
    const car = findCar(vCarId);
    const carLabel = car ? `${car.make} ${car.model}` : (vOtherMake.trim() || "Other");
    const batteryKwh = car ? car.batteryKwh : (vOtherBattery.trim() ? Number(vOtherBattery) : undefined);
    await run(async () => {
      await createVehicle({ fleetId: id, regNumber: vReg.trim().toUpperCase(), carId: vCarId, carLabel, batteryKwh, assignedDriverId: null }, actor);
      setVReg(""); setVCarId(EV_CAR_CATALOG[0]!.id); setVOtherMake(""); setVOtherBattery(""); setVOpen(false);
    }, "Vehicle added.");
  }

  async function submitDriver() {
    if (!actor || !dName.trim() || !dPhone.trim()) return;
    await run(async () => {
      await createDriver({ fleetId: id, name: dName.trim(), phone: dPhone.trim(), licenseNumber: dLicense.trim() || undefined, emspUserId: null }, actor);
      setDName(""); setDPhone(""); setDLicense(""); setDOpen(false);
    }, "Driver added.");
  }

  return (
    <>
      <PageHeader title={fleet?.name ?? "Fleet"} description="Vehicles and drivers for this fleet." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Vehicles"
          subtitle={`${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"}`}
          actions={canManage && <Button size="sm" onClick={() => setVOpen(true)}><Plus className="h-4 w-4" /> Add</Button>}
        >
          {vehicles.length === 0 ? (
            <EmptyState icon={<Car className="h-8 w-8" />} title="No vehicles yet" />
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full">
                <thead className="border-b border-ink-200">
                  <tr>
                    <th className="th">Reg. no.</th><th className="th">Car</th><th className="th">Battery</th>
                    <th className="th">Driver</th><th className="th">RFID card</th>
                    <th className="th text-right">Sessions</th><th className="th text-right">Energy</th><th className="th text-right">Spend</th>
                    <th className="th text-right">Odometer</th><th className="th text-right">₹/km</th>
                    {canManage && <th className="th text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {vehicles.map((v) => {
                    const usage = usageByVehicle.get(v.id);
                    return (
                    <tr key={v.id} className="hover:bg-ink-50">
                      <td className="td font-medium">{v.regNumber}</td>
                      <td className="td text-ink-600">{v.carLabel}</td>
                      <td className="td text-ink-600">{v.batteryKwh ? `${v.batteryKwh} kWh` : "—"}</td>
                      <td className="td">
                        {canManage ? (
                          <Select
                            value={v.assignedDriverId ?? ""}
                            onChange={(e) => void run(() => assignVehicleDriver(v.id, e.target.value || null))}
                            options={drivers.map((d) => ({ value: d.id, label: d.name }))}
                            placeholder="Unassigned"
                          />
                        ) : (v.assignedDriverId ? driverName.get(v.assignedDriverId) ?? "—" : "—")}
                      </td>
                      <td className="td">
                        {canManage ? (
                          <Select
                            value={v.rfidTokenId ?? ""}
                            onChange={(e) => void run(() => assignVehicleRfidToken(v.id, e.target.value || null))}
                            options={rfidTokens.map((t) => ({ value: t.id, label: `${t.label} (${t.idToken})` }))}
                            placeholder="Unassigned"
                          />
                        ) : (v.rfidTokenId ? rfidTokens.find((t) => t.id === v.rfidTokenId)?.label ?? "—" : "—")}
                      </td>
                      <td className="td text-right tabular-nums">{usage?.sessions ?? 0}</td>
                      <td className="td text-right tabular-nums">{usage ? `${(usage.energyWh / 1000).toFixed(1)} kWh` : "—"}</td>
                      <td className="td text-right tabular-nums">{usage ? formatCompactINR(usage.costInr) : "—"}</td>
                      <td className="td text-right tabular-nums">
                        {costPerKmByVehicle.get(v.id)?.latestKm != null ? `${costPerKmByVehicle.get(v.id)!.latestKm.toLocaleString("en-IN")} km` : "—"}
                      </td>
                      <td className="td text-right tabular-nums">
                        {costPerKmByVehicle.get(v.id)?.costPerKm != null ? `₹${costPerKmByVehicle.get(v.id)!.costPerKm!.toFixed(2)}` : "—"}
                      </td>
                      {canManage && (
                        <td className="td text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" onClick={() => { setOdoFor(v); setOdoKm(""); setOdoNotes(""); setOdoDate(new Date().toISOString().slice(0, 10)); }}>
                              Log odometer
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                if (!window.confirm(`Delete vehicle ${v.regNumber}?`)) return;
                                void run(() => deleteVehicle(v.id), "Vehicle deleted.");
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title="Drivers"
          subtitle={`${drivers.length} driver${drivers.length === 1 ? "" : "s"}`}
          actions={canManage && <Button size="sm" onClick={() => setDOpen(true)}><Plus className="h-4 w-4" /> Add</Button>}
        >
          {drivers.length === 0 ? (
            <EmptyState icon={<User className="h-8 w-8" />} title="No drivers yet" />
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full">
                <thead className="border-b border-ink-200">
                  <tr><th className="th">Name</th><th className="th">Phone</th><th className="th">License</th>{canManage && <th className="th text-right">Actions</th>}</tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {drivers.map((d) => (
                    <tr key={d.id} className="hover:bg-ink-50">
                      <td className="td font-medium">{d.name}</td>
                      <td className="td text-ink-600">{d.phone}</td>
                      <td className="td text-ink-600">{d.licenseNumber || "—"}</td>
                      {canManage && (
                        <td className="td text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!window.confirm(`Delete driver ${d.name}?`)) return;
                              void run(() => deleteDriver(d.id), "Driver deleted.");
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={vOpen}
        onClose={() => setVOpen(false)}
        title="Add vehicle"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setVOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!vReg.trim()} onClick={() => void submitVehicle()}>Add</Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Registration number" required><Input value={vReg} onChange={(e) => setVReg(e.target.value)} placeholder="e.g. DL 01 AB 1234" /></Field>
          <Field label="Car">
            <Select
              value={vCarId}
              onChange={(e) => setVCarId(e.target.value)}
              options={[...EV_CAR_CATALOG.map((c) => ({ value: c.id, label: `${c.make} ${c.model} (${c.batteryKwh} kWh)` })), { value: OTHER_CAR_ID, label: "Other — enter manually" }]}
            />
          </Field>
          {vCarId === OTHER_CAR_ID && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Make & model"><Input value={vOtherMake} onChange={(e) => setVOtherMake(e.target.value)} /></Field>
              <Field label="Battery (kWh)"><Input type="number" value={vOtherBattery} onChange={(e) => setVOtherBattery(e.target.value)} /></Field>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={dOpen}
        onClose={() => setDOpen(false)}
        title="Add driver"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!dName.trim() || !dPhone.trim()} onClick={() => void submitDriver()}>Add</Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Name" required><Input value={dName} onChange={(e) => setDName(e.target.value)} /></Field>
          <Field label="Phone" required><Input value={dPhone} onChange={(e) => setDPhone(e.target.value)} /></Field>
          <Field label="License number"><Input value={dLicense} onChange={(e) => setDLicense(e.target.value)} /></Field>
        </div>
      </Modal>

      <Modal
        open={!!odoFor}
        onClose={() => setOdoFor(null)}
        title={`Log odometer — ${odoFor?.regNumber ?? ""}`}
        description="Cost-per-km is derived from total session spend since the earliest reading, divided by km driven since then."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setOdoFor(null)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!odoKm.trim() || !odoDate} onClick={() => void submitOdometer()}>Log</Button>
          </>
        )}
      >
        <div className="grid gap-4">
          {odoFor && readingsByVehicle.get(odoFor.id)?.length ? (
            <p className="text-xs text-ink-500">
              Last logged: {readingsByVehicle.get(odoFor.id)!.slice(-1)[0]!.odometerKm.toLocaleString("en-IN")} km
              on {formatDate(readingsByVehicle.get(odoFor.id)!.slice(-1)[0]!.readingDate)}.
            </p>
          ) : (
            <p className="text-xs text-ink-500">No readings yet — this will be the baseline.</p>
          )}
          <Field label="Odometer (km)" required><Input type="number" min={0} value={odoKm} onChange={(e) => setOdoKm(e.target.value)} /></Field>
          <Field label="Reading date" required><Input type="date" value={odoDate} onChange={(e) => setOdoDate(e.target.value)} /></Field>
          <Field label="Notes"><Input value={odoNotes} onChange={(e) => setOdoNotes(e.target.value)} placeholder="Optional" /></Field>
        </div>
      </Modal>
    </>
  );
}
