"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HandCoins, Plus, Search } from "lucide-react";

import { Badge, Button, EmptyState, Input, PageHeader, Select, StatCard } from "@/components/ui";
import { ExportButton } from "@/components/export-button";
import { SUB_VENDOR_CONTRACT_STATUSES, SUB_VENDOR_CONTRACT_STATUS_META, type SubVendorContractStatus } from "@/lib/constants";
import { subscribeSubVendorContracts } from "@/lib/db/sub-vendors";
import type { SubVendorContract } from "@/lib/types";
import { formatCompactINR, formatDate } from "@/lib/utils";

export default function SubVendorContractsPage() {
  const [rows, setRows] = useState<SubVendorContract[] | null>(null);
  const [status, setStatus] = useState<SubVendorContractStatus | "ALL">("ALL");
  const [projectId, setProjectId] = useState("ALL");
  const [vendorId, setVendorId] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => subscribeSubVendorContracts(setRows), []);

  const projects = useMemo(() => {
    const m = new Map<string, string>();
    (rows ?? []).forEach((r) => m.set(r.projectId, r.projectName));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const vendors = useMemo(() => {
    const m = new Map<string, string>();
    (rows ?? []).forEach((r) => m.set(r.vendorId, r.vendorName));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (projectId !== "ALL" && r.projectId !== projectId) return false;
      if (vendorId !== "ALL" && r.vendorId !== vendorId) return false;
      if (needle && !`${r.contractNo} ${r.projectName} ${r.vendorName} ${r.scopeOfWork}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, status, projectId, vendorId, search]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      total: all.length,
      active: all.filter((c) => c.status === "ACTIVE").length,
      delayed: all.filter((c) => c.status === "DELAYED").length,
      value: all.reduce((s, c) => s + c.contractValue, 0),
    };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Sub-Vendor Contracts"
        description="Work NAKJM has subcontracted to a vendor — stages, payment schedule, and penalty clause, tracked per project or sub-project."
        actions={
          <>
            <ExportButton
              filename="sub-vendor-contracts"
              sheetName="Sub-Vendor Contracts"
              rows={filtered.map((c) => ({
                "Contract No.": c.contractNo, Project: c.projectName, "Sub-vendor": c.vendorName,
                Status: SUB_VENDOR_CONTRACT_STATUS_META[c.status].label, "Contract Value": c.contractValue,
                Start: formatDate(c.startDate), Deadline: formatDate(c.targetEndDate),
              }))}
            />
            <Link href="/sub-vendors/new"><Button variant="primary"><Plus className="h-4 w-4" /> New Sub-Vendor Contract</Button></Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Contracts" value={stats.total} icon={<HandCoins className="h-4 w-4" />} />
        <StatCard label="Active" value={stats.active} tone="positive" />
        <StatCard label="Delayed" value={stats.delayed} tone="negative" />
        <StatCard label="Total value" value={formatCompactINR(stats.value)} />
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input placeholder="Search contracts…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} className="w-auto" options={[{ value: "ALL", label: "All statuses" }, ...SUB_VENDOR_CONTRACT_STATUSES.map((s) => ({ value: s, label: SUB_VENDOR_CONTRACT_STATUS_META[s].label }))]} onChange={(e) => setStatus(e.target.value as SubVendorContractStatus | "ALL")} />
        <Select value={projectId} className="w-auto" options={[{ value: "ALL", label: "All projects" }, ...projects.map(([id, name]) => ({ value: id, label: name }))]} onChange={(e) => setProjectId(e.target.value)} />
        <Select value={vendorId} className="w-auto" options={[{ value: "ALL", label: "All sub-vendors" }, ...vendors.map(([id, name]) => ({ value: id, label: name }))]} onChange={(e) => setVendorId(e.target.value)} />
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<HandCoins className="h-8 w-8" />} title="No sub-vendor contracts yet" description="Subcontract work on a project to a vendor, with its own stages and payment schedule." action={<Link href="/sub-vendors/new"><Button variant="primary"><Plus className="h-4 w-4" /> New Sub-Vendor Contract</Button></Link>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Contract No.</th>
                <th className="th">Project</th>
                <th className="th">Sub-vendor</th>
                <th className="th">Status</th>
                <th className="th">Deadline</th>
                <th className="th">Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-ink-100 hover:bg-ink-50">
                  <td className="td font-medium"><Link href={`/sub-vendors/${c.id}`} className="text-brand-700 hover:underline">{c.contractNo}</Link></td>
                  <td className="td"><Link href={`/projects/${c.projectId}`} className="text-ink-600 hover:underline">{c.projectName}</Link></td>
                  <td className="td">{c.vendorName}</td>
                  <td className="td"><Badge className={SUB_VENDOR_CONTRACT_STATUS_META[c.status].className}>{SUB_VENDOR_CONTRACT_STATUS_META[c.status].label}</Badge></td>
                  <td className="td">{formatDate(c.targetEndDate)}</td>
                  <td className="td">{formatCompactINR(c.contractValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
