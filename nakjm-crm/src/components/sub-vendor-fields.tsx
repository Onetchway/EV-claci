"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button, Field, Input, Select } from "@/components/ui";
import { STAGE_STATUSES, STAGE_STATUS_META, SUB_VENDOR_PAYMENT_STATUSES, SUB_VENDOR_PAYMENT_STATUS_META } from "@/lib/constants";
import type { SubVendorPaymentTermInput, SubVendorStageInput } from "@/lib/db/sub-vendors";

function toDateInput(v: Date | null | undefined): string {
  return v ? v.toISOString().slice(0, 10) : "";
}

/** The work stages within one sub-vendor contract -- its own mini timeline, edited inline as a list of rows. */
export function SubVendorStagesField({ value, onChange }: { value: SubVendorStageInput[]; onChange: (v: SubVendorStageInput[]) => void }) {
  function update(i: number, patch: Partial<SubVendorStageInput>) {
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  return (
    <Field label="Stages" hint="The sub-vendor's own work breakdown for this contract, each with its own timeline and status.">
      <div className="space-y-2">
        {value.map((s, i) => (
          <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-ink-200 p-2.5">
            <div className="col-span-4"><label className="mb-1 block text-[11px] font-semibold uppercase text-ink-500">Stage name</label><Input value={s.name} onChange={(e) => update(i, { name: e.target.value })} /></div>
            <div className="col-span-2"><label className="mb-1 block text-[11px] font-semibold uppercase text-ink-500">Start</label><Input type="date" value={toDateInput(s.startDate)} onChange={(e) => update(i, { startDate: e.target.value ? new Date(e.target.value) : null })} /></div>
            <div className="col-span-2"><label className="mb-1 block text-[11px] font-semibold uppercase text-ink-500">Deadline</label><Input type="date" value={toDateInput(s.endDate)} onChange={(e) => update(i, { endDate: e.target.value ? new Date(e.target.value) : null })} /></div>
            <div className="col-span-2"><label className="mb-1 block text-[11px] font-semibold uppercase text-ink-500">Amount (₹)</label><Input type="number" value={s.amount ?? ""} onChange={(e) => update(i, { amount: Number(e.target.value) || 0 })} /></div>
            <div className="col-span-1"><label className="mb-1 block text-[11px] font-semibold uppercase text-ink-500">Status</label><Select value={s.status} options={STAGE_STATUSES.map((st) => ({ value: st, label: STAGE_STATUS_META[st].label }))} onChange={(e) => update(i, { status: e.target.value as SubVendorStageInput["status"] })} /></div>
            <button type="button" className="col-span-1 flex justify-center pb-2 text-ink-400 hover:text-rose-600" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...value, { name: "", status: "NOT_STARTED" }])}>
          <Plus className="h-3.5 w-3.5" /> Add stage
        </Button>
      </div>
    </Field>
  );
}

/** The payment schedule owed to a sub-vendor -- % or a fixed amount per milestone, mirroring how a PI bills a client. */
export function SubVendorPaymentTermsField({ value, onChange }: { value: SubVendorPaymentTermInput[]; onChange: (v: SubVendorPaymentTermInput[]) => void }) {
  function update(i: number, patch: Partial<SubVendorPaymentTermInput>) {
    onChange(value.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  return (
    <Field label="Payment terms" hint="What NAKJM owes this sub-vendor and when -- e.g. 30% advance, 40% on completion of stage X, 30% final.">
      <div className="space-y-2">
        {value.map((t, i) => (
          <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-ink-200 p-2.5">
            <div className="col-span-5"><label className="mb-1 block text-[11px] font-semibold uppercase text-ink-500">Milestone</label><Input value={t.milestone} onChange={(e) => update(i, { milestone: e.target.value })} /></div>
            <div className="col-span-2"><label className="mb-1 block text-[11px] font-semibold uppercase text-ink-500">%</label><Input type="number" value={t.percent ?? ""} onChange={(e) => update(i, { percent: Number(e.target.value) || undefined })} /></div>
            <div className="col-span-2"><label className="mb-1 block text-[11px] font-semibold uppercase text-ink-500">Amount (₹)</label><Input type="number" value={t.amount ?? ""} onChange={(e) => update(i, { amount: Number(e.target.value) || undefined })} /></div>
            <div className="col-span-2"><label className="mb-1 block text-[11px] font-semibold uppercase text-ink-500">Status</label><Select value={t.status} options={SUB_VENDOR_PAYMENT_STATUSES.map((s) => ({ value: s, label: SUB_VENDOR_PAYMENT_STATUS_META[s].label }))} onChange={(e) => update(i, { status: e.target.value as SubVendorPaymentTermInput["status"] })} /></div>
            <button type="button" className="col-span-1 flex justify-center pb-2 text-ink-400 hover:text-rose-600" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...value, { milestone: "", status: "PENDING" }])}>
          <Plus className="h-3.5 w-3.5" /> Add payment term
        </Button>
      </div>
    </Field>
  );
}
