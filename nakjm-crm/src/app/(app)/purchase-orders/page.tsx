"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileText, Plus } from "lucide-react";

import { useActor } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, useAsyncAction,
} from "@/components/ui";
import { ItemsTable, ITEM_FIELDS, type DraftItem } from "@/components/line-items-table";
import { PO_STATUSES, type PoStatus } from "@/lib/constants";
import { subscribeProjects } from "@/lib/db/projects";
import { createPurchaseOrder, subscribePurchaseOrders } from "@/lib/db/purchase-orders";
import { listActiveVendors } from "@/lib/db/vendors";
import type { Project, PurchaseOrder, Vendor } from "@/lib/types";
import { formatCompactINR, formatINR } from "@/lib/utils";

const OPEN_STATUSES: PoStatus[] = ["DRAFT", "ISSUED", "ACKNOWLEDGED", "PARTIALLY_DELIVERED"];
const EMPTY_FORM = { poNo: "", projectId: "", vendorId: "", deliveryDate: "", notes: "" };

export default function PurchaseOrdersPage() {
  const actor = useActor();
  const [rows, setRows] = useState<PurchaseOrder[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [status, setStatus] = useState<PoStatus | "ALL">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState<DraftItem[]>([]);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribePurchaseOrders(setRows), []);
  useEffect(() => subscribeProjects({ status: "ALL", max: 500 }, setProjects), []);
  useEffect(() => { void listActiveVendors().then(setVendors); }, []);

  const filtered = useMemo(() => (!rows ? [] : status === "ALL" ? rows : rows.filter((r) => r.status === status)), [rows, status]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    const open = all.filter((p) => OPEN_STATUSES.includes(p.status));
    return {
      total: all.length,
      open: open.length,
      value: all.reduce((s, p) => s + p.totalAmount, 0),
      outstanding: all.reduce((s, p) => s + Math.max(p.totalAmount - p.paidAmount, 0), 0),
    };
  }, [rows]);

  async function onCreate() {
    if (!form.poNo.trim() || !form.projectId || !form.vendorId) return;
    await run(async () => {
      const project = projects.find((p) => p.id === form.projectId);
      const vendor = vendors.find((v) => v.id === form.vendorId);
      const po = await createPurchaseOrder({
        poNo: form.poNo, projectId: form.projectId, projectName: project?.name ?? "",
        vendorId: form.vendorId, vendorName: vendor?.name ?? "",
        deliveryDate: form.deliveryDate ? new Date(form.deliveryDate) : null, items, notes: form.notes,
      }, actor);
      setShowForm(false); setForm(EMPTY_FORM); setItems([]);
      window.location.href = `/purchase-orders/${po.id}`;
    }, "Purchase order created.");
  }

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        description="What NAKJM has ordered from vendors — equipment, civil work, EPC scope — and what's still owed."
        actions={
          <>
            <Select value={status} className="w-auto" options={[{ value: "ALL", label: "All statuses" }, ...PO_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]} onChange={(e) => setStatus(e.target.value as PoStatus | "ALL")} />
            <Button variant="primary" onClick={() => { setForm(EMPTY_FORM); setItems([]); setShowForm(true); }}><Plus className="h-4 w-4" /> New PO</Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Purchase orders" value={stats.total} icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Open" value={stats.open} />
        <StatCard label="Total value" value={formatCompactINR(stats.value)} />
        <StatCard label="Outstanding" value={formatCompactINR(stats.outstanding)} tone="negative" />
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="No purchase orders yet" description="Create one here, or from a project's Purchase Orders tab — either way it links to the project." action={<Button variant="primary" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> New PO</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">PO Number</th>
                <th className="th">Vendor</th>
                <th className="th">Status</th>
                <th className="th">Project</th>
                <th className="th">Total</th>
                <th className="th">Due</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((po) => (
                <tr key={po.id} className="cursor-pointer border-t border-ink-100 hover:bg-ink-50">
                  <td className="td font-medium"><Link href={`/purchase-orders/${po.id}`} className="text-brand-700 hover:underline">{po.poNo}</Link></td>
                  <td className="td">{po.vendorName}</td>
                  <td className="td"><Badge>{po.status.replace(/_/g, " ")}</Badge></td>
                  <td className="td"><Link href={`/projects/${po.projectId}`} className="text-ink-600 hover:underline">{po.projectName}</Link></td>
                  <td className="td">{formatINR(po.totalAmount)}</td>
                  <td className="td text-rose-600">{formatINR(Math.max(po.totalAmount - po.paidAmount, 0))}</td>
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
          <Field label="Project" required>
            <Select value={form.projectId} placeholder="Select project…" options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))} />
          </Field>
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
