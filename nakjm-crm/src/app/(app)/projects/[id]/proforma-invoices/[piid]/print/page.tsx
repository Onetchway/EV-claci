"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BankDetailsPrintBlock, PrintFooter, PrintHeader, PrintSheet, PrintToolbar, useDocumentTitle } from "@/components/print-document";
import { EmptyState, Spinner } from "@/components/ui";
import { getClient } from "@/lib/db/clients";
import { getProformaInvoice } from "@/lib/db/proforma-invoices";
import { defaultSettings, subscribeSettings, type AppSettings } from "@/lib/db/settings";
import type { Client, ProformaInvoice } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function ProformaInvoicePrintPage() {
  const { id, piid } = useParams<{ id: string; piid: string }>();
  const [pi, setPi] = useState<ProformaInvoice | null | undefined>(undefined);
  const [client, setClient] = useState<Client | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings());

  useEffect(() => {
    void getProformaInvoice(piid).then(async (row) => {
      setPi(row);
      if (row?.clientId) setClient(await getClient(row.clientId));
    });
  }, [piid]);
  useEffect(() => subscribeSettings(setSettings), []);
  useDocumentTitle(pi ? `NAKJM PI ${pi.piNo}` : undefined);

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
            {client?.address && <p className="whitespace-pre-line text-ink-600">{client.address}</p>}
            {client?.contactName && <p className="text-ink-600">{client.contactName}</p>}
            {client?.contactPhone && <p className="text-ink-600">{client.contactPhone}</p>}
            {client?.contactEmail && <p className="text-ink-600">{client.contactEmail}</p>}
            {client?.gstin && <p className="text-ink-600">GSTIN: {client.gstin}</p>}
            {pi.clientPoNumber && <p className="text-ink-600">Client PO: {pi.clientPoNumber}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-500">Project</p>
            <p className="text-ink-900">{pi.projectName}</p>
            {pi.milestone && (<><p className="mt-2 text-xs text-ink-500">Milestone</p><p className="text-ink-900">{pi.milestone}</p></>)}
            {pi.dueDate && (<><p className="mt-2 text-xs text-ink-500">Due date</p><p className="text-ink-900">{formatDate(pi.dueDate)}</p></>)}
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
              {pi.items.map((line) => (
                <tr key={line.srNo} className="border-b border-ink-100">
                  <td className="py-3 pr-3 align-top text-ink-500">{line.srNo}</td>
                  <td className="break-words py-3 pr-3 align-top">{line.description}</td>
                  <td className="py-3 px-3 align-top text-ink-500">{line.hsnCode || "—"}</td>
                  <td className="py-3 px-3 align-top text-ink-500">{line.unit || "—"}</td>
                  {/* No GST on this PI -- it's a lump sum (e.g. an advance), so Qty/Rate print blank like a Tally invoice's service line, with only Amount filled in. */}
                  <td className="whitespace-nowrap py-3 px-3 text-right align-top tabular-nums">{pi.taxAmount ? line.qty : "—"}</td>
                  <td className="whitespace-nowrap py-3 px-3 text-right align-top tabular-nums">{pi.taxAmount ? formatINR(line.rate) : "—"}</td>
                  <td className="whitespace-nowrap py-3 pl-3 text-right align-top tabular-nums">{formatINR(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <dl className="w-56 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd className="tabular-nums">{formatINR(pi.subtotal)}</dd></div>
            {pi.gstType === "CGST_SGST" ? (
              <>
                <div className="flex justify-between"><dt className="text-ink-600">CGST</dt><dd className="tabular-nums">{formatINR(pi.cgstAmount ?? 0)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-600">SGST</dt><dd className="tabular-nums">{formatINR(pi.sgstAmount ?? 0)}</dd></div>
              </>
            ) : (
              <div className="flex justify-between"><dt className="text-ink-600">IGST</dt><dd className="tabular-nums">{formatINR(pi.igstAmount ?? pi.taxAmount)}</dd></div>
            )}
            <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(pi.totalAmount)}</dd></div>
            <div className="flex justify-between text-ink-600"><dt>Paid</dt><dd className="tabular-nums">{formatINR(pi.paidAmount)}</dd></div>
          </dl>
        </div>

        <BankDetailsPrintBlock bank={settings.bank} />

        {pi.terms && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Terms</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{pi.terms}</p>
          </div>
        )}

        {pi.notes && (
          <div className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{pi.notes}</div>
        )}

        <PrintFooter />
      </PrintSheet>
    </div>
  );
}
