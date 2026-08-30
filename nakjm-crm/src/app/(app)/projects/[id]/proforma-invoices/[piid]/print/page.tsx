"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PrintFooter, PrintHeader, PrintSheet, PrintToolbar } from "@/components/print-document";
import { EmptyState, Spinner } from "@/components/ui";
import { getClient } from "@/lib/db/clients";
import { getProformaInvoice } from "@/lib/db/proforma-invoices";
import type { Client, ProformaInvoice } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function ProformaInvoicePrintPage() {
  const { id, piid } = useParams<{ id: string; piid: string }>();
  const [pi, setPi] = useState<ProformaInvoice | null | undefined>(undefined);
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    void getProformaInvoice(piid).then(async (row) => {
      setPi(row);
      if (row?.clientId) setClient(await getClient(row.clientId));
    });
  }, [piid]);

  if (pi === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (pi === null) return <EmptyState title="Proforma invoice not found" />;

  return (
    <div>
      <PrintToolbar backHref={`/projects/${id}`} />

      <PrintSheet>
        <PrintHeader
          docLabel="Proforma Invoice"
          docNumber={pi.piNo}
          meta={<p className="mt-0.5 text-[11px] text-ink-400">{formatDate(pi.piDate)}</p>}
        />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-500">Billed to</p>
            <p className="font-medium text-ink-900">{client?.name ?? "—"}</p>
            {client?.contactName && <p className="text-ink-600">{client.contactName}</p>}
            {client?.contactPhone && <p className="text-ink-600">{client.contactPhone}</p>}
            {client?.gstin && <p className="text-ink-600">GSTIN: {client.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-500">Project</p>
            <p className="text-ink-900">{pi.projectName}</p>
            {pi.milestone && (<><p className="mt-2 text-xs text-ink-500">Milestone</p><p className="text-ink-900">{pi.milestone}</p></>)}
            {pi.dueDate && (<><p className="mt-2 text-xs text-ink-500">Due date</p><p className="text-ink-900">{formatDate(pi.dueDate)}</p></>)}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="pb-2">#</th>
                <th className="pb-2">Description</th>
                <th className="pb-2">Unit</th>
                <th className="pb-2 text-right">Qty</th>
                <th className="pb-2 text-right">Rate</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {pi.items.map((line) => (
                <tr key={line.srNo} className="border-b border-ink-100">
                  <td className="py-2 text-ink-500">{line.srNo}</td>
                  <td className="py-2">{line.description}</td>
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
            <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd className="tabular-nums">{formatINR(pi.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-600">Tax</dt><dd className="tabular-nums">{formatINR(pi.taxAmount)}</dd></div>
            <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(pi.totalAmount)}</dd></div>
            <div className="flex justify-between text-ink-600"><dt>Paid</dt><dd className="tabular-nums">{formatINR(pi.paidAmount)}</dd></div>
          </dl>
        </div>

        {pi.notes && (
          <div className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{pi.notes}</div>
        )}

        <PrintFooter />
      </PrintSheet>
    </div>
  );
}
