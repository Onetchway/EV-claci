"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileSignature, Plus } from "lucide-react";

import { useActor } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, useAsyncAction,
} from "@/components/ui";
import { ItemsTable, ITEM_FIELDS, type DraftItem } from "@/components/line-items-table";
import { QUOTATION_STATUSES, type QuotationStatus } from "@/lib/constants";
import { subscribeProjects } from "@/lib/db/projects";
import { createQuotation, nextQuotationVersion, subscribeQuotations } from "@/lib/db/quotations";
import type { Project, Quotation } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR } from "@/lib/utils";

const OPEN_STATUSES: QuotationStatus[] = ["DRAFT", "SENT", "NEGOTIATION"];
const EMPTY_FORM = { quotationNo: "", projectId: "", validUntil: "", taxPercent: "18", notes: "" };

export default function QuotationsPage() {
  const actor = useActor();
  const [rows, setRows] = useState<Quotation[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<QuotationStatus | "ALL">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState<DraftItem[]>([]);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeQuotations(setRows), []);
  useEffect(() => subscribeProjects({ status: "ALL", max: 500 }, setProjects), []);

  const filtered = useMemo(() => (!rows ? [] : status === "ALL" ? rows : rows.filter((r) => r.status === status)), [rows, status]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      total: all.length,
      open: all.filter((q) => OPEN_STATUSES.includes(q.status)).length,
      value: all.reduce((s, q) => s + q.totalAmount, 0),
      approved: all.filter((q) => q.status === "APPROVED").length,
    };
  }, [rows]);

  async function onCreate() {
    if (!form.quotationNo.trim() || !form.projectId) return;
    await run(async () => {
      const project = projects.find((p) => p.id === form.projectId);
      if (!project) return;
      const version = await nextQuotationVersion(form.projectId);
      const q = await createQuotation({
        quotationNo: form.quotationNo, projectId: form.projectId, projectName: project.name, clientId: project.clientId,
        version, quotationDate: new Date(), validUntil: form.validUntil ? new Date(form.validUntil) : null,
        items, taxPercent: Number(form.taxPercent) || 0, notes: form.notes,
      }, actor);
      setShowForm(false); setForm(EMPTY_FORM); setItems([]);
      window.location.href = `/quotations/${q.id}`;
    }, "Quotation created.");
  }

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Every quotation and its versions, across every project."
        actions={
          <>
            <Select value={status} className="w-auto" options={[{ value: "ALL", label: "All statuses" }, ...QUOTATION_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]} onChange={(e) => setStatus(e.target.value as QuotationStatus | "ALL")} />
            <Button variant="primary" onClick={() => { setForm(EMPTY_FORM); setItems([]); setShowForm(true); }}><Plus className="h-4 w-4" /> New Quotation</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Quotations" value={stats.total} icon={<FileSignature className="h-4 w-4" />} />
        <StatCard label="Open" value={stats.open} />
        <StatCard label="Approved" value={stats.approved} tone="positive" />
        <StatCard label="Total value" value={formatCompactINR(stats.value)} />
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FileSignature className="h-8 w-8" />} title="No quotations yet" description="Create one here, or from a project's Quotations tab — either way it links to the project." action={<Button variant="primary" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> New Quotation</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No.</th>
                <th className="th">Project</th>
                <th className="th">Version</th>
                <th className="th">Status</th>
                <th className="th">Valid Until</th>
                <th className="th">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.id} className="border-t border-ink-100 hover:bg-ink-50">
                  <td className="td font-medium"><Link href={`/quotations/${q.id}`} className="text-brand-700 hover:underline">{q.quotationNo}</Link></td>
                  <td className="td"><Link href={`/projects/${q.projectId}`} className="text-ink-600 hover:underline">{q.projectName}</Link></td>
                  <td className="td">v{q.version}</td>
                  <td className="td"><Badge>{q.status.replace(/_/g, " ")}</Badge></td>
                  <td className="td">{formatDate(q.validUntil)}</td>
                  <td className="td">{formatINR(q.totalAmount)}</td>
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
          <Field label="Project" required>
            <Select value={form.projectId} placeholder="Select project…" options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))} />
          </Field>
          <Field label="Valid Until"><Input type="date" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} /></Field>
          <Field label="Tax %"><Input type="number" value={form.taxPercent} onChange={(e) => setForm((f) => ({ ...f, taxPercent: e.target.value }))} /></Field>
        </div>
        <ItemsTable items={items} setItems={setItems} fields={ITEM_FIELDS} />
      </Modal>
    </div>
  );
}
