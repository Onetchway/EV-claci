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
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 px-3">Category</th>
                <th className="py-2 px-3">Make/OEM</th>
                <th className="py-2 px-3">Unit</th>
                <th className="whitespace-nowrap py-2 px-3 text-right">Qty</th>
                <th className="whitespace-nowrap py-2 px-3 text-right">Rate</th>
                <th className="whitespace-nowrap py-2 pl-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {boq.items.map((line) => (
                <tr key={line.srNo} className="border-b border-ink-100">
                  <td className="py-3 pr-3 align-top text-ink-500">{line.srNo}</td>
                  <td className="py-3 pr-3 align-top">
                    {line.section && <span className="mr-1 text-[10px] font-semibold uppercase text-ink-400">{line.section}</span>}
                    {line.description}
                    {line.remarks && <p className="mt-0.5 text-[11px] text-ink-400">{line.remarks}</p>}
                  </td>
                  <td className="py-3 px-3 align-top text-ink-500">{line.category}</td>
                  <td className="py-3 px-3 align-top text-ink-500">{line.makeOem || "—"}</td>
                  <td className="py-3 px-3 align-top text-ink-500">{line.unit || "—"}</td>
                  <td className="whitespace-nowrap py-3 px-3 text-right align-top tabular-nums">{line.qty}</td>
                  <td className="whitespace-nowrap py-3 px-3 text-right align-top tabular-nums">{formatINR(line.rate)}</td>
                  <td className="whitespace-nowrap py-3 pl-3 text-right align-top tabular-nums">{formatINR(line.amount)}</td>
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

        {boq.approval && (
          <div className="mt-8 border-t border-ink-200 pt-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Approved</p>
            <p className="mt-1 text-ink-900">{boq.approval.signatureName}</p>
            <p className="text-xs text-ink-500">{formatDate(boq.approval.approvedAt)}</p>
          </div>
        )}

        <PrintFooter />
      </PrintSheet>
    </div>
  );
}
