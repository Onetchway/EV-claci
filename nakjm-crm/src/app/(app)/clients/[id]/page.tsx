"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";

import { EntityActivityLog } from "@/components/entity-activity-log";
import { Badge, Button, Field, Input, Modal, Select, StatCard, useAsyncAction } from "@/components/ui";
import { updateClient, subscribeClient } from "@/lib/db/clients";
import { listProjectsForClient } from "@/lib/db/projects";
import { subscribeBoqs } from "@/lib/db/boq";
import { subscribeDocuments } from "@/lib/db/documents";
import { subscribeClientPayments } from "@/lib/db/payments";
import { subscribePisForClient } from "@/lib/db/proforma-invoices";
import { subscribeQuotationsForClient } from "@/lib/db/quotations";
import { subscribeTendersForClient } from "@/lib/db/tenders";
import { CLIENT_TYPES, DOCUMENT_CATEGORY_LABEL, statusMeta, TENDER_STATUS_META, type ClientType } from "@/lib/constants";
import type { Boq, Client, ClientPayment, NakjmDocument, Project, ProformaInvoice, Quotation, Tender } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR } from "@/lib/utils";

const TABS = ["Overview", "Projects", "Tenders", "Quotations", "Proforma Invoices", "BOQs", "Documents", "Activity"] as const;

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [payments, setPayments] = useState<ClientPayment[] | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [pis, setPis] = useState<ProformaInvoice[]>([]);
  const [allBoqs, setAllBoqs] = useState<Boq[]>([]);
  const [allDocuments, setAllDocuments] = useState<NakjmDocument[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<{
    name: string; clientType: ClientType; contactName: string; contactEmail: string;
    contactPhone: string; city: string; state: string; gstin: string; active: boolean;
  } | null>(null);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeClient(id, setClient), [id]);
  useEffect(() => { void listProjectsForClient(id).then(setProjects); }, [id]);
  useEffect(() => subscribeTendersForClient(id, setTenders), [id]);
  useEffect(() => subscribeClientPayments({ clientId: id }, setPayments), [id]);
  useEffect(() => subscribeQuotationsForClient(id, setQuotations), [id]);
  useEffect(() => subscribePisForClient(id, setPis), [id]);
  useEffect(() => subscribeBoqs(setAllBoqs), []);
  useEffect(() => subscribeDocuments(setAllDocuments), []);

  const projectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);
  const boqs = useMemo(() => allBoqs.filter((b) => projectIds.has(b.projectId)), [allBoqs, projectIds]);
  const documents = useMemo(() => allDocuments.filter((d) => d.projectId && projectIds.has(d.projectId)), [allDocuments, projectIds]);

  if (!client) return <p className="text-sm text-ink-400">Loading…</p>;

  const totalCollected = (payments ?? []).reduce((s, p) => s + p.amount, 0);

  function openEdit() {
    setForm({
      name: client!.name, clientType: client!.clientType, contactName: client!.contactName ?? "",
      contactEmail: client!.contactEmail ?? "", contactPhone: client!.contactPhone ?? "",
      city: client!.city ?? "", state: client!.state ?? "", gstin: client!.gstin ?? "", active: client!.active,
    });
    setEditOpen(true);
  }

  async function onSave() {
    if (!form || !form.name.trim()) return;
    await run(async () => {
      await updateClient(id, form);
      setEditOpen(false);
    }, "Client updated.");
  }

  return (
    <div className="space-y-5">
      <div className="card card-pad">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">{client.name}</h1>
            <p className="text-sm uppercase text-ink-500">{client.clientType} · {[client.city, client.state].filter(Boolean).join(", ")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={client.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
              {client.active ? "Active" : "Inactive"}
            </Badge>
            <Button size="sm" onClick={openEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-ink-100 pt-5 text-sm md:grid-cols-4">
          <div><p className="text-ink-400">Contact</p><p className="font-medium">{client.contactName || "—"}</p></div>
          <div><p className="text-ink-400">Email</p><p className="font-medium">{client.contactEmail || "—"}</p></div>
          <div><p className="text-ink-400">Phone</p><p className="font-medium">{client.contactPhone || "—"}</p></div>
          <div><p className="text-ink-400">GSTIN</p><p className="font-medium">{client.gstin || "—"}</p></div>
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

      {tab === "Overview" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard label="Total Collected" value={formatCompactINR(totalCollected)} tone="positive" />
          <StatCard label="Total Projects" value={projects.length} />
          <StatCard label="Open Tenders" value={tenders.filter((t) => t.status !== "AWARDED" && t.status !== "LOST" && t.status !== "CANCELLED").length} />
        </div>
      )}

      {tab === "Projects" && (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">Code</th><th className="th">Name</th><th className="th">Status</th><th className="th">Contract Value</th><th className="th">Start</th><th className="th">Target End</th></tr></thead>
            <tbody>
              {projects.length === 0 ? (
                <tr><td colSpan={6} className="td text-center text-ink-400">No projects yet.</td></tr>
              ) : projects.map((p) => (
                <tr key={p.id} className="border-t border-ink-100">
                  <td className="td">
                    <Link href={`/projects/${p.id}`} className="font-medium text-brand-700">{p.code}</Link>
                    {p.parentProjectCode && <span className="ml-1.5 text-xs text-ink-400">(sub-project of {p.parentProjectCode})</span>}
                  </td>
                  <td className="td">{p.name}</td>
                  <td className="td"><Badge className={statusMeta(p.status).className}>{statusMeta(p.status).label}</Badge></td>
                  <td className="td">{formatINR(p.contractValue)}</td>
                  <td className="td">{formatDate(p.startDate)}</td>
                  <td className="td">{formatDate(p.targetEndDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Tenders" && (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">Code</th><th className="th">Title</th><th className="th">Status</th><th className="th">Value</th><th className="th">Submission</th></tr></thead>
            <tbody>
              {tenders.length === 0 ? (
                <tr><td colSpan={5} className="td text-center text-ink-400">No tenders yet.</td></tr>
              ) : tenders.map((t) => (
                <tr key={t.id} className="border-t border-ink-100">
                  <td className="td"><Link href={`/tenders/${t.id}`} className="font-medium text-brand-700">{t.tenderCode}</Link></td>
                  <td className="td">{t.title}</td>
                  <td className="td"><Badge className={TENDER_STATUS_META[t.status].className}>{TENDER_STATUS_META[t.status].label}</Badge></td>
                  <td className="td">{formatINR(t.tenderValue)}</td>
                  <td className="td">{formatDate(t.submissionDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Quotations" && (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">No.</th><th className="th">Project</th><th className="th">Version</th><th className="th">Status</th><th className="th">Total</th></tr></thead>
            <tbody>
              {quotations.length === 0 ? (
                <tr><td colSpan={5} className="td text-center text-ink-400">No quotations yet.</td></tr>
              ) : quotations.map((q) => (
                <tr key={q.id} className="border-t border-ink-100">
                  <td className="td"><Link href={`/quotations/${q.id}`} className="font-medium text-brand-700">{q.quotationNo}</Link></td>
                  <td className="td"><Link href={`/projects/${q.projectId}`} className="text-ink-600 hover:underline">{q.projectName}</Link></td>
                  <td className="td">v{q.version}</td>
                  <td className="td"><Badge>{q.status.replace(/_/g, " ")}</Badge></td>
                  <td className="td">{formatINR(q.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Proforma Invoices" && (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">No.</th><th className="th">Project</th><th className="th">Status</th><th className="th">Total</th><th className="th">Paid</th></tr></thead>
            <tbody>
              {pis.length === 0 ? (
                <tr><td colSpan={5} className="td text-center text-ink-400">No proforma invoices yet.</td></tr>
              ) : pis.map((pi) => (
                <tr key={pi.id} className="border-t border-ink-100">
                  <td className="td"><Link href={`/proforma-invoices/${pi.id}`} className="font-medium text-brand-700">{pi.piNo}</Link></td>
                  <td className="td"><Link href={`/projects/${pi.projectId}`} className="text-ink-600 hover:underline">{pi.projectName}</Link></td>
                  <td className="td"><Badge>{pi.status.replace(/_/g, " ")}</Badge></td>
                  <td className="td">{formatINR(pi.totalAmount)}</td>
                  <td className="td text-emerald-600">{formatINR(pi.paidAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "BOQs" && (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">No.</th><th className="th">Project</th><th className="th">Status</th><th className="th">Total</th></tr></thead>
            <tbody>
              {boqs.length === 0 ? (
                <tr><td colSpan={4} className="td text-center text-ink-400">No BOQs yet.</td></tr>
              ) : boqs.map((b) => (
                <tr key={b.id} className="border-t border-ink-100">
                  <td className="td"><Link href={`/boq/${b.id}`} className="font-medium text-brand-700">{b.boqNo}</Link></td>
                  <td className="td"><Link href={`/projects/${b.projectId}`} className="text-ink-600 hover:underline">{b.projectName}</Link></td>
                  <td className="td"><Badge>{b.status}</Badge></td>
                  <td className="td">{formatINR(b.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Documents" && (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">File</th><th className="th">Category</th><th className="th">Project</th><th className="th">Date</th></tr></thead>
            <tbody>
              {documents.length === 0 ? (
                <tr><td colSpan={4} className="td text-center text-ink-400">No documents yet.</td></tr>
              ) : documents.map((d) => (
                <tr key={d.id} className="border-t border-ink-100">
                  <td className="td"><a href={d.downloadUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">{d.fileName}</a></td>
                  <td className="td"><Badge>{DOCUMENT_CATEGORY_LABEL[d.docType]}</Badge></td>
                  <td className="td">{projects.find((p) => p.id === d.projectId)?.name ?? "—"}</td>
                  <td className="td">{formatDate(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Activity" && <EntityActivityLog entityType="CLIENT" entityId={client.id} />}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Client"
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={() => void onSave()} loading={busy}>Save</Button></>}
      >
        {form && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client / Company Name" required className="col-span-2">
              <Input value={form.name} onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })} />
            </Field>
            <Field label="Client Type">
              <Select value={form.clientType} options={CLIENT_TYPES.map((t) => ({ value: t, label: t }))} onChange={(e) => setForm((f) => f && { ...f, clientType: e.target.value as ClientType })} />
            </Field>
            <Field label="Status">
              <Select value={form.active ? "1" : "0"} options={[{ value: "1", label: "Active" }, { value: "0", label: "Inactive" }]} onChange={(e) => setForm((f) => f && { ...f, active: e.target.value === "1" })} />
            </Field>
            <Field label="GSTIN"><Input value={form.gstin} onChange={(e) => setForm((f) => f && { ...f, gstin: e.target.value })} /></Field>
            <Field label="Contact Name"><Input value={form.contactName} onChange={(e) => setForm((f) => f && { ...f, contactName: e.target.value })} /></Field>
            <Field label="Contact Email"><Input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => f && { ...f, contactEmail: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.contactPhone} onChange={(e) => setForm((f) => f && { ...f, contactPhone: e.target.value })} /></Field>
            <Field label="City"><Input value={form.city} onChange={(e) => setForm((f) => f && { ...f, city: e.target.value })} /></Field>
            <Field label="State" className="col-span-2"><Input value={form.state} onChange={(e) => setForm((f) => f && { ...f, state: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
