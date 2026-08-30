"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Plus } from "lucide-react";

import { useActor } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, useAsyncAction,
} from "@/components/ui";
import { ItemsTable, ITEM_FIELDS, type DraftItem } from "@/components/line-items-table";
import { PI_STATUSES, type PiStatus } from "@/lib/constants";
import { subscribeProjects } from "@/lib/db/projects";
import { createProformaInvoice, subscribeProformaInvoices } from "@/lib/db/proforma-invoices";
import type { Project, ProformaInvoice } from "@/lib/types";
import { formatCompactINR, formatINR } from "@/lib/utils";

const EMPTY_FORM = { piNo: "", projectId: "", dueDate: "", milestone: "", notes: "" };

export default function ProformaInvoicesPage() {
  const actor = useActor();
  const [rows, setRows] = useState<ProformaInvoice[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<PiStatus | "ALL">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState<DraftItem[]>([]);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeProformaInvoices(setRows), []);
  useEffect(() => subscribeProjects({ status: "ALL", max: 500 }, setProjects), []);

  const filtered = useMemo(() => (!rows ? [] : status === "ALL" ? rows : rows.filter((r) => r.status === status)), [rows, status]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      total: all.length,
      value: all.reduce((s, p) => s + p.totalAmount, 0),
      collected: all.reduce((s, p) => s + p.paidAmount, 0),
      outstanding: all.reduce((s, p) => s + Math.max(p.totalAmount - p.paidAmount, 0), 0),
    };
  }, [rows]);

  async function onCreate() {
    if (!form.piNo.trim() || !form.projectId) return;
    await run(async () => {
      const project = projects.find((p) => p.id === form.projectId);
      if (!project) return;
      const pi = await createProformaInvoice({
        piNo: form.piNo, projectId: form.projectId, projectName: project.name, clientId: project.clientId,
        dueDate: form.dueDate ? new Date(form.dueDate) : null, milestone: form.milestone, items, notes: form.notes,
      }, actor);
      setShowForm(false); setForm(EMPTY_FORM); setItems([]);
      window.location.href = `/proforma-invoices/${pi.id}`;
    }, "Proforma invoice created.");
  }

  return (
    <div>
      <PageHeader
        title="Proforma Invoices"
        description="Every PI raised against a client, across every project."
        actions={
          <>
            <Select value={status} className="w-auto" options={[{ value: "ALL", label: "All statuses" }, ...PI_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]} onChange={(e) => setStatus(e.target.value as PiStatus | "ALL")} />
            <Button variant="primary" onClick={() => { setForm(EMPTY_FORM); setItems([]); setShowForm(true); }}><Plus className="h-4 w-4" /> New PI</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Proforma invoices" value={stats.total} icon={<FileSpreadsheet className="h-4 w-4" />} />
        <StatCard label="Total value" value={formatCompactINR(stats.value)} />
        <StatCard label="Collected" value={formatCompactINR(stats.collected)} tone="positive" />
        <StatCard label="Outstanding" value={formatCompactINR(stats.outstanding)} tone="negative" />
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FileSpreadsheet className="h-8 w-8" />} title="No proforma invoices yet" description="Create one here, or from a project's Proforma Invoices tab — either way it links to the project." action={<Button variant="primary" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> New PI</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No.</th>
                <th className="th">Project</th>
                <th className="th">Milestone</th>
                <th className="th">Status</th>
                <th className="th">Total</th>
                <th className="th">Paid</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pi) => (
                <tr key={pi.id} className="border-t border-ink-100 hover:bg-ink-50">
                  <td className="td font-medium"><Link href={`/proforma-invoices/${pi.id}`} className="text-brand-700 hover:underline">{pi.piNo}</Link></td>
                  <td className="td"><Link href={`/projects/${pi.projectId}`} className="text-ink-600 hover:underline">{pi.projectName}</Link></td>
                  <td className="td">{pi.milestone || "—"}</td>
                  <td className="td"><Badge>{pi.status.replace(/_/g, " ")}</Badge></td>
                  <td className="td">{formatINR(pi.totalAmount)}</td>
                  <td className="td text-emerald-600">{formatINR(pi.paidAmount)}</td>
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
          <Field label="Project" required>
            <Select value={form.projectId} placeholder="Select project…" options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))} />
          </Field>
          <Field label="Due Date"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
          <Field label="Milestone"><Input value={form.milestone} onChange={(e) => setForm((f) => ({ ...f, milestone: e.target.value }))} /></Field>
        </div>
        <ItemsTable items={items} setItems={setItems} fields={ITEM_FIELDS} />
      </Modal>
    </div>
  );
}
