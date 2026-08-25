"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Truck } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select,
  Spinner, StatCard, Textarea, useAsyncAction, useToast,
} from "@/components/ui";
import {
  VENDOR_CATEGORIES, VENDOR_CATEGORY_LABEL, type VendorCategory,
} from "@/lib/constants";
import { createVendor, subscribeVendors } from "@/lib/db/vendors";
import { canManageVendors } from "@/lib/permissions";
import type { Actor, Vendor } from "@/lib/types";
import { formatCompactINR } from "@/lib/utils";

const blankForm = {
  name: "", category: "CHARGER_OEM" as VendorCategory, contactName: "", phone: "",
  email: "", address: "", gstin: "", paymentTerms: "", notes: "",
  accountName: "", bankName: "", accountNumber: "", ifsc: "", branch: "",
};

export default function VendorsPage() {
  const viewer = useViewer();
  const { actor } = useAuth();
  const { push } = useToast();
  const [rows, setRows] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<VendorCategory | "ALL">("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeVendors((r) => { setRows(r); setLoading(false); }, () => setLoading(false)), []);

  const filtered = useMemo(
    () => (category === "ALL" ? rows : rows.filter((v) => v.category === category)),
    [rows, category],
  );

  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter((v) => v.status === "ACTIVE").length,
    ordered: rows.reduce((a, v) => a + (v.totalOrdered ?? 0), 0),
    outstanding: rows.reduce((a, v) => a + (v.totalOrdered ?? 0) - (v.totalPaid ?? 0), 0),
  }), [rows]);

  async function create() {
    if (!actor || !form.name.trim() || !form.phone.trim()) {
      throw new Error("Name and phone are required.");
    }
    const { code } = await createVendor(form, actor as Actor);
    push(`Vendor ${code} added.`, "success");
    setCreateOpen(false);
    setForm(blankForm);
  }

  return (
    <>
      <PageHeader
        title="Vendors"
        description="Charger OEMs, EPC contractors, civil/electrical/transport vendors Livanto pays to build a station."
        actions={
          canManageVendors(viewer) && (
            <>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as VendorCategory | "ALL")}
                className="w-auto"
                options={[{ value: "ALL", label: "All categories" }, ...VENDOR_CATEGORIES.map((c) => ({ value: c, label: VENDOR_CATEGORY_LABEL[c] }))]}
              />
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Add vendor
              </Button>
            </>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Vendors" value={stats.total} icon={<Truck className="h-4 w-4" />} />
        <StatCard label="Active" value={stats.active} tone="positive" />
        <StatCard label="Total ordered" value={formatCompactINR(stats.ordered)} />
        <StatCard label="Outstanding" value={formatCompactINR(stats.outstanding)} tone={stats.outstanding ? "warn" : "default"} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Truck className="h-8 w-8" />}
          title="No vendors yet"
          description="Add the charger OEMs and contractors Livanto pays to build a station, then raise purchase orders against them."
          action={canManageVendors(viewer) ? <Button variant="primary" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add vendor</Button> : undefined}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => (
            <Link
              key={v.id}
              href={`/vendors/${v.id}`}
              className="card card-pad block transition hover:border-brand-400 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{v.name}</p>
                  <p className="truncate text-xs text-ink-500">{v.code} · {VENDOR_CATEGORY_LABEL[v.category]}</p>
                </div>
                <Badge className={v.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
                  {v.status}
                </Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-ink-100 pt-2.5 text-xs">
                <div>
                  <dt className="text-ink-500">Ordered</dt>
                  <dd className="font-semibold">{formatCompactINR(v.totalOrdered)}</dd>
                </div>
                <div>
                  <dt className="text-ink-500">Outstanding</dt>
                  <dd className="font-semibold">{formatCompactINR((v.totalOrdered ?? 0) - (v.totalPaid ?? 0))}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add a vendor"
        footer={
          <>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void run(create, "Vendor added.")}>
              Add vendor
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Category">
            <Select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as VendorCategory }))}
              options={VENDOR_CATEGORIES.map((c) => ({ value: c, label: VENDOR_CATEGORY_LABEL[c] }))}
            />
          </Field>
          <Field label="Contact person">
            <Input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
          </Field>
          <Field label="Phone" required>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="GSTIN">
            <Input value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))} />
          </Field>
          <Field label="Payment terms" hint="e.g. Net 30, 50% advance">
            <Input value={form.paymentTerms} onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Textarea rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </Field>

          <div className="sm:col-span-2">
            <p className="label mb-2">Bank details <span className="font-normal normal-case text-ink-400">— printed on purchase orders for payment</span></p>
          </div>
          <Field label="Account holder name">
            <Input value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} />
          </Field>
          <Field label="Bank name">
            <Input value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} />
          </Field>
          <Field label="Account number">
            <Input value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} />
          </Field>
          <Field label="IFSC code">
            <Input value={form.ifsc} onChange={(e) => setForm((f) => ({ ...f, ifsc: e.target.value.toUpperCase() }))} />
          </Field>
          <Field label="Branch" className="sm:col-span-2">
            <Input value={form.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))} />
          </Field>

          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
