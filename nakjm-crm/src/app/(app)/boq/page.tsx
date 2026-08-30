"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Upload } from "lucide-react";

import { useActor } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, useAsyncAction, useToast,
} from "@/components/ui";
import { ItemsTable, BOQ_FIELDS, type DraftBoqItem } from "@/components/line-items-table";
import { BOQ_CATEGORIES, BOQ_STATUSES, type BoqCategory, type BoqStatus } from "@/lib/constants";
import { parseBoqFile } from "@/lib/boq-parser";
import { createBoq, subscribeBoqs } from "@/lib/db/boq";
import { subscribeProjects } from "@/lib/db/projects";
import type { Boq, BoqLineItem, Project } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR } from "@/lib/utils";

const EMPTY_FORM = { boqNo: "", projectId: "", siteName: "", notes: "" };

export default function BoqListPage() {
  const actor = useActor();
  const { push } = useToast();
  const [rows, setRows] = useState<Boq[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<BoqStatus | "ALL">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState<DraftBoqItem[]>([]);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeBoqs(setRows), []);
  useEffect(() => subscribeProjects({ status: "ALL", max: 500 }, setProjects), []);

  const filtered = useMemo(() => (!rows ? [] : status === "ALL" ? rows : rows.filter((r) => r.status === status)), [rows, status]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      total: all.length,
      approved: all.filter((b) => b.status === "APPROVED").length,
      value: all.reduce((s, b) => s + b.totalAmount, 0),
    };
  }, [rows]);

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
    if (!form.boqNo.trim() || !form.projectId) return;
    await run(async () => {
      const project = projects.find((p) => p.id === form.projectId);
      if (!project) return;
      const cleanItems = items.map((it) => ({ ...it, category: (it.category as BoqCategory) || "OTHER" })) as BoqLineItem[];
      const boq = await createBoq({ boqNo: form.boqNo, projectId: form.projectId, projectName: project.name, siteName: form.siteName, items: cleanItems, notes: form.notes }, actor);
      setShowForm(false); setForm(EMPTY_FORM); setItems([]);
      window.location.href = `/boq/${boq.id}`;
    }, "BOQ created.");
  }

  return (
    <div>
      <PageHeader
        title="BOQ"
        description="Bills of quantities, across every project — original and revised."
        actions={
          <>
            <Select value={status} className="w-auto" options={[{ value: "ALL", label: "All statuses" }, ...BOQ_STATUSES.map((s) => ({ value: s, label: s }))]} onChange={(e) => setStatus(e.target.value as BoqStatus | "ALL")} />
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-300 bg-white px-3.5 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50">
              <Upload className="h-4 w-4" /> {importing ? "Importing…" : "Import from Excel"}
              <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importing} onChange={(e) => void onFileSelect(e)} />
            </label>
            <Button variant="primary" onClick={() => { setForm(EMPTY_FORM); setItems([]); setShowForm(true); }}><Plus className="h-4 w-4" /> New BOQ</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="BOQs" value={stats.total} icon={<ClipboardList className="h-4 w-4" />} />
        <StatCard label="Approved" value={stats.approved} tone="positive" />
        <StatCard label="Total value" value={formatCompactINR(stats.value)} />
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-8 w-8" />} title="No BOQs yet" description="Create one here, import an Excel file, or add it from a project's BOQ tab — either way it links to the project." action={<Button variant="primary" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> New BOQ</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No.</th>
                <th className="th">Project</th>
                <th className="th">Site</th>
                <th className="th">Status</th>
                <th className="th">Date</th>
                <th className="th">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-t border-ink-100 hover:bg-ink-50">
                  <td className="td font-medium"><Link href={`/boq/${b.id}`} className="text-brand-700 hover:underline">{b.boqNo}</Link></td>
                  <td className="td"><Link href={`/projects/${b.projectId}`} className="text-ink-600 hover:underline">{b.projectName}</Link></td>
                  <td className="td">{b.siteName || "—"}</td>
                  <td className="td"><Badge>{b.status}</Badge></td>
                  <td className="td">{formatDate(b.boqDate)}</td>
                  <td className="td">{formatINR(b.totalAmount)}</td>
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
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Field label="BOQ No." required><Input value={form.boqNo} onChange={(e) => setForm((f) => ({ ...f, boqNo: e.target.value }))} /></Field>
          <Field label="Project" required>
            <Select value={form.projectId} placeholder="Select project…" options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))} />
          </Field>
          <Field label="Site Name"><Input value={form.siteName} onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))} /></Field>
        </div>
        <ItemsTable items={items} setItems={setItems} fields={BOQ_FIELDS} />
        <p className="mt-2 text-xs text-ink-500">Category defaults to OTHER for imported rows; categories: {BOQ_CATEGORIES.join(", ")}.</p>
      </Modal>
    </div>
  );
}
