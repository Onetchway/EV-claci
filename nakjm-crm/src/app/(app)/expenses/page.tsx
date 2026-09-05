"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Receipt, Search } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import { Badge, Button, EmptyState, Input, PageHeader, Select, StatCard } from "@/components/ui";
import { ExportButton } from "@/components/export-button";
import { EXPENSE_REPORT_STATUSES, EXPENSE_REPORT_STATUS_META, type ExpenseReportStatus } from "@/lib/constants";
import { subscribeAllExpenseReports, subscribeMyExpenseReports } from "@/lib/db/expenses";
import { canManageHrms, canManagePayments, canSeeAllHrms } from "@/lib/permissions";
import type { ExpenseReport } from "@/lib/types";
import { formatCompactINR, formatINR } from "@/lib/utils";

type View = "MINE" | "TEAM" | "FINANCE" | "ALL";
type GroupBy = "NONE" | "EMPLOYEE" | "TEAM";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function ExpenseReportsPage() {
  const viewer = useViewer();
  const { profile } = useAuth();
  const broadAccess = canSeeAllHrms(viewer) || canManageHrms(viewer) || canManagePayments(viewer);

  const [mine, setMine] = useState<ExpenseReport[] | null>(null);
  const [all, setAll] = useState<ExpenseReport[] | null>(null);
  const [view, setView] = useState<View>("MINE");
  const [groupBy, setGroupBy] = useState<GroupBy>("NONE");
  const [status, setStatus] = useState<ExpenseReportStatus | "ALL">("ALL");
  const [month, setMonth] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => { if (profile?.uid) return subscribeMyExpenseReports(profile.uid, setMine); }, [profile?.uid]);
  useEffect(() => { if (broadAccess) return subscribeAllExpenseReports(setAll); }, [broadAccess]);

  const rows = useMemo((): ExpenseReport[] | null => {
    if (view === "MINE") return mine;
    if (view === "TEAM") return (all ?? []).filter((r) => r.managerId === profile?.uid);
    if (view === "FINANCE") return (all ?? []).filter((r) => r.status === "MANAGER_APPROVED");
    return all;
  }, [view, mine, all, profile?.uid]);

  const months = useMemo(() => {
    const s = new Set<string>();
    (rows ?? []).forEach((r) => { if (r.month) s.add(r.month); });
    return [...s].sort().reverse();
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (month !== "ALL" && r.month !== month) return false;
      if (needle && !`${r.reportNo} ${r.userName}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, status, month, search]);

  const stats = useMemo(() => {
    const thisMonth = currentMonth();
    const all2 = rows ?? [];
    return {
      total: all2.length,
      pending: all2.filter((r) => r.status === "SUBMITTED" || r.status === "MANAGER_APPROVED").length,
      thisMonthValue: all2.filter((r) => r.month === thisMonth).reduce((s, r) => s + r.totalAmount, 0),
      paidValue: all2.filter((r) => r.status === "PAID").reduce((s, r) => s + r.totalAmount, 0),
    };
  }, [rows]);

  const grouped = useMemo(() => {
    if (groupBy === "NONE") return null;
    const key = groupBy === "EMPLOYEE" ? (r: ExpenseReport) => r.userName : (r: ExpenseReport) => r.managerName || "No manager";
    const m = new Map<string, { count: number; total: number }>();
    filtered.forEach((r) => {
      const k = key(r);
      const cur = m.get(k) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += r.totalAmount;
      m.set(k, cur);
    });
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [filtered, groupBy]);

  const views: { value: View; label: string }[] = [
    { value: "MINE", label: "My Reports" },
    { value: "TEAM", label: "Pending My Approval" },
    ...(canManagePayments(viewer) ? [{ value: "FINANCE" as View, label: "Finance Queue" }] : []),
    ...(broadAccess ? [{ value: "ALL" as View, label: "All Reports" }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Travel, hotel, daily allowance and other expense claims — submitted for manager and finance approval, then reimbursed."
        actions={
          <>
            {filtered.length > 0 && (
              <ExportButton
                filename="expense-reports"
                sheetName="Expenses"
                rows={filtered.map((r) => ({
                  "Report No.": r.reportNo, Employee: r.userName, Manager: r.managerName ?? "", Month: r.month,
                  Status: EXPENSE_REPORT_STATUS_META[r.status].label, Total: r.totalAmount,
                }))}
              />
            )}
            <Link href="/expenses/new"><Button variant="primary"><Plus className="h-4 w-4" /> New Expense Report</Button></Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {views.map((v) => (
          <button
            key={v.value}
            onClick={() => setView(v.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${view === v.value ? "bg-brand-600 text-white" : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50"}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Reports" value={stats.total} icon={<Receipt className="h-4 w-4" />} />
        <StatCard label="Pending approval" value={stats.pending} />
        <StatCard label="This month" value={formatCompactINR(stats.thisMonthValue)} />
        <StatCard label="Paid" value={formatCompactINR(stats.paidValue)} tone="positive" />
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input placeholder="Search reports…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} className="w-auto" options={[{ value: "ALL", label: "All statuses" }, ...EXPENSE_REPORT_STATUSES.map((s) => ({ value: s, label: EXPENSE_REPORT_STATUS_META[s].label }))]} onChange={(e) => setStatus(e.target.value as ExpenseReportStatus | "ALL")} />
        <Select value={month} className="w-auto" options={[{ value: "ALL", label: "All months" }, ...months.map((m) => ({ value: m, label: m }))]} onChange={(e) => setMonth(e.target.value)} />
        {(view === "ALL" || view === "FINANCE") && (
          <Select value={groupBy} className="w-auto" options={[{ value: "NONE", label: "List view" }, { value: "EMPLOYEE", label: "Group by employee" }, { value: "TEAM", label: "Group by team" }]} onChange={(e) => setGroupBy(e.target.value as GroupBy)} />
        )}
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Receipt className="h-8 w-8" />} title="No expense reports" description="Nothing here yet." action={<Link href="/expenses/new"><Button variant="primary"><Plus className="h-4 w-4" /> New Expense Report</Button></Link>} />
      ) : grouped ? (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">{groupBy === "EMPLOYEE" ? "Employee" : "Manager / Team"}</th><th className="th">Reports</th><th className="th">Total</th></tr></thead>
            <tbody>
              {grouped.map(([name, g]) => (
                <tr key={name} className="border-t border-ink-100">
                  <td className="td font-medium">{name}</td>
                  <td className="td">{g.count}</td>
                  <td className="td">{formatINR(g.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Report No.</th>
                <th className="th">Employee</th>
                <th className="th">Manager</th>
                <th className="th">Month</th>
                <th className="th">Status</th>
                <th className="th">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-ink-100 hover:bg-ink-50">
                  <td className="td font-medium"><Link href={`/expenses/${r.id}`} className="text-brand-700 hover:underline">{r.reportNo}</Link></td>
                  <td className="td">{r.userName}</td>
                  <td className="td text-ink-600">{r.managerName || "—"}</td>
                  <td className="td text-ink-600">{r.month}</td>
                  <td className="td"><Badge className={EXPENSE_REPORT_STATUS_META[r.status].className}>{EXPENSE_REPORT_STATUS_META[r.status].label}</Badge></td>
                  <td className="td">{formatINR(r.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
