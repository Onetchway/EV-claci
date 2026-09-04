"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Briefcase, Plus } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import { Badge, Button, EmptyState, Input, PageHeader, Select, Spinner, StatCard } from "@/components/ui";
import { subscribeVendorAssignments } from "@/lib/db/vendor-assignments";
import { canManageVendorAssignments } from "@/lib/permissions";
import { ASSIGNMENT_STATUSES, ASSIGNMENT_STATUS_META, type AssignmentStatus } from "@/lib/constants";
import type { VendorAssignment } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function VendorAssignmentsPage() {
  const viewer = useViewer();
  const [rows, setRows] = useState<VendorAssignment[] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AssignmentStatus | "">("");

  useEffect(() => subscribeVendorAssignments({}, (r) => setRows(r), () => setRows([])), []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = search.trim().toLowerCase();
    return rows
      .filter((a) => !status || a.status === status)
      .filter((a) => !needle || [a.assignmentNo, a.title, a.vendorName, a.projectName].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [rows, search, status]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      total: all.length,
      active: all.filter((a) => a.status === "ACTIVE").length,
      value: all.reduce((s, a) => s + a.contractAmount, 0),
    };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Vendor Assignments"
        description="Work packages handed to a vendor or sub-vendor — milestones, payment terms, penalty clause, timeline."
        actions={(
          <>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as AssignmentStatus | "")}
              placeholder="All statuses"
              options={ASSIGNMENT_STATUSES.map((s) => ({ value: s, label: ASSIGNMENT_STATUS_META[s].label }))}
            />
            {canManageVendorAssignments(viewer) && (
              <Link href="/vendor-assignments/new"><Button variant="primary"><Plus className="h-4 w-4" /> New assignment</Button></Link>
            )}
          </>
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Assignments" value={stats.total} />
        <StatCard label="Active" value={stats.active} tone="positive" />
        <StatCard label="Total contract value" value={formatINR(stats.value)} />
      </div>

      <div className="card mb-4 p-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assignment no., title, vendor, project…" />
      </div>

      {rows === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-8 w-8" />}
          title="No assignments yet"
          description="Assign a scope of work to a vendor or sub-vendor, with its own milestones and timeline."
          action={canManageVendorAssignments(viewer) ? <Link href="/vendor-assignments/new"><Button variant="primary"><Plus className="h-4 w-4" /> New assignment</Button></Link> : undefined}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <Link key={a.id} href={`/vendor-assignments/${a.id}`} className="card card-pad block transition hover:border-brand-400 hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{a.title}</p>
                  <p className="truncate text-xs text-ink-500">{a.assignmentNo} · {a.vendorName}{a.parentVendorName ? ` (via ${a.parentVendorName})` : ""}</p>
                </div>
                <Badge className={ASSIGNMENT_STATUS_META[a.status].className}>{ASSIGNMENT_STATUS_META[a.status].label}</Badge>
              </div>
              <p className="mt-2 truncate text-xs text-ink-500">{a.projectName}</p>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-2.5 text-xs text-ink-500">
                <span>{formatINR(a.contractAmount)}</span>
                <span className="shrink-0">{a.deadline ? `Due ${formatDate(a.deadline)}` : formatDate(a.createdAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
