"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge, Card, StatCard } from "@/components/ui";
import { subscribeLead } from "@/lib/db/leads";
import { EOI_STATUS_LABEL, LEAD_TYPE_LABEL, STAGE_META, STATUS_COLOR, STATUS_LABEL } from "@/lib/constants";
import type { Lead } from "@/lib/types";
import { formatCompactINR } from "@/lib/utils";

/**
 * "Show me everything this person has bought" — every lead linked to this
 * one (an investor can hold several franchises, at once or over time; see
 * the "Add another installation" flow) rolled up in one place: how many,
 * combined value, combined paid/due, and a row per franchise so staff don't
 * have to click through each linked lead one at a time to answer "where do
 * they stand overall."
 */
export function InvestorProfile({ lead }: { lead: Lead }) {
  const linkedIds = (lead.linkedLeads ?? []).map((l) => l.id);
  const [linked, setLinked] = useState<Map<string, Lead | null>>(new Map());

  useEffect(() => {
    const unsubs = linkedIds.map((id) => subscribeLead(id, (l) => setLinked((m) => new Map(m).set(id, l))));
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedIds.join(",")]);

  if (linkedIds.length === 0) return null;

  const rows = [lead, ...linkedIds.map((id) => linked.get(id)).filter((l): l is Lead => Boolean(l))];
  const totalValue = rows.reduce((a, r) => a + (r.value ?? 0), 0);
  const totalPaid = rows.reduce((a, r) => a + (r.paidAmount ?? 0), 0);
  const totalDue = rows.reduce((a, r) => a + (r.dueAmount ?? Math.max(0, (r.value ?? 0) - (r.paidAmount ?? 0))), 0);
  const stillLoading = rows.length < linkedIds.length + 1;

  return (
    <Card
      title={`${lead.client?.name ?? "This client"}'s profile`}
      subtitle={`${rows.length} lead${rows.length === 1 ? "" : "s"} linked together${stillLoading ? " — loading…" : ""}`}
      className="mb-4 print:hidden"
    >
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total leads" value={rows.length} />
        <StatCard label="Combined value" value={formatCompactINR(totalValue)} />
        <StatCard label="Total paid" value={formatCompactINR(totalPaid)} tone="positive" />
        <StatCard label="Total due" value={formatCompactINR(totalDue)} tone={totalDue > 0 ? "negative" : "default"} />
      </div>

      <div className="overflow-x-auto scroll-thin">
        <table className="w-full">
          <thead className="border-b border-ink-200">
            <tr>
              <th className="th">Lead</th>
              <th className="th">Type</th>
              <th className="th">Stage</th>
              <th className="th">EOI</th>
              <th className="th text-right">Value</th>
              <th className="th text-right">Paid</th>
              <th className="th text-right">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => {
              const stage = STAGE_META[r.stage];
              const due = r.dueAmount ?? Math.max(0, (r.value ?? 0) - (r.paidAmount ?? 0));
              return (
                <tr key={r.id} className={r.id === lead.id ? "bg-brand-50/40" : undefined}>
                  <td className="td">
                    <Link href={`/leads/${r.id}`} className="hover:text-brand-700">
                      <span className="block text-sm font-medium text-ink-900">{r.code}{r.id === lead.id ? " (this lead)" : ""}</span>
                      {r.site?.locationName && <span className="block text-xs text-ink-500">{r.site.locationName}</span>}
                    </Link>
                  </td>
                  <td className="td text-ink-600">{LEAD_TYPE_LABEL[r.type]}</td>
                  <td className="td">
                    <Badge className={stage.color}>{stage.short}</Badge>
                    {r.status !== "ACTIVE" && <Badge className={`ml-1 ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</Badge>}
                  </td>
                  <td className="td text-ink-600">{r.eoi ? EOI_STATUS_LABEL[r.eoi.status] : "—"}</td>
                  <td className="td text-right tabular-nums">{formatCompactINR(r.value)}</td>
                  <td className="td text-right tabular-nums text-emerald-700">{formatCompactINR(r.paidAmount ?? 0)}</td>
                  <td className="td text-right tabular-nums">{due > 0 ? formatCompactINR(due) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
