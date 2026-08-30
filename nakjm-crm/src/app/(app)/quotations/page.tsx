"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileSignature, Printer } from "lucide-react";

import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { subscribeQuotations } from "@/lib/db/quotations";
import type { Quotation } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function QuotationsPage() {
  const [rows, setRows] = useState<Quotation[] | null>(null);

  useEffect(() => subscribeQuotations(setRows), []);

  return (
    <div>
      <PageHeader title="Quotations" description="Every quotation and its versions, across every project. Create and edit them from the project's Quotations tab." />

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={<FileSignature className="h-8 w-8" />} title="No quotations yet" description="Create one from a project's Quotations tab." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No.</th>
                <th className="th">Project</th>
                <th className="th">Version</th>
                <th className="th">Status</th>
                <th className="th">Valid Until</th>
                <th className="th">Total</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.id} className="border-t border-ink-100">
                  <td className="td font-medium">{q.quotationNo}</td>
                  <td className="td"><Link href={`/projects/${q.projectId}`} className="text-brand-700 hover:underline">{q.projectName}</Link></td>
                  <td className="td">v{q.version}</td>
                  <td className="td"><Badge>{q.status}</Badge></td>
                  <td className="td">{formatDate(q.validUntil)}</td>
                  <td className="td">{formatINR(q.totalAmount)}</td>
                  <td className="td text-right">
                    <Link href={`/projects/${q.projectId}/quotations/${q.id}/print`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
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
