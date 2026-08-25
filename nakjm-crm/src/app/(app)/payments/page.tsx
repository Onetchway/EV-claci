"use client";

import { useEffect, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

import { Button, PageHeader, StatCard } from "@/components/ui";
import { subscribeClientPayments, subscribeVendorPayments } from "@/lib/db/payments";
import type { ClientPayment, VendorPayment } from "@/lib/types";
import { formatCompactINR, formatDate, formatINR } from "@/lib/utils";

export default function PaymentsPage() {
  const [tab, setTab] = useState<"client" | "vendor">("client");
  const [clientPayments, setClientPayments] = useState<ClientPayment[] | null>(null);
  const [vendorPayments, setVendorPayments] = useState<VendorPayment[] | null>(null);

  useEffect(() => subscribeClientPayments({}, setClientPayments), []);
  useEffect(() => subscribeVendorPayments({}, setVendorPayments), []);

  const rows = tab === "client" ? clientPayments : vendorPayments;
  const total = (rows ?? []).reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <PageHeader title="Payments" description="Client collections and vendor payouts across every project." />

      <div className="mb-4 flex gap-2">
        <Button variant={tab === "client" ? "primary" : "secondary"} onClick={() => setTab("client")}><ArrowDownCircle className="h-4 w-4" /> Client Collections</Button>
        <Button variant={tab === "vendor" ? "primary" : "secondary"} onClick={() => setTab("vendor")}><ArrowUpCircle className="h-4 w-4" /> Vendor Payouts</Button>
      </div>

      <div className="mb-4 max-w-xs"><StatCard label={`Total ${tab === "client" ? "Collected" : "Paid"}`} value={formatCompactINR(total)} /></div>

      <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Date</th>
              <th className="th">Project</th>
              <th className="th">{tab === "client" ? "Client" : "Vendor"}</th>
              <th className="th">Mode</th>
              <th className="th">Reference</th>
              <th className="th">Amount</th>
            </tr>
          </thead>
          <tbody>
            {!rows ? (
              <tr><td colSpan={6} className="td text-center text-ink-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="td text-center text-ink-400">No payments recorded yet.</td></tr>
            ) : rows.map((p) => (
              <tr key={p.id} className="border-t border-ink-100">
                <td className="td">{formatDate(p.paymentDate)}</td>
                <td className="td">{p.projectName}</td>
                <td className="td">{"clientName" in p ? p.clientName : p.vendorName}</td>
                <td className="td capitalize">{p.mode.replace(/_/g, " ").toLowerCase()}</td>
                <td className="td">{p.referenceNo || "—"}</td>
                <td className={`td font-semibold ${tab === "client" ? "text-emerald-600" : "text-rose-600"}`}>{formatINR(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-400">Record new payments from within a project's Payments tab.</p>
    </div>
  );
}
