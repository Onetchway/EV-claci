"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PrintFooter, PrintHeader, PrintSheet, PrintToolbar } from "@/components/print-document";
import { EmptyState, Spinner } from "@/components/ui";
import { statusMeta, TENDER_STATUS_META } from "@/lib/constants";
import { getClient } from "@/lib/db/clients";
import { subscribeClientPayments } from "@/lib/db/payments";
import { listProjectsForClient } from "@/lib/db/projects";
import { subscribeTendersForClient } from "@/lib/db/tenders";
import type { Client, ClientPayment, Project, Tender } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR } from "@/lib/utils";

export default function ClientProjectReportPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null | undefined>(undefined);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [payments, setPayments] = useState<ClientPayment[]>([]);

  useEffect(() => { void getClient(id).then(setClient); }, [id]);
  useEffect(() => { void listProjectsForClient(id).then(setProjects); }, [id]);
  useEffect(() => subscribeTendersForClient(id, setTenders), [id]);
  useEffect(() => subscribeClientPayments({ clientId: id }, setPayments), [id]);

  if (client === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (client === null) return <EmptyState title="Client not found" />;

  const totalContractValue = projects.reduce((s, p) => s + p.contractValue, 0);
  const totalCollected = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <PrintToolbar backHref={`/clients/${id}`} />
      <PrintSheet>
        <PrintHeader
          docLabel="Client Project Report"
          docNumber={client.name}
          meta={<p className="mt-0.5 text-[11px] text-ink-400">As of {formatDate(new Date())}</p>}
        />

        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div><p className="text-xs text-ink-500">Projects</p><p className="text-lg font-semibold text-ink-900">{projects.length}</p></div>
          <div><p className="text-xs text-ink-500">Total Contract Value</p><p className="text-lg font-semibold text-ink-900">{formatCompactINR(totalContractValue)}</p></div>
          <div><p className="text-xs text-ink-500">Collected</p><p className="text-lg font-semibold text-emerald-700">{formatCompactINR(totalCollected)}</p></div>
          <div><p className="text-xs text-ink-500">Tenders</p><p className="text-lg font-semibold text-ink-900">{tenders.length}</p></div>
        </div>

        <div className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Projects</h2>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="pb-2">Code</th>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Contract Value</th>
                  <th className="pb-2">Start</th>
                  <th className="pb-2">Target End</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-ink-100">
                    <td className="py-2">{p.code}</td>
                    <td className="py-2">{p.name}</td>
                    <td className="py-2 text-ink-500">{statusMeta(p.status).label}</td>
                    <td className="py-2 text-right tabular-nums">{formatINR(p.contractValue)}</td>
                    <td className="py-2 text-ink-500">{p.startDate ? formatDate(p.startDate) : "—"}</td>
                    <td className="py-2 text-ink-500">{p.targetEndDate ? formatDate(p.targetEndDate) : "—"}</td>
                  </tr>
                ))}
                {projects.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-ink-400">No projects yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {tenders.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Tenders</h2>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-700">
              {tenders.map((t) => <li key={t.id}>{t.tenderCode} — {t.title} ({TENDER_STATUS_META[t.status].label})</li>)}
            </ul>
          </div>
        )}

        <PrintFooter />
      </PrintSheet>
    </div>
  );
}
