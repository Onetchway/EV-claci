"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Button, Card, EmptyState, PageHeader, Spinner, useAsyncAction,
} from "@/components/ui";
import { ZoneEditModal } from "@/components/zone-edit-modal";
import { subscribeChargerRegistry, type ChargerRegistration } from "@/lib/db/charger-registry";
import { subscribeChargePoints, type ChargePoint } from "@/lib/db/chargers";
import { deleteZone, subscribeZones } from "@/lib/db/zones";
import { canManageChargers } from "@/lib/permissions";
import type { Zone } from "@/lib/types";

export default function ZonesPage() {
  const viewer = useViewer();
  const canManage = canManageChargers(viewer);
  const { run } = useAsyncAction();

  const [zones, setZones] = useState<Zone[] | null>(null);
  const [chargers, setChargers] = useState<ChargerRegistration[]>([]);
  const [points, setPoints] = useState<ChargePoint[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Zone | null>(null);

  useEffect(() => subscribeZones(setZones), []);
  useEffect(() => subscribeChargerRegistry(setChargers), []);
  useEffect(() => subscribeChargePoints(setPoints), []);

  const pointByChargerId = useMemo(() => new Map(points.map((p) => [p.chargePointId ?? p.id, p])), [points]);

  const loadByZone = useMemo(() => {
    const map = new Map<string, { currentKw: number; chargerCount: number }>();
    for (const c of chargers) {
      if (!c.zoneId || !c.active) continue;
      const live = pointByChargerId.get(c.chargerId);
      const occupied = live?.connectors && Object.values(live.connectors).some((conn) => conn.status === "Occupied");
      const entry = map.get(c.zoneId) ?? { currentKw: 0, chargerCount: 0 };
      entry.chargerCount += 1;
      if (occupied) entry.currentKw += c.powerKw ?? 0;
      map.set(c.zoneId, entry);
    }
    return map;
  }, [chargers, pointByChargerId]);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(z: Zone) {
    setEditing(z);
    setModalOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Zones & Load Balancing"
        description="Group chargers under a sanctioned load cap. When a zone's occupied chargers exceed the cap, the OCPP server automatically throttles them (proportional SetChargingProfile limits, cleared once back under cap) — based on rated charger power while occupied, not a live meter reading. Use Set Unavailable on /chargers for anything beyond that. Site details, revenue share and bank details live here or on Station Management — both edit the same record."
        actions={canManage && <Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" /> New zone</Button>}
      />

      {zones === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : zones.length === 0 ? (
        <EmptyState
          title="No zones yet"
          description="Create a zone, then assign chargers to it from the charger's edit form on /chargers."
          action={canManage && <Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" /> New zone</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {zones.map((z) => {
            const load = loadByZone.get(z.id) ?? { currentKw: 0, chargerCount: 0 };
            const pct = z.maxLoadKw > 0 ? (load.currentKw / z.maxLoadKw) * 100 : 0;
            const over = pct >= 90;
            return (
              <Card key={z.id} title={z.name} subtitle={`${load.chargerCount} charger${load.chargerCount === 1 ? "" : "s"}`}>
                <div className="flex items-baseline justify-between">
                  <p className="text-2xl font-semibold tabular-nums">{load.currentKw.toFixed(1)} kW</p>
                  <p className="text-sm text-ink-500">of {z.maxLoadKw} kW cap</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className={`h-full rounded-full ${over ? "bg-rose-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                {over && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-700">
                    <AlertTriangle className="h-3.5 w-3.5" /> At {pct.toFixed(0)}% of sanctioned load
                  </p>
                )}
                {canManage && (
                  <div className="mt-3 flex gap-2 border-t border-ink-100 pt-3">
                    <Button size="sm" onClick={() => openEdit(z)}>Edit</Button>
                    <Button size="sm" onClick={() => void run(() => deleteZone(z.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ZoneEditModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </>
  );
}
