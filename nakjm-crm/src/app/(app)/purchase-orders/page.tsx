"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileText, Plus } from "lucide-react";

import {
  Badge, Button, EmptyState, PageHeader, Select, StatCard,
} from "@/components/ui";
import { PO_STATUSES, type PoStatus } from "@/lib/constants";
import { subscribePurchaseOrders } from "@/lib/db/purchase-orders";
import type { PurchaseOrder } from "@/lib/types";
import { formatCompactINR, formatINR } from "@/lib/utils";

const OPEN_STATUSES: PoStatus[] = ["DRAFT", "ISSUED", "ACKNOWLEDGED", "PARTIALLY_DELIVERED"];

export default function PurchaseOrdersPage() {
  const [rows, setRows] = useState<PurchaseOrder[] | null>(null);
  const [status, setStatus] = useState<PoStatus | "ALL">("ALL");

  useEffect(() => subscribePurchaseOrders(setRows), []);

  const filtered = useMemo(() => (!rows ? [] : status === "ALL" ? rows : rows.filter((r) => r.status === status)), [rows, status]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    const open = all.filter((p) => OPEN_STATUSES.includes(p.status));
    return {
      total: all.length,
      open: open.length,
      value: all.reduce((s, p) => s + p.totalAmount, 0),
      outstanding: all.reduce((s, p) => s + Math.max(p.totalAmount - p.paidAmount, 0), 0),
    };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        description="What NAKJM has ordered from vendors — equipment, civil work, EPC scope — and what's still owed."
        actions={
          <>
            <Select value={status} className="w-auto" options={[{ value: "ALL", label: "All statuses" }, ...PO_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]} onChange={(e) => setStatus(e.target.value as PoStatus | "ALL")} />
            <Link href="/purchase-orders/new"><Button variant="primary"><Plus className="h-4 w-4" /> New PO</Button></Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Purchase orders" value={stats.total} icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Open" value={stats.open} />
        <StatCard label="Total value" value={formatCompactINR(stats.value)} />
        <StatCard label="Outstanding" value={formatCompactINR(stats.outstanding)} tone="negative" />
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} title="No purchase orders yet" description="Create one here, or from a project's Purchase Orders tab — either way it links to the project." action={<Link href="/purchase-orders/new"><Button variant="primary"><Plus className="h-4 w-4" /> New PO</Button></Link>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">PO Number</th>
                <th className="th">Vendor</th>
                <th className="th">Status</th>
                <th className="th">Project</th>
                <th className="th">Total</th>
                <th className="th">Due</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((po) => (
                <tr key={po.id} className="cursor-pointer border-t border-ink-100 hover:bg-ink-50">
                  <td className="td font-medium"><Link href={`/purchase-orders/${po.id}`} className="text-brand-700 hover:underline">{po.poNo}</Link></td>
                  <td className="td">{po.vendorName}</td>
                  <td className="td"><Badge>{po.status.replace(/_/g, " ")}</Badge></td>
                  <td className="td"><Link href={`/projects/${po.projectId}`} className="text-ink-600 hover:underline">{po.projectName}</Link></td>
                  <td className="td">{formatINR(po.totalAmount)}</td>
                  <td className="td text-rose-600">{formatINR(Math.max(po.totalAmount - po.paidAmount, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
