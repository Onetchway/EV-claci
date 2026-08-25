"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge, StatCard } from "@/components/ui";
import { subscribeClient } from "@/lib/db/clients";
import { listProjectsForClient } from "@/lib/db/projects";
import { subscribeClientPayments } from "@/lib/db/payments";
import { statusMeta } from "@/lib/constants";
import type { Client, ClientPayment, Project } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR } from "@/lib/utils";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [payments, setPayments] = useState<ClientPayment[] | null>(null);

  useEffect(() => subscribeClient(id, setClient), [id]);
  useEffect(() => { void listProjectsForClient(id).then(setProjects); }, [id]);
  useEffect(() => subscribeClientPayments({ clientId: id }, setPayments), [id]);

  if (!client) return <p className="text-sm text-ink-400">Loading…</p>;

  const totalCollected = (payments ?? []).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-5">
      <div className="card card-pad">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">{client.name}</h1>
            <p className="text-sm uppercase text-ink-500">{client.clientType} · {[client.city, client.state].filter(Boolean).join(", ")}</p>
          </div>
          <Badge className={client.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
            {client.active ? "Active" : "Inactive"}
          </Badge>
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
    </div>
  );
}
