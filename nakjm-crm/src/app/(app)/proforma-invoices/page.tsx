"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";

import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { subscribeProformaInvoices } from "@/lib/db/proforma-invoices";
import type { ProformaInvoice } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function ProformaInvoicesPage() {
  const [rows, setRows] = useState<ProformaInvoice[] | null>(null);

  useEffect(() => subscribeProformaInvoices(setRows), []);

  return (
    <div>
      <PageHeader title="Proforma Invoices" description="Every PI raised against a client, across every project. Create and edit them from the project's Proforma Invoices tab." />

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={<FileSpreadsheet className="h-8 w-8" />} title="No proforma invoices yet" description="Create one from a project's Proforma Invoices tab." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No.</th>
                <th className="th">Project</th>
                <th className="th">Milestone</th>
                <th className="th">Status</th>
                <th className="th">Total</th>
                <th className="th">Paid</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((pi) => (
                <tr key={pi.id} className="border-t border-ink-100">
                  <td className="td font-medium">{pi.piNo}</td>
                  <td className="td"><Link href={`/projects/${pi.projectId}`} className="text-brand-700 hover:underline">{pi.projectName}</Link></td>
                  <td className="td">{pi.milestone || "—"}</td>
                  <td className="td"><Badge>{pi.status}</Badge></td>
                  <td className="td">{formatINR(pi.totalAmount)}</td>
                  <td className="td text-emerald-600">{formatINR(pi.paidAmount)}</td>
                  <td className="td text-right">
                    <Link href={`/projects/${pi.projectId}/proforma-invoices/${pi.id}/print`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                      <Printer className="h-3.5 w-3.5" /> Print
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
