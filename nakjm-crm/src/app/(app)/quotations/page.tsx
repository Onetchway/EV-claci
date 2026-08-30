"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileSignature, Plus } from "lucide-react";

import { Badge, Button, EmptyState, PageHeader, Select, StatCard } from "@/components/ui";
import { QUOTATION_STATUSES, type QuotationStatus } from "@/lib/constants";
import { subscribeQuotations } from "@/lib/db/quotations";
import type { Quotation } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR } from "@/lib/utils";

const OPEN_STATUSES: QuotationStatus[] = ["DRAFT", "SENT", "NEGOTIATION"];

export default function QuotationsPage() {
  const [rows, setRows] = useState<Quotation[] | null>(null);
  const [status, setStatus] = useState<QuotationStatus | "ALL">("ALL");

  useEffect(() => subscribeQuotations(setRows), []);

  const filtered = useMemo(() => (!rows ? [] : status === "ALL" ? rows : rows.filter((r) => r.status === status)), [rows, status]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      total: all.length,
      open: all.filter((q) => OPEN_STATUSES.includes(q.status)).length,
      value: all.reduce((s, q) => s + q.totalAmount, 0),
      approved: all.filter((q) => q.status === "APPROVED").length,
    };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Every quotation and its versions, across every project."
        actions={
          <>
            <Select value={status} className="w-auto" options={[{ value: "ALL", label: "All statuses" }, ...QUOTATION_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]} onChange={(e) => setStatus(e.target.value as QuotationStatus | "ALL")} />
            <Link href="/quotations/new"><Button variant="primary"><Plus className="h-4 w-4" /> New Quotation</Button></Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Quotations" value={stats.total} icon={<FileSignature className="h-4 w-4" />} />
        <StatCard label="Open" value={stats.open} />
        <StatCard label="Approved" value={stats.approved} tone="positive" />
        <StatCard label="Total value" value={formatCompactINR(stats.value)} />
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FileSignature className="h-8 w-8" />} title="No quotations yet" description="Create one here, or from a project's Quotations tab — either way it links to the project." action={<Link href="/quotations/new"><Button variant="primary"><Plus className="h-4 w-4" /> New Quotation</Button></Link>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No.</th>
                <th className="th">Project</th>
                <th className="th">Version</th>
                <th className="th">Status</th>
                <th className="th">Valid Until</th>
                <th className="th">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.id} className="border-t border-ink-100 hover:bg-ink-50">
                  <td className="td font-medium"><Link href={`/quotations/${q.id}`} className="text-brand-700 hover:underline">{q.quotationNo}</Link></td>
                  <td className="td"><Link href={`/projects/${q.projectId}`} className="text-ink-600 hover:underline">{q.projectName}</Link></td>
                  <td className="td">v{q.version}</td>
                  <td className="td"><Badge>{q.status.replace(/_/g, " ")}</Badge></td>
                  <td className="td">{formatDate(q.validUntil)}</td>
                  <td className="td">{formatINR(q.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
