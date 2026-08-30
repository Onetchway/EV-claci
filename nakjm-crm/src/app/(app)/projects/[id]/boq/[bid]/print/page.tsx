"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PrintFooter, PrintHeader, PrintSheet, PrintToolbar } from "@/components/print-document";
import { EmptyState, Spinner } from "@/components/ui";
import { getBoq } from "@/lib/db/boq";
import type { Boq } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function BoqPrintPage() {
  const { id, bid } = useParams<{ id: string; bid: string }>();
  const [boq, setBoq] = useState<Boq | null | undefined>(undefined);

  useEffect(() => {
    void getBoq(bid).then(setBoq);
  }, [bid]);

  if (boq === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (boq === null) return <EmptyState title="BOQ not found" />;

  return (
    <div>
      <PrintToolbar backHref={`/projects/${id}`} />

      <PrintSheet>
        <PrintHeader
          docLabel="Bill of Quantities"
          docNumber={boq.boqNo}
          meta={<p className="mt-0.5 text-[11px] text-ink-400">Version {boq.version} &middot; {formatDate(boq.boqDate)}</p>}
        />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-500">Project</p>
            <p className="font-medium text-ink-900">{boq.projectName}</p>
          </div>
          {boq.siteName && (
            <div className="text-right">
              <p className="text-xs text-ink-500">Site</p>
              <p className="text-ink-900">{boq.siteName}</p>
            </div>
          )}
        </div>

        <div className="mt-6 overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="pb-2">#</th>
                <th className="pb-2">Description</th>
                <th className="pb-2">Category</th>
                <th className="pb-2">Make/OEM</th>
                <th className="pb-2">Unit</th>
                <th className="pb-2 text-right">Qty</th>
                <th className="pb-2 text-right">Rate</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {boq.items.map((line) => (
                <tr key={line.srNo} className="border-b border-ink-100">
                  <td className="py-2 text-ink-500">{line.srNo}</td>
                  <td className="py-2">
                    {line.section && <span className="mr-1 text-[10px] font-semibold uppercase text-ink-400">{line.section}</span>}
                    {line.description}
                    {line.remarks && <p className="text-[11px] text-ink-400">{line.remarks}</p>}
                  </td>
                  <td className="py-2 text-ink-500">{line.category}</td>
                  <td className="py-2 text-ink-500">{line.makeOem || "—"}</td>
                  <td className="py-2 text-ink-500">{line.unit || "—"}</td>
                  <td className="py-2 text-right tabular-nums">{line.qty}</td>
                  <td className="py-2 text-right tabular-nums">{formatINR(line.rate)}</td>
                  <td className="py-2 text-right tabular-nums">{formatINR(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <dl className="w-56 space-y-1.5 text-sm">
            <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(boq.totalAmount)}</dd></div>
          </dl>
        </div>

        {boq.notes && (
          <div className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{boq.notes}</div>
        )}

        <PrintFooter />
      </PrintSheet>
    </div>
  );
}
