"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";

import { useActor } from "@/components/auth-provider";
import { Badge, Button, Field, Input, Modal, Select, StatCard, useAsyncAction } from "@/components/ui";
import { ItemsTable, ITEM_FIELDS, type DraftItem } from "@/components/line-items-table";
import { VENDOR_CATEGORIES, type VendorCategory } from "@/lib/constants";
import { subscribeVendor, updateVendor } from "@/lib/db/vendors";
import { createPurchaseOrder, subscribePosForVendor } from "@/lib/db/purchase-orders";
import { subscribeVendorPayments } from "@/lib/db/payments";
import { subscribeProjects } from "@/lib/db/projects";
import type { Project, PurchaseOrder, Vendor, VendorPayment } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR } from "@/lib/utils";

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const actor = useActor();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [pos, setPos] = useState<PurchaseOrder[] | null>(null);
  const [payments, setPayments] = useState<VendorPayment[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [poForm, setPoForm] = useState({ poNo: "", projectId: "", deliveryDate: "", notes: "" });
  const [poItems, setPoItems] = useState<DraftItem[]>([]);
  const [form, setForm] = useState<{
    name: string; category: VendorCategory; contactName: string; contactEmail: string;
    contactPhone: string; gstin: string; bankAccountNo: string; bankIfsc: string; bankName: string; active: boolean;
  } | null>(null);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeVendor(id, setVendor), [id]);
  useEffect(() => subscribePosForVendor(id, setPos), [id]);
  useEffect(() => subscribeVendorPayments({ vendorId: id }, setPayments), [id]);
  useEffect(() => subscribeProjects({ status: "ALL", max: 500 }, setProjects), []);

  if (!vendor) return <p className="text-sm text-ink-400">Loading…</p>;

  const totalPoValue = (pos ?? []).reduce((s, p) => s + p.totalAmount, 0);
  const totalPaid = (payments ?? []).reduce((s, p) => s + p.amount, 0);

  async function onCreatePo() {
    if (!poForm.poNo.trim() || !poForm.projectId) return;
    await run(async () => {
      const project = projects.find((p) => p.id === poForm.projectId);
      await createPurchaseOrder({
        poNo: poForm.poNo, projectId: poForm.projectId, projectName: project?.name ?? "",
        vendorId: vendor!.id, vendorName: vendor!.name,
        deliveryDate: poForm.deliveryDate ? new Date(poForm.deliveryDate) : null, items: poItems, notes: poForm.notes,
      }, actor);
      setPoOpen(false); setPoForm({ poNo: "", projectId: "", deliveryDate: "", notes: "" }); setPoItems([]);
    }, "Purchase order created.");
  }

  function openEdit() {
    setForm({
      name: vendor!.name, category: vendor!.category, contactName: vendor!.contactName ?? "",
      contactEmail: vendor!.contactEmail ?? "", contactPhone: vendor!.contactPhone ?? "",
      gstin: vendor!.gstin ?? "", bankAccountNo: vendor!.bankAccountNo ?? "", bankIfsc: vendor!.bankIfsc ?? "",
      bankName: vendor!.bankName ?? "", active: vendor!.active,
    });
    setEditOpen(true);
  }

  async function onSave() {
    if (!form || !form.name.trim()) return;
    await run(async () => {
      await updateVendor(id, form);
      setEditOpen(false);
    }, "Vendor updated.");
  }

  return (
    <div className="space-y-5">
      <div className="card card-pad">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">{vendor.name}</h1>
            <p className="text-sm capitalize text-ink-500">{vendor.category.replace(/_/g, " ").toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={vendor.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
              {vendor.active ? "Active" : "Inactive"}
            </Badge>
            <Button size="sm" onClick={openEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
            <Button size="sm" variant="primary" onClick={() => { setPoForm({ poNo: "", projectId: "", deliveryDate: "", notes: "" }); setPoItems([]); setPoOpen(true); }}><Plus className="h-3.5 w-3.5" /> New PO</Button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-ink-100 pt-5 text-sm md:grid-cols-4">
          <div><p className="text-ink-400">Contact</p><p className="font-medium">{vendor.contactName || "—"}</p></div>
          <div><p className="text-ink-400">Email</p><p className="font-medium">{vendor.contactEmail || "—"}</p></div>
          <div><p className="text-ink-400">Phone</p><p className="font-medium">{vendor.contactPhone || "—"}</p></div>
          <div><p className="text-ink-400">GSTIN</p><p className="font-medium">{vendor.gstin || "—"}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="PO Value" value={formatCompactINR(totalPoValue)} />
        <StatCard label="Paid" value={formatCompactINR(totalPaid)} tone="positive" />
        <StatCard label="Outstanding" value={formatCompactINR(Math.max(totalPoValue - totalPaid, 0))} tone="negative" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
        <table className="w-full">
          <thead><tr><th className="th">PO No.</th><th className="th">Project</th><th className="th">Status</th><th className="th">Total</th><th className="th">Date</th></tr></thead>
          <tbody>
            {(pos ?? []).length === 0 ? (
              <tr><td colSpan={5} className="td text-center text-ink-400">No purchase orders yet.</td></tr>
            ) : pos!.map((po) => (
              <tr key={po.id} className="border-t border-ink-100">
                <td className="td font-medium"><Link href={`/purchase-orders/${po.id}`} className="text-brand-700 hover:underline">{po.poNo}</Link></td>
                <td className="td">{po.projectName}</td>
                <td className="td"><Badge>{po.status}</Badge></td>
                <td className="td">{formatINR(po.totalAmount)}</td>
                <td className="td">{formatDate(po.poDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
        <table className="w-full">
          <thead><tr><th className="th">Date</th><th className="th">Project</th><th className="th">Mode</th><th className="th">Reference</th><th className="th">Amount</th></tr></thead>
          <tbody>
            {(payments ?? []).length === 0 ? (
              <tr><td colSpan={5} className="td text-center text-ink-400">No payments yet.</td></tr>
            ) : payments!.map((p) => (
              <tr key={p.id} className="border-t border-ink-100">
                <td className="td">{formatDate(p.paymentDate)}</td>
                <td className="td">{p.projectName}</td>
                <td className="td capitalize">{p.mode.replace(/_/g, " ").toLowerCase()}</td>
                <td className="td">{p.referenceNo || "—"}</td>
                <td className="td font-medium text-emerald-600">{formatINR(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Vendor"
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={() => void onSave()} loading={busy}>Save</Button></>}
      >
        {form && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vendor / Company Name" required className="col-span-2">
              <Input value={form.name} onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })} />
            </Field>
            <Field label="Category">
              <Select value={form.category} options={VENDOR_CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, " ") }))} onChange={(e) => setForm((f) => f && { ...f, category: e.target.value as VendorCategory })} />
            </Field>
            <Field label="Status">
              <Select value={form.active ? "1" : "0"} options={[{ value: "1", label: "Active" }, { value: "0", label: "Inactive" }]} onChange={(e) => setForm((f) => f && { ...f, active: e.target.value === "1" })} />
            </Field>
            <Field label="GSTIN"><Input value={form.gstin} onChange={(e) => setForm((f) => f && { ...f, gstin: e.target.value })} /></Field>
            <Field label="Contact Name"><Input value={form.contactName} onChange={(e) => setForm((f) => f && { ...f, contactName: e.target.value })} /></Field>
            <Field label="Contact Email"><Input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => f && { ...f, contactEmail: e.target.value })} /></Field>
            <Field label="Phone" className="col-span-2"><Input value={form.contactPhone} onChange={(e) => setForm((f) => f && { ...f, contactPhone: e.target.value })} /></Field>
            <Field label="Bank Name"><Input value={form.bankName} onChange={(e) => setForm((f) => f && { ...f, bankName: e.target.value })} /></Field>
            <Field label="Account No."><Input value={form.bankAccountNo} onChange={(e) => setForm((f) => f && { ...f, bankAccountNo: e.target.value })} /></Field>
            <Field label="IFSC" className="col-span-2"><Input value={form.bankIfsc} onChange={(e) => setForm((f) => f && { ...f, bankIfsc: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <Modal
        open={poOpen}
        onClose={() => setPoOpen(false)}
        title={`New PO for ${vendor.name}`}
        wide
        footer={<><Button variant="secondary" onClick={() => setPoOpen(false)}>Cancel</Button><Button onClick={() => void onCreatePo()} loading={busy}>Create</Button></>}
      >
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Field label="PO No." required><Input value={poForm.poNo} onChange={(e) => setPoForm((f) => ({ ...f, poNo: e.target.value }))} /></Field>
          <Field label="Project" required>
            <Select value={poForm.projectId} placeholder="Select project…" options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} onChange={(e) => setPoForm((f) => ({ ...f, projectId: e.target.value }))} />
          </Field>
          <Field label="Delivery Date"><Input type="date" value={poForm.deliveryDate} onChange={(e) => setPoForm((f) => ({ ...f, deliveryDate: e.target.value }))} /></Field>
        </div>
        <ItemsTable items={poItems} setItems={setPoItems} fields={ITEM_FIELDS} />
      </Modal>
    </div>
  );
}
