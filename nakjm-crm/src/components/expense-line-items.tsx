"use client";

import { useRef } from "react";
import { Plus, Receipt, Trash2, Upload } from "lucide-react";

import { Button, Field, Input, Select, Spinner } from "@/components/ui";
import { DISTANCE_BASED_EXPENSE_CATEGORIES, EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, type ExpenseCategory } from "@/lib/constants";
import type { ExpenseLineItemInput } from "@/lib/db/expenses";
import type { ExpensePolicy } from "@/lib/db/settings";
import { formatINR } from "@/lib/utils";

function toDateInput(v: Date | null): string {
  return v ? v.toISOString().slice(0, 10) : "";
}

function rateFor(category: ExpenseCategory, policy: ExpensePolicy): number {
  if (category === "TRAVEL_BIKE") return policy.bikeRatePerKm;
  if (category === "TRAVEL_CAR") return policy.carRatePerKm;
  return 0;
}

/**
 * The editable list of expense line items on an expense report -- each row's category decides
 * whether it takes a distance (auto-computing the amount from Settings -> Expense policy) or a
 * direct amount, plus an optional receipt upload per line.
 */
export function ExpenseLineItemsField({
  value, onChange, policy, uploading, onUpload,
}: {
  value: ExpenseLineItemInput[];
  onChange: (v: ExpenseLineItemInput[]) => void;
  policy: ExpensePolicy;
  uploading: number | null;
  onUpload: (index: number, file: File) => void;
}) {
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  function update(i: number, patch: Partial<ExpenseLineItemInput>) {
    onChange(value.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function setCategory(i: number, category: ExpenseCategory) {
    const distanceBased = DISTANCE_BASED_EXPENSE_CATEGORIES.includes(category);
    update(i, { category, ratePerKm: distanceBased ? rateFor(category, policy) : undefined, amount: distanceBased ? (value[i].distanceKm ?? 0) * rateFor(category, policy) : value[i].amount });
  }
  function setDistance(i: number, distanceKm: number) {
    const rate = rateFor(value[i].category, policy);
    update(i, { distanceKm, ratePerKm: rate, amount: distanceKm * rate });
  }

  return (
    <div className="space-y-3">
      {value.map((it, i) => {
        const distanceBased = DISTANCE_BASED_EXPENSE_CATEGORIES.includes(it.category);
        return (
          <div key={i} className="rounded-xl border border-ink-200 p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              <div className="col-span-2 sm:col-span-2">
                <label className="mb-1 block text-[11px] font-semibold uppercase text-ink-500">Category</label>
                <Select value={it.category} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABEL[c] }))} onChange={(e) => setCategory(i, e.target.value as ExpenseCategory)} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-ink-500">Date</label>
                <Input type="date" value={toDateInput(it.date)} onChange={(e) => update(i, { date: e.target.value ? new Date(e.target.value) : null })} />
              </div>
              {distanceBased ? (
                <>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-ink-500">Distance (km)</label>
                    <Input type="number" value={it.distanceKm ?? ""} onChange={(e) => setDistance(i, Number(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-ink-500">Rate (₹/km)</label>
                    <Input type="number" value={it.ratePerKm ?? 0} disabled />
                  </div>
                </>
              ) : (
                <div className="col-span-2">
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-ink-500">Amount (₹)</label>
                  <Input type="number" value={it.amount ?? ""} onChange={(e) => update(i, { amount: Number(e.target.value) || 0 })} />
                </div>
              )}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-ink-500">Amount</label>
                <p className="input flex items-center justify-end bg-ink-50 font-medium tabular-nums">{formatINR(it.amount || 0)}</p>
              </div>
            </div>
            <div className="mt-2">
              <Field label="Description"><Input value={it.description ?? ""} onChange={(e) => update(i, { description: e.target.value })} placeholder="What was this for…" /></Field>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <input ref={(el) => { fileInputs.current[i] = el; }} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(i, f); e.target.value = ""; }} />
                <Button type="button" variant="secondary" size="sm" disabled={uploading === i} onClick={() => fileInputs.current[i]?.click()}>
                  {uploading === i ? <Spinner className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />} {it.receiptUrl ? "Replace receipt" : "Upload receipt"}
                </Button>
                {it.receiptUrl && (
                  <a href={it.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                    <Receipt className="h-3.5 w-3.5" /> View
                  </a>
                )}
              </div>
              <button type="button" className="text-ink-400 hover:text-rose-600" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        );
      })}
      <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...value, { category: "OTHER", date: new Date(), amount: 0 }])}>
        <Plus className="h-3.5 w-3.5" /> Add expense
      </Button>
    </div>
  );
}
