"use client";

import { Trash2, Upload } from "lucide-react";

import { Select } from "@/components/ui";
import { AUTO_CALC_CATEGORIES, EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, type ExpenseCategory } from "@/lib/constants";
import { computeItemAmount, rateFor, type ExpenseItemDraft } from "@/lib/db/expenses";
import type { ExpenseRates } from "@/lib/types";

/** Shared editable expense-line-item grid, used by both the New Claim page and a DRAFT claim's own edit mode on its detail page. */
export function ExpenseItemsEditor({
  items, onChange, rates, uploadingIdx, onUpload,
}: {
  items: ExpenseItemDraft[];
  onChange: (next: ExpenseItemDraft[]) => void;
  rates: ExpenseRates;
  uploadingIdx: number | null;
  onUpload: (index: number, file: File) => void;
}) {
  function patchItem(i: number, patch: Partial<ExpenseItemDraft>) {
    onChange(items.map((row, idx) => {
      if (idx !== i) return row;
      const next = { ...row, ...patch };
      if ("category" in patch) {
        next.rate = AUTO_CALC_CATEGORIES.includes(next.category) ? rateFor(next.category, rates) : undefined;
        if (next.category !== "TRAVEL_BIKE" && next.category !== "TRAVEL_CAR") next.km = undefined;
      }
      next.amount = computeItemAmount(next.category, next.km, next.rate, next.amount);
      return next;
    }));
  }

  function removeItem(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-xs text-ink-500">
        No items yet. Add travel, hotel, daily allowance or other expenses.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        const autoCalc = AUTO_CALC_CATEGORIES.includes(it.category);
        const isTravel = it.category === "TRAVEL_BIKE" || it.category === "TRAVEL_CAR";
        return (
          <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-ink-200 p-2.5">
            <div className="col-span-6 sm:col-span-3">
              <label className="label">Category</label>
              <Select
                value={it.category}
                onChange={(e) => patchItem(i, { category: e.target.value as ExpenseCategory })}
                options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABEL[c] }))}
              />
            </div>
            <div className="col-span-6 sm:col-span-2">
              <label className="label">Date</label>
              <input
                type="date"
                value={it.date.toISOString().slice(0, 10)}
                onChange={(e) => patchItem(i, { date: e.target.value ? new Date(e.target.value) : new Date() })}
                className="input"
              />
            </div>
            <div className="col-span-12 sm:col-span-3">
              <label className="label">Description</label>
              <input value={it.description ?? ""} onChange={(e) => patchItem(i, { description: e.target.value })} className="input" />
            </div>
            {isTravel && (
              <div className="col-span-4 sm:col-span-1">
                <label className="label">Km</label>
                <input
                  type="number"
                  value={it.km ?? ""}
                  onChange={(e) => patchItem(i, { km: e.target.value ? Number(e.target.value) : undefined })}
                  className="input tabular-nums"
                />
              </div>
            )}
            <div className={isTravel ? "col-span-4 sm:col-span-2" : "col-span-6 sm:col-span-3"}>
              <label className="label">Amount (₹)</label>
              <input
                type="number"
                value={it.amount}
                disabled={autoCalc}
                onChange={(e) => patchItem(i, { amount: Number(e.target.value) || 0 })}
                className="input tabular-nums disabled:bg-ink-50 disabled:text-ink-500"
              />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <label className="label">Receipt</label>
              {it.receiptUrl ? (
                <a href={it.receiptUrl} target="_blank" rel="noreferrer" className="block truncate text-xs text-brand-700 hover:underline">{it.receiptName}</a>
              ) : (
                <label className="inline-flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-ink-300 bg-white px-2 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50">
                  <Upload className="h-3 w-3" /> {uploadingIdx === i ? "Uploading…" : "Upload"}
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
                    className="hidden"
                    disabled={uploadingIdx !== null}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(i, f); }}
                  />
                </label>
              )}
            </div>
            <div className="col-span-4 sm:col-span-1 flex justify-end">
              <button type="button" onClick={() => removeItem(i)} className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
