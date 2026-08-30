"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { History } from "lucide-react";

import { EmptyState, PageHeader, Select } from "@/components/ui";
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITY_LABEL, ACTIVITY_ENTITY_TYPES, type ActivityEntityType } from "@/lib/constants";
import { subscribeAuditLog } from "@/lib/db/activity";
import type { Activity } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const ACTION_BADGE: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  UPDATE: "bg-sky-50 text-sky-700 ring-sky-200",
  STATUS_CHANGE: "bg-violet-50 text-violet-700 ring-violet-200",
  DELETE: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default function AuditLogPage() {
  const [rows, setRows] = useState<Activity[] | null>(null);
  const [entityType, setEntityType] = useState<ActivityEntityType | "ALL">("ALL");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeAuditLog(
    { entityType: entityType === "ALL" ? undefined : entityType },
    (data) => { setRows(data); setError(null); },
    () => setError("You don't have permission to view the audit log — admins only."),
  ), [entityType]);

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Who did what, across every client, project, quotation, BOQ, PO, PI and payment."
        actions={(
          <Select
            value={entityType}
            options={[{ value: "ALL", label: "All entities" }, ...ACTIVITY_ENTITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_ENTITY_LABEL[t] }))]}
            onChange={(e) => setEntityType(e.target.value as ActivityEntityType | "ALL")}
          />
        )}
      />

      {error ? (
        <EmptyState title="Access restricted" description={error} />
      ) : !rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No activity yet" description="Actions across the CRM will appear here as they happen." icon={<History className="h-6 w-6" />} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">When</th>
                <th className="th">Action</th>
                <th className="th">Entity</th>
                <th className="th">Detail</th>
                <th className="th">By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-ink-100">
                  <td className="td whitespace-nowrap text-ink-500">{formatDateTime(r.at)}</td>
                  <td className="td">
                    <span className={`chip ${ACTION_BADGE[r.action] ?? "bg-ink-100 text-ink-700 ring-ink-200"}`}>{r.action.replace(/_/g, " ")}</span>
                  </td>
                  <td className="td">{ACTIVITY_ENTITY_LABEL[r.entityType]}</td>
                  <td className="td">
                    {r.projectId ? (
                      <Link href={`/projects/${r.projectId}`} className="text-brand-700 hover:underline">{r.message}</Link>
                    ) : r.message}
                  </td>
                  <td className="td text-ink-600">{r.actor.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
