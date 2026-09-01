"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileText, Plus } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, PageHeader, Select, Spinner, StatCard,
} from "@/components/ui";
import { PO_STATUS_COLOR, PO_STATUS_LABEL, PO_STATUSES, type PoStatus } from "@/lib/constants";
import { subscribePurchaseOrders } from "@/lib/db/purchase-orders";
import { canManageVendors } from "@/lib/permissions";
import type { PurchaseOrder } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR } from "@/lib/utils";

export default function PurchaseOrdersPage() {
  const viewer = useViewer();
  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PoStatus | "ALL">("ALL");

  useEffect(() => subscribePurchaseOrders({ max: 1000 }, (r) => { setRows(r); setLoading(false); }, () => setLoading(false)), []);

  const filtered = useMemo(
    () => (status === "ALL" ? rows : rows.filter((p) => p.status === status)),
    [rows, status],
  );

  const stats = useMemo(() => ({
    total: rows.length,
    open: rows.filter((p) => p.status !== "RECEIVED" && p.status !== "CANCELLED").length,
    value: rows.reduce((a, p) => a + p.total, 0),
    due: rows.reduce((a, p) => a + p.dueAmount, 0),
  }), [rows]);

  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="What Livanto has ordered from vendors — chargers, civil work, EPC scope — and what's still owed."
        actions={
          <>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as PoStatus | "ALL")}
              className="w-auto"
              options={[{ value: "ALL", label: "All statuses" }, ...PO_STATUSES.map((s) => ({ value: s, label: PO_STATUS_LABEL[s] }))]}
            />
            {canManageVendors(viewer) && (
              <Link href="/purchase-orders/new">
                <Button variant="primary"><Plus className="h-4 w-4" /> New PO</Button>
              </Link>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Purchase orders" value={stats.total} icon={<FileText className="h-4 w-4" />} />
        <StatCard label="Open" value={stats.open} />
        <StatCard label="Total value" value={formatCompactINR(stats.value)} />
        <StatCard label="Outstanding" value={formatCompactINR(stats.due)} tone={stats.due ? "warn" : "default"} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No purchase orders yet"
          action={canManageVendors(viewer) ? <Link href="/purchase-orders/new"><Button variant="primary"><Plus className="h-4 w-4" /> New PO</Button></Link> : undefined}
        />
      ) : (
        <div className="card overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">PO Number</th>
                <th className="th">Vendor</th>
                <th className="th">Status</th>
                <th className="th">Project</th>
                <th className="th text-right">Total</th>
                <th className="th text-right">Due</th>
                <th className="th">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((po) => (
                <tr key={po.id} className="hover:bg-ink-50">
                  <td className="td">
                    <Link href={`/purchase-orders/${po.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                      {po.poNumber}
                    </Link>
                  </td>
                  <td className="td text-ink-600">{po.vendorName}</td>
                  <td className="td"><Badge className={PO_STATUS_COLOR[po.status]}>{PO_STATUS_LABEL[po.status]}</Badge></td>
                  <td className="td text-ink-600">{po.linkedProjectCode || "—"}</td>
                  <td className="td text-right font-medium tabular-nums">{formatINR(po.total)}</td>
                  <td className="td text-right tabular-nums text-amber-600">{formatINR(po.dueAmount)}</td>
                  <td className="td text-ink-500">{formatDate(po.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
