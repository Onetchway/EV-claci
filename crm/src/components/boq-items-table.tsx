"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button, Select } from "@/components/ui";
import { BOQ_CATEGORIES, BOQ_CATEGORY_LABEL, type BoqCategory } from "@/lib/constants";
import type { BoqLineItem } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export type DraftBoqItem = Omit<BoqLineItem, "amount" | "srNo" | "rate"> & { amount?: number; srNo?: number; rate?: number };

function blankItem(): DraftBoqItem {
  return { description: "", unit: "", qty: 1, supplyRate: 0, installationRate: 0, category: "OTHER" };
}

/** Editable BOQ line-items grid — add/edit/remove rows, grouped visually by `section` when present. Ported from nakjm-crm's ItemsTable/BOQ_FIELDS, rebuilt against crm's own row-card pattern (see ExtrasEditor in charger-configurator.tsx) rather than its generic table component. */
export function BoqItemsTable({
  items, onChange, disabled,
}: {
  items: DraftBoqItem[];
  onChange: (next: DraftBoqItem[]) => void;
  disabled?: boolean;
}) {
  const add = () => { if (!disabled) onChange([...items, blankItem()]); };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const patch = (i: number, p: Partial<DraftBoqItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));

  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * ((Number(it.supplyRate) || 0) + (Number(it.installationRate) || 0)), 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] text-ink-500">Supply + installation rate × qty = line amount.</p>
        <Button size="sm" onClick={add} disabled={disabled}><Plus className="h-3.5 w-3.5" /> Add line</Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-xs text-ink-500">
          No line items yet. Add one, or import from Excel above.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => {
            const amount = (Number(it.qty) || 0) * ((Number(it.supplyRate) || 0) + (Number(it.installationRate) || 0));
            return (
              <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-ink-200 p-2.5">
                {it.section && <div className="col-span-12 text-[10px] font-semibold uppercase tracking-wide text-ink-400">{it.section}</div>}
                <div className="col-span-12 sm:col-span-4">
                  <label className="label">Description</label>
                  <input
                    value={it.description}
                    disabled={disabled}
                    onChange={(e) => patch(i, { description: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="label">Make/OEM</label>
                  <input value={it.makeOem ?? ""} disabled={disabled} onChange={(e) => patch(i, { makeOem: e.target.value })} className="input" />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <label className="label">Unit</label>
                  <input value={it.unit ?? ""} disabled={disabled} onChange={(e) => patch(i, { unit: e.target.value })} className="input" />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <label className="label">Qty</label>
                  <input
                    type="number"
                    value={it.qty}
                    disabled={disabled}
                    onChange={(e) => patch(i, { qty: Math.max(0, Number(e.target.value) || 0) })}
                    className="input tabular-nums"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="label">Supply rate</label>
                  <input
                    type="number"
                    value={it.supplyRate ?? 0}
                    disabled={disabled}
                    onChange={(e) => patch(i, { supplyRate: Number(e.target.value) || 0 })}
                    className="input tabular-nums"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="label">Install rate</label>
                  <input
                    type="number"
                    value={it.installationRate ?? 0}
                    disabled={disabled}
                    onChange={(e) => patch(i, { installationRate: Number(e.target.value) || 0 })}
                    className="input tabular-nums"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="label">Category</label>
                  <Select
                    value={it.category}
                    disabled={disabled}
                    onChange={(e) => patch(i, { category: e.target.value as BoqCategory })}
                    options={BOQ_CATEGORIES.map((c) => ({ value: c, label: BOQ_CATEGORY_LABEL[c] }))}
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label className="label">Remarks</label>
                  <input value={it.remarks ?? ""} disabled={disabled} onChange={(e) => patch(i, { remarks: e.target.value })} className="input" />
                </div>
                <div className="col-span-4 sm:col-span-2 text-right text-xs text-ink-600 tabular-nums">{formatINR(amount)}</div>
                <div className="col-span-4 sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    disabled={disabled}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-2 flex justify-end text-sm font-semibold text-navy-900">Total: {formatINR(total)}</div>
      )}
    </div>
  );
}
