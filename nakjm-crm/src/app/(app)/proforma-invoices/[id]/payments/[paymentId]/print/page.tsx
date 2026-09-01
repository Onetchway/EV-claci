"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PrintFooter, PrintHeader, PrintSheet, PrintToolbar } from "@/components/print-document";
import { EmptyState, Spinner } from "@/components/ui";
import { getClient } from "@/lib/db/clients";
import { getClientPayment } from "@/lib/db/payments";
import { getProformaInvoice } from "@/lib/db/proforma-invoices";
import type { Client, ClientPayment, ProformaInvoice } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

function numberToWordsINR(n: number): string {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function twoDigits(x: number): string {
    if (x < 20) return a[x];
    return `${b[Math.floor(x / 10)]}${x % 10 ? " " + a[x % 10] : ""}`;
  }
  function threeDigits(x: number): string {
    if (x < 100) return twoDigits(x);
    return `${a[Math.floor(x / 100)]} Hundred${x % 100 ? " " + twoDigits(x % 100) : ""}`;
  }

  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  if (rupees === 0) return "Zero Rupees Only";

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = rupees % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  let words = `${parts.join(" ")} Rupees`;
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  return `${words} Only`;
}

export default function PaymentReceiptPrintPage() {
  const { paymentId } = useParams<{ id: string; paymentId: string }>();
  const [payment, setPayment] = useState<ClientPayment | null | undefined>(undefined);
  const [client, setClient] = useState<Client | null>(null);
  const [pi, setPi] = useState<ProformaInvoice | null>(null);

  useEffect(() => {
    void getClientPayment(paymentId).then(async (row) => {
      setPayment(row);
      if (row?.clientId) setClient(await getClient(row.clientId));
      if (row?.piId) setPi(await getProformaInvoice(row.piId));
    });
  }, [paymentId]);

  if (payment === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (payment === null) return <EmptyState title="Payment not found" />;

  const receiptNo = `RCPT-${payment.id.slice(0, 8).toUpperCase()}`;

  return (
    <div>
      <PrintToolbar backHref={`/proforma-invoices/${pi?.id ?? ""}`} />

      <PrintSheet>
        <PrintHeader
          docLabel="Payment Receipt"
          docNumber={receiptNo}
          meta={<p className="mt-0.5 text-[11px] text-ink-400">{formatDate(payment.paymentDate)}</p>}
        />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-500">Received from</p>
            <p className="font-medium text-ink-900">{payment.clientName}</p>
            {client?.contactName && <p className="text-ink-600">{client.contactName}</p>}
            {client?.gstin && <p className="text-ink-600">GSTIN: {client.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-500">Project</p>
            <p className="text-ink-900">{payment.projectName}</p>
            {pi && (<><p className="mt-2 text-xs text-ink-500">Against Proforma Invoice</p><p className="text-ink-900">{pi.piNo}</p></>)}
            {payment.milestone && (<><p className="mt-2 text-xs text-ink-500">Milestone</p><p className="text-ink-900">{payment.milestone}</p></>)}
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-ink-200 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-ink-600">Amount received</span>
            <span className="text-2xl font-bold tabular-nums text-emerald-600">{formatINR(payment.amount)}</span>
          </div>
          <p className="mt-1 text-xs italic text-ink-500">{numberToWordsINR(payment.amount)}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-ink-500">Mode of payment</p><p className="capitalize text-ink-900">{payment.mode.replace(/_/g, " ").toLowerCase()}</p></div>
          <div><p className="text-xs text-ink-500">Reference no.</p><p className="text-ink-900">{payment.referenceNo || "—"}</p></div>
        </div>

        {payment.notes && (
          <div className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{payment.notes}</div>
        )}

        <p className="mt-8 text-xs text-ink-500">This is a system-generated receipt acknowledging the payment above. It is not a tax invoice.</p>

        <PrintFooter />
      </PrintSheet>
    </div>
  );
}
