"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PrintFooter, PrintHeader, PrintSheet, PrintToolbar } from "@/components/print-document";
import { EmptyState, Spinner } from "@/components/ui";
import { subscribeIssuesForProject } from "@/lib/db/issues";
import { getProject } from "@/lib/db/projects";
import type { Issue, Project } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function IssueReportPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [issues, setIssues] = useState<Issue[]>([]);

  useEffect(() => { void getProject(id).then(setProject); }, [id]);
  useEffect(() => subscribeIssuesForProject(id, setIssues), [id]);

  if (project === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (project === null) return <EmptyState title="Project not found" />;

  const open = issues.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS").length;

  return (
    <div>
      <PrintToolbar backHref={`/projects/${id}`} />
      <PrintSheet>
        <PrintHeader docLabel="Issue Report" docNumber={project.code} meta={<p className="mt-0.5 text-[11px] text-ink-400">{open} open of {issues.length}</p>} />

        <div className="text-sm"><p className="text-xs text-ink-500">Project</p><p className="font-medium text-ink-900">{project.name}</p></div>

        <div className="mt-6 overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="pb-2">Title</th>
                <th className="pb-2">Stage</th>
                <th className="pb-2">Priority</th>
                <th className="pb-2">Assignee</th>
                <th className="pb-2">Due</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.id} className="border-b border-ink-100">
                  <td className="py-2">{i.title}</td>
                  <td className="py-2 text-ink-500">{i.stageName || "—"}</td>
                  <td className="py-2 text-ink-500">{i.priority}</td>
                  <td className="py-2 text-ink-500">{i.assigneeName || "Unassigned"}</td>
                  <td className="py-2 text-ink-500">{i.dueDate ? formatDate(i.dueDate) : "—"}</td>
                  <td className="py-2 text-ink-500">{i.status.replace(/_/g, " ")}</td>
                </tr>
              ))}
              {issues.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-ink-400">No issues raised.</td></tr>}
            </tbody>
          </table>
        </div>

        <PrintFooter />
      </PrintSheet>
    </div>
  );
}
