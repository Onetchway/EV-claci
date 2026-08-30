"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Pencil, Plus, Printer, Trash2, Upload } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, ProgressBar,
  Select, StatCard, Textarea, useAsyncAction, useToast,
} from "@/components/ui";
import {
  BOQ_CATEGORIES, BOQ_CATEGORY_LABEL, DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABEL, DRAWING_DISCIPLINES,
  DRAWING_STATUSES, HANDOVER_STAGES, HANDOVER_STAGE_LABEL, INSPECTION_RESULTS, ISSUE_PRIORITIES, ISSUE_STATUSES,
  NCR_STATUSES, PAYMENT_MODES, PROJECT_STATUSES, PROJECT_TYPES, PUNCH_ITEM_STATUSES, RFI_STATUSES,
  SITE_REPORT_TYPES, STAGE_STATUSES, STAGE_TEMPLATES, TASK_STATUSES, statusMeta,
  type BoqCategory, type DocumentCategory, type DrawingDiscipline, type DrawingStatus, type HandoverStage,
  type InspectionResult, type IssuePriority, type IssueStatus, type NcrStatus, type PaymentMode,
  type ProjectStatus, type ProjectType, type PunchItemStatus, type RfiStatus, type SiteReportType,
  type StageStatus, type TaskStatus,
} from "@/lib/constants";
import { ItemsTable, ITEM_FIELDS, BOQ_FIELDS, QUOTATION_ITEM_FIELDS, PO_ITEM_FIELDS, type DraftItem, type DraftBoqItem } from "@/components/line-items-table";
import { computeBoqTotals, createBoq, deleteBoq, subscribeBoqsForProject, updateBoq } from "@/lib/db/boq";
import { listActiveClients } from "@/lib/db/clients";
import { deleteDocument, subscribeDocumentsForProject, uploadDocument } from "@/lib/db/documents";
import { subscribeDrawingsForProject, updateDrawingStatus, uploadDrawing } from "@/lib/db/drawings";
import {
  advanceHandoverStage, createPunchItem, getOrCreateHandover, subscribeHandover, subscribePunchItemsForProject,
  updatePunchItem,
} from "@/lib/db/handover";
import { createIssue, deleteIssue, subscribeIssuesForProject, updateIssue } from "@/lib/db/issues";
import { recordMeasurement, subscribeMeasurementsForProject } from "@/lib/db/measurements";
import { createInspection, createNcr, subscribeInspectionsForProject, subscribeNcrsForProject, updateNcr } from "@/lib/db/quality";
import { createRfi, respondToRfi, subscribeRfisForProject, updateRfiStatus } from "@/lib/db/rfis";
import { recordClientPayment, recordVendorPayment, subscribeClientPayments, subscribeVendorPayments } from "@/lib/db/payments";
import { createProformaInvoice, deleteProformaInvoice, subscribePisForProject, updateProformaInvoice } from "@/lib/db/proforma-invoices";
import { subscribeProjectTemplates } from "@/lib/db/project-templates";
import { assignTeamMember, subscribeProject, subscribeSubprojects, trashProject, unassignTeamMember, updateProject } from "@/lib/db/projects";
import { canManageIssues, canManageStages, canManageTasks, canTrash } from "@/lib/permissions";
import { createPurchaseOrder, deletePurchaseOrder, subscribePosForProject, updatePurchaseOrder } from "@/lib/db/purchase-orders";
import { createQuotation, deleteQuotation, nextQuotationVersion, subscribeQuotationsForProject, updateQuotation } from "@/lib/db/quotations";
import { createSiteReport, subscribeSiteReportsForProject } from "@/lib/db/site-reports";
import { createStage, deleteStage, subscribeStagesForProject, updateStage } from "@/lib/db/stages";
import { createTask, deleteTask, subscribeTasksForProject, updateTask } from "@/lib/db/tasks";
import { listActiveTeamMembers } from "@/lib/db/team-members";
import { listActiveVendors } from "@/lib/db/vendors";
import type {
  Boq, BoqLineItem, Client, Drawing, Handover, Inspection, Issue, Measurement, NakjmDocument, Ncr, Project,
  ProformaInvoice, ProjectStage, ProjectTask, PunchItem, PurchaseOrder, Quotation, Rfi, SiteReport, TeamMember, Vendor,
} from "@/lib/types";
import { formatCompactINR, formatDate, formatDateTime, formatINR, toDate } from "@/lib/utils";

const TABS = ["Overview", "Stages & Tasks", "Timeline", "Measurements", "Issues", "RFI", "Quality", "Drawings", "Handover", "Reports", "Quotations", "BOQ", "Purchase Orders", "Proforma Invoices", "Payments", "Team", "Site Reports", "Documents"] as const;

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const viewer = useViewer();
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [form, setForm] = useState<{
    name: string; projectType: ProjectType; status: ProjectStatus; projectManagerId: string;
    city: string; state: string; address: string; capacityKw: string; budgetAmount: string;
    contractValue: string; startDate: string; targetEndDate: string; pocName: string; pocPhone: string; pocEmail: string; notes: string;
    clientRequirements: string;
  } | null>(null);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeProject(id, setProject), [id]);
  useEffect(() => { void listActiveTeamMembers().then(setTeam); }, []);

  if (!project) return <p className="text-sm text-ink-400">Loading…</p>;

  function openEdit() {
    setForm({
      name: project!.name, projectType: project!.projectType, status: project!.status,
      projectManagerId: project!.projectManagerId ?? "",
      city: project!.site?.city ?? "", state: project!.site?.state ?? "", address: project!.site?.address ?? "",
      capacityKw: project!.capacityKw != null ? String(project!.capacityKw) : "",
      budgetAmount: String(project!.budgetAmount ?? 0), contractValue: String(project!.contractValue ?? 0),
      startDate: project!.startDate ? project!.startDate.toDate().toISOString().slice(0, 10) : "",
      targetEndDate: project!.targetEndDate ? project!.targetEndDate.toDate().toISOString().slice(0, 10) : "",
      pocName: project!.pocName ?? "", pocPhone: project!.pocPhone ?? "", pocEmail: project!.pocEmail ?? "", notes: project!.notes ?? "",
      clientRequirements: project!.clientRequirements ?? "",
    });
    setEditOpen(true);
  }

  async function onSave() {
    if (!form || !form.name.trim() || !project) return;
    await run(async () => {
      const pm = team.find((t) => t.id === form.projectManagerId);
      await updateProject(project, {
        name: form.name, projectManagerId: pm?.id ?? null, projectManagerName: pm?.name ?? null,
        site: { city: form.city, state: form.state, address: form.address },
        capacityKw: form.capacityKw ? Number(form.capacityKw) : null,
        status: form.status, budgetAmount: Number(form.budgetAmount) || 0, contractValue: Number(form.contractValue) || 0,
        startDate: form.startDate ? new Date(form.startDate) : null,
        targetEndDate: form.targetEndDate ? new Date(form.targetEndDate) : null,
        pocName: form.pocName, pocPhone: form.pocPhone, pocEmail: form.pocEmail, notes: form.notes,
        clientRequirements: form.clientRequirements,
      }, actor);
      setEditOpen(false);
    }, "Project updated.");
  }

  return (
    <div className="space-y-5">
      <div className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-ink-400">{project.code}</p>
            <h1 className="text-xl font-semibold text-ink-900">{project.name}</h1>
            <p className="text-sm text-ink-500">{project.clientName} · {[project.site?.city, project.site?.state].filter(Boolean).join(", ")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusMeta(project.status).className}>{statusMeta(project.status).label}</Badge>
            <Button size="sm" onClick={openEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
            {canTrash(viewer) && (
              <Button size="sm" className="text-rose-700 hover:bg-rose-50" onClick={() => setTrashOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        title="Delete this project?"
        description="Moves it to Trash — it disappears from every list, but an admin can restore it from Trash at any time. Nothing is permanently deleted."
        footer={
          <>
            <Button onClick={() => setTrashOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  await trashProject(project, actor);
                  setTrashOpen(false);
                  router.push("/projects");
                }, "Project moved to Trash.")
              }
            >
              <Trash2 className="h-4 w-4" /> Move to Trash
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">{project.code} — {project.name}</p>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Project"
        wide
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={() => void onSave()} loading={busy}>Save</Button></>}
      >
        {form && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project Name" required className="col-span-2">
              <Input value={form.name} onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })} />
            </Field>
            <Field label="Project Type">
              <Select value={form.projectType} options={PROJECT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))} onChange={(e) => setForm((f) => f && { ...f, projectType: e.target.value as ProjectType })} />
            </Field>
            <Field label="Status">
              <Select value={form.status} options={PROJECT_STATUSES.map((s) => ({ value: s, label: statusMeta(s).label }))} onChange={(e) => setForm((f) => f && { ...f, status: e.target.value as ProjectStatus })} />
            </Field>
            <Field label="City"><Input value={form.city} onChange={(e) => setForm((f) => f && { ...f, city: e.target.value })} /></Field>
            <Field label="State"><Input value={form.state} onChange={(e) => setForm((f) => f && { ...f, state: e.target.value })} /></Field>
            <Field label="Capacity (kW)"><Input type="number" value={form.capacityKw} onChange={(e) => setForm((f) => f && { ...f, capacityKw: e.target.value })} /></Field>
            <Field label="Project Manager">
              <Select placeholder="Unassigned" value={form.projectManagerId} options={team.map((t) => ({ value: t.id, label: t.name }))} onChange={(e) => setForm((f) => f && { ...f, projectManagerId: e.target.value })} />
            </Field>
            <Field label="Budget (₹)"><Input type="number" value={form.budgetAmount} onChange={(e) => setForm((f) => f && { ...f, budgetAmount: e.target.value })} /></Field>
            <Field label="Contract Value (₹)"><Input type="number" value={form.contractValue} onChange={(e) => setForm((f) => f && { ...f, contractValue: e.target.value })} /></Field>
            <Field label="Start Date"><Input type="date" value={form.startDate} onChange={(e) => setForm((f) => f && { ...f, startDate: e.target.value })} /></Field>
            <Field label="Target End Date"><Input type="date" value={form.targetEndDate} onChange={(e) => setForm((f) => f && { ...f, targetEndDate: e.target.value })} /></Field>
            <Field label="Site Address" className="col-span-2"><Textarea value={form.address} onChange={(e) => setForm((f) => f && { ...f, address: e.target.value })} /></Field>
            <Field label="POC Name"><Input value={form.pocName} onChange={(e) => setForm((f) => f && { ...f, pocName: e.target.value })} /></Field>
            <Field label="POC Phone"><Input value={form.pocPhone} onChange={(e) => setForm((f) => f && { ...f, pocPhone: e.target.value })} /></Field>
            <Field label="POC Email" className="col-span-2"><Input type="email" value={form.pocEmail} onChange={(e) => setForm((f) => f && { ...f, pocEmail: e.target.value })} /></Field>
            <Field label="Notes" className="col-span-2"><Textarea value={form.notes} onChange={(e) => setForm((f) => f && { ...f, notes: e.target.value })} /></Field>
            <Field label="Client Requirements" className="col-span-2" hint="What the client actually asked for — shown on the stage-wise client report.">
              <Textarea value={form.clientRequirements} onChange={(e) => setForm((f) => f && { ...f, clientRequirements: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>

      <div className="flex gap-1 overflow-x-auto border-b border-ink-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-800"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab project={project} />}
      {tab === "Stages & Tasks" && <StagesTasksTab project={project} />}
      {tab === "Timeline" && <TimelineTab project={project} />}
      {tab === "Measurements" && <MeasurementsTab project={project} />}
      {tab === "Issues" && <IssuesTab project={project} />}
      {tab === "RFI" && <RfiTab project={project} />}
      {tab === "Quality" && <QualityTab project={project} />}
      {tab === "Drawings" && <DrawingsTab project={project} />}
      {tab === "Handover" && <HandoverTab project={project} />}
      {tab === "Reports" && <ReportsTab project={project} />}
      {tab === "Quotations" && <QuotationsTab project={project} />}
      {tab === "BOQ" && <BoqTab project={project} />}
      {tab === "Purchase Orders" && <PoTab project={project} />}
      {tab === "Proforma Invoices" && <PiTab project={project} />}
      {tab === "Payments" && <PaymentsTab project={project} />}
      {tab === "Team" && <TeamTab project={project} />}
      {tab === "Site Reports" && <SiteReportsTab project={project} />}
      {tab === "Documents" && <DocumentsTab project={project} />}
    </div>
  );
}

// ── Overview ────────────────────────────────────────────────────────────
function OverviewTab({ project }: { project: Project }) {
  const [pos, setPos] = useState<PurchaseOrder[] | null>(null);
  const [pis, setPis] = useState<ProformaInvoice[] | null>(null);
  const [cps, setCps] = useState<{ amount: number }[] | null>(null);
  const [reports, setReports] = useState<SiteReport[] | null>(null);
  const [subprojects, setSubprojects] = useState<Project[]>([]);
  const [stages, setStages] = useState<ProjectStage[] | null>(null);

  useEffect(() => subscribePosForProject(project.id, setPos), [project.id]);
  useEffect(() => subscribePisForProject(project.id, setPis), [project.id]);
  useEffect(() => subscribeClientPayments({ projectId: project.id }, setCps), [project.id]);
  useEffect(() => subscribeSiteReportsForProject(project.id, setReports), [project.id]);
  useEffect(() => subscribeSubprojects(project.id, setSubprojects), [project.id]);
  useEffect(() => subscribeStagesForProject(project.id, setStages), [project.id]);

  const health = computeProjectHealth(project, stages ?? []);

  const committed = (pos ?? []).filter((p) => p.status !== "CANCELLED").reduce((s, p) => s + p.totalAmount, 0);
  const paidToVendors = (pos ?? []).reduce((s, p) => s + p.paidAmount, 0);
  const invoiced = (pis ?? []).filter((p) => p.status !== "CANCELLED").reduce((s, p) => s + p.totalAmount, 0);
  const collected = (cps ?? []).reduce((s, p) => s + p.amount, 0);
  const latestProgress = reports?.[0]?.progressPct ?? 0;
  const collectionPct = project.contractValue > 0 ? Math.round((collected / project.contractValue) * 100) : 0;
  const budgetPct = project.budgetAmount > 0 ? Math.round((paidToVendors / project.budgetAmount) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Contract Value" value={formatCompactINR(project.contractValue)} />
        <StatCard label="Budget" value={formatCompactINR(project.budgetAmount)} />
        <StatCard label="Estimated Margin" value={formatCompactINR(project.contractValue - committed)} tone="positive" />
        <StatCard label="Site Progress" value={`${latestProgress}%`} />
      </div>

      <Card title="Project Health">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${health.className}`}>
            <span className="h-2 w-2 rounded-full bg-current" /> {health.label}
          </span>
          <span className="text-sm text-ink-500">{health.detail}</span>
        </div>
        {stages && stages.length > 0 && (
          <div className="mt-4 space-y-2">
            {stages.map((s) => (
              <div key={s.id} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 truncate text-ink-700">{s.name}</span>
                <ProgressBar pct={s.progressPct} className="flex-1" />
                <span className="w-10 shrink-0 text-right tabular-nums text-ink-500">{s.progressPct}%</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Client Collection">
          <div className="space-y-2 text-sm">
            <Row label="Invoiced" value={formatINR(invoiced)} />
            <Row label="Collected" value={formatINR(collected)} tone="positive" />
            <Row label="Pending" value={formatINR(Math.max(invoiced - collected, 0))} tone="negative" />
            <ProgressBar pct={collectionPct} className="mt-2" />
            <p className="text-xs text-ink-500">{collectionPct}% of contract value collected</p>
          </div>
        </Card>
        <Card title="Vendor Spend">
          <div className="space-y-2 text-sm">
            <Row label="Committed (POs)" value={formatINR(committed)} />
            <Row label="Paid" value={formatINR(paidToVendors)} tone="positive" />
            <Row label="Outstanding" value={formatINR(Math.max(committed - paidToVendors, 0))} tone="negative" />
            <ProgressBar pct={budgetPct} className="mt-2" />
            <p className="text-xs text-ink-500">{budgetPct}% of budget utilized</p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div><p className="text-ink-400">Project Manager</p><p className="font-medium">{project.projectManagerName || "—"}</p></div>
          <div><p className="text-ink-400">POC</p><p className="font-medium">{project.pocName || "—"}</p></div>
          <div><p className="text-ink-400">Start Date</p><p className="font-medium">{formatDate(project.startDate)}</p></div>
          <div><p className="text-ink-400">Target End</p><p className="font-medium">{formatDate(project.targetEndDate)}</p></div>
        </div>
      </Card>

      {project.parentProjectId && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm text-indigo-800">
          Sub-project of <Link href={`/projects/${project.parentProjectId}`} className="font-medium underline">{project.parentProjectCode}</Link>
        </div>
      )}

      <Card
        title="Sub-projects"
        actions={<Link href={`/projects/new?parentProjectId=${project.id}`}><Button size="sm"><Plus className="h-3.5 w-3.5" /> New Sub-project</Button></Link>}
      >
        {subprojects.length === 0 ? (
          <p className="text-sm text-ink-400">No sub-projects yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-ink-200">
            <table className="w-full">
              <thead><tr><th className="th">Code</th><th className="th">Name</th><th className="th">Status</th><th className="th">Contract Value</th></tr></thead>
              <tbody>
                {subprojects.map((sp) => (
                  <tr key={sp.id} className="border-t border-ink-100">
                    <td className="td"><Link href={`/projects/${sp.id}`} className="font-medium text-brand-700">{sp.code}</Link></td>
                    <td className="td">{sp.name}</td>
                    <td className="td"><Badge className={statusMeta(sp.status).className}>{statusMeta(sp.status).label}</Badge></td>
                    <td className="td">{formatINR(sp.contractValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Auto health indicator: compares average stage progress to the fraction of
 * the planned schedule elapsed. No stages / no dates yet -> grey (unknown),
 * ON_HOLD/COMPLETED short-circuit to their own state.
 */
function computeProjectHealth(project: Project, stages: ProjectStage[]): { label: string; detail: string; className: string } {
  const GREY = "bg-ink-100 text-ink-600 ring-ink-200";
  if (project.status === "ON_HOLD") return { label: "On Hold", detail: "Project is paused.", className: GREY };
  if (project.status === "COMPLETED") return { label: "Completed", detail: "Project delivered.", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  if (stages.some((s) => s.status === "BLOCKED")) return { label: "Delayed", detail: "One or more stages are blocked.", className: "bg-rose-50 text-rose-700 ring-rose-200" };

  const start = toDate(project.startDate);
  const end = toDate(project.targetEndDate);
  if (!stages.length || !start || !end || end <= start) {
    return { label: "Not Started", detail: "Add stages and a schedule to track health.", className: GREY };
  }

  const actualProgress = stages.reduce((s, st) => s + st.progressPct, 0) / stages.length;
  const now = Date.now();
  const elapsedPct = Math.max(0, Math.min(100, ((now - start.getTime()) / (end.getTime() - start.getTime())) * 100));
  const delta = actualProgress - elapsedPct;

  if (delta >= -5) return { label: "On Track", detail: `${Math.round(actualProgress)}% done vs ${Math.round(elapsedPct)}% of schedule elapsed.`, className: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  if (delta >= -15) return { label: "At Risk", detail: `${Math.round(actualProgress)}% done vs ${Math.round(elapsedPct)}% of schedule elapsed.`, className: "bg-amber-50 text-amber-700 ring-amber-200" };
  return { label: "Delayed", detail: `${Math.round(actualProgress)}% done vs ${Math.round(elapsedPct)}% of schedule elapsed.`, className: "bg-rose-50 text-rose-700 ring-rose-200" };
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{label}</span>
      <span className={`font-semibold ${tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "text-ink-900"}`}>{value}</span>
    </div>
  );
}

// ── Shared line-item editor ─────────────────────────────────────────────
// ── Quotations ──────────────────────────────────────────────────────────
function QuotationsTab({ project }: { project: Project }) {
  const actor = useActor();
  const viewer = useViewer();
  const router = useRouter();
  const [rows, setRows] = useState<Quotation[] | null>(null);
  const [boqs, setBoqs] = useState<Boq[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null);
  const [form, setForm] = useState({ quotationNo: "", validUntil: "", taxPercent: "18", gstType: "IGST" as "IGST" | "CGST_SGST", terms: "", notes: "" });
  const [items, setItems] = useState<DraftItem[]>([]);
  const [sourceBoqId, setSourceBoqId] = useState<string | null>(null);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeQuotationsForProject(project.id, setRows), [project.id]);
  useEffect(() => subscribeBoqsForProject(project.id, setBoqs), [project.id]);

  function openEdit(q: Quotation) {
    setEditing(q);
    setSourceBoqId(q.sourceBoqId ?? null);
    setItems(q.items.map((it) => ({ description: it.description, unit: it.unit, qty: it.qty, rate: it.rate, hsnCode: it.hsnCode })));
    setForm({
      quotationNo: q.quotationNo,
      validUntil: q.validUntil ? q.validUntil.toDate().toISOString().slice(0, 10) : "",
      taxPercent: String(q.taxPercent),
      gstType: q.gstType ?? "IGST",
      terms: q.terms ?? "",
      notes: q.notes ?? "",
    });
    setShowForm(true);
  }

  async function onSave() {
    if (!form.quotationNo.trim()) return;
    await run(async () => {
      if (editing) {
        await updateQuotation(editing, {
          quotationNo: form.quotationNo,
          validUntil: form.validUntil ? new Date(form.validUntil) : null,
          items,
          taxPercent: Number(form.taxPercent) || 0,
          gstType: form.gstType,
          terms: form.terms,
          notes: form.notes,
        }, actor);
      } else {
        const version = await nextQuotationVersion(project.id);
        await createQuotation({
          quotationNo: form.quotationNo,
          projectId: project.id,
          projectName: project.name,
          clientId: project.clientId,
          version,
          quotationDate: new Date(),
          validUntil: form.validUntil ? new Date(form.validUntil) : null,
          items,
          taxPercent: Number(form.taxPercent) || 0,
          gstType: form.gstType,
          terms: form.terms,
          notes: form.notes,
          sourceBoqId,
        }, actor);
      }
      setShowForm(false); setEditing(null); setItems([]); setSourceBoqId(null);
    }, editing ? "Quotation updated." : "Quotation created.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        {boqs.length > 0 && (
          <Select
            defaultValue=""
            className="w-56"
            options={boqs.map((b) => ({ value: b.id, label: `${b.boqNo} (v${b.version})` }))}
            placeholder="Generate from BOQ…"
            onChange={(e) => { if (e.target.value) router.push(`/quotations/new?projectId=${project.id}&sourceBoqId=${e.target.value}`); }}
          />
        )}
        <Link href={`/quotations/new?projectId=${project.id}`}><Button><Plus className="h-4 w-4" /> New Quotation</Button></Link>
      </div>

      {!rows ? <p className="text-sm text-ink-400">Loading…</p> : rows.length === 0 ? (
        <EmptyState title="No quotations yet" description="All versions of a quotation appear here as they're created." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">No.</th><th className="th">Version</th><th className="th">Status</th><th className="th">Valid Until</th><th className="th">Total</th><th className="th"></th></tr></thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id} className="border-t border-ink-100">
                  <td className="td font-medium"><Link href={`/quotations/${q.id}`} className="text-brand-700 hover:underline">{q.quotationNo}</Link></td>
                  <td className="td">v{q.version}</td>
                  <td className="td"><Badge>{q.status}</Badge></td>
                  <td className="td">{formatDate(q.validUntil)}</td>
                  <td className="td">{formatINR(q.totalAmount)}</td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/projects/${project.id}/quotations/${q.id}/print`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                        <Printer className="h-3.5 w-3.5" /> Print
                      </Link>
                      <button onClick={() => openEdit(q)} className="inline-flex items-center gap-1 text-ink-600 hover:underline"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                      {canTrash(viewer) && <button onClick={() => setDeleteTarget(q)} className="inline-flex items-center gap-1 text-rose-600 hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Quotation" : "New Quotation"}
        wide
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onSave()} loading={busy}>{editing ? "Save" : "Create"}</Button></>}
      >
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Field label="Quotation No." required><Input value={form.quotationNo} onChange={(e) => setForm((f) => ({ ...f, quotationNo: e.target.value }))} /></Field>
          <Field label="Valid Until"><Input type="date" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} /></Field>
          <Field label="Tax %"><Input type="number" value={form.taxPercent} onChange={(e) => setForm((f) => ({ ...f, taxPercent: e.target.value }))} /></Field>
          <Field label="GST Type">
            <div className="flex items-center gap-4 pt-2 text-sm">
              <label className="flex items-center gap-1.5"><input type="radio" checked={form.gstType === "IGST"} onChange={() => setForm((f) => ({ ...f, gstType: "IGST" }))} /> IGST</label>
              <label className="flex items-center gap-1.5"><input type="radio" checked={form.gstType === "CGST_SGST"} onChange={() => setForm((f) => ({ ...f, gstType: "CGST_SGST" }))} /> CGST &amp; SGST</label>
            </div>
          </Field>
          <Field label="Terms &amp; Conditions" className="col-span-2"><Textarea value={form.terms} onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))} /></Field>
        </div>
        <ItemsTable items={items} setItems={setItems} fields={QUOTATION_ITEM_FIELDS} />
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete this quotation?"
        description="This cannot be undone."
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => void run(async () => { if (deleteTarget) await deleteQuotation(deleteTarget, actor); setDeleteTarget(null); }, "Quotation deleted.")}><Trash2 className="h-4 w-4" /> Delete</Button></>}
      >
        {deleteTarget && <p className="text-sm text-ink-700">{deleteTarget.quotationNo}</p>}
      </Modal>
    </div>
  );
}

// ── BOQ ─────────────────────────────────────────────────────────────────
function BoqTab({ project }: { project: Project }) {
  const actor = useActor();
  const viewer = useViewer();
  const [rows, setRows] = useState<Boq[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Boq | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Boq | null>(null);
  const [form, setForm] = useState({ boqNo: "", siteName: "", notes: "" });
  const [items, setItems] = useState<DraftBoqItem[]>([]);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeBoqsForProject(project.id, setRows), [project.id]);

  function openEdit(b: Boq) {
    setEditing(b);
    setItems(b.items.map((it) => ({ section: it.section, description: it.description, makeOem: it.makeOem, unit: it.unit, qty: it.qty, supplyRate: it.supplyRate, installationRate: it.installationRate, category: it.category })));
    setForm({ boqNo: b.boqNo, siteName: b.siteName ?? "", notes: b.notes ?? "" });
    setShowForm(true);
  }

  async function onSave() {
    if (!form.boqNo.trim()) return;
    await run(async () => {
      const cleanItems = items.map((it) => ({ ...it, category: (it.category as BoqCategory) || "OTHER" })) as BoqLineItem[];
      if (editing) {
        await updateBoq(editing, { boqNo: form.boqNo, siteName: form.siteName, items: cleanItems, notes: form.notes }, actor);
      } else {
        await createBoq({ boqNo: form.boqNo, projectId: project.id, projectName: project.name, siteName: form.siteName, items: cleanItems, notes: form.notes }, actor);
      }
      setShowForm(false); setEditing(null); setItems([]); setForm({ boqNo: "", siteName: "", notes: "" });
    }, editing ? "BOQ updated." : "BOQ created.");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Link href={`/boq/new?projectId=${project.id}`}><Button><Plus className="h-4 w-4" /> New BOQ</Button></Link>
      </div>

      {!rows ? <p className="text-sm text-ink-400">Loading…</p> : rows.length === 0 ? (
        <EmptyState title="No BOQs yet" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">No.</th><th className="th">Site</th><th className="th">Status</th><th className="th">Date</th><th className="th">Total</th><th className="th"></th></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-t border-ink-100">
                  <td className="td font-medium"><Link href={`/boq/${b.id}`} className="text-brand-700 hover:underline">{b.boqNo}</Link></td>
                  <td className="td">{b.siteName || "—"}</td>
                  <td className="td"><Badge>{b.status}</Badge></td>
                  <td className="td">{formatDate(b.boqDate)}</td>
                  <td className="td">{formatINR(b.totalAmount)}</td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/projects/${project.id}/boq/${b.id}/print`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                        <Printer className="h-3.5 w-3.5" /> Print
                      </Link>
                      <button onClick={() => openEdit(b)} className="inline-flex items-center gap-1 text-ink-600 hover:underline"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                      {canTrash(viewer) && <button onClick={() => setDeleteTarget(b)} className="inline-flex items-center gap-1 text-rose-600 hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit BOQ" : "New BOQ"}
        wide
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onSave()} loading={busy}>{editing ? "Save" : "Create"}</Button></>}
      >
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Field label="BOQ No." required><Input value={form.boqNo} onChange={(e) => setForm((f) => ({ ...f, boqNo: e.target.value }))} /></Field>
          <Field label="Site Name"><Input value={form.siteName} onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))} /></Field>
        </div>
        <ItemsTable items={items} setItems={setItems} fields={BOQ_FIELDS} />
        <p className="mt-2 text-xs text-ink-500">Category defaults to OTHER for imported rows; categories: {BOQ_CATEGORIES.join(", ")}.</p>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete this BOQ?"
        description="This cannot be undone."
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => void run(async () => { if (deleteTarget) await deleteBoq(deleteTarget, actor); setDeleteTarget(null); }, "BOQ deleted.")}><Trash2 className="h-4 w-4" /> Delete</Button></>}
      >
        {deleteTarget && <p className="text-sm text-ink-700">{deleteTarget.boqNo}</p>}
      </Modal>
    </div>
  );
}

// ── Purchase Orders ─────────────────────────────────────────────────────
function PoTab({ project }: { project: Project }) {
  const actor = useActor();
  const viewer = useViewer();
  const [rows, setRows] = useState<PurchaseOrder[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);
  const [form, setForm] = useState({ poNo: "", vendorId: "", deliveryDate: "", notes: "" });
  const [items, setItems] = useState<DraftItem[]>([]);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribePosForProject(project.id, setRows), [project.id]);
  useEffect(() => { void listActiveVendors().then(setVendors); }, []);

  function openEdit(po: PurchaseOrder) {
    setEditing(po);
    setItems(po.items.map((it) => ({ description: it.description, unit: it.unit, qty: it.qty, rate: it.rate })));
    setForm({
      poNo: po.poNo, vendorId: po.vendorId,
      deliveryDate: po.deliveryDate ? po.deliveryDate.toDate().toISOString().slice(0, 10) : "",
      notes: po.notes ?? "",
    });
    setShowForm(true);
  }

  async function onSave() {
    if (!form.poNo.trim() || !form.vendorId) return;
    await run(async () => {
      const vendor = vendors.find((v) => v.id === form.vendorId);
      if (editing) {
        await updatePurchaseOrder(editing, {
          poNo: form.poNo, vendorId: form.vendorId, vendorName: vendor?.name ?? editing.vendorName,
          deliveryDate: form.deliveryDate ? new Date(form.deliveryDate) : null, items, notes: form.notes,
        }, actor);
      } else {
        await createPurchaseOrder({
          poNo: form.poNo, projectId: project.id, projectName: project.name, vendorId: form.vendorId, vendorName: vendor?.name ?? "",
          deliveryDate: form.deliveryDate ? new Date(form.deliveryDate) : null, items, notes: form.notes,
        }, actor);
      }
      setShowForm(false); setEditing(null); setItems([]); setForm({ poNo: "", vendorId: "", deliveryDate: "", notes: "" });
    }, editing ? "Purchase order updated." : "Purchase order created.");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Link href={`/purchase-orders/new?projectId=${project.id}`}><Button><Plus className="h-4 w-4" /> New PO</Button></Link></div>
      {!rows ? <p className="text-sm text-ink-400">Loading…</p> : rows.length === 0 ? (
        <EmptyState title="No purchase orders yet" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">No.</th><th className="th">Vendor</th><th className="th">Status</th><th className="th">Total</th><th className="th">Paid</th><th className="th"></th></tr></thead>
            <tbody>
              {rows.map((po) => (
                <tr key={po.id} className="border-t border-ink-100">
                  <td className="td font-medium"><Link href={`/purchase-orders/${po.id}`} className="text-brand-700 hover:underline">{po.poNo}</Link></td>
                  <td className="td">{po.vendorName}</td>
                  <td className="td"><Badge>{po.status}</Badge></td>
                  <td className="td">{formatINR(po.totalAmount)}</td>
                  <td className="td text-emerald-600">{formatINR(po.paidAmount)}</td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/projects/${project.id}/purchase-orders/${po.id}/print`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                        <Printer className="h-3.5 w-3.5" /> Print
                      </Link>
                      <button onClick={() => openEdit(po)} className="inline-flex items-center gap-1 text-ink-600 hover:underline"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                      {canTrash(viewer) && <button onClick={() => setDeleteTarget(po)} className="inline-flex items-center gap-1 text-rose-600 hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Purchase Order" : "New Purchase Order"}
        wide
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onSave()} loading={busy}>{editing ? "Save" : "Create"}</Button></>}
      >
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Field label="PO No." required><Input value={form.poNo} onChange={(e) => setForm((f) => ({ ...f, poNo: e.target.value }))} /></Field>
          <Field label="Vendor" required>
            <Select value={form.vendorId} placeholder="Select vendor…" options={vendors.map((v) => ({ value: v.id, label: v.name }))} onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))} />
          </Field>
          <Field label="Delivery Date"><Input type="date" value={form.deliveryDate} onChange={(e) => setForm((f) => ({ ...f, deliveryDate: e.target.value }))} /></Field>
        </div>
        <ItemsTable items={items} setItems={setItems} fields={ITEM_FIELDS} />
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete this purchase order?"
        description="This cannot be undone."
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => void run(async () => { if (deleteTarget) await deletePurchaseOrder(deleteTarget, actor); setDeleteTarget(null); }, "Purchase order deleted.")}><Trash2 className="h-4 w-4" /> Delete</Button></>}
      >
        {deleteTarget && <p className="text-sm text-ink-700">{deleteTarget.poNo}</p>}
      </Modal>
    </div>
  );
}

// ── Proforma Invoices ───────────────────────────────────────────────────
function PiTab({ project }: { project: Project }) {
  const actor = useActor();
  const viewer = useViewer();
  const [rows, setRows] = useState<ProformaInvoice[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProformaInvoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProformaInvoice | null>(null);
  const [form, setForm] = useState({ piNo: "", dueDate: "", milestone: "", taxAmount: "0", gstType: "IGST" as "IGST" | "CGST_SGST", terms: "", notes: "" });
  const [items, setItems] = useState<DraftItem[]>([]);
  const [poFile, setPoFile] = useState<File | null>(null);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribePisForProject(project.id, setRows), [project.id]);

  function openEdit(pi: ProformaInvoice) {
    setEditing(pi);
    setItems(pi.items.map((it) => ({ description: it.description, unit: it.unit, qty: it.qty, rate: it.rate, hsnCode: it.hsnCode })));
    setForm({
      piNo: pi.piNo, dueDate: pi.dueDate ? pi.dueDate.toDate().toISOString().slice(0, 10) : "",
      milestone: pi.milestone ?? "", taxAmount: String(pi.taxAmount), gstType: pi.gstType ?? "IGST", terms: pi.terms ?? "", notes: pi.notes ?? "",
    });
    setPoFile(null);
    setShowForm(true);
  }

  async function onSave() {
    if (!form.piNo.trim()) return;
    await run(async () => {
      if (editing) {
        await updateProformaInvoice(editing, {
          piNo: form.piNo, dueDate: form.dueDate ? new Date(form.dueDate) : null,
          milestone: form.milestone, items, taxAmount: Number(form.taxAmount) || 0, gstType: form.gstType, terms: form.terms, notes: form.notes,
        }, actor);
      } else {
        let sourceDocumentId: string | null = null;
        if (poFile) {
          const doc = await uploadDocument({ file: poFile, projectId: project.id, docType: "CLIENT_PO", actor });
          sourceDocumentId = doc.id;
        }
        await createProformaInvoice({
          piNo: form.piNo, projectId: project.id, projectName: project.name, clientId: project.clientId,
          dueDate: form.dueDate ? new Date(form.dueDate) : null, milestone: form.milestone, items,
          taxAmount: Number(form.taxAmount) || 0, gstType: form.gstType, terms: form.terms, notes: form.notes, sourceDocumentId,
        }, actor);
      }
      setShowForm(false); setEditing(null); setItems([]); setPoFile(null); setForm({ piNo: "", dueDate: "", milestone: "", taxAmount: "0", gstType: "IGST", terms: "", notes: "" });
    }, editing ? "Proforma invoice updated." : "Proforma invoice created.");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Link href={`/proforma-invoices/new?projectId=${project.id}`}><Button><Plus className="h-4 w-4" /> New PI</Button></Link></div>
      {!rows ? <p className="text-sm text-ink-400">Loading…</p> : rows.length === 0 ? (
        <EmptyState title="No proforma invoices yet" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">No.</th><th className="th">Milestone</th><th className="th">Status</th><th className="th">Total</th><th className="th">Paid</th><th className="th"></th></tr></thead>
            <tbody>
              {rows.map((pi) => (
                <tr key={pi.id} className="border-t border-ink-100">
                  <td className="td font-medium"><Link href={`/proforma-invoices/${pi.id}`} className="text-brand-700 hover:underline">{pi.piNo}</Link></td>
                  <td className="td">{pi.milestone || "—"}</td>
                  <td className="td"><Badge>{pi.status}</Badge></td>
                  <td className="td">{formatINR(pi.totalAmount)}</td>
                  <td className="td text-emerald-600">{formatINR(pi.paidAmount)}</td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/projects/${project.id}/proforma-invoices/${pi.id}/print`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                        <Printer className="h-3.5 w-3.5" /> Print
                      </Link>
                      <button onClick={() => openEdit(pi)} className="inline-flex items-center gap-1 text-ink-600 hover:underline"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                      {canTrash(viewer) && <button onClick={() => setDeleteTarget(pi)} className="inline-flex items-center gap-1 text-rose-600 hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Proforma Invoice" : "New Proforma Invoice"}
        wide
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onSave()} loading={busy}>{editing ? "Save" : "Create"}</Button></>}
      >
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Field label="PI No." required><Input value={form.piNo} onChange={(e) => setForm((f) => ({ ...f, piNo: e.target.value }))} /></Field>
          <Field label="Due Date"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
          <Field label="Milestone"><Input value={form.milestone} onChange={(e) => setForm((f) => ({ ...f, milestone: e.target.value }))} /></Field>
          <Field label="Tax Amount (₹)"><Input type="number" value={form.taxAmount} onChange={(e) => setForm((f) => ({ ...f, taxAmount: e.target.value }))} /></Field>
          <Field label="GST Type">
            <div className="flex items-center gap-4 pt-2 text-sm">
              <label className="flex items-center gap-1.5"><input type="radio" checked={form.gstType === "IGST"} onChange={() => setForm((f) => ({ ...f, gstType: "IGST" }))} /> IGST</label>
              <label className="flex items-center gap-1.5"><input type="radio" checked={form.gstType === "CGST_SGST"} onChange={() => setForm((f) => ({ ...f, gstType: "CGST_SGST" }))} /> CGST &amp; SGST</label>
            </div>
          </Field>
          <Field label="Terms &amp; Conditions" className="col-span-3"><Textarea value={form.terms} onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))} /></Field>
          {!editing && (
            <Field label="Client PO / Work Order" className="col-span-3" hint="Optional — generates this PI against the uploaded document.">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink-300 px-3 py-2 text-sm text-ink-600 hover:bg-ink-50">
                <Upload className="h-4 w-4" /> {poFile ? poFile.name : "Choose a file…"}
                <input type="file" className="hidden" accept=".pdf,.xlsx,.xls,.doc,.docx,image/*" onChange={(e) => setPoFile(e.target.files?.[0] ?? null)} />
              </label>
            </Field>
          )}
        </div>
        <ItemsTable items={items} setItems={setItems} fields={QUOTATION_ITEM_FIELDS} />
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete this proforma invoice?"
        description="This cannot be undone."
        footer={<><Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => void run(async () => { if (deleteTarget) await deleteProformaInvoice(deleteTarget, actor); setDeleteTarget(null); }, "Proforma invoice deleted.")}><Trash2 className="h-4 w-4" /> Delete</Button></>}
      >
        {deleteTarget && <p className="text-sm text-ink-700">{deleteTarget.piNo}</p>}
      </Modal>
    </div>
  );
}

// ── Payments ────────────────────────────────────────────────────────────
function PaymentsTab({ project }: { project: Project }) {
  const actor = useActor();
  const [clientPayments, setClientPayments] = useState<import("@/lib/types").ClientPayment[] | null>(null);
  const [vendorPayments, setVendorPayments] = useState<import("@/lib/types").VendorPayment[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [showClientForm, setShowClientForm] = useState(false);
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [clientForm, setClientForm] = useState({ amount: "", mode: "BANK_TRANSFER" as PaymentMode, referenceNo: "", milestone: "" });
  const [vendorForm, setVendorForm] = useState({ vendorId: "", amount: "", mode: "BANK_TRANSFER" as PaymentMode, referenceNo: "" });
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeClientPayments({ projectId: project.id }, setClientPayments), [project.id]);
  useEffect(() => subscribeVendorPayments({ projectId: project.id }, setVendorPayments), [project.id]);
  useEffect(() => { void listActiveVendors().then(setVendors); }, []);

  async function submitClient() {
    if (!clientForm.amount) return;
    await run(async () => {
      await recordClientPayment({
        projectId: project.id, projectName: project.name, clientId: project.clientId, clientName: project.clientName,
        amount: Number(clientForm.amount), mode: clientForm.mode, referenceNo: clientForm.referenceNo, milestone: clientForm.milestone,
      }, actor);
      setShowClientForm(false); setClientForm({ amount: "", mode: "BANK_TRANSFER", referenceNo: "", milestone: "" });
    }, "Payment recorded.");
  }

  async function submitVendor() {
    if (!vendorForm.amount || !vendorForm.vendorId) return;
    await run(async () => {
      const vendor = vendors.find((v) => v.id === vendorForm.vendorId);
      await recordVendorPayment({
        vendorId: vendorForm.vendorId, vendorName: vendor?.name ?? "", projectId: project.id, projectName: project.name,
        amount: Number(vendorForm.amount), mode: vendorForm.mode, referenceNo: vendorForm.referenceNo,
      }, actor);
      setShowVendorForm(false); setVendorForm({ vendorId: "", amount: "", mode: "BANK_TRANSFER", referenceNo: "" });
    }, "Payout recorded.");
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold text-ink-900">Client Collections</h3><Button size="sm" variant="secondary" onClick={() => setShowClientForm(true)}><Plus className="h-3.5 w-3.5" /> Record</Button></div>
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">Date</th><th className="th">Amount</th><th className="th">Mode</th></tr></thead>
            <tbody>
              {(clientPayments ?? []).length === 0 ? <tr><td colSpan={3} className="td text-center text-ink-400">None yet.</td></tr> :
                clientPayments!.map((p) => <tr key={p.id} className="border-t border-ink-100"><td className="td">{formatDate(p.paymentDate)}</td><td className="td font-medium text-emerald-600">{formatINR(p.amount)}</td><td className="td capitalize">{p.mode.replace(/_/g, " ").toLowerCase()}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold text-ink-900">Vendor Payouts</h3><Button size="sm" variant="secondary" onClick={() => setShowVendorForm(true)}><Plus className="h-3.5 w-3.5" /> Record</Button></div>
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">Date</th><th className="th">Vendor</th><th className="th">Amount</th></tr></thead>
            <tbody>
              {(vendorPayments ?? []).length === 0 ? <tr><td colSpan={3} className="td text-center text-ink-400">None yet.</td></tr> :
                vendorPayments!.map((p) => <tr key={p.id} className="border-t border-ink-100"><td className="td">{formatDate(p.paymentDate)}</td><td className="td">{p.vendorName}</td><td className="td font-medium text-rose-600">{formatINR(p.amount)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showClientForm} onClose={() => setShowClientForm(false)} title="Record Client Payment" footer={<><Button variant="secondary" onClick={() => setShowClientForm(false)}>Cancel</Button><Button onClick={() => void submitClient()} loading={busy}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)" required><Input type="number" value={clientForm.amount} onChange={(e) => setClientForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
          <Field label="Mode"><Select value={clientForm.mode} options={PAYMENT_MODES.map((m) => ({ value: m, label: m.replace(/_/g, " ") }))} onChange={(e) => setClientForm((f) => ({ ...f, mode: e.target.value as PaymentMode }))} /></Field>
          <Field label="Reference No."><Input value={clientForm.referenceNo} onChange={(e) => setClientForm((f) => ({ ...f, referenceNo: e.target.value }))} /></Field>
          <Field label="Milestone"><Input value={clientForm.milestone} onChange={(e) => setClientForm((f) => ({ ...f, milestone: e.target.value }))} /></Field>
        </div>
      </Modal>

      <Modal open={showVendorForm} onClose={() => setShowVendorForm(false)} title="Record Vendor Payment" footer={<><Button variant="secondary" onClick={() => setShowVendorForm(false)}>Cancel</Button><Button onClick={() => void submitVendor()} loading={busy}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendor" required className="col-span-2"><Select value={vendorForm.vendorId} placeholder="Select vendor…" options={vendors.map((v) => ({ value: v.id, label: v.name }))} onChange={(e) => setVendorForm((f) => ({ ...f, vendorId: e.target.value }))} /></Field>
          <Field label="Amount (₹)" required><Input type="number" value={vendorForm.amount} onChange={(e) => setVendorForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
          <Field label="Mode"><Select value={vendorForm.mode} options={PAYMENT_MODES.map((m) => ({ value: m, label: m.replace(/_/g, " ") }))} onChange={(e) => setVendorForm((f) => ({ ...f, mode: e.target.value as PaymentMode }))} /></Field>
          <Field label="Reference No." className="col-span-2"><Input value={vendorForm.referenceNo} onChange={(e) => setVendorForm((f) => ({ ...f, referenceNo: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}

// ── Stages & Tasks ─────────────────────────────────────────────────────
function StagesTasksTab({ project }: { project: Project }) {
  const actor = useActor();
  const viewer = useViewer();
  const [stages, setStages] = useState<ProjectStage[] | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[] | null>(null);
  const [boqs, setBoqs] = useState<Boq[]>([]);
  const [templates, setTemplates] = useState<Record<ProjectType, string[]> | null>(null);
  const [showStageForm, setShowStageForm] = useState(false);
  const [stageForm, setStageForm] = useState({ name: "", plannedStart: "", plannedEnd: "" });
  const [taskForm, setTaskForm] = useState<Record<string, { title: string; assigneeId: string; dueDate: string }>>({});
  const { busy, run } = useAsyncAction();
  const canStage = canManageStages(viewer);
  const canTask = canManageTasks(viewer);

  useEffect(() => subscribeStagesForProject(project.id, setStages), [project.id]);
  useEffect(() => subscribeTasksForProject(project.id, setTasks), [project.id]);
  useEffect(() => subscribeBoqsForProject(project.id, setBoqs), [project.id]);
  useEffect(() => subscribeProjectTemplates(setTemplates), []);

  async function onAddStage() {
    if (!stageForm.name.trim()) return;
    await run(async () => {
      await createStage({
        projectId: project.id, name: stageForm.name, sequence: (stages?.length ?? 0) + 1,
        plannedStart: stageForm.plannedStart ? new Date(stageForm.plannedStart) : null,
        plannedEnd: stageForm.plannedEnd ? new Date(stageForm.plannedEnd) : null,
      }, actor);
      setShowStageForm(false); setStageForm({ name: "", plannedStart: "", plannedEnd: "" });
    }, "Stage added.");
  }

  async function onGenerateFromNames(names: string[], successMsg: string) {
    if (names.length === 0) return;
    await run(async () => {
      let seq = (stages?.length ?? 0) + 1;
      for (const name of names) {
        // eslint-disable-next-line no-await-in-loop -- sequence must stay in order
        await createStage({ projectId: project.id, name, sequence: seq++ }, actor);
      }
    }, successMsg);
  }

  function onGenerateFromTemplate() {
    const names = templates?.[project.projectType] ?? STAGE_TEMPLATES[project.projectType];
    void onGenerateFromNames(names, `Generated ${names.length} stages from the ${project.projectType.replace(/_/g, " ")} template.`);
  }

  function onGenerateFromBoq() {
    const boq = boqs.find((b) => b.status === "APPROVED") ?? boqs[0];
    if (!boq) return;
    const categories = Array.from(new Set(boq.items.map((it) => it.category))).filter(Boolean) as BoqCategory[];
    const names = categories.map((c) => BOQ_CATEGORY_LABEL[c] ?? c);
    void onGenerateFromNames(names.length ? [...names, "Testing", "Commissioning", "Handover"] : [], `Generated ${names.length + 3} stages from ${boq.boqNo}.`);
  }

  async function onAddTask(stage: ProjectStage) {
    const f = taskForm[stage.id];
    if (!f?.title.trim()) return;
    await run(async () => {
      const member = project.team.find((m) => m.teamMemberId === f.assigneeId);
      await createTask({
        projectId: project.id, stageId: stage.id, stageName: stage.name, title: f.title,
        assigneeId: member?.teamMemberId ?? null, assigneeName: member?.name,
        dueDate: f.dueDate ? new Date(f.dueDate) : null,
      }, actor);
      setTaskForm((s) => ({ ...s, [stage.id]: { title: "", assigneeId: "", dueDate: "" } }));
    }, "Task added.");
  }

  const stageTasks = (stageId: string) => (tasks ?? []).filter((t) => t.stageId === stageId);

  return (
    <div className="space-y-4">
      {canStage && (
        <div className="flex flex-wrap justify-end gap-2">
          {stages && stages.length === 0 && (
            <>
              <Button variant="secondary" onClick={onGenerateFromTemplate}>Generate from {project.projectType.replace(/_/g, " ")} template</Button>
              {boqs.length > 0 && <Button variant="secondary" onClick={onGenerateFromBoq}>Generate from BOQ</Button>}
            </>
          )}
          <Button onClick={() => setShowStageForm(true)}><Plus className="h-4 w-4" /> Add Stage</Button>
        </div>
      )}

      {!stages ? <p className="text-sm text-ink-400">Loading…</p> : stages.length === 0 ? (
        <EmptyState title="No stages yet" description="Create stages manually, generate them from the project type's default template, or from the BOQ's categories — then track tasks under each." />
      ) : (
        <div className="space-y-3">
          {stages.map((stage) => (
            <Card key={stage.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-navy-900">{stage.sequence}. {stage.name}</p>
                  <p className="text-xs text-ink-500">
                    {stage.plannedStart ? formatDate(stage.plannedStart) : "—"} → {stage.plannedEnd ? formatDate(stage.plannedEnd) : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {canStage ? (
                    <Select value={stage.status} className="w-auto" options={STAGE_STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") }))} onChange={(e) => void run(() => updateStage(stage, { status: e.target.value as StageStatus }, actor), "Updated.")} />
                  ) : (
                    <Badge>{stage.status.replace("_", " ")}</Badge>
                  )}
                  {canStage && (
                    <button onClick={() => void run(async () => { await deleteStage(stage, actor); }, "Stage deleted.")} disabled={busy}>
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <ProgressBar pct={stage.progressPct} className="flex-1" />
                <span className="text-xs tabular-nums text-ink-500">{stage.progressPct}%</span>
                {canStage && (
                  <Input
                    type="number" min={0} max={100} className="w-20"
                    defaultValue={stage.progressPct}
                    onBlur={(e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      if (v !== stage.progressPct) void run(() => updateStage(stage, { progressPct: v }, actor), "Progress updated.");
                    }}
                  />
                )}
              </div>

              <div className="mt-3 space-y-1.5 border-t border-ink-100 pt-3">
                {stageTasks(stage.id).length === 0 ? (
                  <p className="text-xs text-ink-400">No tasks yet.</p>
                ) : stageTasks(stage.id).map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-ink-50 px-2.5 py-1.5 text-sm">
                    <span className="flex-1 min-w-[120px]">{t.title}</span>
                    <span className="text-xs text-ink-500">{t.assigneeName || "Unassigned"}</span>
                    {t.dueDate && <span className="text-xs text-ink-400">Due {formatDate(t.dueDate)}</span>}
                    {canTask ? (
                      <Select value={t.status} className="w-auto" options={TASK_STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") }))} onChange={(e) => void run(() => updateTask(t, { status: e.target.value as TaskStatus }, actor), "Updated.")} />
                    ) : (
                      <Badge>{t.status.replace("_", " ")}</Badge>
                    )}
                    {canTask && (
                      <button onClick={() => void run(async () => { await deleteTask(t, actor); }, "Task deleted.")} disabled={busy}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {canTask && (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-ink-100 pt-3">
                  <Field label="New task" className="min-w-[160px] flex-1">
                    <Input value={taskForm[stage.id]?.title ?? ""} onChange={(e) => setTaskForm((s) => ({ ...s, [stage.id]: { ...(s[stage.id] ?? { assigneeId: "", dueDate: "" }), title: e.target.value } }))} />
                  </Field>
                  <Field label="Assignee" className="w-40">
                    <Select
                      value={taskForm[stage.id]?.assigneeId ?? ""} placeholder="Unassigned"
                      options={project.team.map((m) => ({ value: m.teamMemberId, label: m.name }))}
                      onChange={(e) => setTaskForm((s) => ({ ...s, [stage.id]: { ...(s[stage.id] ?? { title: "", dueDate: "" }), assigneeId: e.target.value } }))}
                    />
                  </Field>
                  <Field label="Due" className="w-36">
                    <Input type="date" value={taskForm[stage.id]?.dueDate ?? ""} onChange={(e) => setTaskForm((s) => ({ ...s, [stage.id]: { ...(s[stage.id] ?? { title: "", assigneeId: "" }), dueDate: e.target.value } }))} />
                  </Field>
                  <Button onClick={() => void onAddTask(stage)} loading={busy}><Plus className="h-4 w-4" /> Add</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={showStageForm} onClose={() => setShowStageForm(false)} title="Add Stage" footer={<><Button variant="secondary" onClick={() => setShowStageForm(false)}>Cancel</Button><Button onClick={() => void onAddStage()} loading={busy}>Add</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stage Name" required className="col-span-2"><Input value={stageForm.name} onChange={(e) => setStageForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Planned Start"><Input type="date" value={stageForm.plannedStart} onChange={(e) => setStageForm((f) => ({ ...f, plannedStart: e.target.value }))} /></Field>
          <Field label="Planned End"><Input type="date" value={stageForm.plannedEnd} onChange={(e) => setStageForm((f) => ({ ...f, plannedEnd: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}

// ── Timeline (Gantt) ──────────────────────────────────────────────────
/** Simple CSS Gantt — planned bar (light) with an actual-progress overlay, scaled to the stages' own date range. */
function TimelineTab({ project }: { project: Project }) {
  const [stages, setStages] = useState<ProjectStage[] | null>(null);

  useEffect(() => subscribeStagesForProject(project.id, setStages), [project.id]);

  if (!stages) return <p className="text-sm text-ink-400">Loading…</p>;

  const withDates = stages.filter((s) => s.plannedStart && s.plannedEnd);
  if (withDates.length === 0) {
    return <EmptyState title="No planned dates yet" description="Set planned start/end dates on stages (edit a stage's status card fields) to see the timeline." />;
  }

  const starts = withDates.map((s) => toDate(s.plannedStart)!.getTime());
  const ends = withDates.map((s) => toDate(s.plannedEnd)!.getTime());
  const rangeStart = Math.min(...starts);
  const rangeEnd = Math.max(...ends);
  const rangeSpan = Math.max(rangeEnd - rangeStart, 86400000);

  return (
    <div className="space-y-4">
      <Card title="Stage Timeline" subtitle={`${formatDate(new Date(rangeStart))} — ${formatDate(new Date(rangeEnd))}`}>
        <div className="space-y-3">
          {stages.map((s) => {
            if (!s.plannedStart || !s.plannedEnd) {
              return (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 truncate text-ink-700">{s.name}</span>
                  <span className="text-xs text-ink-400">No planned dates</span>
                </div>
              );
            }
            const start = toDate(s.plannedStart)!.getTime();
            const end = toDate(s.plannedEnd)!.getTime();
            const leftPct = ((start - rangeStart) / rangeSpan) * 100;
            const widthPct = Math.max(((end - start) / rangeSpan) * 100, 1);
            const isDelayed = s.status === "DELAYED" || s.status === "BLOCKED";
            return (
              <div key={s.id} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 truncate text-ink-700">{s.name}</span>
                <div className="relative h-6 flex-1 rounded bg-ink-50">
                  <div className="absolute inset-y-0 rounded bg-ink-200" style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
                  <div
                    className={`absolute inset-y-0 rounded ${isDelayed ? "bg-rose-400" : s.status === "COMPLETED" ? "bg-emerald-500" : "bg-brand-500"}`}
                    style={{ left: `${leftPct}%`, width: `${Math.max((widthPct * s.progressPct) / 100, s.progressPct > 0 ? 1 : 0)}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-500">{s.progressPct}%</span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-ink-400">Today: {formatDate(new Date())}. Light bar = planned duration; colored bar = progress within it.</p>
      </Card>
    </div>
  );
}

// ── Measurements ───────────────────────────────────────────────────────
/** Quantity-based progress against the project's BOQ — not manual %. */
function MeasurementsTab({ project }: { project: Project }) {
  const actor = useActor();
  const viewer = useViewer();
  const [boqs, setBoqs] = useState<Boq[] | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [selectedBoqId, setSelectedBoqId] = useState("");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const { busy, run } = useAsyncAction();
  const canRecord = canManageTasks(viewer);

  useEffect(() => subscribeBoqsForProject(project.id, setBoqs), [project.id]);
  useEffect(() => subscribeMeasurementsForProject(project.id, setMeasurements), [project.id]);

  useEffect(() => {
    if (!boqs || selectedBoqId) return;
    const approved = boqs.find((b) => b.status === "APPROVED");
    setSelectedBoqId((approved ?? boqs[0])?.id ?? "");
  }, [boqs, selectedBoqId]);

  const boq = boqs?.find((b) => b.id === selectedBoqId);
  const byItem = (srNo: number) => measurements.find((m) => m.boqId === selectedBoqId && m.itemSrNo === srNo);

  async function onSave(item: BoqLineItem) {
    const raw = drafts[item.srNo];
    if (raw === undefined || !boq) return;
    const executedQty = Math.max(0, Number(raw) || 0);
    await run(() => recordMeasurement({
      projectId: project.id, boqId: boq.id, itemSrNo: item.srNo, description: item.description,
      unit: item.unit, boqQty: item.qty, executedQty,
    }, actor), "Recorded.");
    setDrafts((d) => { const next = { ...d }; delete next[item.srNo]; return next; });
  }

  const totalPlanned = boq?.items.reduce((s, it) => s + it.qty, 0) ?? 0;
  const totalExecuted = boq?.items.reduce((s, it) => s + (byItem(it.srNo)?.executedQty ?? 0), 0) ?? 0;
  const overallPct = totalPlanned > 0 ? Math.round((totalExecuted / totalPlanned) * 100) : 0;

  if (!boqs) return <p className="text-sm text-ink-400">Loading…</p>;
  if (boqs.length === 0) return <EmptyState title="No BOQ yet" description="Measurements are tracked against a project's BOQ — add one on the BOQ tab first." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={selectedBoqId} className="w-auto" options={boqs.map((b) => ({ value: b.id, label: `${b.boqNo} (v${b.version}, ${b.status})` }))} onChange={(e) => setSelectedBoqId(e.target.value)} />
        <div className="flex items-center gap-2 text-sm text-ink-600">
          <ProgressBar pct={overallPct} className="w-40" />
          <span className="tabular-nums">{overallPct}% executed</span>
        </div>
      </div>

      {boq && (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">Description</th><th className="th">Unit</th><th className="th text-right">BOQ Qty</th><th className="th text-right">Executed</th><th className="th text-right">Remaining</th><th className="th">Progress</th></tr></thead>
            <tbody>
              {boq.items.map((item) => {
                const m = byItem(item.srNo);
                const executed = m?.executedQty ?? 0;
                const remaining = Math.max(0, item.qty - executed);
                const pct = item.qty > 0 ? Math.round((executed / item.qty) * 100) : 0;
                return (
                  <tr key={item.srNo} className="border-t border-ink-100">
                    <td className="td">{item.description}</td>
                    <td className="td text-ink-500">{item.unit || "—"}</td>
                    <td className="td text-right tabular-nums">{item.qty}</td>
                    <td className="td text-right">
                      {canRecord ? (
                        <Input
                          type="number" min={0} className="w-24 text-right"
                          defaultValue={executed}
                          onChange={(e) => setDrafts((d) => ({ ...d, [item.srNo]: e.target.value }))}
                          onBlur={() => void onSave(item)}
                          disabled={busy}
                        />
                      ) : (
                        <span className="tabular-nums">{executed}</span>
                      )}
                    </td>
                    <td className="td text-right tabular-nums">{remaining}</td>
                    <td className="td"><div className="flex items-center gap-2"><ProgressBar pct={pct} className="w-20" /><span className="text-xs tabular-nums text-ink-500">{pct}%</span></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Issues ─────────────────────────────────────────────────────────────
function IssuesTab({ project }: { project: Project }) {
  const actor = useActor();
  const viewer = useViewer();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "MEDIUM" as IssuePriority, stageId: "", assigneeId: "", dueDate: "" });
  const { busy, run } = useAsyncAction();
  const canManage = canManageIssues(viewer);

  useEffect(() => subscribeIssuesForProject(project.id, setIssues), [project.id]);
  useEffect(() => subscribeStagesForProject(project.id, setStages), [project.id]);

  async function onCreate() {
    if (!form.title.trim()) return;
    await run(async () => {
      const stage = stages.find((s) => s.id === form.stageId);
      const member = project.team.find((m) => m.teamMemberId === form.assigneeId);
      await createIssue({
        projectId: project.id, projectName: project.name, stageId: stage?.id ?? null, stageName: stage?.name,
        title: form.title, description: form.description, priority: form.priority,
        assigneeId: member?.teamMemberId ?? null, assigneeName: member?.name,
        dueDate: form.dueDate ? new Date(form.dueDate) : null,
      }, actor);
      setShowForm(false); setForm({ title: "", description: "", priority: "MEDIUM", stageId: "", assigneeId: "", dueDate: "" });
    }, "Issue raised.");
  }

  const openCount = (issues ?? []).filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">{openCount} open issue{openCount === 1 ? "" : "s"}</p>
        {canManage && <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Raise Issue</Button>}
      </div>

      {!issues ? <p className="text-sm text-ink-400">Loading…</p> : issues.length === 0 ? (
        <EmptyState title="No issues raised" description="Site issues blocking progress — a missing drawing, a delayed approval, a site conflict — go here." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">Title</th><th className="th">Stage</th><th className="th">Priority</th><th className="th">Assignee</th><th className="th">Due</th><th className="th">Status</th><th className="th" /></tr></thead>
            <tbody>
              {issues.map((i) => (
                <tr key={i.id} className="border-t border-ink-100">
                  <td className="td font-medium">{i.title}</td>
                  <td className="td">{i.stageName || "—"}</td>
                  <td className="td"><Badge>{i.priority}</Badge></td>
                  <td className="td">{i.assigneeName || "Unassigned"}</td>
                  <td className="td">{i.dueDate ? formatDate(i.dueDate) : "—"}</td>
                  <td className="td">
                    {canManage ? (
                      <Select value={i.status} className="w-auto" options={ISSUE_STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") }))} onChange={(e) => void run(() => updateIssue(i, { status: e.target.value as IssueStatus }, actor), "Updated.")} />
                    ) : (
                      <Badge>{i.status.replace("_", " ")}</Badge>
                    )}
                  </td>
                  <td className="td text-right">
                    {canManage && <button onClick={() => void run(async () => { await deleteIssue(i, actor); }, "Issue deleted.")} disabled={busy}><Trash2 className="h-4 w-4 text-rose-500" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Raise Issue" footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onCreate()} loading={busy}>Raise</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title" required className="col-span-2"><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="Description" className="col-span-2"><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          <Field label="Stage"><Select value={form.stageId} placeholder="Unlinked" options={stages.map((s) => ({ value: s.id, label: s.name }))} onChange={(e) => setForm((f) => ({ ...f, stageId: e.target.value }))} /></Field>
          <Field label="Priority"><Select value={form.priority} options={ISSUE_PRIORITIES.map((p) => ({ value: p, label: p }))} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as IssuePriority }))} /></Field>
          <Field label="Assignee"><Select value={form.assigneeId} placeholder="Unassigned" options={project.team.map((m) => ({ value: m.teamMemberId, label: m.name }))} onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value }))} /></Field>
          <Field label="Due Date"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}

// ── Documents ──────────────────────────────────────────────────────────
function DocumentsTab({ project }: { project: Project }) {
  const actor = useActor();
  const viewer = useViewer();
  const [rows, setRows] = useState<NakjmDocument[] | null>(null);
  const [category, setCategory] = useState<DocumentCategory | "ALL">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentCategory>("OTHER");
  const [notes, setNotes] = useState("");
  const { busy, run } = useAsyncAction();
  const canUpload = canManageTasks(viewer);
  const canDelete = canManageStages(viewer);

  useEffect(() => subscribeDocumentsForProject(project.id, setRows), [project.id]);

  const filtered = (rows ?? []).filter((d) => category === "ALL" || d.docType === category);

  async function onUpload() {
    if (!file) return;
    await run(async () => {
      await uploadDocument({ file, projectId: project.id, docType, notes, actor });
      setShowForm(false); setFile(null); setDocType("OTHER"); setNotes("");
    }, "Document uploaded.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={category} className="w-auto" options={[{ value: "ALL", label: "All categories" }, ...DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: DOCUMENT_CATEGORY_LABEL[c] }))]} onChange={(e) => setCategory(e.target.value as DocumentCategory | "ALL")} />
        {canUpload && <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Upload</Button>}
      </div>

      {!rows ? <p className="text-sm text-ink-400">Loading…</p> : filtered.length === 0 ? (
        <EmptyState title="No documents yet" description="Drawings, approvals, technical documents, inspection reports, DPR photos — everything for this project lives here, categorised." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">File</th><th className="th">Category</th><th className="th">Uploaded By</th><th className="th">Date</th><th className="th" /></tr></thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-t border-ink-100">
                  <td className="td font-medium"><a href={d.downloadUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">{d.fileName}</a></td>
                  <td className="td"><Badge>{DOCUMENT_CATEGORY_LABEL[d.docType]}</Badge></td>
                  <td className="td">{d.uploadedBy?.name || "—"}</td>
                  <td className="td">{formatDate(d.createdAt)}</td>
                  <td className="td text-right">
                    {canDelete && <button onClick={() => void run(async () => { await deleteDocument(d, actor); }, "Document deleted.")} disabled={busy}><Trash2 className="h-4 w-4 text-rose-500" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Upload Document" footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onUpload()} loading={busy}>Upload</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="File" required className="col-span-2"><input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" /></Field>
          <Field label="Category" required><Select value={docType} options={DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: DOCUMENT_CATEGORY_LABEL[c] }))} onChange={(e) => setDocType(e.target.value as DocumentCategory)} /></Field>
          <Field label="Notes" className="col-span-2"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}

// ── RFI ────────────────────────────────────────────────────────────────
function RfiTab({ project }: { project: Project }) {
  const actor = useActor();
  const viewer = useViewer();
  const [rfis, setRfis] = useState<Rfi[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", question: "", assignedToId: "" });
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const { busy, run } = useAsyncAction();
  const canManage = canManageIssues(viewer);

  useEffect(() => subscribeRfisForProject(project.id, setRfis), [project.id]);

  async function onCreate() {
    if (!form.subject.trim() || !form.question.trim()) return;
    await run(async () => {
      const assignee = project.team.find((m) => m.teamMemberId === form.assignedToId);
      await createRfi({
        projectId: project.id, projectName: project.name, subject: form.subject, question: form.question,
        assignedToId: assignee?.teamMemberId ?? null, assignedToName: assignee?.name,
      }, actor);
      setShowForm(false); setForm({ subject: "", question: "", assignedToId: "" });
    }, "RFI raised.");
  }

  async function onRespond(rfi: Rfi, closeIt: boolean) {
    const message = replyDrafts[rfi.id]?.trim();
    if (!message) return;
    await run(async () => {
      await respondToRfi(rfi, message, actor, closeIt);
      setReplyDrafts((d) => ({ ...d, [rfi.id]: "" }));
    }, closeIt ? "RFI closed." : "Response added.");
  }

  return (
    <div className="space-y-4">
      {canManage && <div className="flex justify-end"><Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Raise RFI</Button></div>}

      {!rfis ? <p className="text-sm text-ink-400">Loading…</p> : rfis.length === 0 ? (
        <EmptyState title="No RFIs yet" description="A site clarification request — a missing dimension, an unclear spec — with a full response history." />
      ) : (
        <div className="space-y-3">
          {rfis.map((rfi) => (
            <Card key={rfi.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-navy-900">{rfi.subject}</p>
                  <p className="mt-1 text-sm text-ink-600">{rfi.question}</p>
                  <p className="mt-1 text-xs text-ink-400">Raised by {rfi.raisedByName} · {rfi.assignedToName ? `Assigned to ${rfi.assignedToName}` : "Unassigned"}</p>
                </div>
                {canManage ? (
                  <Select value={rfi.status} className="w-auto" options={RFI_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))} onChange={(e) => void run(() => updateRfiStatus(rfi, e.target.value as RfiStatus, actor), "Updated.")} />
                ) : (
                  <Badge>{rfi.status.replace(/_/g, " ")}</Badge>
                )}
              </div>

              {rfi.responses.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-ink-100 pt-3">
                  {rfi.responses.map((r, i) => (
                    <div key={i} className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
                      <p className="text-ink-700">{r.message}</p>
                      <p className="mt-1 text-xs text-ink-400">{r.byName} · {formatDateTime(r.at)}</p>
                    </div>
                  ))}
                </div>
              )}

              {canManage && rfi.status !== "CLOSED" && (
                <div className="mt-3 flex items-end gap-2 border-t border-ink-100 pt-3">
                  <Field label="Response" className="flex-1">
                    <Textarea value={replyDrafts[rfi.id] ?? ""} onChange={(e) => setReplyDrafts((d) => ({ ...d, [rfi.id]: e.target.value }))} />
                  </Field>
                  <Button variant="secondary" onClick={() => void onRespond(rfi, false)} loading={busy}>Respond</Button>
                  <Button onClick={() => void onRespond(rfi, true)} loading={busy}>Respond & Close</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Raise RFI" footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onCreate()} loading={busy}>Raise</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Subject" required className="col-span-2"><Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} /></Field>
          <Field label="Question" required className="col-span-2"><Textarea value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} /></Field>
          <Field label="Assign To" className="col-span-2"><Select value={form.assignedToId} placeholder="Unassigned" options={project.team.map((m) => ({ value: m.teamMemberId, label: m.name }))} onChange={(e) => setForm((f) => ({ ...f, assignedToId: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}

// ── Quality (Inspections + NCR) ───────────────────────────────────────
function QualityTab({ project }: { project: Project }) {
  const actor = useActor();
  const viewer = useViewer();
  const [inspections, setInspections] = useState<Inspection[] | null>(null);
  const [ncrs, setNcrs] = useState<Ncr[] | null>(null);
  const [showInspectionForm, setShowInspectionForm] = useState(false);
  const [showNcrForm, setShowNcrForm] = useState(false);
  const [inspectionForm, setInspectionForm] = useState({ checklist: "", result: "PASS" as InspectionResult, remarks: "" });
  const [ncrForm, setNcrForm] = useState({ issue: "", location: "", responsiblePersonId: "" });
  const [correctiveDrafts, setCorrectiveDrafts] = useState<Record<string, string>>({});
  const { busy, run } = useAsyncAction();
  const canManage = canManageIssues(viewer);

  useEffect(() => subscribeInspectionsForProject(project.id, setInspections), [project.id]);
  useEffect(() => subscribeNcrsForProject(project.id, setNcrs), [project.id]);

  async function onAddInspection() {
    if (!inspectionForm.checklist.trim()) return;
    await run(async () => {
      await createInspection({ projectId: project.id, projectName: project.name, ...inspectionForm }, actor);
      setShowInspectionForm(false); setInspectionForm({ checklist: "", result: "PASS", remarks: "" });
    }, "Inspection recorded.");
  }

  async function onAddNcr() {
    if (!ncrForm.issue.trim()) return;
    await run(async () => {
      const person = project.team.find((m) => m.teamMemberId === ncrForm.responsiblePersonId);
      await createNcr({
        projectId: project.id, projectName: project.name, issue: ncrForm.issue, location: ncrForm.location,
        responsiblePersonId: person?.teamMemberId ?? null, responsiblePersonName: person?.name,
      }, actor);
      setShowNcrForm(false); setNcrForm({ issue: "", location: "", responsiblePersonId: "" });
    }, "NCR raised.");
  }

  async function onCloseNcr(ncr: Ncr) {
    const correctiveAction = correctiveDrafts[ncr.id]?.trim() || ncr.correctiveAction;
    await run(() => updateNcr(ncr, { correctiveAction, status: "CLOSED" }, actor), "NCR closed.");
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-navy-900">Inspections</h3>
          {canManage && <Button size="sm" onClick={() => setShowInspectionForm(true)}><Plus className="h-3.5 w-3.5" /> Record Inspection</Button>}
        </div>
        {!inspections ? <p className="text-sm text-ink-400">Loading…</p> : inspections.length === 0 ? (
          <EmptyState title="No inspections recorded" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
            <table className="w-full">
              <thead><tr><th className="th">Checklist</th><th className="th">Result</th><th className="th">Remarks</th><th className="th">Inspected By</th><th className="th">Date</th></tr></thead>
              <tbody>
                {inspections.map((i) => (
                  <tr key={i.id} className="border-t border-ink-100">
                    <td className="td font-medium">{i.checklist}</td>
                    <td className="td"><Badge className={i.result === "FAIL" ? "bg-rose-50 text-rose-700 ring-rose-200" : i.result === "PASS" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"}>{i.result.replace(/_/g, " ")}</Badge></td>
                    <td className="td">{i.remarks || "—"}</td>
                    <td className="td">{i.inspectedByName}</td>
                    <td className="td">{formatDate(i.inspectedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-navy-900">NCRs (Non-Conformance Reports)</h3>
          {canManage && <Button size="sm" onClick={() => setShowNcrForm(true)}><Plus className="h-3.5 w-3.5" /> Raise NCR</Button>}
        </div>
        {!ncrs ? <p className="text-sm text-ink-400">Loading…</p> : ncrs.length === 0 ? (
          <EmptyState title="No NCRs raised" />
        ) : (
          <div className="space-y-3">
            {ncrs.map((n) => (
              <Card key={n.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{n.issue}</p>
                    <p className="text-xs text-ink-500">{n.location || "—"} · Responsible: {n.responsiblePersonName || "Unassigned"}</p>
                  </div>
                  <Badge>{n.status.replace(/_/g, " ")}</Badge>
                </div>
                {n.correctiveAction && <p className="mt-2 text-sm text-ink-700">Corrective action: {n.correctiveAction}</p>}
                {canManage && n.status !== "CLOSED" && (
                  <div className="mt-3 flex items-end gap-2 border-t border-ink-100 pt-3">
                    <Field label="Corrective action" className="flex-1">
                      <Input defaultValue={n.correctiveAction} onChange={(e) => setCorrectiveDrafts((d) => ({ ...d, [n.id]: e.target.value }))} />
                    </Field>
                    <Button variant="secondary" onClick={() => void run(() => updateNcr(n, { correctiveAction: correctiveDrafts[n.id] ?? n.correctiveAction, status: "CORRECTIVE_ACTION" }, actor), "Updated.")} loading={busy}>Save</Button>
                    <Button onClick={() => void onCloseNcr(n)} loading={busy}>Close</Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={showInspectionForm} onClose={() => setShowInspectionForm(false)} title="Record Inspection" footer={<><Button variant="secondary" onClick={() => setShowInspectionForm(false)}>Cancel</Button><Button onClick={() => void onAddInspection()} loading={busy}>Save</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Checklist / Item" required className="col-span-2"><Input value={inspectionForm.checklist} onChange={(e) => setInspectionForm((f) => ({ ...f, checklist: e.target.value }))} /></Field>
          <Field label="Result"><Select value={inspectionForm.result} options={INSPECTION_RESULTS.map((r) => ({ value: r, label: r.replace(/_/g, " ") }))} onChange={(e) => setInspectionForm((f) => ({ ...f, result: e.target.value as InspectionResult }))} /></Field>
          <Field label="Remarks" className="col-span-2"><Textarea value={inspectionForm.remarks} onChange={(e) => setInspectionForm((f) => ({ ...f, remarks: e.target.value }))} /></Field>
        </div>
      </Modal>

      <Modal open={showNcrForm} onClose={() => setShowNcrForm(false)} title="Raise NCR" footer={<><Button variant="secondary" onClick={() => setShowNcrForm(false)}>Cancel</Button><Button onClick={() => void onAddNcr()} loading={busy}>Raise</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Issue" required className="col-span-2"><Textarea value={ncrForm.issue} onChange={(e) => setNcrForm((f) => ({ ...f, issue: e.target.value }))} /></Field>
          <Field label="Location"><Input value={ncrForm.location} onChange={(e) => setNcrForm((f) => ({ ...f, location: e.target.value }))} /></Field>
          <Field label="Responsible Person"><Select value={ncrForm.responsiblePersonId} placeholder="Unassigned" options={project.team.map((m) => ({ value: m.teamMemberId, label: m.name }))} onChange={(e) => setNcrForm((f) => ({ ...f, responsiblePersonId: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}

// ── Drawings ───────────────────────────────────────────────────────────
/** Revision-controlled: uploading against an existing drawing number supersedes its prior revisions, never deletes them. */
function DrawingsTab({ project }: { project: Project }) {
  const actor = useActor();
  const viewer = useViewer();
  const [rows, setRows] = useState<Drawing[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [drawingNumber, setDrawingNumber] = useState("");
  const [title, setTitle] = useState("");
  const [discipline, setDiscipline] = useState<DrawingDiscipline>("OTHER");
  const { busy, run } = useAsyncAction();
  const canManage = canManageTasks(viewer);

  useEffect(() => subscribeDrawingsForProject(project.id, setRows), [project.id]);

  const groups = new Map<string, Drawing[]>();
  for (const d of rows ?? []) {
    const list = groups.get(d.drawingNumber) ?? [];
    list.push(d);
    groups.set(d.drawingNumber, list);
  }

  async function onUpload() {
    if (!file || !drawingNumber.trim() || !title.trim()) return;
    await run(async () => {
      const existing = (rows ?? []).filter((d) => d.drawingNumber === drawingNumber.trim());
      const nextRevision = `R${existing.length}`;
      await uploadDrawing({
        file, projectId: project.id, projectName: project.name, drawingNumber: drawingNumber.trim(), title,
        discipline, revision: nextRevision, existingRevisionIds: existing.filter((d) => d.status !== "SUPERSEDED").map((d) => d.id),
      }, actor);
      setShowForm(false); setFile(null); setDrawingNumber(""); setTitle(""); setDiscipline("OTHER");
    }, "Drawing uploaded.");
  }

  return (
    <div className="space-y-4">
      {canManage && <div className="flex justify-end"><Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Upload Drawing</Button></div>}

      {!rows ? <p className="text-sm text-ink-400">Loading…</p> : groups.size === 0 ? (
        <EmptyState title="No drawings yet" description="Upload architectural, structural, civil or electrical drawings — each re-upload against the same drawing number becomes a new revision, and nothing is ever deleted." />
      ) : (
        <div className="space-y-3">
          {Array.from(groups.entries()).map(([num, revisions]) => (
            <Card key={num} title={num} subtitle={revisions[0].title}>
              <div className="space-y-1.5">
                {revisions.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-ink-50 px-3 py-2 text-sm">
                    <span className="font-medium text-navy-900">{d.revision}</span>
                    <span className="text-ink-500">{d.discipline.replace(/_/g, " ")}</span>
                    <a href={d.downloadUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">{d.fileName}</a>
                    <span className="text-xs text-ink-400">{formatDate(d.createdAt)}</span>
                    <span className="flex-1" />
                    {canManage ? (
                      <Select value={d.status} className="w-auto" options={DRAWING_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))} onChange={(e) => void run(() => updateDrawingStatus(d, e.target.value as DrawingStatus, actor), "Updated.")} />
                    ) : (
                      <Badge>{d.status.replace(/_/g, " ")}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Upload Drawing" footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onUpload()} loading={busy}>Upload</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Drawing Number" required hint="Re-use the same number to upload a new revision."><Input value={drawingNumber} onChange={(e) => setDrawingNumber(e.target.value)} /></Field>
          <Field label="Discipline"><Select value={discipline} options={DRAWING_DISCIPLINES.map((d) => ({ value: d, label: d.replace(/_/g, " ") }))} onChange={(e) => setDiscipline(e.target.value as DrawingDiscipline)} /></Field>
          <Field label="Title" required className="col-span-2"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="File" required className="col-span-2">
            <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

// ── Handover (Punch List + close-out workflow) ────────────────────────
function HandoverTab({ project }: { project: Project }) {
  const actor = useActor();
  const viewer = useViewer();
  const [handover, setHandover] = useState<Handover | null | undefined>(undefined);
  const [items, setItems] = useState<PunchItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: "", assignedToId: "", dueDate: "" });
  const [resolutionDrafts, setResolutionDrafts] = useState<Record<string, string>>({});
  const { busy, run } = useAsyncAction();
  const canManage = canManageIssues(viewer);

  useEffect(() => { void getOrCreateHandover(project.id, project.name).then(setHandover); }, [project.id, project.name]);
  useEffect(() => subscribeHandover(project.id, setHandover), [project.id]);
  useEffect(() => subscribePunchItemsForProject(project.id, setItems), [project.id]);

  const stageIndex = handover ? HANDOVER_STAGES.indexOf(handover.stage) : -1;
  const openItems = (items ?? []).filter((i) => i.status !== "ACCEPTED").length;

  async function onAddItem() {
    if (!form.description.trim()) return;
    await run(async () => {
      const member = project.team.find((m) => m.teamMemberId === form.assignedToId);
      await createPunchItem({
        projectId: project.id, projectName: project.name, description: form.description,
        assignedToId: member?.teamMemberId ?? null, assignedToName: member?.name,
        dueDate: form.dueDate ? new Date(form.dueDate) : null,
      }, actor);
      setShowForm(false); setForm({ description: "", assignedToId: "", dueDate: "" });
    }, "Punch item added.");
  }

  return (
    <div className="space-y-6">
      <Card title="Close-out workflow">
        <div className="flex flex-wrap items-center gap-2">
          {HANDOVER_STAGES.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${i <= stageIndex ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-ink-100 text-ink-500 ring-ink-200"}`}>
                {HANDOVER_STAGE_LABEL[s]}
              </span>
              {i < HANDOVER_STAGES.length - 1 && <span className="text-ink-300">→</span>}
            </div>
          ))}
        </div>
        {canManage && handover && stageIndex < HANDOVER_STAGES.length - 1 && (
          <Button className="mt-4" onClick={() => void run(() => advanceHandoverStage(handover, HANDOVER_STAGES[stageIndex + 1], actor), "Advanced.")} loading={busy}>
            Advance to {HANDOVER_STAGE_LABEL[HANDOVER_STAGES[stageIndex + 1]]}
          </Button>
        )}
        {handover?.handoverDate && <p className="mt-3 text-xs text-ink-500">Handed over {formatDate(handover.handoverDate)}</p>}
      </Card>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-navy-900">Punch List <span className="font-normal text-ink-500">({openItems} open)</span></h3>
          {canManage && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-3.5 w-3.5" /> Add Item</Button>}
        </div>
        {!items ? <p className="text-sm text-ink-400">Loading…</p> : items.length === 0 ? (
          <EmptyState title="No punch items" description="Snags found during internal or client inspection — track them here through to client acceptance." />
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <Card key={it.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-navy-900">{it.description}</p>
                    <p className="text-xs text-ink-500">{it.assignedToName || "Unassigned"}{it.dueDate ? ` · Due ${formatDate(it.dueDate)}` : ""}</p>
                  </div>
                  {canManage ? (
                    <Select value={it.status} className="w-auto" options={PUNCH_ITEM_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))} onChange={(e) => void run(() => updatePunchItem(it, { status: e.target.value as PunchItemStatus }, actor), "Updated.")} />
                  ) : (
                    <Badge>{it.status.replace(/_/g, " ")}</Badge>
                  )}
                </div>
                {it.resolution && <p className="mt-2 text-sm text-ink-700">Resolution: {it.resolution}</p>}
                {canManage && it.status !== "ACCEPTED" && (
                  <div className="mt-3 flex items-end gap-2 border-t border-ink-100 pt-3">
                    <Field label="Resolution" className="flex-1">
                      <Input defaultValue={it.resolution} onChange={(e) => setResolutionDrafts((d) => ({ ...d, [it.id]: e.target.value }))} />
                    </Field>
                    <Button variant="secondary" onClick={() => void run(() => updatePunchItem(it, { resolution: resolutionDrafts[it.id] ?? it.resolution, status: "RESOLVED" }, actor), "Updated.")} loading={busy}>Resolve</Button>
                    <Button onClick={() => void run(() => updatePunchItem(it, { status: "ACCEPTED", clientAccepted: true }, actor), "Accepted.")} loading={busy}>Client Accept</Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Punch Item" footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onAddItem()} loading={busy}>Add</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Description" required className="col-span-2"><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          <Field label="Assignee"><Select value={form.assignedToId} placeholder="Unassigned" options={project.team.map((m) => ({ value: m.teamMemberId, label: m.name }))} onChange={(e) => setForm((f) => ({ ...f, assignedToId: e.target.value }))} /></Field>
          <Field label="Due Date"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}

// ── Reports ────────────────────────────────────────────────────────────
/** Report Centre — currently one report type (Weekly Progress), generated live from existing data, not stored. */
function ReportsTab({ project }: { project: Project }) {
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [reports, setReports] = useState<SiteReport[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 6 * 86400000);
  const [from, setFrom] = useState(weekAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [nextWeek, setNextWeek] = useState("");

  useEffect(() => subscribeStagesForProject(project.id, setStages), [project.id]);
  useEffect(() => subscribeSiteReportsForProject(project.id, setReports), [project.id]);
  useEffect(() => subscribeIssuesForProject(project.id, setIssues), [project.id]);

  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime() + 86400000;
  const weekReports = reports.filter((r) => { const t = r.reportDate?.seconds ? r.reportDate.seconds * 1000 : 0; return t >= fromTime && t < toTime; });
  const overallProgress = stages.length ? Math.round(stages.reduce((s, st) => s + st.progressPct, 0) / stages.length) : 0;
  const active = stages.filter((s) => s.status === "IN_PROGRESS");
  const delayed = stages.filter((s) => s.status === "DELAYED" || s.status === "BLOCKED");
  const openIssues = issues.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS");

  const printHref = `/projects/${project.id}/reports/weekly/print?from=${from}&to=${to}&nextWeek=${encodeURIComponent(nextWeek)}`;

  return (
    <div className="space-y-4">
      <Card title="Weekly Progress Report">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Link href={printHref} target="_blank"><Button><Printer className="h-4 w-4" /> Preview / PDF</Button></Link>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div><p className="text-ink-400">Overall Progress</p><p className="text-lg font-semibold text-navy-900">{overallProgress}%</p></div>
          <div><p className="text-ink-400">Current Activities</p><p className="text-lg font-semibold text-navy-900">{active.length}</p></div>
          <div><p className="text-ink-400">Delayed</p><p className="text-lg font-semibold text-rose-600">{delayed.length}</p></div>
          <div><p className="text-ink-400">Open Issues</p><p className="text-lg font-semibold text-navy-900">{openIssues.length}</p></div>
        </div>

        <div className="mt-4 border-t border-ink-100 pt-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-500">Completed This Week</p>
          {weekReports.length === 0 ? <p className="text-sm text-ink-400">No site reports logged in this range.</p> : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-700">
              {weekReports.map((r) => <li key={r.id}>{r.workDone || `${r.progressPct}% progress recorded`}</li>)}
            </ul>
          )}
        </div>

        <Field label="Next Week (for the printed report)" className="mt-4"><Textarea value={nextWeek} onChange={(e) => setNextWeek(e.target.value)} placeholder="Planned activities for next week…" /></Field>
      </Card>

      <Card title="Other reports">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link href={`/projects/${project.id}/reports/stages/print`} target="_blank" className="rounded-xl border border-ink-200 p-3 text-sm hover:bg-ink-50">
            <p className="font-medium text-navy-900">Stage Progress Report</p>
            <p className="text-xs text-ink-500">Planned vs actual dates, per stage.</p>
          </Link>
          <Link href={`/projects/${project.id}/reports/measurements/print`} target="_blank" className="rounded-xl border border-ink-200 p-3 text-sm hover:bg-ink-50">
            <p className="font-medium text-navy-900">Measurement / BOQ Report</p>
            <p className="text-xs text-ink-500">Executed vs planned quantity, per item.</p>
          </Link>
          <Link href={`/projects/${project.id}/reports/issues/print`} target="_blank" className="rounded-xl border border-ink-200 p-3 text-sm hover:bg-ink-50">
            <p className="font-medium text-navy-900">Issue Report</p>
            <p className="text-xs text-ink-500">Every issue, with status and priority.</p>
          </Link>
          <Link href={`/projects/${project.id}/reports/stage-wise/print`} target="_blank" className="rounded-xl border border-ink-200 p-3 text-sm hover:bg-ink-50">
            <p className="font-medium text-navy-900">Stage-wise Client Report</p>
            <p className="text-xs text-ink-500">Client requirements, then every stage's tasks &amp; issues.</p>
          </Link>
        </div>
      </Card>
    </div>
  );
}

// ── Team ────────────────────────────────────────────────────────────────
function TeamTab({ project }: { project: Project }) {
  const actor = useActor();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ teamMemberId: "", projectRole: "" });
  const { busy, run } = useAsyncAction();

  useEffect(() => { void listActiveTeamMembers().then(setMembers); }, []);

  async function onAssign() {
    if (!form.teamMemberId) return;
    await run(async () => {
      const member = members.find((m) => m.id === form.teamMemberId);
      if (!member) return;
      await assignTeamMember(project, { teamMemberId: member.id, name: member.name, designation: member.designation, projectRole: form.projectRole, assignedAt: null as never }, actor);
      setShowForm(false); setForm({ teamMemberId: "", projectRole: "" });
    }, "Assigned.");
  }

  async function onUnassign(teamMemberId: string) {
    await run(async () => { await unassignTeamMember(project, teamMemberId, actor); }, "Removed.");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Assign Member</Button></div>
      {project.team.length === 0 ? (
        <EmptyState title="No one assigned yet" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">Name</th><th className="th">Designation</th><th className="th">Project Role</th><th className="th" /></tr></thead>
            <tbody>
              {project.team.map((m) => (
                <tr key={m.teamMemberId} className="border-t border-ink-100">
                  <td className="td font-medium">{m.name}</td>
                  <td className="td">{m.designation || "—"}</td>
                  <td className="td">{m.projectRole || "—"}</td>
                  <td className="td text-right"><button onClick={() => void onUnassign(m.teamMemberId)} disabled={busy}><Trash2 className="h-4 w-4 text-rose-500" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Assign Team Member" footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onAssign()} loading={busy}>Assign</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Team Member" required><Select value={form.teamMemberId} placeholder="Select…" options={members.map((m) => ({ value: m.id, label: `${m.name} — ${m.designation ?? ""}` }))} onChange={(e) => setForm((f) => ({ ...f, teamMemberId: e.target.value }))} /></Field>
          <Field label="Project Role"><Input value={form.projectRole} onChange={(e) => setForm((f) => ({ ...f, projectRole: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}

// ── Site Reports ────────────────────────────────────────────────────────
function SiteReportsTab({ project }: { project: Project }) {
  const actor = useActor();
  const [rows, setRows] = useState<SiteReport[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ reportType: "DAILY" as SiteReportType, progressPct: "", workDone: "", issues: "", manpowerCount: "", visibleToClient: false });
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeSiteReportsForProject(project.id, setRows), [project.id]);

  async function onCreate() {
    await run(async () => {
      await createSiteReport({
        projectId: project.id, projectName: project.name, reportedById: actor.uid, reportedByName: actor.name,
        reportType: form.reportType, progressPct: Number(form.progressPct) || 0, workDone: form.workDone, issues: form.issues,
        manpowerCount: Number(form.manpowerCount) || 0, visibleToClient: form.visibleToClient,
      }, actor);
      setShowForm(false);
      setForm({ reportType: "DAILY", progressPct: "", workDone: "", issues: "", manpowerCount: "", visibleToClient: false });
    }, "Report submitted.");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> New Report</Button></div>
      {!rows ? <p className="text-sm text-ink-400">Loading…</p> : rows.length === 0 ? (
        <EmptyState title="No site reports yet" />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">{r.reportType.toLowerCase()} report — {formatDate(r.reportDate)}</span>
                <span className="text-sm font-semibold">{r.progressPct}% complete</span>
              </div>
              {r.workDone && <p className="mt-1 text-sm text-ink-600">{r.workDone}</p>}
              {r.issues && <p className="mt-1 text-sm text-rose-600">⚠ {r.issues}</p>}
            </Card>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Site Report" footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onCreate()} loading={busy}>Submit</Button></>}>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Type"><Select value={form.reportType} options={SITE_REPORT_TYPES.map((t) => ({ value: t, label: t }))} onChange={(e) => setForm((f) => ({ ...f, reportType: e.target.value as SiteReportType }))} /></Field>
          <Field label="Progress %"><Input type="number" min={0} max={100} value={form.progressPct} onChange={(e) => setForm((f) => ({ ...f, progressPct: e.target.value }))} /></Field>
          <Field label="Manpower Count"><Input type="number" value={form.manpowerCount} onChange={(e) => setForm((f) => ({ ...f, manpowerCount: e.target.value }))} /></Field>
          <Field label="Work Done" className="col-span-3"><Textarea value={form.workDone} onChange={(e) => setForm((f) => ({ ...f, workDone: e.target.value }))} /></Field>
          <Field label="Issues" className="col-span-3"><Textarea value={form.issues} onChange={(e) => setForm((f) => ({ ...f, issues: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}
