"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";

import { Badge, Button, EmptyState, PageHeader, Select, StatCard } from "@/components/ui";
import { ExportButton } from "@/components/export-button";
import { BOQ_STATUSES, type BoqStatus } from "@/lib/constants";
import { subscribeBoqs } from "@/lib/db/boq";
import type { Boq } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR } from "@/lib/utils";

export default function BoqListPage() {
  const [rows, setRows] = useState<Boq[] | null>(null);
  const [status, setStatus] = useState<BoqStatus | "ALL">("ALL");

  useEffect(() => subscribeBoqs(setRows), []);

  const filtered = useMemo(() => (!rows ? [] : status === "ALL" ? rows : rows.filter((r) => r.status === status)), [rows, status]);

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
            <Select value={status} className="w-auto" options={[{ value: "ALL", label: "All statuses" }, ...BOQ_STATUSES.map((s) => ({ value: s, label: s }))]} onChange={(e) => setStatus(e.target.value as BoqStatus | "ALL")} />
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
