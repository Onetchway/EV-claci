"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Plus } from "lucide-react";

import { Badge, Button, EmptyState, PageHeader, Select, StatCard } from "@/components/ui";
import { ExportButton } from "@/components/export-button";
import { PI_STATUSES, type PiStatus } from "@/lib/constants";
import { subscribeProformaInvoices } from "@/lib/db/proforma-invoices";
import type { ProformaInvoice } from "@/lib/types";
import { formatCompactINR, formatINR } from "@/lib/utils";

export default function ProformaInvoicesPage() {
  const [rows, setRows] = useState<ProformaInvoice[] | null>(null);
  const [status, setStatus] = useState<PiStatus | "ALL">("ALL");

  useEffect(() => subscribeProformaInvoices(setRows), []);

  const filtered = useMemo(() => (!rows ? [] : status === "ALL" ? rows : rows.filter((r) => r.status === status)), [rows, status]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      total: all.length,
      value: all.reduce((s, p) => s + p.totalAmount, 0),
      collected: all.reduce((s, p) => s + p.paidAmount, 0),
      outstanding: all.reduce((s, p) => s + Math.max(p.totalAmount - p.paidAmount, 0), 0),
    };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Proforma Invoices"
        description="Every PI raised against a client, across every project."
        actions={
          <>
            <Select value={status} className="w-auto" options={[{ value: "ALL", label: "All statuses" }, ...PI_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]} onChange={(e) => setStatus(e.target.value as PiStatus | "ALL")} />
            <ExportButton
              filename="proforma-invoices"
              sheetName="Proforma Invoices"
              rows={filtered.map((pi) => ({
                "PI No.": pi.piNo, Project: pi.projectName, Milestone: pi.milestone ?? "", Status: pi.status.replace(/_/g, " "),
                Total: pi.totalAmount, Paid: pi.paidAmount,
              }))}
            />
            <Link href="/proforma-invoices/new"><Button variant="primary"><Plus className="h-4 w-4" /> New PI</Button></Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Proforma invoices" value={stats.total} icon={<FileSpreadsheet className="h-4 w-4" />} />
        <StatCard label="Total value" value={formatCompactINR(stats.value)} />
        <StatCard label="Collected" value={formatCompactINR(stats.collected)} tone="positive" />
        <StatCard label="Outstanding" value={formatCompactINR(stats.outstanding)} tone="negative" />
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FileSpreadsheet className="h-8 w-8" />} title="No proforma invoices yet" description="Create one here, or from a project's Proforma Invoices tab — either way it links to the project." action={<Link href="/proforma-invoices/new"><Button variant="primary"><Plus className="h-4 w-4" /> New PI</Button></Link>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No.</th>
                <th className="th">Project</th>
                <th className="th">Milestone</th>
                <th className="th">Status</th>
                <th className="th">Total</th>
                <th className="th">Paid</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pi) => (
                <tr key={pi.id} className="border-t border-ink-100 hover:bg-ink-50">
                  <td className="td font-medium"><Link href={`/proforma-invoices/${pi.id}`} className="text-brand-700 hover:underline">{pi.piNo}</Link></td>
                  <td className="td"><Link href={`/projects/${pi.projectId}`} className="text-ink-600 hover:underline">{pi.projectName}</Link></td>
                  <td className="td">{pi.milestone || "—"}</td>
                  <td className="td"><Badge>{pi.status.replace(/_/g, " ")}</Badge></td>
                  <td className="td">{formatINR(pi.totalAmount)}</td>
                  <td className="td text-emerald-600">{formatINR(pi.paidAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
