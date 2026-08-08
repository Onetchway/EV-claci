"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Building2, HardHat, MapPin, Plus, Search, Zap } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import { ExportButton } from "@/components/data-transfer";
import {
  Avatar, Badge, Button, EmptyState, Input, PageHeader, ProgressBar, Select,
  Spinner, StatCard,
} from "@/components/ui";
import {
  DISCOM_STAGE_LABEL, PROJECT_OWNERSHIPS, PROJECT_OWNERSHIP_COLOR,
  PROJECT_OWNERSHIP_LABEL, PROJECT_STAGES, PROJECT_STAGE_META, PROJECT_STATUSES,
  PROJECT_STATUS_COLOR, PROJECT_STATUS_LABEL,
  type ProjectOwnership, type ProjectStage, type ProjectStatus,
} from "@/lib/constants";
import {
  applyProjectFilters, projectProgress, projectRisks, subscribeProjects,
} from "@/lib/db/projects";
import { PROJECT_COLUMNS } from "@/lib/exports";
import { canExport } from "@/lib/permissions";
import type { Project } from "@/lib/types";
import { cn, formatCompactINR, formatDate } from "@/lib/utils";

function ProjectCard({ project }: { project: Project }) {
  const pct = projectProgress(project);
  const risks = projectRisks(project);
  const meta = PROJECT_STAGE_META[project.stage];

  return (
    <Link
      href={`/projects/${project.id}`}
      className="card card-pad block transition hover:border-brand-400 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900">{project.name}</p>
          <p className="truncate text-xs text-ink-500">
            {project.code} · {project.site?.city}
          </p>
        </div>
        <Badge className={PROJECT_OWNERSHIP_COLOR[project.ownership]}>
          {project.ownership === "COCO" ? "COCO" : "Franchise"}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge className={meta.color}>{meta.short}</Badge>
        {project.status !== "ACTIVE" && (
          <Badge className={PROJECT_STATUS_COLOR[project.status]}>
            {PROJECT_STATUS_LABEL[project.status]}
          </Badge>
        )}
        {risks.length > 0 && (
          <Badge className="bg-rose-100 text-rose-800 ring-rose-200">
            {risks.length} at risk
          </Badge>
        )}
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-ink-500">
          <span>Overall progress</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <ProgressBar pct={pct} />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-ink-100 pt-2.5 text-xs">
        <div>
          <dt className="text-ink-500">Capacity</dt>
          <dd className="font-semibold">{project.totalKw} kW</dd>
        </div>
        <div>
          <dt className="text-ink-500">Value</dt>
          <dd className="font-semibold">{formatCompactINR(project.value)}</dd>
        </div>
        <div>
          <dt className="text-ink-500">DISCOM</dt>
          <dd className="truncate font-semibold">
            {DISCOM_STAGE_LABEL[project.discom?.stage ?? "NOT_APPLIED"]}
          </dd>
        </div>
      </dl>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-ink-100 pt-2.5 text-xs text-ink-500">
        <span className="flex min-w-0 items-center gap-1.5">
          <Avatar name={project.managerName} size={18} />
          <span className="truncate">{project.managerName}</span>
        </span>
        <span className="shrink-0">
          {project.liveAt
            ? `Live ${formatDate(project.liveAt)}`
            : project.targetLiveAt
              ? `Target ${formatDate(project.targetLiveAt)}`
              : ""}
        </span>
      </div>
    </Link>
  );
}

function ProjectsInner() {
  const params = useSearchParams();
  const viewer = useViewer();
  const { profile } = useAuth();

  const [ownership, setOwnership] = useState<ProjectOwnership | "ALL">("ALL");
  const [status, setStatus] = useState<ProjectStatus | "ALL">("ALL");
  const [stage, setStage] = useState<ProjectStage | "">("");
  const [search, setSearch] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // /projects?ownership=COCO drives the "Company Stations" nav entry.
  useEffect(() => {
    const o = params.get("ownership") as ProjectOwnership | null;
    if (o && PROJECT_OWNERSHIPS.includes(o)) setOwnership(o);
  }, [params]);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    return subscribeProjects(
      { ownership, status, max: 300 },
      (rows) => { setProjects(rows); setError(null); setLoading(false); },
      (e) => { setError(e.message); setLoading(false); },
    );
  }, [profile, ownership, status]);

  const rows = useMemo(
    () => applyProjectFilters(projects, { stages: stage ? [stage] : [], search }),
    [projects, stage, search],
  );

  const stats = useMemo(() => {
    const live = rows.filter((p) => p.status === "LIVE");
    const atRisk = rows.filter((p) => projectRisks(p).length > 0);
    return {
      total: rows.length,
      live: live.length,
      kw: rows.reduce((a, p) => a + (p.totalKw ?? 0), 0),
      value: rows.reduce((a, p) => a + (p.value ?? 0), 0),
      atRisk: atRisk.length,
      avgProgress: rows.length
        ? Math.round(rows.reduce((a, p) => a + projectProgress(p), 0) / rows.length)
        : 0,
    };
  }, [rows]);

  const isCoco = ownership === "COCO";

  return (
    <>
      <PageHeader
        title={isCoco ? "Company stations" : ownership === "FRANCHISE" ? "Franchise projects" : "Projects"}
        description={
          isCoco
            ? "Stations Livanto owns and operates itself — same delivery tracking, no franchisee."
            : "Delivery tracking from site survey through to a live charger."
        }
        actions={
          <>
            {canExport(viewer) && (
              <ExportButton
                filename={isCoco ? "livanto-company-stations" : "livanto-projects"}
                sheetName="Projects"
                columns={PROJECT_COLUMNS}
                rows={rows}
              />
            )}
            <Link href={`/projects/new${isCoco ? "?ownership=COCO" : ""}`}>
              <Button variant="primary"><Plus className="h-4 w-4" /> New project</Button>
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Projects" value={stats.total} icon={<HardHat className="h-4 w-4" />} />
        <StatCard label="Live" value={stats.live} tone="positive" icon={<Zap className="h-4 w-4" />} />
        <StatCard label="Capacity" value={`${stats.kw} kW`} />
        <StatCard label="Portfolio value" value={formatCompactINR(stats.value)} />
        <StatCard
          label="At risk"
          value={stats.atRisk}
          tone={stats.atRisk ? "negative" : "default"}
          sub={`Avg progress ${stats.avgProgress}%`}
        />
      </div>

      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project, client, location or city…"
            className="pl-9"
          />
        </div>

        <Select
          value={ownership}
          onChange={(e) => setOwnership(e.target.value as ProjectOwnership | "ALL")}
          className="w-auto"
          options={[
            { value: "ALL", label: "All ownership" },
            ...PROJECT_OWNERSHIPS.map((o) => ({ value: o, label: PROJECT_OWNERSHIP_LABEL[o] })),
          ]}
        />

        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus | "ALL")}
          className="w-auto"
          options={[
            { value: "ALL", label: "All statuses" },
            ...PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABEL[s] })),
          ]}
        />

        <Select
          value={stage}
          onChange={(e) => setStage(e.target.value as ProjectStage | "")}
          className="w-auto"
          placeholder="All stages"
          options={PROJECT_STAGES.map((s) => ({ value: s, label: PROJECT_STAGE_META[s].label }))}
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          {error}
        </div>
      )}

      {/* Stage summary strip */}
      {rows.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {PROJECT_STAGES.map((s) => {
            const n = rows.filter((p) => p.stage === s).length;
            if (!n) return null;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStage(stage === s ? "" : s)}
                className={cn(
                  "chip ring-inset transition",
                  PROJECT_STAGE_META[s].color,
                  stage === s && "ring-2 ring-ink-900",
                )}
              >
                {PROJECT_STAGE_META[s].short}: {n}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={isCoco ? <Building2 className="h-8 w-8" /> : <MapPin className="h-8 w-8" />}
          title={isCoco ? "No company stations yet" : "No projects yet"}
          description={
            isCoco
              ? "Create a company-owned station to track its civil, electrical and DISCOM work."
              : "Projects appear here when a won franchise deal is converted, or when you create one directly."
          }
          action={
            <Link href={`/projects/new${isCoco ? "?ownership=COCO" : ""}`}>
              <Button variant="primary"><Plus className="h-4 w-4" /> New project</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>}>
      <ProjectsInner />
    </Suspense>
  );
}
