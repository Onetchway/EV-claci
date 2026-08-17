"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Building2, IndianRupee, MapPin, Phone, Plus, Search, Wifi, WifiOff, Zap,
} from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import { ConnectorIcon } from "@/components/connector-icon";
import type { MapPin as MapPinType } from "@/components/chargers-map";
import {
  Badge, Button, Card, EmptyState, Input, PageHeader, Spinner,
} from "@/components/ui";
import { ZoneEditModal } from "@/components/zone-edit-modal";
import { SITE_TYPE_LABEL } from "@/lib/constants";
import { subscribeChargerRegistry, oemLabel, type ChargerRegistration } from "@/lib/db/charger-registry";
import { subscribeChargePoints, type ChargePoint } from "@/lib/db/chargers";
import { subscribeZones } from "@/lib/db/zones";
import { canManageChargers } from "@/lib/permissions";
import type { Zone } from "@/lib/types";
import { cn } from "@/lib/utils";

const ChargersMap = dynamic(() => import("@/components/chargers-map").then((m) => m.ChargersMap), {
  ssr: false,
  loading: () => <div className="flex h-[280px] items-center justify-center rounded-xl bg-ink-50 text-ink-400"><Spinner /></div>,
});

export default function StationsPage() {
  const viewer = useViewer();
  const canManage = canManageChargers(viewer);
  const isSiteOwner = viewer.role === "SITE_OWNER";

  const [zones, setZones] = useState<Zone[] | null>(null);
  const [chargers, setChargers] = useState<ChargerRegistration[]>([]);
  const [points, setPoints] = useState<ChargePoint[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => subscribeZones(setZones), []);
  useEffect(() => subscribeChargerRegistry(setChargers), []);
  useEffect(() => subscribeChargePoints(setPoints), []);

  // A Site Owner only ever sees the site(s) their account is linked to via Zone.ownerUid.
  const visibleZones = useMemo(
    () => (isSiteOwner ? (zones ?? []).filter((z) => z.ownerUid === viewer.uid) : zones),
    [zones, isSiteOwner, viewer.uid],
  );
  const visibleZoneIds = useMemo(() => new Set((visibleZones ?? []).map((z) => z.id)), [visibleZones]);
  const visibleChargers = useMemo(
    () => (isSiteOwner ? chargers.filter((c) => c.zoneId && visibleZoneIds.has(c.zoneId)) : chargers),
    [chargers, isSiteOwner, visibleZoneIds],
  );

  useEffect(() => {
    if (!selectedId && visibleZones && visibleZones.length > 0) setSelectedId(visibleZones[0]!.id);
  }, [visibleZones, selectedId]);

  const pointByChargerId = useMemo(() => new Map(points.map((p) => [p.chargePointId ?? p.id, p])), [points]);

  const mapPins: MapPinType[] = useMemo(
    () => visibleChargers
      .filter((c) => c.active && c.lat != null && c.lng != null)
      .map((c) => ({
        id: c.chargerId,
        label: c.label,
        lat: c.lat!,
        lng: c.lng!,
        online: pointByChargerId.get(c.chargerId)?.status === "ONLINE",
      })),
    [visibleChargers, pointByChargerId],
  );

  const chargerCountByZone = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of visibleChargers) {
      if (!c.zoneId || !c.active) continue;
      map.set(c.zoneId, (map.get(c.zoneId) ?? 0) + 1);
    }
    return map;
  }, [visibleChargers]);

  const filteredZones = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleZones ?? [];
    return (visibleZones ?? []).filter((z) =>
      z.name.toLowerCase().includes(q)
      || (z.address ?? "").toLowerCase().includes(q)
      || (z.city ?? "").toLowerCase().includes(q));
  }, [visibleZones, search]);

  const selected = visibleZones?.find((z) => z.id === selectedId) ?? null;
  const stationChargers = useMemo(
    () => (selected ? visibleChargers.filter((c) => c.zoneId === selected.id) : []),
    [visibleChargers, selected],
  );

  return (
    <>
      <PageHeader
        title="Station Management"
        description="Every site (RWA, hotel, corporate campus, etc.) and the chargers installed there — site details, revenue share and bank details in one place. Per-charger setup and remote commands still happen on Charger Management."
        actions={canManage && <Button variant="primary" onClick={() => { setSelectedId(null); setModalOpen(true); }}><Plus className="h-4 w-4" /> New station</Button>}
      />

      {mapPins.length > 0 && (
        <Card
          title="Map"
          subtitle={`${mapPins.length} charger${mapPins.length === 1 ? "" : "s"} with a location set`}
          className="mb-4"
        >
          <ChargersMap pins={mapPins} />
        </Card>
      )}

      {zones === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : (visibleZones ?? []).length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title={isSiteOwner ? "No site linked to your account yet" : "No stations yet"}
          action={canManage && <Button variant="primary" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> New station</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card bodyClassName="!p-0">
            <div className="border-b border-ink-100 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stations…" className="pl-8" />
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto scroll-thin">
              {filteredZones.length === 0 ? (
                <p className="p-4 text-sm text-ink-500">No matches.</p>
              ) : filteredZones.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setSelectedId(z.id)}
                  className={cn(
                    "block w-full border-b border-ink-50 px-4 py-3 text-left last:border-0 hover:bg-ink-50",
                    selectedId === z.id && "bg-brand-50",
                  )}
                >
                  <p className="truncate text-sm font-medium text-ink-900">{z.name}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-500">
                    {chargerCountByZone.get(z.id) ?? 0} charger{(chargerCountByZone.get(z.id) ?? 0) === 1 ? "" : "s"}
                    {z.siteType ? ` · ${SITE_TYPE_LABEL[z.siteType]}` : ""}
                  </p>
                </button>
              ))}
            </div>
          </Card>

          {!selected ? (
            <Card><p className="text-sm text-ink-500">Select a station.</p></Card>
          ) : (
            <div className="grid gap-4">
              <Card
                title={selected.name}
                subtitle={selected.siteType ? SITE_TYPE_LABEL[selected.siteType] : undefined}
                actions={canManage && <Button size="sm" onClick={() => setModalOpen(true)}>Edit station</Button>}
              >
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                    <span className="text-ink-700">
                      {[selected.address, selected.city, selected.state, selected.pincode].filter(Boolean).join(", ") || "No address set"}
                    </span>
                  </div>
                  {selected.pocName && (
                    <div className="flex items-start gap-1.5"><Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                      <span className="text-ink-700">{selected.pocName}{selected.pocPhone ? ` · ${selected.pocPhone}` : ""}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-1.5"><Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                    <span className="text-ink-700">{selected.maxLoadKw} kW sanctioned load{selected.discomName ? ` · ${selected.discomName}` : ""}</span>
                  </div>
                  {selected.revenueShareType && (
                    <div className="flex items-start gap-1.5"><IndianRupee className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                      <span className="text-ink-700">
                        Revenue share: {selected.revenueShareType === "PERCENT" ? `${selected.revenueShareValue}%` : `₹${selected.revenueShareValue}/session`}
                      </span>
                    </div>
                  )}
                </dl>
                {!selected.bankAccountNumber && (
                  <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-500">No bank details on file — add them under Edit station → Bank details.</p>
                )}
              </Card>

              <Card
                title="Chargers at this station"
                subtitle={`${stationChargers.length} charger${stationChargers.length === 1 ? "" : "s"}`}
                actions={<Link href="/chargers"><Button size="sm">Manage on Charger Dashboard</Button></Link>}
              >
                {stationChargers.length === 0 ? (
                  <EmptyState
                    icon={<Zap className="h-8 w-8" />}
                    title="No chargers here yet"
                    description="Register one on Charger Dashboard and assign it to this station."
                  />
                ) : (
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full">
                      <thead className="border-b border-ink-200">
                        <tr>
                          <th className="th">Label</th>
                          <th className="th">Type</th>
                          <th className="th">OEM</th>
                          <th className="th">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {stationChargers.map((c) => {
                          const live = pointByChargerId.get(c.chargerId);
                          const online = live?.status === "ONLINE";
                          return (
                            <tr key={c.id} className="hover:bg-ink-50">
                              <td className="td font-medium">{c.label}</td>
                              <td className="td text-ink-600">
                                <div className="flex items-center gap-1.5">
                                  {c.connectorType && <ConnectorIcon type={c.connectorType} size={20} />}
                                  <span>
                                    {c.chargerPowerType}{c.connectorType ? ` · ${c.connectorType}` : ""}
                                    {c.connectors && c.connectors.length > 0 && ` +${c.connectors.length}`}
                                  </span>
                                </div>
                              </td>
                              <td className="td text-ink-600">{oemLabel(c)}</td>
                              <td className="td">
                                {!c.active ? (
                                  <Badge className="bg-ink-100 text-ink-500 ring-ink-200">Deactivated</Badge>
                                ) : online ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">
                                    <span className="flex items-center gap-1"><Wifi className="h-3 w-3" /> Online</span>
                                  </Badge>
                                ) : (
                                  <Badge className="bg-ink-100 text-ink-600 ring-ink-200">
                                    <span className="flex items-center gap-1"><WifiOff className="h-3 w-3" /> {live ? "Offline" : "Not connected yet"}</span>
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      <ZoneEditModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={selected && modalOpen && selectedId ? selected : null}
        onSaved={(id) => setSelectedId(id)}
      />
    </>
  );
}
