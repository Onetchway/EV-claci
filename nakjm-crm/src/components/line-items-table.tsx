"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui";
import type { BoqLineItem, LineItem } from "@/lib/types";
import { formatINR } from "@/lib/utils";

/**
 * Each line item renders as its own full-width block, description on its own
 * full-width auto-growing textarea line (Odoo's product-line editor look),
 * with the remaining fields (qty/unit/rate/etc.) laid out in a compact grid
 * beneath it -- rather than cramming every field into equal-width table
 * columns, where description had no room to be read while typing.
 */
export function ItemsTable<T extends Record<string, unknown>>({
  items, setItems, fields,
}: {
  items: T[];
  setItems: (items: T[]) => void;
  fields: { key: keyof T; label: string; type?: string }[];
}) {
  const descField = fields.find((f) => f.key === "description");
  const otherFields = fields.filter((f) => f.key !== "description");
  // Qty defaults to 1, not 0 -- a fresh row left at qty 0 silently zeroes out its amount (qty x rate) with no visible warning.
  const showAmount = fields.some((f) => f.key === "qty") && fields.some((f) => f.key === "rate");

  const addRow = () => setItems([...items, Object.fromEntries(fields.map((f) => [f.key, f.key === "qty" ? 1 : f.type === "number" ? 0 : ""])) as T]);
  const update = (i: number, key: keyof T, value: string) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="rounded-xl border border-ink-200 p-3">
          <div className="flex items-start gap-2">
            {descField && (
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500">{descField.label}</label>
                <textarea
                  className="input min-h-[4.5rem] resize-y py-2.5 text-base"
                  rows={3}
                  value={(it[descField.key] as string) ?? ""}
                  onChange={(e) => update(i, descField.key, e.target.value)}
                />
              </div>
            )}
            <button type="button" className="mt-6 shrink-0" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4 text-rose-500" />
            </button>
          </div>
          {otherFields.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
              {otherFields.map((f) => (
                <div key={String(f.key)}>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-500">{f.label}</label>
                  <input
                    className="input py-2.5 text-base"
                    type={f.type ?? "text"}
                    value={(it[f.key] as string | number) ?? ""}
                    onChange={(e) => update(i, f.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
          {showAmount && (
            <p className="mt-2 text-right text-xs text-ink-500">
              Amount: <span className={`font-semibold tabular-nums ${(Number(it.qty) || 0) * (Number(it.rate) || 0) ? "text-ink-800" : "text-rose-600"}`}>{formatINR((Number(it.qty) || 0) * (Number(it.rate) || 0))}</span>
              {!(Number(it.qty) || 0) && " — Qty is 0, so this line adds nothing to the total."}
            </p>
          )}
        </div>
      ))}
      {items.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-200 py-8 text-center text-sm text-ink-400">No line items yet.</div>
      )}
      <Button type="button" variant="secondary" size="sm" onClick={addRow}><Plus className="h-3.5 w-3.5" /> Add Line</Button>
    </div>
  );
}

export const ITEM_FIELDS = [
  { key: "description" as const, label: "Description" },
  { key: "unit" as const, label: "Unit" },
  { key: "qty" as const, label: "Qty", type: "number" },
  { key: "rate" as const, label: "Rate (₹)", type: "number" },
];
export const QUOTATION_ITEM_FIELDS = [
  { key: "description" as const, label: "Description" },
  { key: "unit" as const, label: "Unit" },
  { key: "qty" as const, label: "Qty", type: "number" },
  { key: "rate" as const, label: "Rate (₹)", type: "number" },
  { key: "hsnCode" as const, label: "HSN/SAC" },
];
export const PO_ITEM_FIELDS = [
  { key: "description" as const, label: "Description" },
  { key: "unit" as const, label: "Unit" },
  { key: "qty" as const, label: "Qty", type: "number" },
  { key: "rate" as const, label: "Unit Price (₹)", type: "number" },
  { key: "gstPercent" as const, label: "GST %", type: "number" },
  { key: "hsnCode" as const, label: "HSN/SAC" },
];
export const BOQ_FIELDS = [
  { key: "section" as const, label: "Section" },
  { key: "description" as const, label: "Description" },
  { key: "makeOem" as const, label: "Make/OEM" },
  { key: "unit" as const, label: "Unit" },
  { key: "qty" as const, label: "Qty", type: "number" },
  { key: "supplyRate" as const, label: "Supply Rate", type: "number" },
  { key: "installationRate" as const, label: "Install Rate", type: "number" },
  { key: "remarks" as const, label: "Remarks" },
];

export type DraftItem = Omit<LineItem, "amount" | "srNo">;
export type DraftBoqItem = Omit<BoqLineItem, "amount" | "srNo" | "rate" | "category"> & { category?: string };
