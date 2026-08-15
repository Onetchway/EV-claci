"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import { Badge, Button, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { subscribeInvoices } from "@/lib/db/invoices";
import { INVOICE_STATUS_COLOR, INVOICE_STATUS_LABEL } from "@/lib/constants";
import { canManageInvoices } from "@/lib/permissions";
import type { Invoice } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function InvoicesPage() {
  const viewer = useViewer();
  const canManage = canManageInvoices(viewer);
  const [rows, setRows] = useState<Invoice[] | null>(null);

  useEffect(() => subscribeInvoices(setRows), []);

  return (
    <>
      <PageHeader
        title="Invoicing"
        description="GST invoices for billed charging sessions."
        actions={canManage && <Link href="/invoices/new"><Button variant="primary"><Plus className="h-4 w-4" /> New invoice</Button></Link>}
      />

      {rows === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No invoices yet"
          action={canManage && <Link href="/invoices/new"><Button variant="primary"><Plus className="h-4 w-4" /> New invoice</Button></Link>}
        />
      ) : (
        <div className="card overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="th">Invoice #</th>
                <th className="th">Bill to</th>
                <th className="th">Period</th>
                <th className="th">Status</th>
                <th className="th text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((inv) => (
                <tr key={inv.id} className="hover:bg-ink-50">
                  <td className="td font-medium">
                    <Link href={`/invoices/${inv.id}`} className="text-brand-600 hover:underline">{inv.invoiceNumber}</Link>
                  </td>
                  <td className="td text-ink-600">{inv.billToName}</td>
                  <td className="td text-ink-600">{formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</td>
                  <td className="td"><Badge className={INVOICE_STATUS_COLOR[inv.status]}>{INVOICE_STATUS_LABEL[inv.status]}</Badge></td>
                  <td className="td text-right font-medium tabular-nums">{formatINR(inv.totalInr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
