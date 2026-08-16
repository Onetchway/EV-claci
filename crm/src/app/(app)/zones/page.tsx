"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, useAsyncAction,
} from "@/components/ui";
import { INDIAN_STATES, SITE_TYPE_LABEL, SITE_TYPES, type SiteType } from "@/lib/constants";
import { subscribeChargerRegistry, type ChargerRegistration } from "@/lib/db/charger-registry";
import { subscribeChargePoints, type ChargePoint } from "@/lib/db/chargers";
import { createZone, deleteZone, subscribeZones, updateZone, type ZoneDraft } from "@/lib/db/zones";
import { canManageChargers } from "@/lib/permissions";
import type { RevenueShareType, Zone } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = ["Details", "Revenue share", "Bank details"] as const;
type Tab = (typeof TABS)[number];

export default function ZonesPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = canManageChargers(viewer);
  const { run, busy } = useAsyncAction();

  const [zones, setZones] = useState<Zone[] | null>(null);
  const [chargers, setChargers] = useState<ChargerRegistration[]>([]);
  const [points, setPoints] = useState<ChargePoint[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("Details");
  const [editing, setEditing] = useState<Zone | null>(null);

  const [name, setName] = useState("");
  const [maxLoadKw, setMaxLoadKw] = useState(0);
  const [siteType, setSiteType] = useState<SiteType | "">("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [state, setState] = useState("");
  const [pocName, setPocName] = useState("");
  const [pocPhone, setPocPhone] = useState("");
  const [discomName, setDiscomName] = useState("");
  const [slaHours, setSlaHours] = useState("");
  const [revenueShareType, setRevenueShareType] = useState<RevenueShareType | "">("");
  const [revenueShareValue, setRevenueShareValue] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfscCode, setBankIfscCode] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankName, setBankName] = useState("");

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

  function resetForm() {
    setName(""); setMaxLoadKw(0); setSiteType(""); setAddress(""); setCity(""); setPincode(""); setState("");
    setPocName(""); setPocPhone(""); setDiscomName(""); setSlaHours("");
    setRevenueShareType(""); setRevenueShareValue("");
    setBankAccountNumber(""); setBankIfscCode(""); setBankAccountName(""); setBankName("");
  }

  function openNew() {
    setEditing(null);
    resetForm();
    setTab("Details");
    setModalOpen(true);
  }

  function openEdit(z: Zone) {
    setEditing(z);
    setName(z.name);
    setMaxLoadKw(z.maxLoadKw);
    setSiteType(z.siteType ?? "");
    setAddress(z.address ?? "");
    setCity(z.city ?? "");
    setPincode(z.pincode ?? "");
    setState(z.state ?? "");
    setPocName(z.pocName ?? "");
    setPocPhone(z.pocPhone ?? "");
    setDiscomName(z.discomName ?? "");
    setSlaHours(z.slaHours != null ? String(z.slaHours) : "");
    setRevenueShareType(z.revenueShareType ?? "");
    setRevenueShareValue(z.revenueShareValue != null ? String(z.revenueShareValue) : "");
    setBankAccountNumber(z.bankAccountNumber ?? "");
    setBankIfscCode(z.bankIfscCode ?? "");
    setBankAccountName(z.bankAccountName ?? "");
    setBankName(z.bankName ?? "");
    setTab("Details");
    setModalOpen(true);
  }

  async function submit() {
    if (!actor || !name.trim()) return;
    const draft: ZoneDraft = {
      name: name.trim(),
      maxLoadKw,
      siteType: siteType || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      pincode: pincode.trim() || undefined,
      state: state || undefined,
      pocName: pocName.trim() || undefined,
      pocPhone: pocPhone.trim() || undefined,
      discomName: discomName.trim() || undefined,
      slaHours: slaHours.trim() ? Number(slaHours) : undefined,
      revenueShareType: revenueShareType || undefined,
      revenueShareValue: revenueShareType && revenueShareValue.trim() ? Number(revenueShareValue) : undefined,
      bankAccountNumber: bankAccountNumber.trim() || undefined,
      bankIfscCode: bankIfscCode.trim() || undefined,
      bankAccountName: bankAccountName.trim() || undefined,
      bankName: bankName.trim() || undefined,
    };
    await run(async () => {
      if (editing) await updateZone(editing.id, draft);
      else await createZone(draft, actor);
      setModalOpen(false);
    }, editing ? "Zone updated." : "Zone created.");
  }

  return (
    <>
      <PageHeader
        title="Zones & Load Balancing"
        description="Group chargers under a sanctioned load cap. When a zone's occupied chargers exceed the cap, the OCPP server automatically throttles them (proportional SetChargingProfile limits, cleared once back under cap) — based on rated charger power while occupied, not a live meter reading. Use Set Unavailable on /chargers for anything beyond that."
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit zone" : "New zone"}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!name.trim()} onClick={() => void submit()}>
              {editing ? "Save" : "Create"}
            </Button>
          </>
        )}
      >
        <div className="mb-4 flex gap-1 border-b border-ink-100">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium",
                tab === t ? "border-brand-500 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-700",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Details" && (
          <div className="grid gap-4">
            <Field label="Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Basement parking, Block A" />
            </Field>
            <Field label="Sanctioned load cap (kW)">
              <Input type="number" min={0} value={maxLoadKw} onChange={(e) => setMaxLoadKw(Number(e.target.value) || 0)} />
            </Field>
            <Field label="Site type">
              <Select
                value={siteType}
                onChange={(e) => setSiteType(e.target.value as SiteType | "")}
                placeholder="Select site type"
                options={SITE_TYPES.map((t) => ({ value: t, label: SITE_TYPE_LABEL[t] }))}
              />
            </Field>
            <Field label="Address">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="City"><Input value={city} onChange={(e) => setCity(e.target.value)} /></Field>
              <Field label="Pincode"><Input value={pincode} onChange={(e) => setPincode(e.target.value)} /></Field>
              <Field label="State">
                <Select value={state} onChange={(e) => setState(e.target.value)} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} placeholder="—" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="POC name" hint="Who to contact at this site."><Input value={pocName} onChange={(e) => setPocName(e.target.value)} /></Field>
              <Field label="POC phone"><Input value={pocPhone} onChange={(e) => setPocPhone(e.target.value)} /></Field>
            </div>
            <Field label="DISCOM name">
              <Input value={discomName} onChange={(e) => setDiscomName(e.target.value)} placeholder="e.g. BSES Rajdhani, Tata Power" />
            </Field>
            <Field label="Fault ticket SLA override (hours)">
              <Input
                type="number"
                min={0}
                value={slaHours}
                onChange={(e) => setSlaHours(e.target.value)}
                placeholder="Leave blank to use the platform default"
              />
            </Field>
          </div>
        )}

        {tab === "Revenue share" && (
          <div className="grid gap-4">
            <Field label="Share with site host?">
              <Select
                value={revenueShareType}
                onChange={(e) => setRevenueShareType(e.target.value as RevenueShareType | "")}
                options={[{ value: "PERCENT", label: "Yes — % of each session" }, { value: "FIXED", label: "Yes — flat ₹ per session" }]}
                placeholder="No revenue share"
              />
            </Field>
            {revenueShareType && (
              <Field label={revenueShareType === "PERCENT" ? "Share (%)" : "Flat amount per session (₹)"}>
                <Input
                  type="number"
                  min={0}
                  max={revenueShareType === "PERCENT" ? 100 : undefined}
                  value={revenueShareValue}
                  onChange={(e) => setRevenueShareValue(e.target.value)}
                  placeholder={revenueShareType === "PERCENT" ? "e.g. 15" : "e.g. 20"}
                />
              </Field>
            )}
            <p className="text-xs text-ink-500">Accrues automatically per session on /settlements — e.g. an RWA hosting this charger.</p>
          </div>
        )}

        {tab === "Bank details" && (
          <div className="grid gap-4">
            <p className="text-xs text-ink-500">Where a settlement payout to this site's host actually goes — shown on /settlements, not validated against a real bank.</p>
            <Field label="Bank account number"><Input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} /></Field>
            <Field label="IFSC code"><Input value={bankIfscCode} onChange={(e) => setBankIfscCode(e.target.value.toUpperCase())} /></Field>
            <Field label="Account holder name"><Input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} /></Field>
            <Field label="Bank name"><Input value={bankName} onChange={(e) => setBankName(e.target.value)} /></Field>
          </div>
        )}
      </Modal>
    </>
  );
}
