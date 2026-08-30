"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Star, Truck } from "lucide-react";

import { useActor } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, Textarea, useAsyncAction,
} from "@/components/ui";
import { VENDOR_CATEGORIES, type VendorCategory } from "@/lib/constants";
import { createVendor, subscribeVendors } from "@/lib/db/vendors";
import type { Vendor } from "@/lib/types";

const EMPTY = {
  name: "", category: "OTHER" as VendorCategory, contactName: "", contactEmail: "", contactPhone: "",
  gstin: "", paymentTerms: "", address: "", bankAccountNo: "", bankIfsc: "", bankName: "",
};

export default function VendorsPage() {
  const actor = useActor();
  const [rows, setRows] = useState<Vendor[] | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeVendors({}, setRows), []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((v) => v.name.toLowerCase().includes(needle));
  }, [rows, search]);

  async function onCreate() {
    if (!form.name.trim()) return;
    await run(async () => {
      await createVendor(form, actor);
      setShowForm(false);
      setForm(EMPTY);
    }, "Vendor added.");
  }

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Contractors and suppliers NAKJM pays to execute a project."
        actions={<Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Add Vendor</Button>}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <Input placeholder="Search vendors…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Truck className="h-8 w-8" />} title="No vendors yet" description="Add a vendor to start issuing purchase orders." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((v) => (
            <Link key={v.id} href={`/vendors/${v.id}`} className="card card-pad block transition hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Truck className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-ink-900">{v.name}</p>
                    <p className="text-xs capitalize text-ink-500">{v.category.replace(/_/g, " ").toLowerCase()}</p>
                  </div>
                </div>
                <Badge className={v.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
                  {v.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              {v.rating ? (
                <p className="mt-3 flex items-center gap-1 text-xs text-ink-500"><Star className="h-3.5 w-3.5" /> {v.rating}</p>
              ) : null}
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New Vendor"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => void onCreate()} loading={busy}>Create Vendor</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendor Name" required className="col-span-2">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Category">
            <Select
              value={form.category}
              options={VENDOR_CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, " ") }))}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as VendorCategory }))}
            />
          </Field>
          <Field label="GSTIN"><Input value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))} /></Field>
          <Field label="Contact Name"><Input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} /></Field>
          <Field label="Contact Email"><Input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} /></Field>
          <Field label="Phone"><Input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} /></Field>
          <Field label="Payment Terms"><Input value={form.paymentTerms} placeholder="e.g. Net 30, 50% advance" onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))} /></Field>
          <Field label="Address" className="col-span-2"><Textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></Field>
          <Field label="Bank Account No."><Input value={form.bankAccountNo} onChange={(e) => setForm((f) => ({ ...f, bankAccountNo: e.target.value }))} /></Field>
          <Field label="IFSC"><Input value={form.bankIfsc} onChange={(e) => setForm((f) => ({ ...f, bankIfsc: e.target.value }))} /></Field>
          <Field label="Bank Name" className="col-span-2"><Input value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}
