"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Briefcase, Plus } from "lucide-react";

import { Badge, Button, EmptyState, PageHeader, Select } from "@/components/ui";
import { PROJECT_STATUSES, statusMeta, type ProjectStatus } from "@/lib/constants";
import { subscribeProjects } from "@/lib/db/projects";
import type { Project } from "@/lib/types";
import { formatCompactINR, formatDate } from "@/lib/utils";

export default function ProjectsPage() {
  const [rows, setRows] = useState<Project[] | null>(null);
  const [status, setStatus] = useState<ProjectStatus | "ALL">("ALL");

  useEffect(() => subscribeProjects({ status }, setRows), [status]);

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Every EPC engagement, from lead to handover."
        actions={
          <>
            <Select
              value={status}
              options={[{ value: "ALL", label: "All statuses" }, ...PROJECT_STATUSES.map((s) => ({ value: s, label: statusMeta(s).label }))]}
              onChange={(e) => setStatus(e.target.value as ProjectStatus | "ALL")}
              className="w-44"
            />
            <Link href="/projects/new"><Button><Plus className="h-4 w-4" /> New Project</Button></Link>
          </>
        }
      />

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Briefcase className="h-8 w-8" />} title="No projects yet" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Code</th>
                <th className="th">Project</th>
                <th className="th">Client</th>
                <th className="th">Status</th>
                <th className="th">Contract Value</th>
                <th className="th">Target End</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-ink-100">
                  <td className="td"><Link href={`/projects/${p.id}`} className="font-medium text-brand-700">{p.code}</Link></td>
                  <td className="td">{p.name}</td>
                  <td className="td">{p.clientName}</td>
                  <td className="td"><Badge className={statusMeta(p.status).className}>{statusMeta(p.status).label}</Badge></td>
                  <td className="td">{formatCompactINR(p.contractValue)}</td>
                  <td className="td">{formatDate(p.targetEndDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
