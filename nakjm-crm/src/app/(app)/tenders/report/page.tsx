"use client";

import { useEffect, useMemo, useState } from "react";

import { PrintFooter, PrintHeader, PrintSheet, PrintToolbar } from "@/components/print-document";
import { TENDER_STATUS_META, TENDER_STATUSES } from "@/lib/constants";
import { subscribeTenders } from "@/lib/db/tenders";
import type { Tender } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR } from "@/lib/utils";

const DECIDED = new Set(["AWARDED", "LOST"]);

export default function TenderReportPage() {
  const [tenders, setTenders] = useState<Tender[] | null>(null);

  useEffect(() => subscribeTenders({}, setTenders), []);

  const stats = useMemo(() => {
    const all = tenders ?? [];
    const decided = all.filter((t) => DECIDED.has(t.status));
    const awarded = all.filter((t) => t.status === "AWARDED");
    return {
      total: all.length,
      totalValue: all.reduce((s, t) => s + (t.tenderValue ?? 0), 0),
      awardedValue: awarded.reduce((s, t) => s + (t.tenderValue ?? 0), 0),
      winRate: decided.length ? Math.round((awarded.length / decided.length) * 100) : 0,
      byStatus: TENDER_STATUSES.map((s) => ({ status: s, count: all.filter((t) => t.status === s).length })),
    };
  }, [tenders]);

  return (
    <div>
      <PrintToolbar backHref="/tenders" />
      <PrintSheet>
        <PrintHeader
          docLabel="Tender Report"
          docNumber={`As of ${formatDate(new Date())}`}
          meta={<p className="mt-0.5 text-[11px] text-ink-400">Win rate: {stats.winRate}% of decided tenders</p>}
        />

        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div><p className="text-xs text-ink-500">Total Tenders</p><p className="text-lg font-semibold text-ink-900">{stats.total}</p></div>
          <div><p className="text-xs text-ink-500">Total Value</p><p className="text-lg font-semibold text-ink-900">{formatCompactINR(stats.totalValue)}</p></div>
          <div><p className="text-xs text-ink-500">Awarded Value</p><p className="text-lg font-semibold text-emerald-700">{formatCompactINR(stats.awardedValue)}</p></div>
          <div><p className="text-xs text-ink-500">Win Rate</p><p className="text-lg font-semibold text-ink-900">{stats.winRate}%</p></div>
        </div>

        <div className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">By Status</h2>
          <div className="flex flex-wrap gap-3 text-sm">
            {stats.byStatus.filter((s) => s.count > 0).map((s) => (
              <span key={s.status} className="rounded-full bg-ink-100 px-3 py-1 text-ink-700">{TENDER_STATUS_META[s.status].label}: {s.count}</span>
            ))}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="pb-2">Code</th>
                <th className="pb-2">Title</th>
                <th className="pb-2">Client</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Value</th>
                <th className="pb-2">Submission</th>
              </tr>
            </thead>
            <tbody>
              {(tenders ?? []).map((t) => (
                <tr key={t.id} className="border-b border-ink-100">
                  <td className="py-2">{t.tenderCode}</td>
                  <td className="py-2">{t.title}</td>
                  <td className="py-2 text-ink-500">{t.clientName}</td>
                  <td className="py-2 text-ink-500">{TENDER_STATUS_META[t.status].label}</td>
                  <td className="py-2 text-right tabular-nums">{formatINR(t.tenderValue ?? 0)}</td>
                  <td className="py-2 text-ink-500">{t.submissionDate ? formatDate(t.submissionDate) : "—"}</td>
                </tr>
              ))}
              {(tenders ?? []).length === 0 && <tr><td colSpan={6} className="py-6 text-center text-ink-400">No tenders yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <PrintFooter />
      </PrintSheet>
    </div>
  );
}
