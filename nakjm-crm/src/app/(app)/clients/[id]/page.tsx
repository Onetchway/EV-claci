"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";

import { Badge, Button, Field, Input, Modal, Select, StatCard, useAsyncAction } from "@/components/ui";
import { updateClient, subscribeClient } from "@/lib/db/clients";
import { listProjectsForClient } from "@/lib/db/projects";
import { subscribeClientPayments } from "@/lib/db/payments";
import { CLIENT_TYPES, statusMeta, type ClientType } from "@/lib/constants";
import type { Client, ClientPayment, Project } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR } from "@/lib/utils";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [payments, setPayments] = useState<ClientPayment[] | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<{
    name: string; clientType: ClientType; contactName: string; contactEmail: string;
    contactPhone: string; city: string; state: string; gstin: string; active: boolean;
  } | null>(null);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeClient(id, setClient), [id]);
  useEffect(() => { void listProjectsForClient(id).then(setProjects); }, [id]);
  useEffect(() => subscribeClientPayments({ clientId: id }, setPayments), [id]);

  if (!client) return <p className="text-sm text-ink-400">Loading…</p>;

  const totalCollected = (payments ?? []).reduce((s, p) => s + p.amount, 0);

  function openEdit() {
    setForm({
      name: client!.name, clientType: client!.clientType, contactName: client!.contactName ?? "",
      contactEmail: client!.contactEmail ?? "", contactPhone: client!.contactPhone ?? "",
      city: client!.city ?? "", state: client!.state ?? "", gstin: client!.gstin ?? "", active: client!.active,
    });
    setEditOpen(true);
  }

  async function onSave() {
    if (!form || !form.name.trim()) return;
    await run(async () => {
      await updateClient(id, form);
      setEditOpen(false);
    }, "Client updated.");
  }

  return (
    <div className="space-y-5">
      <div className="card card-pad">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">{client.name}</h1>
            <p className="text-sm uppercase text-ink-500">{client.clientType} · {[client.city, client.state].filter(Boolean).join(", ")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={client.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
              {client.active ? "Active" : "Inactive"}
            </Badge>
            <Button size="sm" onClick={openEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-ink-100 pt-5 text-sm md:grid-cols-4">
          <div><p className="text-ink-400">Contact</p><p className="font-medium">{client.contactName || "—"}</p></div>
          <div><p className="text-ink-400">Email</p><p className="font-medium">{client.contactEmail || "—"}</p></div>
          <div><p className="text-ink-400">Phone</p><p className="font-medium">{client.contactPhone || "—"}</p></div>
          <div><p className="text-ink-400">GSTIN</p><p className="font-medium">{client.gstin || "—"}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard label="Total Collected" value={formatCompactINR(totalCollected)} tone="positive" />
        <StatCard label="Total Projects" value={projects.length} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
        <table className="w-full">
          <thead><tr><th className="th">Code</th><th className="th">Name</th><th className="th">Status</th><th className="th">Contract Value</th><th className="th">Start</th><th className="th">Target End</th></tr></thead>
          <tbody>
            {projects.length === 0 ? (
              <tr><td colSpan={6} className="td text-center text-ink-400">No projects yet.</td></tr>
            ) : projects.map((p) => (
              <tr key={p.id} className="border-t border-ink-100">
                <td className="td"><Link href={`/projects/${p.id}`} className="font-medium text-brand-700">{p.code}</Link></td>
                <td className="td">{p.name}</td>
                <td className="td"><Badge className={statusMeta(p.status).className}>{statusMeta(p.status).label}</Badge></td>
                <td className="td">{formatINR(p.contractValue)}</td>
                <td className="td">{formatDate(p.startDate)}</td>
                <td className="td">{formatDate(p.targetEndDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Client"
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={() => void onSave()} loading={busy}>Save</Button></>}
      >
        {form && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client / Company Name" required className="col-span-2">
              <Input value={form.name} onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })} />
            </Field>
            <Field label="Client Type">
              <Select value={form.clientType} options={CLIENT_TYPES.map((t) => ({ value: t, label: t }))} onChange={(e) => setForm((f) => f && { ...f, clientType: e.target.value as ClientType })} />
            </Field>
            <Field label="Status">
              <Select value={form.active ? "1" : "0"} options={[{ value: "1", label: "Active" }, { value: "0", label: "Inactive" }]} onChange={(e) => setForm((f) => f && { ...f, active: e.target.value === "1" })} />
            </Field>
            <Field label="GSTIN"><Input value={form.gstin} onChange={(e) => setForm((f) => f && { ...f, gstin: e.target.value })} /></Field>
            <Field label="Contact Name"><Input value={form.contactName} onChange={(e) => setForm((f) => f && { ...f, contactName: e.target.value })} /></Field>
            <Field label="Contact Email"><Input type="email" value={form.contactEmail} onChange={(e) => setForm((f) => f && { ...f, contactEmail: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.contactPhone} onChange={(e) => setForm((f) => f && { ...f, contactPhone: e.target.value })} /></Field>
            <Field label="City"><Input value={form.city} onChange={(e) => setForm((f) => f && { ...f, city: e.target.value })} /></Field>
            <Field label="State" className="col-span-2"><Input value={form.state} onChange={(e) => setForm((f) => f && { ...f, state: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
