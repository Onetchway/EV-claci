"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PrintFooter, PrintHeader, PrintSheet, PrintToolbar } from "@/components/print-document";
import { EmptyState, Spinner } from "@/components/ui";
import { getProject } from "@/lib/db/projects";
import { subscribeStagesForProject } from "@/lib/db/stages";
import type { Project, ProjectStage } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function StageProgressReportPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [stages, setStages] = useState<ProjectStage[]>([]);

  useEffect(() => { void getProject(id).then(setProject); }, [id]);
  useEffect(() => subscribeStagesForProject(id, setStages), [id]);

  if (project === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (project === null) return <EmptyState title="Project not found" />;

  const overall = stages.length ? Math.round(stages.reduce((s, st) => s + st.progressPct, 0) / stages.length) : 0;

  return (
    <div>
      <PrintToolbar backHref={`/projects/${id}`} />
      <PrintSheet>
        <PrintHeader docLabel="Stage Progress Report" docNumber={project.code} meta={<p className="mt-0.5 text-[11px] text-ink-400">Overall: {overall}%</p>} />

        <div className="text-sm"><p className="text-xs text-ink-500">Project</p><p className="font-medium text-ink-900">{project.name}</p></div>

        <div className="mt-6 overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="pb-2">#</th>
                <th className="pb-2">Stage</th>
                <th className="pb-2">Planned Start</th>
                <th className="pb-2">Planned End</th>
                <th className="pb-2">Actual Start</th>
                <th className="pb-2">Actual End</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Progress</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.id} className="border-b border-ink-100">
                  <td className="py-2 text-ink-500">{s.sequence}</td>
                  <td className="py-2">{s.name}</td>
                  <td className="py-2 text-ink-500">{s.plannedStart ? formatDate(s.plannedStart) : "—"}</td>
                  <td className="py-2 text-ink-500">{s.plannedEnd ? formatDate(s.plannedEnd) : "—"}</td>
                  <td className="py-2 text-ink-500">{s.actualStart ? formatDate(s.actualStart) : "—"}</td>
                  <td className="py-2 text-ink-500">{s.actualEnd ? formatDate(s.actualEnd) : "—"}</td>
                  <td className="py-2 text-ink-500">{s.status.replace(/_/g, " ")}</td>
                  <td className="py-2 text-right tabular-nums">{s.progressPct}%</td>
                </tr>
              ))}
              {stages.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-ink-400">No stages yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <PrintFooter />
      </PrintSheet>
    </div>
  );
}
