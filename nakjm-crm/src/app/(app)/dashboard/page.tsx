"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, Briefcase, Building2, TrendingUp, Truck } from "lucide-react";

import { PageHeader, ProgressBar, StatCard } from "@/components/ui";
import { statusMeta } from "@/lib/constants";
import { listActiveClients } from "@/lib/db/clients";
import { subscribeClientPayments, subscribeVendorPayments } from "@/lib/db/payments";
import { subscribeProjects } from "@/lib/db/projects";
import { subscribeRecentSiteReports } from "@/lib/db/site-reports";
import { listActiveVendors } from "@/lib/db/vendors";
import type { ClientPayment, Project, SiteReport, VendorPayment } from "@/lib/types";
import { formatCompactINR, formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [vendorCount, setVendorCount] = useState<number | null>(null);
  const [clientPayments, setClientPayments] = useState<ClientPayment[] | null>(null);
  const [vendorPayments, setVendorPayments] = useState<VendorPayment[] | null>(null);
  const [reports, setReports] = useState<SiteReport[] | null>(null);

  useEffect(() => subscribeProjects({ status: "ALL", max: 500 }, setProjects), []);
  useEffect(() => { void listActiveClients().then((c) => setClientCount(c.length)); }, []);
  useEffect(() => { void listActiveVendors().then((v) => setVendorCount(v.length)); }, []);
  useEffect(() => subscribeClientPayments({}, setClientPayments), []);
  useEffect(() => subscribeVendorPayments({}, setVendorPayments), []);
  useEffect(() => subscribeRecentSiteReports(setReports), []);

  const contractValue = (projects ?? []).filter((p) => p.status !== "CANCELLED").reduce((s, p) => s + p.contractValue, 0);
  const budget = (projects ?? []).filter((p) => p.status !== "CANCELLED").reduce((s, p) => s + p.budgetAmount, 0);
  const collected = (clientPayments ?? []).reduce((s, p) => s + p.amount, 0);
  const paidToVendors = (vendorPayments ?? []).reduce((s, p) => s + p.amount, 0);
  const collectionPct = contractValue > 0 ? Math.round((collected / contractValue) * 100) : 0;

  const byStatus = new Map<string, number>();
  for (const p of projects ?? []) byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1);

  const upcoming = (projects ?? [])
    .filter((p) => p.targetEndDate && ["APPROVED", "IN_PROGRESS"].includes(p.status))
    .sort((a, b) => (a.targetEndDate?.seconds ?? 0) - (b.targetEndDate?.seconds ?? 0))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Everything NAKJM's EPC business is running, at a glance." />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Clients" value={clientCount ?? "—"} icon={<Building2 className="h-4 w-4" />} />
        <StatCard label="Active Vendors" value={vendorCount ?? "—"} icon={<Truck className="h-4 w-4" />} />
        <StatCard label="Contract Value" value={formatCompactINR(contractValue)} icon={<Briefcase className="h-4 w-4" />} />
        <StatCard label="Budget" value={formatCompactINR(budget)} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <h3 className="font-semibold text-ink-900">Client Collections</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center text-sm">
            <div><p className="text-ink-500">Collected</p><p className="font-bold text-emerald-600">{formatCompactINR(collected)}</p></div>
            <div><p className="text-ink-500">Of Contract Value</p><p className="font-bold">{collectionPct}%</p></div>
          </div>
          <ProgressBar pct={collectionPct} className="mt-3" />
        </div>
        <div className="card card-pad">
          <h3 className="font-semibold text-ink-900">Vendor Payouts</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center text-sm">
            <div><p className="text-ink-500">Paid</p><p className="font-bold text-emerald-600">{formatCompactINR(paidToVendors)}</p></div>
            <div><p className="text-ink-500">Estimated Margin</p><p className="font-bold">{formatCompactINR(contractValue - budget)}</p></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card card-pad">
          <h3 className="mb-3 font-semibold text-ink-900">Projects by Status</h3>
          <div className="space-y-2 text-sm">
            {[...byStatus.entries()].map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span>{statusMeta(status).label}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
            {byStatus.size === 0 && <p className="text-ink-400">No projects yet.</p>}
          </div>
        </div>
        <div className="card card-pad">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink-900"><AlertCircle className="h-4 w-4 text-amber-500" /> Upcoming Deadlines</h3>
          <div className="space-y-2 text-sm">
            {upcoming.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <Link href={`/projects/${p.id}`} className="text-ink-700 hover:text-brand-700">{p.name}</Link>
                <span className="text-ink-500">{formatDate(p.targetEndDate)}</span>
              </div>
            ))}
            {upcoming.length === 0 && <p className="text-ink-400">Nothing due soon.</p>}
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <h3 className="mb-3 font-semibold text-ink-900">Recent Site Reports</h3>
        <div className="space-y-2 text-sm">
          {(reports ?? []).map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-ink-100 pb-2 last:border-0">
              <span>{r.projectName}</span>
              <span className="capitalize text-ink-500">{r.reportType.toLowerCase()}</span>
              <span className="font-medium">{r.progressPct}%</span>
              <span className="text-ink-400">{formatDate(r.reportDate)}</span>
            </div>
          ))}
          {(!reports || reports.length === 0) && <p className="text-ink-400">No site reports yet.</p>}
        </div>
      </div>
    </div>
  );
}
