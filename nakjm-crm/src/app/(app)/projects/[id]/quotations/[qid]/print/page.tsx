"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PrintFooter, PrintHeader, PrintSheet, PrintToolbar } from "@/components/print-document";
import { EmptyState, Spinner } from "@/components/ui";
import { getClient } from "@/lib/db/clients";
import { getQuotation } from "@/lib/db/quotations";
import type { Client, Quotation } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function QuotationPrintPage() {
  const { id, qid } = useParams<{ id: string; qid: string }>();
  const [q, setQ] = useState<Quotation | null | undefined>(undefined);
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    void getQuotation(qid).then(async (row) => {
      setQ(row);
      if (row?.clientId) setClient(await getClient(row.clientId));
    });
  }, [qid]);

  if (q === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (q === null) return <EmptyState title="Quotation not found" />;

  return (
    <div>
      <PrintToolbar backHref={`/projects/${id}`} />

      <PrintSheet>
        <PrintHeader
          docLabel="Quotation"
          docNumber={q.quotationNo}
          meta={<p className="mt-0.5 text-[11px] text-ink-400">Version {q.version} &middot; {formatDate(q.quotationDate)}</p>}
        />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-500">Quoted to</p>
            <p className="font-medium text-ink-900">{client?.name ?? "—"}</p>
            {client?.address && <p className="whitespace-pre-line text-ink-600">{client.address}</p>}
            {client?.contactName && <p className="text-ink-600">{client.contactName}</p>}
            {client?.contactPhone && <p className="text-ink-600">{client.contactPhone}</p>}
            {client?.contactEmail && <p className="text-ink-600">{client.contactEmail}</p>}
            {client?.gstin && <p className="text-ink-600">GSTIN: {client.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-500">Project</p>
            <p className="text-ink-900">{q.projectName}</p>
            {q.validUntil && (<><p className="mt-2 text-xs text-ink-500">Valid until</p><p className="text-ink-900">{formatDate(q.validUntil)}</p></>)}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto scroll-thin">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[4%]" />
              <col className="w-[38%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 px-3">HSN/SAC</th>
                <th className="py-2 px-3">Unit</th>
                <th className="whitespace-nowrap py-2 px-3 text-right">Qty</th>
                <th className="whitespace-nowrap py-2 px-3 text-right">Rate</th>
                <th className="whitespace-nowrap py-2 pl-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {q.items.map((line) => (
                <tr key={line.srNo} className="border-b border-ink-100">
                  <td className="py-3 pr-3 align-top text-ink-500">{line.srNo}</td>
                  <td className="break-words py-3 pr-3 align-top">{line.description}</td>
                  <td className="py-3 px-3 align-top text-ink-500">{line.hsnCode || "—"}</td>
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
            <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd className="tabular-nums">{formatINR(q.subtotal)}</dd></div>
            {q.gstType === "CGST_SGST" ? (
              <>
                <div className="flex justify-between"><dt className="text-ink-600">CGST</dt><dd className="tabular-nums">{formatINR(q.cgstAmount ?? 0)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-600">SGST</dt><dd className="tabular-nums">{formatINR(q.sgstAmount ?? 0)}</dd></div>
              </>
            ) : (
              <div className="flex justify-between"><dt className="text-ink-600">IGST ({q.taxPercent}%)</dt><dd className="tabular-nums">{formatINR(q.igstAmount ?? q.taxAmount)}</dd></div>
            )}
            <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(q.totalAmount)}</dd></div>
          </dl>
        </div>

        {q.terms && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Terms</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{q.terms}</p>
          </div>
        )}

        {q.notes && (
          <div className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{q.notes}</div>
        )}

        {q.approval && (
          <div className="mt-8 border-t border-ink-200 pt-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Approved</p>
            <p className="mt-1 text-ink-900">{q.approval.signatureName}</p>
            <p className="text-xs text-ink-500">{formatDate(q.approval.approvedAt)}</p>
          </div>
        )}

        <PrintFooter />
      </PrintSheet>
    </div>
  );
}
