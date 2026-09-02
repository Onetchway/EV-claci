"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileText, Plus } from "lucide-react";

import {
  Badge, Button, EmptyState, PageHeader, Select, StatCard,
} from "@/components/ui";
import { ExportButton } from "@/components/export-button";
import { PO_STATUSES, type PoStatus } from "@/lib/constants";
import { subscribePurchaseOrders } from "@/lib/db/purchase-orders";
import type { PurchaseOrder } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR, MONTH_NAMES, toDate } from "@/lib/utils";

const OPEN_STATUSES: PoStatus[] = ["DRAFT", "ISSUED", "ACKNOWLEDGED", "PARTIALLY_DELIVERED"];

export default function PurchaseOrdersPage() {
  const [rows, setRows] = useState<PurchaseOrder[] | null>(null);
  const [status, setStatus] = useState<PoStatus | "ALL">("ALL");
  const [year, setYear] = useState<string>("ALL");
  const [month, setMonth] = useState<string>("ALL");
  const [projectId, setProjectId] = useState<string>("ALL");
  const [vendorId, setVendorId] = useState<string>("ALL");

  useEffect(() => subscribePurchaseOrders(setRows), []);

  const years = useMemo(() => {
    const s = new Set<number>();
    (rows ?? []).forEach((r) => { const d = toDate(r.poDate); if (d) s.add(d.getFullYear()); });
    return [...s].sort((a, b) => b - a);
  }, [rows]);
  const projects = useMemo(() => {
    const m = new Map<string, string>();
    (rows ?? []).forEach((r) => { if (r.projectId) m.set(r.projectId, r.projectName); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const vendors = useMemo(() => {
    const m = new Map<string, string>();
    (rows ?? []).forEach((r) => { if (r.vendorId) m.set(r.vendorId, r.vendorName); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (projectId !== "ALL" && r.projectId !== projectId) return false;
      if (vendorId !== "ALL" && r.vendorId !== vendorId) return false;
      const d = toDate(r.poDate);
      if (year !== "ALL" && (!d || d.getFullYear() !== Number(year))) return false;
      if (month !== "ALL" && (!d || d.getMonth() !== Number(month))) return false;
      return true;
    });
  }, [rows, status, year, month, projectId, vendorId]);

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
            <ExportButton
              filename="purchase-orders"
              sheetName="Purchase Orders"
              rows={filtered.map((po) => ({
                "PO No.": po.poNo, Vendor: po.vendorName, Project: po.projectName, Status: po.status.replace(/_/g, " "),
                Total: po.totalAmount, Paid: po.paidAmount, Date: formatDate(po.poDate),
              }))}
            />
            <Link href="/purchase-orders/new"><Button variant="primary"><Plus className="h-4 w-4" /> New PO</Button></Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={status} className="w-auto" options={[{ value: "ALL", label: "All statuses" }, ...PO_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))]} onChange={(e) => setStatus(e.target.value as PoStatus | "ALL")} />
        <Select value={year} className="w-auto" options={[{ value: "ALL", label: "All years" }, ...years.map((y) => ({ value: String(y), label: String(y) }))]} onChange={(e) => setYear(e.target.value)} />
        <Select value={month} className="w-auto" options={[{ value: "ALL", label: "All months" }, ...MONTH_NAMES.map((m, i) => ({ value: String(i), label: m }))]} onChange={(e) => setMonth(e.target.value)} />
        <Select value={projectId} className="w-auto" options={[{ value: "ALL", label: "All projects" }, ...projects.map(([id, name]) => ({ value: id, label: name }))]} onChange={(e) => setProjectId(e.target.value)} />
        <Select value={vendorId} className="w-auto" options={[{ value: "ALL", label: "All vendors" }, ...vendors.map(([id, name]) => ({ value: id, label: name }))]} onChange={(e) => setVendorId(e.target.value)} />
      </div>

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
