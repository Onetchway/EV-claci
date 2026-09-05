"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Mail, Plus, Search } from "lucide-react";

import { useActor } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, useAsyncAction,
} from "@/components/ui";
import { ExportButton } from "@/components/export-button";
import { RFQ_STATUS_META, RFQ_STATUSES, type RfqStatus } from "@/lib/constants";
import { listActiveClients } from "@/lib/db/clients";
import { createRfq, subscribeRfqs } from "@/lib/db/rfqs";
import { subscribeProjects } from "@/lib/db/projects";
import type { Client, Project, Rfq } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const EMPTY = { subject: "", clientId: "", projectId: "", receivedDate: "", dueDate: "", notes: "" };

export default function RfqsPage() {
  const actor = useActor();
  const [rows, setRows] = useState<Rfq[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<RfqStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeRfqs(setRows), []);
  useEffect(() => { void listActiveClients().then(setClients); }, []);
  useEffect(() => subscribeProjects({ status: "ALL", clientId: form.clientId || undefined, max: 500 }, setProjects), [form.clientId]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (needle && !`${r.rfqNo} ${r.subject} ${r.clientName}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, status, search]);

  async function onCreate() {
    if (!form.subject.trim() || !form.clientId) return;
    await run(async () => {
      const client = clients.find((c) => c.id === form.clientId);
      const project = projects.find((p) => p.id === form.projectId);
      await createRfq({
        subject: form.subject, clientId: form.clientId, clientName: client?.name ?? "",
        projectId: form.projectId || null, projectName: project?.name,
        receivedDate: form.receivedDate ? new Date(form.receivedDate) : null,
        dueDate: form.dueDate ? new Date(form.dueDate) : null,
        notes: form.notes,
      }, actor);
      setShowForm(false); setForm(EMPTY);
    }, "RFQ logged.");
  }

  return (
    <div>
      <PageHeader
        title="RFQs"
        description="A client's Request for Quotation, logged before it's priced into a Quotation."
        actions={
          <>
            <ExportButton
              filename="rfqs"
              sheetName="RFQs"
              rows={filtered.map((r) => ({
                No: r.rfqNo, Subject: r.subject, Client: r.clientName, Project: r.projectName ?? "",
                Status: RFQ_STATUS_META[r.status].label, Received: formatDate(r.receivedDate), Due: formatDate(r.dueDate),
              }))}
            />
            <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> New RFQ</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input placeholder="Search RFQs…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select
          value={status}
          className="w-56"
          options={[{ value: "ALL", label: "All statuses" }, ...RFQ_STATUSES.map((s) => ({ value: s, label: RFQ_STATUS_META[s].label }))]}
          onChange={(e) => setStatus(e.target.value as RfqStatus | "ALL")}
        />
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Mail className="h-8 w-8" />} title="No RFQs yet" description="Log a client's request here before pricing it into a Quotation." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No.</th>
                <th className="th">Subject</th>
                <th className="th">Client</th>
                <th className="th">Project</th>
                <th className="th">Status</th>
                <th className="th">Received</th>
                <th className="th">Due</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-ink-100">
                  <td className="td"><Link href={`/rfqs/${r.id}`} className="font-medium text-brand-700 hover:underline">{r.rfqNo}</Link></td>
                  <td className="td">{r.subject}</td>
                  <td className="td">{r.clientName}</td>
                  <td className="td text-ink-600">{r.projectName || "—"}</td>
                  <td className="td"><Badge className={RFQ_STATUS_META[r.status].className}>{RFQ_STATUS_META[r.status].label}</Badge></td>
                  <td className="td">{formatDate(r.receivedDate)}</td>
                  <td className="td">{formatDate(r.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New RFQ"
        wide
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onCreate()} loading={busy}>Create</Button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Subject" required className="col-span-2"><Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} /></Field>
          <Field label="Client" required>
            <Select value={form.clientId} placeholder="Select client…" options={clients.map((c) => ({ value: c.id, label: c.name }))} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value, projectId: "" }))} />
          </Field>
          <Field label="Project" hint="Optional — link a project now, or later once one exists.">
            <Select value={form.projectId} placeholder="Select project…" options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))} />
          </Field>
          <Field label="Received Date"><Input type="date" value={form.receivedDate} onChange={(e) => setForm((f) => ({ ...f, receivedDate: e.target.value }))} /></Field>
          <Field label="Due Date"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
          <Field label="Notes" className="col-span-2"><Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}
