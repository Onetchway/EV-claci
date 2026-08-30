"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Gavel, Plus, Search } from "lucide-react";

import { useActor } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, useAsyncAction,
} from "@/components/ui";
import { TENDER_STATUS_META, TENDER_STATUSES, type TenderStatus } from "@/lib/constants";
import { listActiveClients } from "@/lib/db/clients";
import { createTender, subscribeTenders } from "@/lib/db/tenders";
import type { Client, Tender } from "@/lib/types";
import { formatCompactINR, formatDate } from "@/lib/utils";

const EMPTY = {
  title: "", clientId: "", tenderNumber: "", department: "", authority: "", location: "",
  tenderValue: "", emdAmount: "", tenderFee: "", submissionDate: "", openingDate: "",
};

export default function TendersPage() {
  const actor = useActor();
  const [rows, setRows] = useState<Tender[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [status, setStatus] = useState<TenderStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeTenders({}, setRows), []);
  useEffect(() => { void listActiveClients().then(setClients); }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = search.trim().toLowerCase();
    return rows.filter((t) => {
      if (status !== "ALL" && t.status !== status) return false;
      if (needle && !`${t.tenderCode} ${t.tenderNumber} ${t.title} ${t.clientName}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, status, search]);

  async function onCreate() {
    if (!form.title.trim() || !form.clientId) return;
    await run(async () => {
      const client = clients.find((c) => c.id === form.clientId);
      await createTender({
        title: form.title, clientId: form.clientId, clientName: client?.name ?? "",
        tenderNumber: form.tenderNumber, department: form.department, authority: form.authority, location: form.location,
        tenderValue: Number(form.tenderValue) || 0, emdAmount: Number(form.emdAmount) || 0, tenderFee: Number(form.tenderFee) || 0,
        submissionDate: form.submissionDate ? new Date(form.submissionDate) : null,
        openingDate: form.openingDate ? new Date(form.openingDate) : null,
      }, actor);
      setShowForm(false); setForm(EMPTY);
    }, "Tender created.");
  }

  return (
    <div>
      <PageHeader
        title="Tenders"
        description="Government and institutional tenders, from preparation through award."
        actions={<Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> New Tender</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input placeholder="Search tenders…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select
          value={status}
          className="w-56"
          options={[{ value: "ALL", label: "All statuses" }, ...TENDER_STATUSES.map((s) => ({ value: s, label: TENDER_STATUS_META[s].label }))]}
          onChange={(e) => setStatus(e.target.value as TenderStatus | "ALL")}
        />
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Gavel className="h-8 w-8" />} title="No tenders yet" description="Add a tender to start tracking it through to award." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Code</th>
                <th className="th">Title</th>
                <th className="th">Client</th>
                <th className="th">Authority</th>
                <th className="th">Status</th>
                <th className="th">Submission</th>
                <th className="th">Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-t border-ink-100">
                  <td className="td"><Link href={`/tenders/${t.id}`} className="font-medium text-brand-700 hover:underline">{t.tenderCode}</Link></td>
                  <td className="td">{t.title}</td>
                  <td className="td">{t.clientName}</td>
                  <td className="td text-ink-600">{t.authority || "—"}</td>
                  <td className="td"><Badge className={TENDER_STATUS_META[t.status].className}>{TENDER_STATUS_META[t.status].label}</Badge></td>
                  <td className="td">{formatDate(t.submissionDate)}</td>
                  <td className="td">{formatCompactINR(t.tenderValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New Tender"
        wide
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onCreate()} loading={busy}>Create</Button></>}
      >
        <div className="grid grid-cols-3 gap-3">
          <Field label="Tender Title" required className="col-span-2"><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="Client" required>
            <Select value={form.clientId} placeholder="Select client…" options={clients.map((c) => ({ value: c.id, label: c.name }))} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} />
          </Field>
          <Field label="Tender Number"><Input value={form.tenderNumber} onChange={(e) => setForm((f) => ({ ...f, tenderNumber: e.target.value }))} /></Field>
          <Field label="Department"><Input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} /></Field>
          <Field label="Authority"><Input value={form.authority} onChange={(e) => setForm((f) => ({ ...f, authority: e.target.value }))} /></Field>
          <Field label="Location" className="col-span-2"><Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} /></Field>
          <Field label="Tender Value (₹)"><Input type="number" value={form.tenderValue} onChange={(e) => setForm((f) => ({ ...f, tenderValue: e.target.value }))} /></Field>
          <Field label="EMD (₹)"><Input type="number" value={form.emdAmount} onChange={(e) => setForm((f) => ({ ...f, emdAmount: e.target.value }))} /></Field>
          <Field label="Tender Fee (₹)"><Input type="number" value={form.tenderFee} onChange={(e) => setForm((f) => ({ ...f, tenderFee: e.target.value }))} /></Field>
          <Field label="Submission Date"><Input type="date" value={form.submissionDate} onChange={(e) => setForm((f) => ({ ...f, submissionDate: e.target.value }))} /></Field>
          <Field label="Opening Date"><Input type="date" value={form.openingDate} onChange={(e) => setForm((f) => ({ ...f, openingDate: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}
