"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui";
import type { BoqLineItem, LineItem } from "@/lib/types";

export function ItemsTable<T extends Record<string, unknown>>({
  items, setItems, fields,
}: {
  items: T[];
  setItems: (items: T[]) => void;
  fields: { key: keyof T; label: string; type?: string }[];
}) {
  const addRow = () => setItems([...items, Object.fromEntries(fields.map((f) => [f.key, f.type === "number" ? 0 : ""])) as T]);
  const update = (i: number, key: keyof T, value: string) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-ink-200">
        <table className="w-full">
          <thead><tr>{fields.map((f) => <th key={String(f.key)} className="th py-3 text-sm">{f.label}</th>)}<th className="th" /></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-t border-ink-100">
                {fields.map((f) => (
                  <td key={String(f.key)} className="td p-2">
                    <input
                      className="input py-2.5 text-base"
                      type={f.type ?? "text"}
                      value={(it[f.key] as string | number) ?? ""}
                      onChange={(e) => update(i, f.key, e.target.value)}
                    />
                  </td>
                ))}
                <td className="td p-2"><button type="button" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-rose-500" /></button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={fields.length + 1} className="td text-center text-ink-400">No line items yet.</td></tr>}
          </tbody>
        </table>
      </div>
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
