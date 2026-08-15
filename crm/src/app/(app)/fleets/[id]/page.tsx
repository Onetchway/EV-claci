"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Car, Plus, User } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, useAsyncAction,
} from "@/components/ui";
import {
  assignVehicleDriver, createDriver, createVehicle, subscribeDrivers, subscribeFleets, subscribeVehicles,
} from "@/lib/db/fleets";
import { EV_CAR_CATALOG, findCar, OTHER_CAR_ID } from "@/lib/ev-cars";
import { canManageFleets } from "@/lib/permissions";
import type { Driver, Fleet, Vehicle } from "@/lib/types";

export default function FleetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = canManageFleets(viewer);
  const { run, busy } = useAsyncAction();

  const [fleets, setFleets] = useState<Fleet[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

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

  const fleet = fleets.find((f) => f.id === id);
  const driverName = useMemo(() => new Map(drivers.map((d) => [d.id, d.name])), [drivers]);

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
                  <tr><th className="th">Reg. no.</th><th className="th">Car</th><th className="th">Battery</th><th className="th">Driver</th></tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {vehicles.map((v) => (
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
                    </tr>
                  ))}
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
                  <tr><th className="th">Name</th><th className="th">Phone</th><th className="th">License</th></tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {drivers.map((d) => (
                    <tr key={d.id} className="hover:bg-ink-50">
                      <td className="td font-medium">{d.name}</td>
                      <td className="td text-ink-600">{d.phone}</td>
                      <td className="td text-ink-600">{d.licenseNumber || "—"}</td>
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
    </>
  );
}
