"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Plus } from "lucide-react";

import { Badge, Button, EmptyState, PageHeader, Select, StatCard } from "@/components/ui";
import { ExportButton } from "@/components/export-button";
import { PI_STATUSES, type PiStatus } from "@/lib/constants";
import { subscribeProformaInvoices } from "@/lib/db/proforma-invoices";
import type { ProformaInvoice } from "@/lib/types";
import { formatCompactINR, formatINR, MONTH_NAMES, toDate } from "@/lib/utils";

export default function ProformaInvoicesPage() {
  const [rows, setRows] = useState<ProformaInvoice[] | null>(null);
  const [status, setStatus] = useState<PiStatus | "ALL">("ALL");
  const [year, setYear] = useState<string>("ALL");
  const [month, setMonth] = useState<string>("ALL");
  const [projectId, setProjectId] = useState<string>("ALL");

  useEffect(() => subscribeProformaInvoices(setRows), []);

  const years = useMemo(() => {
    const s = new Set<number>();
    (rows ?? []).forEach((r) => { const d = toDate(r.piDate); if (d) s.add(d.getFullYear()); });
    return [...s].sort((a, b) => b - a);
  }, [rows]);
  const projects = useMemo(() => {
    const m = new Map<string, string>();
    (rows ?? []).forEach((r) => { if (r.projectId) m.set(r.projectId, r.projectName); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (projectId !== "ALL" && r.projectId !== projectId) return false;
      const d = toDate(r.piDate);
      if (year !== "ALL" && (!d || d.getFullYear() !== Number(year))) return false;
      if (month !== "ALL" && (!d || d.getMonth() !== Number(month))) return false;
      return true;
    });
  }, [rows, status, year, month, projectId]);

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

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={status} className="w-auto" options={[{ value: "ALL", label: "All statuses" }, ...PI_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]} onChange={(e) => setStatus(e.target.value as PiStatus | "ALL")} />
        <Select value={year} className="w-auto" options={[{ value: "ALL", label: "All years" }, ...years.map((y) => ({ value: String(y), label: String(y) }))]} onChange={(e) => setYear(e.target.value)} />
        <Select value={month} className="w-auto" options={[{ value: "ALL", label: "All months" }, ...MONTH_NAMES.map((m, i) => ({ value: String(i), label: m }))]} onChange={(e) => setMonth(e.target.value)} />
        <Select value={projectId} className="w-auto" options={[{ value: "ALL", label: "All projects" }, ...projects.map(([id, name]) => ({ value: id, label: name }))]} onChange={(e) => setProjectId(e.target.value)} />
      </div>

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
