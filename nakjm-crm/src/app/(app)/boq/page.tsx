"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";

import { Badge, Button, EmptyState, PageHeader, Select, StatCard } from "@/components/ui";
import { ExportButton } from "@/components/export-button";
import { BOQ_CATEGORIES, BOQ_STATUSES, type BoqCategory, type BoqStatus } from "@/lib/constants";
import { subscribeBoqs } from "@/lib/db/boq";
import type { Boq } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR, MONTH_NAMES, toDate } from "@/lib/utils";

export default function BoqListPage() {
  const [rows, setRows] = useState<Boq[] | null>(null);
  const [status, setStatus] = useState<BoqStatus | "ALL">("ALL");
  const [year, setYear] = useState<string>("ALL");
  const [month, setMonth] = useState<string>("ALL");
  const [projectId, setProjectId] = useState<string>("ALL");
  const [category, setCategory] = useState<BoqCategory | "ALL">("ALL");

  useEffect(() => subscribeBoqs(setRows), []);

  const years = useMemo(() => {
    const s = new Set<number>();
    (rows ?? []).forEach((r) => { const d = toDate(r.boqDate); if (d) s.add(d.getFullYear()); });
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
      if (category !== "ALL" && !r.items.some((it) => it.category === category)) return false;
      const d = toDate(r.boqDate);
      if (year !== "ALL" && (!d || d.getFullYear() !== Number(year))) return false;
      if (month !== "ALL" && (!d || d.getMonth() !== Number(month))) return false;
      return true;
    });
  }, [rows, status, year, month, projectId, category]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      total: all.length,
      approved: all.filter((b) => b.status === "APPROVED").length,
      value: all.reduce((s, b) => s + b.totalAmount, 0),
    };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="BOQ"
        description="Bills of quantities, across every project — original and revised."
        actions={
          <>
            <ExportButton
              filename="boq"
              sheetName="BOQ"
              rows={filtered.map((b) => ({
                "BOQ No.": b.boqNo, Project: b.projectName, Site: b.siteName ?? "", Status: b.status,
                Total: b.totalAmount, Date: formatDate(b.boqDate),
              }))}
            />
            <Link href="/boq/new"><Button variant="primary"><Plus className="h-4 w-4" /> New BOQ</Button></Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={status} className="w-auto" options={[{ value: "ALL", label: "All statuses" }, ...BOQ_STATUSES.map((s) => ({ value: s, label: s }))]} onChange={(e) => setStatus(e.target.value as BoqStatus | "ALL")} />
        <Select value={year} className="w-auto" options={[{ value: "ALL", label: "All years" }, ...years.map((y) => ({ value: String(y), label: String(y) }))]} onChange={(e) => setYear(e.target.value)} />
        <Select value={month} className="w-auto" options={[{ value: "ALL", label: "All months" }, ...MONTH_NAMES.map((m, i) => ({ value: String(i), label: m }))]} onChange={(e) => setMonth(e.target.value)} />
        <Select value={projectId} className="w-auto" options={[{ value: "ALL", label: "All projects" }, ...projects.map(([id, name]) => ({ value: id, label: name }))]} onChange={(e) => setProjectId(e.target.value)} />
        <Select value={category} className="w-auto" options={[{ value: "ALL", label: "All categories" }, ...BOQ_CATEGORIES.map((c) => ({ value: c, label: c }))]} onChange={(e) => setCategory(e.target.value as BoqCategory | "ALL")} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="BOQs" value={stats.total} icon={<ClipboardList className="h-4 w-4" />} />
        <StatCard label="Approved" value={stats.approved} tone="positive" />
        <StatCard label="Total value" value={formatCompactINR(stats.value)} />
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-8 w-8" />} title="No BOQs yet" description="Create one here, import an Excel file, or add it from a project's BOQ tab — either way it links to the project." action={<Link href="/boq/new"><Button variant="primary"><Plus className="h-4 w-4" /> New BOQ</Button></Link>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No.</th>
                <th className="th">Project</th>
                <th className="th">Site</th>
                <th className="th">Status</th>
                <th className="th">Date</th>
                <th className="th">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-t border-ink-100 hover:bg-ink-50">
                  <td className="td font-medium"><Link href={`/boq/${b.id}`} className="text-brand-700 hover:underline">{b.boqNo}</Link></td>
                  <td className="td"><Link href={`/projects/${b.projectId}`} className="text-ink-600 hover:underline">{b.projectName}</Link></td>
                  <td className="td">{b.siteName || "—"}</td>
                  <td className="td"><Badge>{b.status}</Badge></td>
                  <td className="td">{formatDate(b.boqDate)}</td>
                  <td className="td">{formatINR(b.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
