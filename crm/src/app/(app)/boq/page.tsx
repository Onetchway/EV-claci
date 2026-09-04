"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import { Badge, Button, EmptyState, PageHeader, Select, Spinner, StatCard } from "@/components/ui";
import { subscribeBoqs } from "@/lib/db/boq";
import { canManageBoq } from "@/lib/permissions";
import { BOQ_STATUSES, BOQ_STATUS_META, type BoqStatus } from "@/lib/constants";
import type { Boq } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function BoqListPage() {
  const viewer = useViewer();
  const [rows, setRows] = useState<Boq[] | null>(null);
  const [status, setStatus] = useState<BoqStatus | "">("");

  useEffect(() => subscribeBoqs((r) => setRows(r), () => setRows([])), []);

  const filtered = useMemo(() => (!rows ? [] : status ? rows.filter((r) => r.status === status) : rows), [rows, status]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      total: all.length,
      approved: all.filter((b) => b.status === "APPROVED").length,
      value: all.reduce((s, b) => s + b.totalAmount, 0),
    };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="BOQ"
        description="Bills of quantities, across every project — original and revised."
        actions={(
          <>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as BoqStatus | "")}
              placeholder="All statuses"
              options={BOQ_STATUSES.map((s) => ({ value: s, label: BOQ_STATUS_META[s].label }))}
            />
            {canManageBoq(viewer) && (
              <Link href="/boq/new"><Button variant="primary"><Plus className="h-4 w-4" /> New BOQ</Button></Link>
            )}
          </>
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="BOQs" value={stats.total} />
        <StatCard label="Approved" value={stats.approved} tone="positive" />
        <StatCard label="Total value" value={formatINR(stats.value)} />
      </div>

      {rows === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-8 w-8" />}
          title="No BOQs yet"
          description="Create one here, or import an Excel file — either way it links to a project."
          action={canManageBoq(viewer) ? <Link href="/boq/new"><Button variant="primary"><Plus className="h-4 w-4" /> New BOQ</Button></Link> : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No.</th>
                <th className="th">Project</th>
                <th className="th">Site</th>
                <th className="th">Version</th>
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
                  <td className="td tabular-nums">v{b.version}</td>
                  <td className="td"><Badge className={BOQ_STATUS_META[b.status].className}>{BOQ_STATUS_META[b.status].label}</Badge></td>
                  <td className="td">{formatDate(b.boqDate)}</td>
                  <td className="td tabular-nums">{formatINR(b.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
