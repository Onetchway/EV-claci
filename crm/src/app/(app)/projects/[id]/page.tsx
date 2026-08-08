"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ExternalLink, Lightbulb, MapPin, Phone, Zap,
} from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader,
  ProgressBar, Select, Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import { useAgents } from "@/hooks/use-leads";
import {
  CONNECTION_TYPES, CONNECTION_TYPE_LABEL, DISCOM_STAGES, DISCOM_STAGE_LABEL,
  LAND_TYPE_LABEL, LOCATION_TYPE_LABEL, OWNER_TYPE_LABEL, PROJECT_OWNERSHIP_COLOR,
  PROJECT_OWNERSHIP_LABEL, PROJECT_STAGES, PROJECT_STAGE_META, PROJECT_STATUSES,
  PROJECT_STATUS_COLOR, PROJECT_STATUS_LABEL, TASK_STATUSES, TASK_STATUS_COLOR,
  TASK_STATUS_LABEL, WORKSTREAMS, WORKSTREAM_HINT, WORKSTREAM_LABEL,
  type ConnectionType, type DiscomStage, type ProjectStage, type ProjectStatus,
  type TaskStatus, type Workstream,
} from "@/lib/constants";
import {
  changeProjectStage, projectProgress, projectRisks, setProjectStatus,
  subscribeProject, suggestedStage, updateProject, updateWorkstream,
} from "@/lib/db/projects";
import { canEditLead, canReassign } from "@/lib/permissions";
import { buildQuote, describeConfig } from "@/lib/pricing";
import type { Project, ProjectWorkstream } from "@/lib/types";
import { cn, formatDate, formatINR, formatNumber, toDate } from "@/lib/utils";

const toInput = (d: unknown) => {
  const date = toDate(d as never);
  return date ? date.toISOString().slice(0, 10) : "";
};
const fromInput = (s: string) => (s ? new Date(`${s}T00:00:00`) : null);

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{value ?? "—"}</dd>
    </div>
  );
}

function WorkstreamRow({
  project, ws, canEdit, onSave,
}: {
  project: Project;
  ws: ProjectWorkstream;
  canEdit: boolean;
  onSave: (patch: Partial<ProjectWorkstream>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectWorkstream>(ws);
  const { busy, run } = useAsyncAction();

  useEffect(() => setForm(ws), [ws]);

  const overdue =
    ws.status !== "DONE" &&
    ws.status !== "NOT_APPLICABLE" &&
    (toDate(ws.plannedEnd)?.getTime() ?? Infinity) < Date.now();

  return (
    <>
      <li className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[180px] flex-1">
            <p className="text-sm font-medium text-ink-900">{WORKSTREAM_LABEL[ws.key]}</p>
            <p className="text-[11px] text-ink-500">{WORKSTREAM_HINT[ws.key]}</p>
          </div>

          <Badge className={TASK_STATUS_COLOR[ws.status]}>{TASK_STATUS_LABEL[ws.status]}</Badge>

          <div className="flex w-40 items-center gap-2">
            <ProgressBar pct={ws.status === "DONE" ? 100 : ws.progressPct ?? 0} className="flex-1" />
            <span className="w-9 text-right text-xs tabular-nums text-ink-600">
              {ws.status === "DONE" ? 100 : ws.progressPct ?? 0}%
            </span>
          </div>

          <div className="hidden w-40 text-xs text-ink-500 sm:block">
            {ws.vendor || <span className="text-ink-300">No vendor</span>}
          </div>

          <div className={cn("w-28 text-xs", overdue ? "font-semibold text-rose-600" : "text-ink-500")}>
            {ws.plannedEnd ? formatDate(ws.plannedEnd) : "—"}
          </div>

          {canEdit && (
            <Button size="sm" onClick={() => setOpen(true)}>Update</Button>
          )}
        </div>
      </li>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={WORKSTREAM_LABEL[ws.key]}
        description={WORKSTREAM_HINT[ws.key]}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  await onSave(form);
                  setOpen(false);
                }, "Workstream updated.")
              }
            >
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
              options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] }))}
            />
          </Field>
          <Field label="Progress %">
            <Input
              type="number"
              min={0}
              max={100}
              value={form.progressPct ?? 0}
              onChange={(e) => setForm({ ...form, progressPct: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Vendor / contractor">
            <Input value={form.vendor ?? ""} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          </Field>
          <Field label="Vendor phone">
            <Input value={form.vendorPhone ?? ""} onChange={(e) => setForm({ ...form, vendorPhone: e.target.value })} />
          </Field>
          <Field label="Planned start">
            <Input
              type="date"
              value={toInput(form.plannedStart)}
              onChange={(e) => setForm({ ...form, plannedStart: fromInput(e.target.value) as never })}
            />
          </Field>
          <Field label="Planned end">
            <Input
              type="date"
              value={toInput(form.plannedEnd)}
              onChange={(e) => setForm({ ...form, plannedEnd: fromInput(e.target.value) as never })}
            />
          </Field>
          <Field label="Actual start">
            <Input
              type="date"
              value={toInput(form.actualStart)}
              onChange={(e) => setForm({ ...form, actualStart: fromInput(e.target.value) as never })}
            />
          </Field>
          <Field label="Actual end">
            <Input
              type="date"
              value={toInput(form.actualEnd)}
              onChange={(e) => setForm({ ...form, actualEnd: fromInput(e.target.value) as never })}
            />
          </Field>
          <Field label="Cost (₹)">
            <Input
              type="number"
              min={0}
              step={1000}
              value={form.cost ?? ""}
              onChange={(e) => setForm({ ...form, cost: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </Field>
          <Field label="Note" className="sm:col-span-2">
            <Textarea rows={2} value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { actor } = useAuth();
  const viewer = useViewer();
  const { users } = useAgents();
  const { busy, run } = useAsyncAction();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageOpen, setStageOpen] = useState(false);
  const [targetStage, setTargetStage] = useState<ProjectStage>("PLANNING");
  const [stageNote, setStageNote] = useState("");
  const [discomOpen, setDiscomOpen] = useState(false);
  const [discom, setDiscom] = useState<Project["discom"] | null>(null);

  useEffect(() => {
    if (!id) return;
    return subscribeProject(
      id,
      (p) => { setProject(p); setDiscom(p?.discom ?? null); setLoading(false); },
      (e) => { setError(e.message); setLoading(false); },
    );
  }, [id]);

  const quote = useMemo(
    () =>
      project
        ? buildQuote(project.config ?? [], { discount: project.discount ?? 0, extras: project.extras ?? [] })
        : null,
    [project],
  );

  if (loading) {
    return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  }

  if (error || !project) {
    return (
      <EmptyState
        title="Project not available"
        description={error ?? "This project does not exist, or it may have been deleted."}
        action={<Link href="/projects"><Button>Back to projects</Button></Link>}
      />
    );
  }

  // Project delivery is an operations job, so it reuses the lead write
  // capability rather than inventing a second, divergent permission model.
  const canEdit = canEditLead(viewer, { ownerId: project.managerId, status: "ACTIVE" }) && Boolean(actor);
  const pct = projectProgress(project);
  const risks = projectRisks(project);
  const meta = PROJECT_STAGE_META[project.stage];
  const suggestion = suggestedStage(project);
  const isCoco = project.ownership === "COCO";

  return (
    <>
      <button
        onClick={() => router.push("/projects")}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="h-4 w-4" /> All projects
      </button>

      <PageHeader
        title={project.name}
        description={`${project.code} · ${PROJECT_OWNERSHIP_LABEL[project.ownership]} · manager ${project.managerName}`}
        actions={
          canEdit && (
            <>
              <Button onClick={() => { setTargetStage(project.stage); setStageOpen(true); }}>
                Change stage
              </Button>
              <Select
                value={project.status}
                onChange={(e) => void run(() => setProjectStatus(project, e.target.value as ProjectStatus, actor!), "Status updated.")}
                className="w-auto"
                options={PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABEL[s] }))}
              />
            </>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge className={meta.color}>{meta.label}</Badge>
        <Badge className={PROJECT_STATUS_COLOR[project.status]}>{PROJECT_STATUS_LABEL[project.status]}</Badge>
        <Badge className={PROJECT_OWNERSHIP_COLOR[project.ownership]}>
          {PROJECT_OWNERSHIP_LABEL[project.ownership]}
        </Badge>
        {project.sourceLeadId && (
          <Link href={`/leads/${project.sourceLeadId}`}>
            <Badge className="bg-sky-100 text-sky-800 ring-sky-200">
              From {project.sourceLeadCode} <ExternalLink className="h-3 w-3" />
            </Badge>
          </Link>
        )}
      </div>

      {risks.length > 0 && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-inset ring-rose-200">
          <p className="font-semibold">{risks.length} workstream{risks.length === 1 ? "" : "s"} need attention</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {risks.map((r) => <li key={r.key}>{r.label} — {r.reason}</li>)}
          </ul>
        </div>
      )}

      {canEdit && suggestion !== project.stage && (
        <button
          type="button"
          onClick={() => { setTargetStage(suggestion); setStageOpen(true); }}
          className="mb-4 flex w-full items-center gap-2 rounded-lg bg-sky-50 px-4 py-3 text-left text-sm text-sky-900 ring-1 ring-inset ring-sky-200 hover:bg-sky-100"
        >
          <Lightbulb className="h-4 w-4 shrink-0" />
          <span>
            The workstreams suggest this project is at{" "}
            <strong>{PROJECT_STAGE_META[suggestion].label}</strong>, not {meta.label}. Move it?
          </span>
        </button>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-500">Overall progress</p>
          <p className="mt-1 text-2xl font-semibold">{pct}%</p>
          <ProgressBar pct={pct} className="mt-2" />
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-500">Capacity</p>
          <p className="mt-1 text-2xl font-semibold">{project.totalKw} kW</p>
          <p className="mt-1 text-xs text-ink-500">{describeConfig(project.config)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-500">
            {isCoco ? "CAPEX budget" : "Investment value"}
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {formatINR(isCoco ? (project.capexBudget ?? project.value) : project.value)}
          </p>
          {isCoco && (
            <p className="mt-1 text-xs text-ink-500">
              Spent {formatINR(project.capexSpent ?? 0)}
            </p>
          )}
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-500">DISCOM</p>
          <p className="mt-1 text-base font-semibold">
            {DISCOM_STAGE_LABEL[project.discom?.stage ?? "NOT_APPLIED"]}
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setDiscomOpen(true)}
              className="mt-1 text-xs font-medium text-brand-700 hover:underline"
            >
              Update electrification
            </button>
          )}
        </Card>
      </div>

      <Card
        title="Delivery workstreams"
        subtitle="These run in parallel — civil can finish while DISCOM is still pending."
        className="mb-4"
        bodyClassName="p-0"
      >
        <ul className="divide-y divide-ink-100">
          {WORKSTREAMS.map((w) => {
            const ws = project.workstreams?.[w];
            if (!ws) return null;
            return (
              <WorkstreamRow
                key={w}
                project={project}
                ws={ws}
                canEdit={canEdit}
                onSave={(patch) => updateWorkstream(project, w, patch, actor!)}
              />
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Site" className="lg:col-span-2">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Location" value={project.site?.locationName || "—"} />
            <Detail label="City" value={project.site?.city || "—"} />
            <Detail label="State" value={project.site?.state || "—"} />
            <Detail
              label="Google Maps"
              value={
                project.site?.mapsLink ? (
                  <a
                    href={project.site.mapsLink}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                  >
                    <MapPin className="h-3.5 w-3.5" /> Open map
                  </a>
                ) : "—"
              }
            />
            <Detail
              label="Location type"
              value={(project.site?.locationTypes ?? []).map((t) => LOCATION_TYPE_LABEL[t]).join(", ") || "—"}
            />
            <Detail
              label="Land type"
              value={project.site?.landType ? LAND_TYPE_LABEL[project.site.landType] : "—"}
            />
            <Detail
              label="Owner type"
              value={project.site?.ownerType ? OWNER_TYPE_LABEL[project.site.ownerType] : "—"}
            />
            <Detail
              label="Space"
              value={project.site?.spaceAvailableSqft ? `${formatNumber(project.site.spaceAvailableSqft)} sq.ft` : "—"}
            />
            <Detail label="Address" value={project.site?.address || "—"} />
          </dl>
        </Card>

        <Card title={isCoco ? "Operator" : "Franchisee"}>
          {isCoco ? (
            <p className="py-4 text-center text-sm text-ink-500">
              Company owned and operated — there is no franchisee on this station.
            </p>
          ) : (
            <dl className="space-y-3">
              <Detail label="Name" value={project.client?.name || "—"} />
              <Detail
                label="Phone"
                value={
                  project.client?.phone ? (
                    <a href={`tel:${project.client.phone}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                      <Phone className="h-3.5 w-3.5" /> {project.client.phone}
                    </a>
                  ) : "—"
                }
              />
              <Detail label="Email" value={project.client?.email || "—"} />
              <Detail label="Company" value={project.client?.company || "—"} />
              <Detail
                label="Source lead"
                value={
                  project.sourceLeadId ? (
                    <Link href={`/leads/${project.sourceLeadId}`} className="text-brand-700 hover:underline">
                      {project.sourceLeadCode}
                    </Link>
                  ) : "—"
                }
              />
            </dl>
          )}
        </Card>
      </div>

      {quote && quote.lines.length > 0 && (
        <Card title="Bill of materials" subtitle={describeConfig(project.config)} className="mt-4">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Item</th>
                  <th className="th text-right">Qty</th>
                  <th className="th text-right">Rate</th>
                  <th className="th text-right">GST</th>
                  <th className="th text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {quote.lines.map((l) => (
                  <tr key={l.key}>
                    <td className="td font-medium">
                      {l.label}
                      {l.oem && <span className="ml-1 text-xs font-normal text-ink-500">· {l.oem}</span>}
                    </td>
                    <td className="td text-right tabular-nums">{l.qty}</td>
                    <td className="td text-right tabular-nums">{formatINR(l.unitBase)}</td>
                    <td className="td text-right tabular-nums text-ink-500">{l.gstPct}%</td>
                    <td className="td text-right font-semibold tabular-nums">{formatINR(l.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-ink-200">
                <tr>
                  <td className="td font-semibold" colSpan={4}>Total incl. GST</td>
                  <td className="td text-right text-base font-bold tabular-nums text-brand-700">
                    {formatINR(quote.grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Stage change */}
      <Modal
        open={stageOpen}
        onClose={() => setStageOpen(false)}
        title="Change project stage"
        description={PROJECT_STAGE_META[targetStage]?.hint}
        footer={
          <>
            <Button onClick={() => setStageOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  await changeProjectStage(project, targetStage, actor!, stageNote.trim() || undefined);
                  setStageOpen(false);
                  setStageNote("");
                }, "Stage updated.")
              }
            >
              Move project
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Stage">
            <Select
              value={targetStage}
              onChange={(e) => setTargetStage(e.target.value as ProjectStage)}
              options={PROJECT_STAGES.map((s) => ({ value: s, label: PROJECT_STAGE_META[s].label }))}
            />
          </Field>
          <Field label="Note (optional)">
            <Textarea rows={2} value={stageNote} onChange={(e) => setStageNote(e.target.value)} />
          </Field>
        </div>
      </Modal>

      {/* DISCOM */}
      <Modal
        open={discomOpen}
        onClose={() => setDiscomOpen(false)}
        title="DISCOM & electrification"
        description="The connection is usually the longest lead time on the project."
        wide
        footer={
          <>
            <Button onClick={() => setDiscomOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (discom) await updateProject(project, { discom }, actor!);
                  setDiscomOpen(false);
                }, "Electrification updated.")
              }
            >
              Save
            </Button>
          </>
        }
      >
        {discom && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Stage">
              <Select
                value={discom.stage}
                onChange={(e) => setDiscom({ ...discom, stage: e.target.value as DiscomStage })}
                options={DISCOM_STAGES.map((s) => ({ value: s, label: DISCOM_STAGE_LABEL[s] }))}
              />
            </Field>
            <Field label="DISCOM name">
              <Input
                value={discom.discomName ?? ""}
                onChange={(e) => setDiscom({ ...discom, discomName: e.target.value })}
                placeholder="MSEDCL, BSES, UPPCL…"
              />
            </Field>
            <Field label="Connection type">
              <Select
                placeholder="Select"
                value={discom.connectionType ?? ""}
                onChange={(e) => setDiscom({ ...discom, connectionType: (e.target.value || null) as ConnectionType | null })}
                options={CONNECTION_TYPES.map((c) => ({ value: c, label: CONNECTION_TYPE_LABEL[c] }))}
              />
            </Field>
            <Field label="Sanctioned load (kVA)">
              <Input
                type="number"
                min={0}
                value={discom.sanctionedLoadKva ?? ""}
                onChange={(e) => setDiscom({ ...discom, sanctionedLoadKva: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Application number">
              <Input value={discom.applicationNo ?? ""} onChange={(e) => setDiscom({ ...discom, applicationNo: e.target.value })} />
            </Field>
            <Field label="Consumer number">
              <Input value={discom.consumerNumber ?? ""} onChange={(e) => setDiscom({ ...discom, consumerNumber: e.target.value })} />
            </Field>
            <Field label="Demand note amount">
              <Input
                type="number"
                min={0}
                step={1000}
                value={discom.demandNoteAmount ?? ""}
                onChange={(e) => setDiscom({ ...discom, demandNoteAmount: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Applied on">
              <Input
                type="date"
                value={toInput(discom.appliedAt)}
                onChange={(e) => setDiscom({ ...discom, appliedAt: fromInput(e.target.value) as never })}
              />
            </Field>
            <Field label="Energised on">
              <Input
                type="date"
                value={toInput(discom.energisedAt)}
                onChange={(e) => setDiscom({ ...discom, energisedAt: fromInput(e.target.value) as never })}
              />
            </Field>
            <Field label="Note" className="sm:col-span-2">
              <Textarea rows={2} value={discom.note ?? ""} onChange={(e) => setDiscom({ ...discom, note: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
