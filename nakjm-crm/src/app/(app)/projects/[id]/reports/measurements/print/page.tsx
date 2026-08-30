"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PrintFooter, PrintHeader, PrintSheet, PrintToolbar } from "@/components/print-document";
import { EmptyState, Spinner } from "@/components/ui";
import { subscribeBoqsForProject } from "@/lib/db/boq";
import { subscribeMeasurementsForProject } from "@/lib/db/measurements";
import { getProject } from "@/lib/db/projects";
import type { Boq, Measurement, Project } from "@/lib/types";

export default function MeasurementReportPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [boqs, setBoqs] = useState<Boq[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  useEffect(() => { void getProject(id).then(setProject); }, [id]);
  useEffect(() => subscribeBoqsForProject(id, setBoqs), [id]);
  useEffect(() => subscribeMeasurementsForProject(id, setMeasurements), [id]);

  if (project === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (project === null) return <EmptyState title="Project not found" />;

  const boq = boqs.find((b) => b.status === "APPROVED") ?? boqs[0];
  const byItem = (srNo: number) => measurements.find((m) => m.boqId === boq?.id && m.itemSrNo === srNo);
  const totalPlanned = boq?.items.reduce((s, it) => s + it.qty, 0) ?? 0;
  const totalExecuted = boq?.items.reduce((s, it) => s + (byItem(it.srNo)?.executedQty ?? 0), 0) ?? 0;
  const overallPct = totalPlanned > 0 ? Math.round((totalExecuted / totalPlanned) * 100) : 0;

  return (
    <div>
      <PrintToolbar backHref={`/projects/${id}`} />
      <PrintSheet>
        <PrintHeader docLabel="Measurement / BOQ Progress Report" docNumber={project.code} meta={<p className="mt-0.5 text-[11px] text-ink-400">{overallPct}% executed</p>} />

        <div className="text-sm"><p className="text-xs text-ink-500">Project</p><p className="font-medium text-ink-900">{project.name}</p></div>

        {!boq ? (
          <p className="mt-6 text-sm text-ink-400">No BOQ on this project yet.</p>
        ) : (
          <div className="mt-6 overflow-x-auto scroll-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="pb-2">Description</th>
                  <th className="pb-2">Unit</th>
                  <th className="pb-2 text-right">BOQ Qty</th>
                  <th className="pb-2 text-right">Executed</th>
                  <th className="pb-2 text-right">Remaining</th>
                  <th className="pb-2 text-right">Progress</th>
                </tr>
              </thead>
              <tbody>
                {boq.items.map((item) => {
                  const executed = byItem(item.srNo)?.executedQty ?? 0;
                  const remaining = Math.max(0, item.qty - executed);
                  const pct = item.qty > 0 ? Math.round((executed / item.qty) * 100) : 0;
                  return (
                    <tr key={item.srNo} className="border-b border-ink-100">
                      <td className="py-2">{item.description}</td>
                      <td className="py-2 text-ink-500">{item.unit || "—"}</td>
                      <td className="py-2 text-right tabular-nums">{item.qty}</td>
                      <td className="py-2 text-right tabular-nums">{executed}</td>
                      <td className="py-2 text-right tabular-nums">{remaining}</td>
                      <td className="py-2 text-right tabular-nums">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <PrintFooter />
      </PrintSheet>
    </div>
  );
}
