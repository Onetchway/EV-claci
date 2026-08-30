"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Printer } from "lucide-react";

import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { subscribePurchaseOrders } from "@/lib/db/purchase-orders";
import type { PurchaseOrder } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function PurchaseOrdersPage() {
  const [rows, setRows] = useState<PurchaseOrder[] | null>(null);

  useEffect(() => subscribePurchaseOrders(setRows), []);

  return (
    <div>
      <PageHeader title="Purchase Orders" description="Every PO issued to a vendor, across every project. Create and edit them from the project's Purchase Orders tab." />

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="No purchase orders yet" description="Create one from a project's Purchase Orders tab." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No.</th>
                <th className="th">Project</th>
                <th className="th">Vendor</th>
                <th className="th">Status</th>
                <th className="th">Total</th>
                <th className="th">Paid</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((po) => (
                <tr key={po.id} className="border-t border-ink-100">
                  <td className="td font-medium">{po.poNo}</td>
                  <td className="td"><Link href={`/projects/${po.projectId}`} className="text-brand-700 hover:underline">{po.projectName}</Link></td>
                  <td className="td"><Link href={`/vendors/${po.vendorId}`} className="text-brand-700 hover:underline">{po.vendorName}</Link></td>
                  <td className="td"><Badge>{po.status}</Badge></td>
                  <td className="td">{formatINR(po.totalAmount)}</td>
                  <td className="td text-emerald-600">{formatINR(po.paidAmount)}</td>
                  <td className="td text-right">
                    <Link href={`/projects/${po.projectId}/purchase-orders/${po.id}/print`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
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
