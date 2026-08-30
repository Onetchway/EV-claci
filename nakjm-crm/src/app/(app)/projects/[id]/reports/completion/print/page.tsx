"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PrintFooter, PrintHeader, PrintSheet, PrintToolbar } from "@/components/print-document";
import { EmptyState, Spinner } from "@/components/ui";
import { HANDOVER_STAGE_LABEL } from "@/lib/constants";
import { subscribeHandover, subscribePunchItemsForProject } from "@/lib/db/handover";
import { subscribeClientPayments, subscribeVendorPayments } from "@/lib/db/payments";
import { getProject } from "@/lib/db/projects";
import { subscribeStagesForProject } from "@/lib/db/stages";
import type { ClientPayment, Handover, Project, ProjectStage, PunchItem, VendorPayment } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function ProjectCompletionReportPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [handover, setHandover] = useState<Handover | null>(null);
  const [punchItems, setPunchItems] = useState<PunchItem[]>([]);
  const [clientPayments, setClientPayments] = useState<ClientPayment[]>([]);
  const [vendorPayments, setVendorPayments] = useState<VendorPayment[]>([]);

  useEffect(() => { void getProject(id).then(setProject); }, [id]);
  useEffect(() => subscribeStagesForProject(id, setStages), [id]);
  useEffect(() => subscribeHandover(id, setHandover), [id]);
  useEffect(() => subscribePunchItemsForProject(id, setPunchItems), [id]);
  useEffect(() => subscribeClientPayments({ projectId: id }, setClientPayments), [id]);
  useEffect(() => subscribeVendorPayments({ projectId: id }, setVendorPayments), [id]);

  if (project === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (project === null) return <EmptyState title="Project not found" />;

  const overall = stages.length ? Math.round(stages.reduce((s, st) => s + st.progressPct, 0) / stages.length) : 0;
  const collected = clientPayments.reduce((s, p) => s + p.amount, 0);
  const paidToVendors = vendorPayments.reduce((s, p) => s + p.amount, 0);
  const acceptedPunch = punchItems.filter((p) => p.status === "ACCEPTED").length;

  return (
    <div>
      <PrintToolbar backHref={`/projects/${id}`} />
      <PrintSheet>
        <PrintHeader
          docLabel="Project Completion Report"
          docNumber={project.code}
          meta={<p className="mt-0.5 text-[11px] text-ink-400">{overall}% complete</p>}
        />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-ink-500">Project</p><p className="font-medium text-ink-900">{project.name}</p></div>
          <div className="text-right"><p className="text-xs text-ink-500">Client</p><p className="font-medium text-ink-900">{project.clientName}</p></div>
          <div><p className="text-xs text-ink-500">Start Date</p><p className="text-ink-900">{project.startDate ? formatDate(project.startDate) : "—"}</p></div>
          <div className="text-right"><p className="text-xs text-ink-500">Actual Completion</p><p className="text-ink-900">{project.actualEndDate ? formatDate(project.actualEndDate) : handover?.handoverDate ? formatDate(handover.handoverDate) : "—"}</p></div>
        </div>

        <div className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Financial Summary</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-ink-500">Contract Value</dt><dd className="font-medium text-ink-900">{formatINR(project.contractValue)}</dd></div>
            <div><dt className="text-ink-500">Collected from Client</dt><dd className="font-medium text-emerald-700">{formatINR(collected)}</dd></div>
            <div><dt className="text-ink-500">Budget</dt><dd className="font-medium text-ink-900">{formatINR(project.budgetAmount)}</dd></div>
            <div><dt className="text-ink-500">Paid to Vendors</dt><dd className="font-medium text-ink-900">{formatINR(paidToVendors)}</dd></div>
          </dl>
        </div>

        <div className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Handover Status</h2>
          <p className="text-sm text-ink-800">Current stage: <span className="font-medium">{handover ? HANDOVER_STAGE_LABEL[handover.stage] : "Not started"}</span></p>
          {handover && handover.history.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink-700">
              {handover.history.map((h, i) => (
                <li key={i}>{HANDOVER_STAGE_LABEL[h.stage]} — {formatDate(h.at)}{h.byName ? ` (${h.byName})` : ""}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Punch List</h2>
          <p className="text-sm text-ink-800">{acceptedPunch} of {punchItems.length} items accepted by client.</p>
          {punchItems.length > acceptedPunch && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-amber-700">
              {punchItems.filter((p) => p.status !== "ACCEPTED").map((p) => <li key={p.id}>{p.description} — {p.status.replace(/_/g, " ")}</li>)}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Stage Summary</h2>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-700">
            {stages.map((s) => <li key={s.id}>{s.name} — {s.status.replace(/_/g, " ")} ({s.progressPct}%)</li>)}
          </ul>
        </div>

        <PrintFooter />
      </PrintSheet>
    </div>
  );
}
