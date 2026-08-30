"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Printer, Trash2, Upload } from "lucide-react";

import { useActor } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, ProgressBar,
  Select, StatCard, Textarea, useAsyncAction, useToast,
} from "@/components/ui";
import {
  BOQ_CATEGORIES, PAYMENT_MODES, SITE_REPORT_TYPES, statusMeta, type BoqCategory, type PaymentMode, type SiteReportType,
} from "@/lib/constants";
import { parseBoqFile } from "@/lib/boq-parser";
import { computeBoqTotals, createBoq, subscribeBoqsForProject } from "@/lib/db/boq";
import { listActiveClients } from "@/lib/db/clients";
import { uploadDocument } from "@/lib/db/documents";
import { recordClientPayment, recordVendorPayment, subscribeClientPayments, subscribeVendorPayments } from "@/lib/db/payments";
import { createProformaInvoice, subscribePisForProject } from "@/lib/db/proforma-invoices";
import { assignTeamMember, subscribeProject, unassignTeamMember } from "@/lib/db/projects";
import { createPurchaseOrder, subscribePosForProject } from "@/lib/db/purchase-orders";
import { createQuotation, nextQuotationVersion, subscribeQuotationsForProject } from "@/lib/db/quotations";
import { createSiteReport, subscribeSiteReportsForProject } from "@/lib/db/site-reports";
import { listActiveTeamMembers } from "@/lib/db/team-members";
import { listActiveVendors } from "@/lib/db/vendors";
import type {
  Boq, BoqLineItem, Client, LineItem, Project, ProformaInvoice, PurchaseOrder, Quotation, SiteReport, TeamMember, Vendor,
} from "@/lib/types";
import { formatCompactINR, formatDate, formatINR } from "@/lib/utils";

const TABS = ["Overview", "Quotations", "BOQ", "Purchase Orders", "Proforma Invoices", "Payments", "Team", "Site Reports"] as const;

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  useEffect(() => subscribeProject(id, setProject), [id]);

  if (!project) return <p className="text-sm text-ink-400">Loading…</p>;

  return (
    <div className="space-y-5">
      <div className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-ink-400">{project.code}</p>
            <h1 className="text-xl font-semibold text-ink-900">{project.name}</h1>
            <p className="text-sm text-ink-500">{project.clientName} · {[project.site?.city, project.site?.state].filter(Boolean).join(", ")}</p>
          </div>
          <Badge className={statusMeta(project.status).className}>{statusMeta(project.status).label}</Badge>
        </div>
      </div>

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

  useEffect(() => subscribePosForProject(project.id, setPos), [project.id]);
  useEffect(() => subscribePisForProject(project.id, setPis), [project.id]);
  useEffect(() => subscribeClientPayments({ projectId: project.id }, setCps), [project.id]);
  useEffect(() => subscribeSiteReportsForProject(project.id, setReports), [project.id]);

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
function ItemsTable<T extends Record<string, unknown>>({
  items, setItems, fields,
}: {
  items: T[];
  setItems: (items: T[]) => void;
  fields: { key: keyof T; label: string; type?: string }[];
}) {
  const addRow = () => setItems([...items, Object.fromEntries(fields.map((f) => [f.key, f.type === "number" ? 0 : ""])) as T]);
  const update = (i: number, key: keyof T, value: string) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-ink-200">
        <table className="w-full">
          <thead><tr>{fields.map((f) => <th key={String(f.key)} className="th">{f.label}</th>)}<th className="th" /></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-t border-ink-100">
                {fields.map((f) => (
                  <td key={String(f.key)} className="td">
                    <input
                      className="input py-1"
                      type={f.type ?? "text"}
                      value={(it[f.key] as string | number) ?? ""}
                      onChange={(e) => update(i, f.key, e.target.value)}
                    />
                  </td>
                ))}
                <td className="td"><button type="button" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-rose-500" /></button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={fields.length + 1} className="td text-center text-ink-400">No line items yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={addRow}><Plus className="h-3.5 w-3.5" /> Add Line</Button>
    </div>
  );
}

const ITEM_FIELDS = [
  { key: "description" as const, label: "Description" },
  { key: "unit" as const, label: "Unit" },
  { key: "qty" as const, label: "Qty", type: "number" },
  { key: "rate" as const, label: "Rate (₹)", type: "number" },
];
const BOQ_FIELDS = [
  { key: "section" as const, label: "Section" },
  { key: "description" as const, label: "Description" },
  { key: "makeOem" as const, label: "Make/OEM" },
  { key: "unit" as const, label: "Unit" },
  { key: "qty" as const, label: "Qty", type: "number" },
  { key: "supplyRate" as const, label: "Supply Rate", type: "number" },
  { key: "installationRate" as const, label: "Install Rate", type: "number" },
];

type DraftItem = Omit<LineItem, "amount" | "srNo">;
type DraftBoqItem = Omit<BoqLineItem, "amount" | "srNo" | "rate" | "category"> & { category?: string };

// ── Quotations ──────────────────────────────────────────────────────────
function QuotationsTab({ project }: { project: Project }) {
  const actor = useActor();
  const [rows, setRows] = useState<Quotation[] | null>(null);
  const [boqs, setBoqs] = useState<Boq[]>([]);
  const [showForm, setShowForm] = useState(false);
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
    setSourceBoqId(boqId);
    setItems(boq.items.map((it) => ({ description: [it.section, it.description].filter(Boolean).join(" — "), unit: it.unit, qty: it.qty, rate: it.rate })));
    setForm({ quotationNo: `${boq.boqNo}-Q${version}`, validUntil: "", taxPercent: "18", notes: `Generated from BOQ ${boq.boqNo} (v${boq.version})` });
    setShowForm(true);
  }

  async function onCreate() {
    if (!form.quotationNo.trim()) return;
    await run(async () => {
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
      setShowForm(false); setItems([]); setSourceBoqId(null);
    }, "Quotation created.");
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
        <Button onClick={() => { setSourceBoqId(null); setItems([]); setForm({ quotationNo: "", validUntil: "", taxPercent: "18", notes: "" }); setShowForm(true); }}>
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
                  <td className="td font-medium">{q.quotationNo}</td>
                  <td className="td">v{q.version}</td>
                  <td className="td"><Badge>{q.status}</Badge></td>
                  <td className="td">{formatDate(q.validUntil)}</td>
                  <td className="td">{formatINR(q.totalAmount)}</td>
                  <td className="td text-right">
                    <Link href={`/projects/${project.id}/quotations/${q.id}/print`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                      <Printer className="h-3.5 w-3.5" /> Print
                    </Link>
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
        title="New Quotation"
        wide
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onCreate()} loading={busy}>Create</Button></>}
      >
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Field label="Quotation No." required><Input value={form.quotationNo} onChange={(e) => setForm((f) => ({ ...f, quotationNo: e.target.value }))} /></Field>
          <Field label="Valid Until"><Input type="date" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} /></Field>
          <Field label="Tax %"><Input type="number" value={form.taxPercent} onChange={(e) => setForm((f) => ({ ...f, taxPercent: e.target.value }))} /></Field>
        </div>
        <ItemsTable items={items} setItems={setItems} fields={ITEM_FIELDS} />
      </Modal>
    </div>
  );
}

// ── BOQ ─────────────────────────────────────────────────────────────────
function BoqTab({ project }: { project: Project }) {
  const actor = useActor();
  const [rows, setRows] = useState<Boq[] | null>(null);
  const [showForm, setShowForm] = useState(false);
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

  async function onCreate() {
    if (!form.boqNo.trim()) return;
    await run(async () => {
      const cleanItems = items.map((it) => ({ ...it, category: (it.category as BoqCategory) || "OTHER" })) as BoqLineItem[];
      await createBoq({ boqNo: form.boqNo, projectId: project.id, projectName: project.name, siteName: form.siteName, items: cleanItems, notes: form.notes }, actor);
      setShowForm(false); setItems([]); setForm({ boqNo: "", siteName: "", notes: "" });
    }, "BOQ created.");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-300 bg-white px-3.5 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50">
          <Upload className="h-4 w-4" /> {importing ? "Importing…" : "Import from Excel"}
          <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importing} onChange={(e) => void onFileSelect(e)} />
        </label>
        <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> New BOQ</Button>
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
                  <td className="td font-medium">{b.boqNo}</td>
                  <td className="td">{b.siteName || "—"}</td>
                  <td className="td"><Badge>{b.status}</Badge></td>
                  <td className="td">{formatDate(b.boqDate)}</td>
                  <td className="td">{formatINR(b.totalAmount)}</td>
                  <td className="td text-right">
                    <Link href={`/projects/${project.id}/boq/${b.id}/print`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                      <Printer className="h-3.5 w-3.5" /> Print
                    </Link>
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
        title="New BOQ"
        wide
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onCreate()} loading={busy}>Create</Button></>}
      >
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Field label="BOQ No." required><Input value={form.boqNo} onChange={(e) => setForm((f) => ({ ...f, boqNo: e.target.value }))} /></Field>
          <Field label="Site Name"><Input value={form.siteName} onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))} /></Field>
        </div>
        <ItemsTable items={items} setItems={setItems} fields={BOQ_FIELDS} />
        <p className="mt-2 text-xs text-ink-500">Category defaults to OTHER for imported rows; categories: {BOQ_CATEGORIES.join(", ")}.</p>
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
  const [form, setForm] = useState({ poNo: "", vendorId: "", deliveryDate: "", notes: "" });
  const [items, setItems] = useState<DraftItem[]>([]);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribePosForProject(project.id, setRows), [project.id]);
  useEffect(() => { void listActiveVendors().then(setVendors); }, []);

  async function onCreate() {
    if (!form.poNo.trim() || !form.vendorId) return;
    await run(async () => {
      const vendor = vendors.find((v) => v.id === form.vendorId);
      await createPurchaseOrder({
        poNo: form.poNo, projectId: project.id, projectName: project.name, vendorId: form.vendorId, vendorName: vendor?.name ?? "",
        deliveryDate: form.deliveryDate ? new Date(form.deliveryDate) : null, items, notes: form.notes,
      }, actor);
      setShowForm(false); setItems([]); setForm({ poNo: "", vendorId: "", deliveryDate: "", notes: "" });
    }, "Purchase order created.");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> New PO</Button></div>
      {!rows ? <p className="text-sm text-ink-400">Loading…</p> : rows.length === 0 ? (
        <EmptyState title="No purchase orders yet" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">No.</th><th className="th">Vendor</th><th className="th">Status</th><th className="th">Total</th><th className="th">Paid</th><th className="th"></th></tr></thead>
            <tbody>
              {rows.map((po) => (
                <tr key={po.id} className="border-t border-ink-100">
                  <td className="td font-medium">{po.poNo}</td>
                  <td className="td">{po.vendorName}</td>
                  <td className="td"><Badge>{po.status}</Badge></td>
                  <td className="td">{formatINR(po.totalAmount)}</td>
                  <td className="td text-emerald-600">{formatINR(po.paidAmount)}</td>
                  <td className="td text-right">
                    <Link href={`/projects/${project.id}/purchase-orders/${po.id}/print`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                      <Printer className="h-3.5 w-3.5" /> Print
                    </Link>
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
        title="New Purchase Order"
        wide
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onCreate()} loading={busy}>Create</Button></>}
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
    </div>
  );
}

// ── Proforma Invoices ───────────────────────────────────────────────────
function PiTab({ project }: { project: Project }) {
  const actor = useActor();
  const [rows, setRows] = useState<ProformaInvoice[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ piNo: "", dueDate: "", milestone: "", notes: "" });
  const [items, setItems] = useState<DraftItem[]>([]);
  const [poFile, setPoFile] = useState<File | null>(null);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribePisForProject(project.id, setRows), [project.id]);

  async function onCreate() {
    if (!form.piNo.trim()) return;
    await run(async () => {
      let sourceDocumentId: string | null = null;
      if (poFile) {
        const doc = await uploadDocument({ file: poFile, projectId: project.id, docType: "CLIENT_PO", actor });
        sourceDocumentId = doc.id;
      }
      await createProformaInvoice({
        piNo: form.piNo, projectId: project.id, projectName: project.name, clientId: project.clientId,
        dueDate: form.dueDate ? new Date(form.dueDate) : null, milestone: form.milestone, items, notes: form.notes, sourceDocumentId,
      }, actor);
      setShowForm(false); setItems([]); setPoFile(null); setForm({ piNo: "", dueDate: "", milestone: "", notes: "" });
    }, "Proforma invoice created.");
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> New PI</Button></div>
      {!rows ? <p className="text-sm text-ink-400">Loading…</p> : rows.length === 0 ? (
        <EmptyState title="No proforma invoices yet" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">No.</th><th className="th">Milestone</th><th className="th">Status</th><th className="th">Total</th><th className="th">Paid</th><th className="th"></th></tr></thead>
            <tbody>
              {rows.map((pi) => (
                <tr key={pi.id} className="border-t border-ink-100">
                  <td className="td font-medium">{pi.piNo}</td>
                  <td className="td">{pi.milestone || "—"}</td>
                  <td className="td"><Badge>{pi.status}</Badge></td>
                  <td className="td">{formatINR(pi.totalAmount)}</td>
                  <td className="td text-emerald-600">{formatINR(pi.paidAmount)}</td>
                  <td className="td text-right">
                    <Link href={`/projects/${project.id}/proforma-invoices/${pi.id}/print`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                      <Printer className="h-3.5 w-3.5" /> Print
                    </Link>
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
        title="New Proforma Invoice"
        wide
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onCreate()} loading={busy}>Create</Button></>}
      >
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Field label="PI No." required><Input value={form.piNo} onChange={(e) => setForm((f) => ({ ...f, piNo: e.target.value }))} /></Field>
          <Field label="Due Date"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
          <Field label="Milestone"><Input value={form.milestone} onChange={(e) => setForm((f) => ({ ...f, milestone: e.target.value }))} /></Field>
          <Field label="Client PO / Work Order" className="col-span-3" hint="Optional — generates this PI against the uploaded document.">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink-300 px-3 py-2 text-sm text-ink-600 hover:bg-ink-50">
              <Upload className="h-4 w-4" /> {poFile ? poFile.name : "Choose a file…"}
              <input type="file" className="hidden" accept=".pdf,.xlsx,.xls,.doc,.docx,image/*" onChange={(e) => setPoFile(e.target.files?.[0] ?? null)} />
            </label>
          </Field>
        </div>
        <ItemsTable items={items} setItems={setItems} fields={ITEM_FIELDS} />
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
