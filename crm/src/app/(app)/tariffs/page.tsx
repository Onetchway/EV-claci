"use client";

import { useEffect, useMemo, useState } from "react";
import { IndianRupee, Plus } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Checkbox, EmptyState, Field, Input, Modal, PageHeader,
  Select, Spinner, useAsyncAction,
} from "@/components/ui";
import { subscribeChargerRegistry, type ChargerRegistration } from "@/lib/db/charger-registry";
import { createTariff, subscribeTariffs, updateTariff, setTariffActive, type TariffDraft } from "@/lib/db/tariffs";
import { subscribeZones } from "@/lib/db/zones";
import {
  INDIAN_STATES, TARIFF_PRICING_TYPE_LABEL, TARIFF_PRICING_TYPES, TARIFF_SCOPE_LABEL,
  TARIFF_SCOPES, WEEKDAY_LABEL,
} from "@/lib/constants";
import { canManageTariffs } from "@/lib/permissions";
import type { Tariff, Zone } from "@/lib/types";
import { formatINR } from "@/lib/utils";

const blankDraft: TariffDraft = {
  name: "",
  scope: "ALL_CHARGERS",
  chargerIds: [],
  zoneIds: [],
  states: [],
  pricingType: "PER_KWH",
  rate: 0,
  gstPct: 18,
  platformFeeInr: 0,
  timeWindow: null,
  priority: 0,
  active: true,
};

function rateLabel(t: Pick<Tariff, "pricingType" | "rate">): string {
  const unit = t.pricingType === "PER_KWH" ? "/kWh" : t.pricingType === "PER_MINUTE" ? "/min" : " flat";
  return `${formatINR(t.rate)}${unit}`;
}

function timeWindowLabel(t: Tariff): string {
  if (!t.timeWindow) return "Always";
  const days = t.timeWindow.daysOfWeek.length
    ? t.timeWindow.daysOfWeek.map((d) => WEEKDAY_LABEL[d]).join(", ")
    : "Every day";
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return `${days}, ${fmt(t.timeWindow.startMinute)}–${fmt(t.timeWindow.endMinute)}`;
}

export default function TariffsPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = canManageTariffs(viewer);
  const { run, busy } = useAsyncAction();

  const [rows, setRows] = useState<Tariff[] | null>(null);
  const [chargers, setChargers] = useState<ChargerRegistration[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TariffDraft>(blankDraft);
  const [useTimeWindow, setUseTimeWindow] = useState(false);

  useEffect(() => subscribeTariffs(setRows), []);
  useEffect(() => subscribeChargerRegistry(setChargers), []);
  useEffect(() => subscribeZones(setZones), []);

  const chargerLabel = useMemo(() => new Map(chargers.map((c) => [c.chargerId, c.label])), [chargers]);
  const zoneLabel = useMemo(() => new Map(zones.map((z) => [z.id, z.name])), [zones]);

  function appliesToLabel(t: Tariff): string {
    if (t.scope === "ALL_CHARGERS") return "All chargers";
    if (t.scope === "SPECIFIC_CHARGERS") return t.chargerIds.length ? t.chargerIds.map((id) => chargerLabel.get(id) ?? id).join(", ") : "—";
    if (t.scope === "ZONE") return t.zoneIds.length ? t.zoneIds.map((id) => zoneLabel.get(id) ?? id).join(", ") : "—";
    return t.states.length ? t.states.join(", ") : "—";
  }

  function openNew() {
    setEditingId(null);
    setDraft(blankDraft);
    setUseTimeWindow(false);
    setModalOpen(true);
  }

  function openEdit(t: Tariff) {
    setEditingId(t.id);
    setDraft({
      name: t.name, scope: t.scope, chargerIds: t.chargerIds, zoneIds: t.zoneIds, states: t.states,
      pricingType: t.pricingType, rate: t.rate, gstPct: t.gstPct, platformFeeInr: t.platformFeeInr,
      timeWindow: t.timeWindow ?? null, priority: t.priority, active: t.active,
    });
    setUseTimeWindow(!!t.timeWindow);
    setModalOpen(true);
  }

  function toggleDay(day: number) {
    setDraft((d) => {
      const tw = d.timeWindow ?? { daysOfWeek: [], startMinute: 0, endMinute: 1440 };
      const days = tw.daysOfWeek.includes(day) ? tw.daysOfWeek.filter((x) => x !== day) : [...tw.daysOfWeek, day];
      return { ...d, timeWindow: { ...tw, daysOfWeek: days } };
    });
  }

  async function submit() {
    if (!actor || !draft.name.trim() || draft.rate < 0) return;
    const toSave: TariffDraft = { ...draft, timeWindow: useTimeWindow ? (draft.timeWindow ?? { daysOfWeek: [], startMinute: 0, endMinute: 1440 }) : null };
    await run(async () => {
      if (editingId) await updateTariff(editingId, toSave, actor);
      else await createTariff(toSave, actor);
      setModalOpen(false);
    }, editingId ? "Tariff updated." : "Tariff created.");
  }

  return (
    <>
      <PageHeader
        title="Tariffs & Pricing"
        description="Session pricing rules the OCPP server applies when a charging session ends. More specific rules (a named charger, a time window) win over the general default."
        actions={canManage && <Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" /> New tariff</Button>}
      />

      {rows === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<IndianRupee className="h-8 w-8" />}
          title="No tariffs configured"
          description="Sessions won't be billed until at least one active tariff exists."
          action={canManage && <Button variant="primary" onClick={openNew}><Plus className="h-4 w-4" /> New tariff</Button>}
        />
      ) : (
        <div className="card overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="th">Name</th>
                <th className="th">Applies to</th>
                <th className="th">Rate</th>
                <th className="th">GST</th>
                <th className="th">Window</th>
                <th className="th">Priority</th>
                <th className="th">Status</th>
                {canManage && <th className="th text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-ink-50">
                  <td className="td font-medium">{t.name}</td>
                  <td className="td text-ink-600">{appliesToLabel(t)}</td>
                  <td className="td tabular-nums">{rateLabel(t)}{t.platformFeeInr > 0 && <span className="text-ink-500"> + {formatINR(t.platformFeeInr)}</span>}</td>
                  <td className="td text-ink-600">{t.gstPct}%</td>
                  <td className="td text-ink-600">{timeWindowLabel(t)}</td>
                  <td className="td text-ink-600">{t.priority}</td>
                  <td className="td">
                    <Badge className={t.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-500 ring-ink-200"}>
                      {t.active ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  {canManage && (
                    <td className="td text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => openEdit(t)}>Edit</Button>
                        <Button size="sm" onClick={() => void run(() => setTariffActive(t.id, !t.active, actor!))}>
                          {t.active ? "Disable" : "Enable"}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit tariff" : "New tariff"}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!draft.name.trim()} onClick={() => void submit()}>
              {editingId ? "Save" : "Create"}
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Field label="Name" required>
            <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Standard DC rate" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Applies to">
              <Select
                value={draft.scope}
                onChange={(e) => setDraft((d) => ({ ...d, scope: e.target.value as TariffDraft["scope"] }))}
                options={TARIFF_SCOPES.map((s) => ({ value: s, label: TARIFF_SCOPE_LABEL[s] }))}
              />
            </Field>
            <Field label="Priority" hint="Higher wins when two rules tie on specificity.">
              <Input type="number" value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: Number(e.target.value) || 0 }))} />
            </Field>
          </div>

          {draft.scope === "SPECIFIC_CHARGERS" && (
            <Field label="Chargers">
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-ink-200 p-2">
                {chargers.length === 0 ? (
                  <p className="text-xs text-ink-500">No chargers registered yet.</p>
                ) : chargers.map((c) => (
                  <Checkbox
                    key={c.id}
                    label={c.label}
                    checked={draft.chargerIds.includes(c.chargerId)}
                    onChange={(v) => setDraft((d) => ({
                      ...d,
                      chargerIds: v ? [...d.chargerIds, c.chargerId] : d.chargerIds.filter((x) => x !== c.chargerId),
                    }))}
                  />
                ))}
              </div>
            </Field>
          )}

          {draft.scope === "ZONE" && (
            <Field label="Zones / sites">
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-ink-200 p-2">
                {zones.length === 0 ? (
                  <p className="text-xs text-ink-500">No zones created yet — see Zones & Load Balancing.</p>
                ) : zones.map((z) => (
                  <Checkbox
                    key={z.id}
                    label={z.name}
                    checked={draft.zoneIds.includes(z.id)}
                    onChange={(v) => setDraft((d) => ({
                      ...d,
                      zoneIds: v ? [...d.zoneIds, z.id] : d.zoneIds.filter((x) => x !== z.id),
                    }))}
                  />
                ))}
              </div>
            </Field>
          )}

          {draft.scope === "STATE" && (
            <Field label="States">
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-ink-200 p-2">
                {INDIAN_STATES.map((s) => (
                  <Checkbox
                    key={s}
                    label={s}
                    checked={draft.states.includes(s)}
                    onChange={(v) => setDraft((d) => ({
                      ...d,
                      states: v ? [...d.states, s] : d.states.filter((x) => x !== s),
                    }))}
                  />
                ))}
              </div>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Pricing type">
              <Select
                value={draft.pricingType}
                onChange={(e) => setDraft((d) => ({ ...d, pricingType: e.target.value as TariffDraft["pricingType"] }))}
                options={TARIFF_PRICING_TYPES.map((p) => ({ value: p, label: TARIFF_PRICING_TYPE_LABEL[p] }))}
              />
            </Field>
            <Field label="Rate (₹, excl. GST)">
              <Input type="number" min={0} step={0.5} value={draft.rate} onChange={(e) => setDraft((d) => ({ ...d, rate: Number(e.target.value) || 0 }))} />
            </Field>
            <Field label="GST %">
              <Input type="number" min={0} max={28} value={draft.gstPct} onChange={(e) => setDraft((d) => ({ ...d, gstPct: Number(e.target.value) || 0 }))} />
            </Field>
          </div>

          <Field label="Platform fee (₹, flat, excl. GST)" hint="Added to every session this tariff prices, on top of the rate above.">
            <Input type="number" min={0} value={draft.platformFeeInr} onChange={(e) => setDraft((d) => ({ ...d, platformFeeInr: Number(e.target.value) || 0 }))} />
          </Field>

          <Checkbox label="Only applies during a specific time window" checked={useTimeWindow} onChange={setUseTimeWindow} />

          {useTimeWindow && (
            <div className="space-y-3 rounded-lg bg-ink-50 p-3">
              <div>
                <p className="label mb-1.5">Days</p>
                <div className="flex flex-wrap gap-3">
                  {WEEKDAY_LABEL.map((label, i) => (
                    <Checkbox key={i} label={label} checked={(draft.timeWindow?.daysOfWeek ?? []).includes(i)} onChange={() => toggleDay(i)} />
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-ink-500">No days checked = every day.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Start time">
                  <Input
                    type="time"
                    value={`${String(Math.floor((draft.timeWindow?.startMinute ?? 0) / 60)).padStart(2, "0")}:${String((draft.timeWindow?.startMinute ?? 0) % 60).padStart(2, "0")}`}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      setDraft((d) => ({ ...d, timeWindow: { daysOfWeek: d.timeWindow?.daysOfWeek ?? [], startMinute: h * 60 + m, endMinute: d.timeWindow?.endMinute ?? 1440 } }));
                    }}
                  />
                </Field>
                <Field label="End time">
                  <Input
                    type="time"
                    value={`${String(Math.floor((draft.timeWindow?.endMinute ?? 1440) / 60) % 24).padStart(2, "0")}:${String((draft.timeWindow?.endMinute ?? 1440) % 60).padStart(2, "0")}`}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      setDraft((d) => ({ ...d, timeWindow: { daysOfWeek: d.timeWindow?.daysOfWeek ?? [], startMinute: d.timeWindow?.startMinute ?? 0, endMinute: h * 60 + m } }));
                    }}
                  />
                </Field>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
