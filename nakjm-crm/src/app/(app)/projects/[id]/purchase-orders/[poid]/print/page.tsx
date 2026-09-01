"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BankDetailsPrintBlock, PrintFooter, PrintHeader, PrintSheet, PrintToolbar, useDocumentTitle } from "@/components/print-document";
import { EmptyState, Spinner } from "@/components/ui";
import { getPurchaseOrder } from "@/lib/db/purchase-orders";
import { getVendor } from "@/lib/db/vendors";
import type { PurchaseOrder, Vendor } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function PurchaseOrderPrintPage() {
  const { id, poid } = useParams<{ id: string; poid: string }>();
  const [po, setPo] = useState<PurchaseOrder | null | undefined>(undefined);
  const [vendor, setVendor] = useState<Vendor | null>(null);

  useEffect(() => {
    void getPurchaseOrder(poid).then(async (row) => {
      setPo(row);
      if (row?.vendorId) setVendor(await getVendor(row.vendorId));
    });
  }, [poid]);
  useDocumentTitle(po ? `NAKJM PO ${po.poNo}` : undefined);

  if (po === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (po === null) return <EmptyState title="Purchase order not found" />;

  return (
    <div>
      <PrintToolbar backHref={`/projects/${id}`} />

      <PrintSheet>
        <PrintHeader
          docLabel="Purchase Order"
          docNumber={po.poNo}
          meta={<p className="mt-0.5 text-[11px] text-ink-400">{formatDate(po.poDate)}</p>}
        />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-500">Vendor</p>
            <p className="font-medium text-ink-900">{vendor?.name ?? "—"}</p>
            {vendor?.address && <p className="whitespace-pre-line text-ink-600">{vendor.address}</p>}
            {vendor?.contactName && <p className="text-ink-600">{vendor.contactName}</p>}
            {vendor?.contactPhone && <p className="text-ink-600">{vendor.contactPhone}</p>}
            {vendor?.contactEmail && <p className="text-ink-600">{vendor.contactEmail}</p>}
            {vendor?.gstin && <p className="text-ink-600">GSTIN: {vendor.gstin}</p>}
          </div>
          <div className="text-right">
            {po.deliveryDate && (<><p className="text-xs text-ink-500">Delivery by</p><p className="text-ink-900">{formatDate(po.deliveryDate)}</p></>)}
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
              {po.items.map((line) => (
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
            <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd className="tabular-nums">{formatINR(po.subtotal)}</dd></div>
            {po.gstType === "CGST_SGST" ? (
              <>
                <div className="flex justify-between"><dt className="text-ink-600">CGST</dt><dd className="tabular-nums">{formatINR(po.cgstAmount ?? 0)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-600">SGST</dt><dd className="tabular-nums">{formatINR(po.sgstAmount ?? 0)}</dd></div>
              </>
            ) : (
              <div className="flex justify-between"><dt className="text-ink-600">IGST</dt><dd className="tabular-nums">{formatINR(po.igstAmount ?? po.taxAmount)}</dd></div>
            )}
            <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(po.totalAmount)}</dd></div>
          </dl>
        </div>

        <BankDetailsPrintBlock
          bank={vendor?.bankAccountNo ? { accountName: vendor.name, accountNo: vendor.bankAccountNo, ifsc: vendor.bankIfsc ?? "", bankName: vendor.bankName ?? "", branch: "" } : null}
        />

        {po.terms && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Terms</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{po.terms}</p>
          </div>
        )}

        {po.notes && (
          <div className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{po.notes}</div>
        )}

        {po.approval && (
          <div className="mt-8 border-t border-ink-200 pt-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Approved</p>
            <p className="mt-1 text-ink-900">{po.approval.signatureName}</p>
            <p className="text-xs text-ink-500">{formatDate(po.approval.approvedAt)}</p>
          </div>
        )}

        <PrintFooter />
      </PrintSheet>
    </div>
  );
}
