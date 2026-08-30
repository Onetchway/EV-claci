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
  BOQ_CATEGORIES, PAYMENT_MODES, PROJECT_STATUSES, PROJECT_TYPES, SITE_REPORT_TYPES, STAGE_STATUSES, TASK_STATUSES, statusMeta,
  type BoqCategory, type PaymentMode, type ProjectStatus, type ProjectType, type SiteReportType, type StageStatus, type TaskStatus,
} from "@/lib/constants";
import { ItemsTable, ITEM_FIELDS, BOQ_FIELDS, type DraftItem, type DraftBoqItem } from "@/components/line-items-table";
import { parseBoqFile } from "@/lib/boq-parser";
import { computeBoqTotals, createBoq, deleteBoq, subscribeBoqsForProject, updateBoq } from "@/lib/db/boq";
import { listActiveClients } from "@/lib/db/clients";
import { uploadDocument } from "@/lib/db/documents";
import { recordClientPayment, recordVendorPayment, subscribeClientPayments, subscribeVendorPayments } from "@/lib/db/payments";
import { createProformaInvoice, deleteProformaInvoice, subscribePisForProject, updateProformaInvoice } from "@/lib/db/proforma-invoices";
import { assignTeamMember, subscribeProject, subscribeSubprojects, trashProject, unassignTeamMember, updateProject } from "@/lib/db/projects";
import { canManageStages, canManageTasks, canTrash } from "@/lib/permissions";
import { createPurchaseOrder, deletePurchaseOrder, subscribePosForProject, updatePurchaseOrder } from "@/lib/db/purchase-orders";
import { createQuotation, deleteQuotation, nextQuotationVersion, subscribeQuotationsForProject, updateQuotation } from "@/lib/db/quotations";
import { createSiteReport, subscribeSiteReportsForProject } from "@/lib/db/site-reports";
import { createStage, deleteStage, subscribeStagesForProject, updateStage } from "@/lib/db/stages";
import { createTask, deleteTask, subscribeTasksForProject, updateTask } from "@/lib/db/tasks";
import { listActiveTeamMembers } from "@/lib/db/team-members";
import { listActiveVendors } from "@/lib/db/vendors";
import type {
  Boq, BoqLineItem, Client, Project, ProformaInvoice, ProjectStage, ProjectTask, PurchaseOrder, Quotation, SiteReport, TeamMember, Vendor,
} from "@/lib/types";
import { formatCompactINR, formatDate, formatINR } from "@/lib/utils";

const TABS = ["Overview", "Stages & Tasks", "Quotations", "BOQ", "Purchase Orders", "Proforma Invoices", "Payments", "Team", "Site Reports"] as const;

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
      {tab === "Quotations" && <QuotationsTab project={project} />}
      {tab === "BOQ" && <BoqTab project={project} />}
      {tab === "Purchase Orders" && <PoTab project={project} />}
      {tab === "Proforma Invoices" && <PiTab project={project} />}
      {tab === "Payments" && <PaymentsTab project={project} />}
      {tab === "Team" && <TeamTab project={project} />}
      {tab === "Site Reports" && <SiteReportsTab project={project} />}
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

  useEffect(() => subscribePosForProject(project.id, setPos), [project.id]);
  useEffect(() => subscribePisForProject(project.id, setPis), [project.id]);
  useEffect(() => subscribeClientPayments({ projectId: project.id }, setCps), [project.id]);
  useEffect(() => subscribeSiteReportsForProject(project.id, setReports), [project.id]);
  useEffect(() => subscribeSubprojects(project.id, setSubprojects), [project.id]);

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
  const [rows, setRows] = useState<Quotation[] | null>(null);
  const [boqs, setBoqs] = useState<Boq[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null);
  const [form, setForm] = useState({ quotationNo: "", validUntil: "", taxPercent: "18", notes: "" });
  const [items, setItems] = useState<DraftItem[]>([]);
  const [sourceBoqId, setSourceBoqId] = useState<string | null>(null);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeQuotationsForProject(project.id, setRows), [project.id]);
  useEffect(() => subscribeBoqsForProject(project.id, setBoqs), [project.id]);

  async function generateFromBoq(boqId: string) {
    if (!boqId) return;
    const boq = boqs.find((b) => b.id === boqId);
    if (!boq) return;
    const version = await nextQuotationVersion(project.id);
    setEditing(null);
    setSourceBoqId(boqId);
    setItems(boq.items.map((it) => ({ description: [it.section, it.description].filter(Boolean).join(" — "), unit: it.unit, qty: it.qty, rate: it.rate })));
    setForm({ quotationNo: `${boq.boqNo}-Q${version}`, validUntil: "", taxPercent: "18", notes: `Generated from BOQ ${boq.boqNo} (v${boq.version})` });
    setShowForm(true);
  }

  function openEdit(q: Quotation) {
    setEditing(q);
    setSourceBoqId(q.sourceBoqId ?? null);
    setItems(q.items.map((it) => ({ description: it.description, unit: it.unit, qty: it.qty, rate: it.rate })));
    setForm({
      quotationNo: q.quotationNo,
      validUntil: q.validUntil ? q.validUntil.toDate().toISOString().slice(0, 10) : "",
      taxPercent: String(q.taxPercent),
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
            onChange={(e) => void generateFromBoq(e.target.value)}
          />
        )}
        <Button onClick={() => { setEditing(null); setSourceBoqId(null); setItems([]); setForm({ quotationNo: "", validUntil: "", taxPercent: "18", notes: "" }); setShowForm(true); }}>
          <Plus className="h-4 w-4" /> New Quotation
        </Button>
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
                      <button onClick={() => setDeleteTarget(q)} className="inline-flex items-center gap-1 text-rose-600 hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
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
        </div>
        <ItemsTable items={items} setItems={setItems} fields={ITEM_FIELDS} />
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
  const [rows, setRows] = useState<Boq[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Boq | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Boq | null>(null);
  const [form, setForm] = useState({ boqNo: "", siteName: "", notes: "" });
  const [items, setItems] = useState<DraftBoqItem[]>([]);
  const [importing, setImporting] = useState(false);
  const { busy, run } = useAsyncAction();
  const { push } = useToast();

  useEffect(() => subscribeBoqsForProject(project.id, setRows), [project.id]);

  async function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const parsed = await parseBoqFile(file);
      if (!parsed.length) throw new Error("Could not detect a BOQ table in this file.");
      setEditing(null);
      setItems(parsed);
      setForm((f) => ({ ...f, boqNo: f.boqNo || file.name.replace(/\.[^.]+$/, "") }));
      setShowForm(true);
      push(`Imported ${parsed.length} line items — review before saving.`, "success");
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setImporting(false);
    }
  }

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
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-300 bg-white px-3.5 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50">
          <Upload className="h-4 w-4" /> {importing ? "Importing…" : "Import from Excel"}
          <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importing} onChange={(e) => void onFileSelect(e)} />
        </label>
        <Button onClick={() => { setEditing(null); setItems([]); setForm({ boqNo: "", siteName: "", notes: "" }); setShowForm(true); }}><Plus className="h-4 w-4" /> New BOQ</Button>
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
                      <button onClick={() => setDeleteTarget(b)} className="inline-flex items-center gap-1 text-rose-600 hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
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
      <div className="flex justify-end"><Button onClick={() => { setEditing(null); setItems([]); setForm({ poNo: "", vendorId: "", deliveryDate: "", notes: "" }); setShowForm(true); }}><Plus className="h-4 w-4" /> New PO</Button></div>
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
                      <button onClick={() => setDeleteTarget(po)} className="inline-flex items-center gap-1 text-rose-600 hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
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
  const [rows, setRows] = useState<ProformaInvoice[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProformaInvoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProformaInvoice | null>(null);
  const [form, setForm] = useState({ piNo: "", dueDate: "", milestone: "", notes: "" });
  const [items, setItems] = useState<DraftItem[]>([]);
  const [poFile, setPoFile] = useState<File | null>(null);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribePisForProject(project.id, setRows), [project.id]);

  function openEdit(pi: ProformaInvoice) {
    setEditing(pi);
    setItems(pi.items.map((it) => ({ description: it.description, unit: it.unit, qty: it.qty, rate: it.rate })));
    setForm({
      piNo: pi.piNo, dueDate: pi.dueDate ? pi.dueDate.toDate().toISOString().slice(0, 10) : "",
      milestone: pi.milestone ?? "", notes: pi.notes ?? "",
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
          milestone: form.milestone, items, notes: form.notes,
        }, actor);
      } else {
        let sourceDocumentId: string | null = null;
        if (poFile) {
          const doc = await uploadDocument({ file: poFile, projectId: project.id, docType: "CLIENT_PO", actor });
          sourceDocumentId = doc.id;
        }
        await createProformaInvoice({
          piNo: form.piNo, projectId: project.id, projectName: project.name, clientId: project.clientId,
          dueDate: form.dueDate ? new Date(form.dueDate) : null, milestone: form.milestone, items, notes: form.notes, sourceDocumentId,
        }, actor);
      }
      setShowForm(false); setEditing(null); setItems([]); setPoFile(null); setForm({ piNo: "", dueDate: "", milestone: "", notes: "" });
    }, editing ? "Proforma invoice updated." : "Proforma invoice created.");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => { setEditing(null); setItems([]); setPoFile(null); setForm({ piNo: "", dueDate: "", milestone: "", notes: "" }); setShowForm(true); }}><Plus className="h-4 w-4" /> New PI</Button></div>
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
                      <button onClick={() => setDeleteTarget(pi)} className="inline-flex items-center gap-1 text-rose-600 hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
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
          {!editing && (
            <Field label="Client PO / Work Order" className="col-span-3" hint="Optional — generates this PI against the uploaded document.">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink-300 px-3 py-2 text-sm text-ink-600 hover:bg-ink-50">
                <Upload className="h-4 w-4" /> {poFile ? poFile.name : "Choose a file…"}
                <input type="file" className="hidden" accept=".pdf,.xlsx,.xls,.doc,.docx,image/*" onChange={(e) => setPoFile(e.target.files?.[0] ?? null)} />
              </label>
            </Field>
          )}
        </div>
        <ItemsTable items={items} setItems={setItems} fields={ITEM_FIELDS} />
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
  const [showStageForm, setShowStageForm] = useState(false);
  const [stageForm, setStageForm] = useState({ name: "", plannedStart: "", plannedEnd: "" });
  const [taskForm, setTaskForm] = useState<Record<string, { title: string; assigneeId: string; dueDate: string }>>({});
  const { busy, run } = useAsyncAction();
  const canStage = canManageStages(viewer);
  const canTask = canManageTasks(viewer);

  useEffect(() => subscribeStagesForProject(project.id, setStages), [project.id]);
  useEffect(() => subscribeTasksForProject(project.id, setTasks), [project.id]);

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
      {canStage && <div className="flex justify-end"><Button onClick={() => setShowStageForm(true)}><Plus className="h-4 w-4" /> Add Stage</Button></div>}

      {!stages ? <p className="text-sm text-ink-400">Loading…</p> : stages.length === 0 ? (
        <EmptyState title="No stages yet" description="Break the project into delivery stages — Survey, Civil, Electrical, Installation, Testing, Commissioning — then track tasks under each." />
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
