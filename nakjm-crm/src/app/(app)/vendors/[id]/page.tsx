"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge, StatCard } from "@/components/ui";
import { subscribeVendor } from "@/lib/db/vendors";
import { subscribePosForVendor } from "@/lib/db/purchase-orders";
import { subscribeVendorPayments } from "@/lib/db/payments";
import type { PurchaseOrder, Vendor, VendorPayment } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR } from "@/lib/utils";

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [pos, setPos] = useState<PurchaseOrder[] | null>(null);
  const [payments, setPayments] = useState<VendorPayment[] | null>(null);

  useEffect(() => subscribeVendor(id, setVendor), [id]);
  useEffect(() => subscribePosForVendor(id, setPos), [id]);
  useEffect(() => subscribeVendorPayments({ vendorId: id }, setPayments), [id]);

  if (!vendor) return <p className="text-sm text-ink-400">Loading…</p>;

  const totalPoValue = (pos ?? []).reduce((s, p) => s + p.totalAmount, 0);
  const totalPaid = (payments ?? []).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-5">
      <div className="card card-pad">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">{vendor.name}</h1>
            <p className="text-sm capitalize text-ink-500">{vendor.category.replace(/_/g, " ").toLowerCase()}</p>
          </div>
          <Badge className={vendor.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
            {vendor.active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-ink-100 pt-5 text-sm md:grid-cols-4">
          <div><p className="text-ink-400">Contact</p><p className="font-medium">{vendor.contactName || "—"}</p></div>
          <div><p className="text-ink-400">Email</p><p className="font-medium">{vendor.contactEmail || "—"}</p></div>
          <div><p className="text-ink-400">Phone</p><p className="font-medium">{vendor.contactPhone || "—"}</p></div>
          <div><p className="text-ink-400">GSTIN</p><p className="font-medium">{vendor.gstin || "—"}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="PO Value" value={formatCompactINR(totalPoValue)} />
        <StatCard label="Paid" value={formatCompactINR(totalPaid)} tone="positive" />
        <StatCard label="Outstanding" value={formatCompactINR(Math.max(totalPoValue - totalPaid, 0))} tone="negative" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
        <table className="w-full">
          <thead><tr><th className="th">PO No.</th><th className="th">Project</th><th className="th">Status</th><th className="th">Total</th><th className="th">Date</th></tr></thead>
          <tbody>
            {(pos ?? []).length === 0 ? (
              <tr><td colSpan={5} className="td text-center text-ink-400">No purchase orders yet.</td></tr>
            ) : pos!.map((po) => (
              <tr key={po.id} className="border-t border-ink-100">
                <td className="td font-medium">{po.poNo}</td>
                <td className="td">{po.projectName}</td>
                <td className="td"><Badge>{po.status}</Badge></td>
                <td className="td">{formatINR(po.totalAmount)}</td>
                <td className="td">{formatDate(po.poDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
        <table className="w-full">
          <thead><tr><th className="th">Date</th><th className="th">Project</th><th className="th">Mode</th><th className="th">Reference</th><th className="th">Amount</th></tr></thead>
          <tbody>
            {(payments ?? []).length === 0 ? (
              <tr><td colSpan={5} className="td text-center text-ink-400">No payments yet.</td></tr>
            ) : payments!.map((p) => (
              <tr key={p.id} className="border-t border-ink-100">
                <td className="td">{formatDate(p.paymentDate)}</td>
                <td className="td">{p.projectName}</td>
                <td className="td capitalize">{p.mode.replace(/_/g, " ").toLowerCase()}</td>
                <td className="td">{p.referenceNo || "—"}</td>
                <td className="td font-medium text-emerald-600">{formatINR(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
