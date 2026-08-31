"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PrintFooter, PrintHeader, PrintSheet, PrintToolbar } from "@/components/print-document";
import { EmptyState, Spinner } from "@/components/ui";
import { subscribeIssuesForProject } from "@/lib/db/issues";
import { getProject } from "@/lib/db/projects";
import { subscribeStagePhotosForProject } from "@/lib/db/stage-photos";
import { subscribeStagesForProject } from "@/lib/db/stages";
import { subscribeTasksForProject } from "@/lib/db/tasks";
import type { Issue, Project, ProjectStage, ProjectTask, StageProgressPhoto } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function StageWiseClientReportPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [photos, setPhotos] = useState<StageProgressPhoto[]>([]);

  useEffect(() => { void getProject(id).then(setProject); }, [id]);
  useEffect(() => subscribeStagesForProject(id, setStages), [id]);
  useEffect(() => subscribeTasksForProject(id, setTasks), [id]);
  useEffect(() => subscribeIssuesForProject(id, setIssues), [id]);
  useEffect(() => subscribeStagePhotosForProject(id, setPhotos), [id]);

  if (project === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (project === null) return <EmptyState title="Project not found" />;

  const overall = stages.length ? Math.round(stages.reduce((s, st) => s + st.progressPct, 0) / stages.length) : 0;

  return (
    <div>
      <PrintToolbar backHref={`/projects/${id}`} />
      <PrintSheet>
        <PrintHeader
          docLabel="Stage-wise Client Report"
          docNumber={project.code}
          meta={<p className="mt-0.5 text-[11px] text-ink-400">Overall progress: {overall}%</p>}
        />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-ink-500">Project</p><p className="font-medium text-ink-900">{project.name}</p></div>
          <div className="text-right"><p className="text-xs text-ink-500">Client</p><p className="font-medium text-ink-900">{project.clientName}</p></div>
          {project.startDate && <div><p className="text-xs text-ink-500">Start</p><p className="text-ink-900">{formatDate(project.startDate)}</p></div>}
          {project.targetEndDate && <div className="text-right"><p className="text-xs text-ink-500">Target Completion</p><p className="text-ink-900">{formatDate(project.targetEndDate)}</p></div>}
        </div>

        {project.clientRequirements && (
          <div className="mt-6 rounded-lg bg-ink-50 p-3">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Client Requirements</h2>
            <p className="whitespace-pre-line text-sm text-ink-800">{project.clientRequirements}</p>
          </div>
        )}

        <div className="mt-6 space-y-5">
          {stages.length === 0 ? (
            <p className="text-sm text-ink-400">No stages defined for this project yet.</p>
          ) : stages.map((s) => {
            const stageTasks = tasks.filter((t) => t.stageId === s.id);
            const stageIssues = issues.filter((i) => i.stageId === s.id);
            const stagePhotos = photos.filter((p) => p.stageId === s.id);
            return (
              <div key={s.id} className="break-inside-avoid border-t border-ink-200 pt-3">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold text-navy-900">{s.sequence}. {s.name}</h3>
                  <span className="text-xs text-ink-500">{s.status.replace(/_/g, " ")} · {s.progressPct}%</span>
                </div>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  Planned: {s.plannedStart ? formatDate(s.plannedStart) : "—"} – {s.plannedEnd ? formatDate(s.plannedEnd) : "—"}
                  {s.actualStart && <> · Actual start: {formatDate(s.actualStart)}</>}
                  {s.actualEnd && <> · Actual end: {formatDate(s.actualEnd)}</>}
                </p>

                {stageTasks.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink-700">
                    {stageTasks.map((t) => (
                      <li key={t.id}>{t.title} — <span className="text-ink-500">{t.status.replace(/_/g, " ")}{t.assigneeName ? `, ${t.assigneeName}` : ""}</span></li>
                    ))}
                  </ul>
                )}

                {stageIssues.length > 0 && (
                  <p className="mt-2 text-xs text-rose-700">
                    {stageIssues.length} issue{stageIssues.length === 1 ? "" : "s"}: {stageIssues.map((i) => i.title).join("; ")}
                  </p>
                )}

                {stageTasks.length === 0 && stageIssues.length === 0 && (
                  <p className="mt-2 text-xs text-ink-400">No tasks or issues logged against this stage.</p>
                )}

                {stagePhotos.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {stagePhotos.map((p) => (
                      <div key={p.id} className="break-inside-avoid overflow-hidden rounded-lg border border-ink-100">
                        <img src={p.photoUrl} alt={p.title} className="h-28 w-full object-cover" />
                        <div className="p-1.5">
                          <p className="truncate text-[11px] font-medium text-ink-900">{p.title}</p>
                          {p.details && <p className="text-[10px] text-ink-500">{p.details}</p>}
                          <p className="text-[10px] text-ink-400">{formatDate(p.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <PrintFooter />
      </PrintSheet>
    </div>
  );
}
