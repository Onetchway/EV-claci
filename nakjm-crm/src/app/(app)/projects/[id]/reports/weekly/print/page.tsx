"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { PrintFooter, PrintHeader, PrintSheet, PrintToolbar } from "@/components/print-document";
import { EmptyState, Spinner } from "@/components/ui";
import { subscribeIssuesForProject } from "@/lib/db/issues";
import { getProject } from "@/lib/db/projects";
import { subscribeSiteReportsForProject } from "@/lib/db/site-reports";
import { subscribeStagesForProject } from "@/lib/db/stages";
import type { Issue, Project, ProjectStage, SiteReport } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function WeeklyReportPrintPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>}>
      <WeeklyReportPrintInner />
    </Suspense>
  );
}

function WeeklyReportPrintInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const nextWeek = params.get("nextWeek") ?? "";

  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [reports, setReports] = useState<SiteReport[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);

  useEffect(() => { void getProject(id).then(setProject); }, [id]);
  useEffect(() => subscribeStagesForProject(id, setStages), [id]);
  useEffect(() => subscribeSiteReportsForProject(id, setReports), [id]);
  useEffect(() => subscribeIssuesForProject(id, setIssues), [id]);

  if (project === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (project === null) return <EmptyState title="Project not found" />;

  const fromTime = from ? new Date(from).getTime() : 0;
  const toTime = to ? new Date(to).getTime() + 86400000 : Infinity;
  const inRange = (r: SiteReport) => {
    const t = r.reportDate?.seconds ? r.reportDate.seconds * 1000 : 0;
    return t >= fromTime && t < toTime;
  };
  const weekReports = reports.filter(inRange);
  const overallProgress = stages.length ? Math.round(stages.reduce((s, st) => s + st.progressPct, 0) / stages.length) : 0;
  const active = stages.filter((s) => s.status === "IN_PROGRESS");
  const delayed = stages.filter((s) => s.status === "DELAYED" || s.status === "BLOCKED");
  const openIssues = issues.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS");

  return (
    <div>
      <PrintToolbar backHref={`/projects/${id}`} />
      <PrintSheet>
        <PrintHeader
          docLabel="Weekly Progress Report"
          docNumber={project.code}
          meta={<p className="mt-0.5 text-[11px] text-ink-400">{from ? formatDate(from) : "—"} – {to ? formatDate(to) : "—"}</p>}
        />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-ink-500">Project</p><p className="font-medium text-ink-900">{project.name}</p></div>
          <div className="text-right"><p className="text-xs text-ink-500">Overall Progress</p><p className="text-lg font-bold text-ink-900">{overallProgress}%</p></div>
        </div>

        <div className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Completed This Week</h2>
          {weekReports.length === 0 ? <p className="text-sm text-ink-400">No site reports logged this week.</p> : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-800">
              {weekReports.map((r) => <li key={r.id}>{r.workDone || `${r.progressPct}% progress recorded`}{r.manpowerCount ? ` — ${r.manpowerCount} workers` : ""}</li>)}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Current Activities</h2>
          {active.length === 0 ? <p className="text-sm text-ink-400">No stages currently in progress.</p> : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-800">{active.map((s) => <li key={s.id}>{s.name} — {s.progressPct}%</li>)}</ul>
          )}
        </div>

        <div className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Delayed</h2>
          {delayed.length === 0 ? <p className="text-sm text-ink-400">Nothing delayed or blocked.</p> : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-rose-700">{delayed.map((s) => <li key={s.id}>{s.name}</li>)}</ul>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div><h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Open Issues</h2><p className="text-2xl font-bold text-ink-900">{openIssues.length}</p></div>
        </div>

        {nextWeek && (
          <div className="mt-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Next Week</h2>
            <p className="whitespace-pre-line text-sm text-ink-800">{nextWeek}</p>
          </div>
        )}

        <PrintFooter />
      </PrintSheet>
    </div>
  );
}
