"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, Plus, Search } from "lucide-react";

import { useActor } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, useAsyncAction,
} from "@/components/ui";
import { ExportButton } from "@/components/export-button";
import { CLIENT_TYPES, type ClientType } from "@/lib/constants";
import { createClient, subscribeClients } from "@/lib/db/clients";
import type { Client } from "@/lib/types";

const EMPTY = { name: "", clientType: "PRIVATE" as ClientType, contactName: "", contactEmail: "", contactPhone: "", city: "", state: "", gstin: "" };

export default function ClientsPage() {
  const actor = useActor();
  const [rows, setRows] = useState<Client[] | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeClients({}, setRows), []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((c) => [c.name, c.contactName, c.city].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [rows, search]);

  async function onCreate() {
    if (!form.name.trim()) return;
    await run(async () => {
      await createClient(form, actor);
      setShowForm(false);
      setForm(EMPTY);
    }, "Client added.");
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Who NAKJM builds for — OEMs, CPOs, private and government clients."
        actions={
          <>
            <ExportButton
              filename="clients"
              sheetName="Clients"
              rows={filtered.map((c) => ({
                Name: c.name, Type: c.clientType, Contact: c.contactName ?? "", Email: c.contactEmail ?? "",
                Phone: c.contactPhone ?? "", City: c.city ?? "", State: c.state ?? "", GSTIN: c.gstin ?? "",
                Status: c.active ? "Active" : "Inactive",
              }))}
            />
            <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Add Client</Button>
          </>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <Input placeholder="Search clients…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Building2 className="h-8 w-8" />} title="No clients yet" description="Add your first client to start a project against them." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="card card-pad block transition hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-ink-900">{c.name}</p>
                    <p className="text-xs uppercase text-ink-500">{c.clientType}</p>
                  </div>
                </div>
                <Badge className={c.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
                  {c.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              {(c.city || c.contactName) && (
                <p className="mt-3 text-xs text-ink-500">{[c.contactName, c.city].filter(Boolean).join(" · ")}</p>
              )}
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New Client"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => void onCreate()} loading={busy}>Create Client</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client / Company Name" required className="col-span-2">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Client Type">
            <Select
              value={form.clientType}
              options={CLIENT_TYPES.map((t) => ({ value: t, label: t }))}
              onChange={(e) => setForm((f) => ({ ...f, clientType: e.target.value as ClientType }))}
            />
          </Field>
          <Field label="GSTIN"><Input value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))} /></Field>
          <Field label="Contact Name"><Input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} /></Field>
          <Field label="Contact Email"><Input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} /></Field>
          <Field label="Phone"><Input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} /></Field>
          <Field label="City"><Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></Field>
          <Field label="State" className="col-span-2"><Input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}
