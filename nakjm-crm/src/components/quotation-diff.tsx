"use client";

import { Badge } from "@/components/ui";
import type { LineItem, Quotation } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

function itemKey(item: LineItem): string {
  return `${item.description}__${item.unit ?? ""}`;
}

/** Line-by-line and header diff between two versions of the same quotation. */
export function QuotationDiff({ from, to }: { from: Quotation; to: Quotation }) {
  const fromByKey = new Map(from.items.map((it) => [itemKey(it), it]));
  const toByKey = new Map(to.items.map((it) => [itemKey(it), it]));
  const allKeys = Array.from(new Set([...fromByKey.keys(), ...toByKey.keys()]));

  const headerDiffs: { label: string; from: string; to: string }[] = [
    { label: "Status", from: from.status, to: to.status },
    { label: "Total", from: formatINR(from.totalAmount), to: formatINR(to.totalAmount) },
    { label: "Tax %", from: `${from.taxPercent}%`, to: `${to.taxPercent}%` },
    { label: "Valid until", from: from.validUntil ? formatDate(from.validUntil) : "—", to: to.validUntil ? formatDate(to.validUntil) : "—" },
    { label: "Terms", from: from.terms || "—", to: to.terms || "—" },
  ].filter((d) => d.from !== d.to);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-ink-500">
        <Badge>v{from.version}</Badge> <span>vs</span> <Badge>v{to.version}</Badge>
      </div>

      {headerDiffs.length > 0 && (
        <div>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Changed fields</h3>
          <div className="overflow-x-auto rounded-lg border border-ink-200">
            <table className="w-full text-sm">
              <thead><tr className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500"><th className="px-3 py-2">Field</th><th className="px-3 py-2">v{from.version}</th><th className="px-3 py-2">v{to.version}</th></tr></thead>
              <tbody>
                {headerDiffs.map((d) => (
                  <tr key={d.label} className="border-t border-ink-100">
                    <td className="px-3 py-2 font-medium text-ink-700">{d.label}</td>
                    <td className="px-3 py-2 text-rose-600">{d.from}</td>
                    <td className="px-3 py-2 text-emerald-600">{d.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Line items</h3>
        <div className="overflow-x-auto rounded-lg border border-ink-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Qty (v{from.version} → v{to.version})</th>
                <th className="px-3 py-2 text-right">Rate (v{from.version} → v{to.version})</th>
                <th className="px-3 py-2 text-right">Amount (v{from.version} → v{to.version})</th>
              </tr>
            </thead>
            <tbody>
              {allKeys.map((key) => {
                const a = fromByKey.get(key);
                const b = toByKey.get(key);
                const added = !a && b;
                const removed = a && !b;
                const changed = a && b && (a.qty !== b.qty || a.rate !== b.rate);
                const rowClass = added ? "bg-emerald-50" : removed ? "bg-rose-50" : changed ? "bg-amber-50" : "";
                return (
                  <tr key={key} className={`border-t border-ink-100 ${rowClass}`}>
                    <td className="px-3 py-2">
                      {(b ?? a)!.description}
                      {added && <span className="ml-2 text-xs font-medium text-emerald-700">Added</span>}
                      {removed && <span className="ml-2 text-xs font-medium text-rose-700">Removed</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{a ? a.qty : "—"} → {b ? b.qty : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a ? formatINR(a.rate) : "—"} → {b ? formatINR(b.rate) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a ? formatINR(a.amount) : "—"} → {b ? formatINR(b.amount) : "—"}</td>
                  </tr>
                );
              })}
              {allKeys.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-ink-400">No line items.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
