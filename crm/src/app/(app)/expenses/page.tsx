"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Receipt } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, PageHeader, Spinner, StatCard, useAsyncAction, useToast,
} from "@/components/ui";
import { useSettings } from "@/hooks/use-settings";
import { saveSettings } from "@/lib/db/settings";
import { subscribeAllClaims, subscribeMyClaims } from "@/lib/db/expenses";
import { subscribeUsers } from "@/lib/db/users";
import {
  canApproveExpenseAsFinance, canApproveExpenseAsManager, canManageExpenseSettings, canSeeAllHrms,
} from "@/lib/permissions";
import { EXPENSE_STATUS_META } from "@/lib/constants";
import type { AppUser, ExpenseClaim } from "@/lib/types";
import { cn, formatINR } from "@/lib/utils";

type TabKey = "mine" | "approvals" | "reports" | "settings";

export default function ExpensesPage() {
  const viewer = useViewer();
  const [tab, setTab] = useState<TabKey>("mine");

  const canApprove = canApproveExpenseAsManager(viewer) || canApproveExpenseAsFinance(viewer);
  const canSeeReports = canApprove;
  const canSeeSettings = canManageExpenseSettings(viewer);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "mine", label: "My Claims" },
    ...(canApprove ? [{ key: "approvals" as const, label: "Approvals" }] : []),
    ...(canSeeReports ? [{ key: "reports" as const, label: "Reports" }] : []),
    ...(canSeeSettings ? [{ key: "settings" as const, label: "Settings" }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Employee expense claims and reimbursement."
        actions={<Link href="/expenses/new"><Button variant="primary"><Plus className="h-4 w-4" /> New claim</Button></Link>}
      />

      <div className="mb-4 flex gap-1 border-b border-ink-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "mine" && <MyClaimsTab />}
      {tab === "approvals" && canApprove && <ApprovalsTab />}
      {tab === "reports" && canSeeReports && <ReportsTab />}
      {tab === "settings" && canSeeSettings && <SettingsTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function MyClaimsTab() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<ExpenseClaim[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    return subscribeMyClaims(profile.uid, setRows);
  }, [profile]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      total: all.reduce((s, c) => s + c.totalAmount, 0),
      pending: all.filter((c) => c.status === "SUBMITTED" || c.status === "MANAGER_APPROVED").length,
      approved: all.filter((c) => c.status === "FINANCE_APPROVED").reduce((s, c) => s + c.totalAmount, 0),
    };
  }, [rows]);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Total claimed" value={formatINR(stats.total)} />
        <StatCard label="Awaiting approval" value={stats.pending} />
        <StatCard label="Reimbursed" value={formatINR(stats.approved)} tone="positive" />
      </div>

      {rows === null ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-8 w-8" />}
          title="No expense claims yet"
          action={<Link href="/expenses/new"><Button variant="primary"><Plus className="h-4 w-4" /> New claim</Button></Link>}
        />
      ) : (
        <ClaimsTable rows={rows} showEmployee={false} />
      )}
    </div>
  );
}

function ApprovalsTab() {
  const viewer = useViewer();
  const [rows, setRows] = useState<ExpenseClaim[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeAllClaims((r) => { setRows(r); setLoading(false); }, () => setLoading(false)), []);
  useEffect(() => subscribeUsers(setUsers), []);

  const seesAll = canSeeAllHrms(viewer);
  const directReportIds = useMemo(() => new Set(users.filter((u) => u.managerId === viewer.uid).map((u) => u.uid)), [users, viewer.uid]);

  const managerQueue = rows.filter((c) => c.status === "SUBMITTED" && canApproveExpenseAsManager(viewer) && (seesAll || directReportIds.has(c.uid) || c.managerId === viewer.uid));
  const financeQueue = rows.filter((c) => c.status === "MANAGER_APPROVED" && canApproveExpenseAsFinance(viewer));

  if (loading) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;

  return (
    <div className="space-y-4">
      {canApproveExpenseAsManager(viewer) && (
        <Card title="Pending your approval (manager)" subtitle={`${managerQueue.length} waiting`}>
          {managerQueue.length === 0 ? <p className="py-4 text-center text-sm text-ink-500">Nothing pending.</p> : <ClaimsTable rows={managerQueue} showEmployee />}
        </Card>
      )}
      {canApproveExpenseAsFinance(viewer) && (
        <Card title="Pending finance approval" subtitle={`${financeQueue.length} waiting`}>
          {financeQueue.length === 0 ? <p className="py-4 text-center text-sm text-ink-500">Nothing pending.</p> : <ClaimsTable rows={financeQueue} showEmployee />}
        </Card>
      )}
    </div>
  );
}

function ReportsTab() {
  const [rows, setRows] = useState<ExpenseClaim[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; });

  useEffect(() => subscribeAllClaims(setRows), []);
  useEffect(() => subscribeUsers(setUsers), []);

  const monthRows = rows.filter((c) => c.month === month && c.status !== "DRAFT");
  const byUser = new Map<string, AppUser>(users.map((u) => [u.uid, u]));

  const employeeWise = useMemo(() => {
    const map = new Map<string, { userName: string; total: number; approved: number; count: number }>();
    for (const c of monthRows) {
      const row = map.get(c.uid) ?? { userName: c.userName, total: 0, approved: 0, count: 0 };
      row.total += c.totalAmount;
      if (c.status === "FINANCE_APPROVED") row.approved += c.totalAmount;
      row.count += 1;
      map.set(c.uid, row);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [monthRows]);

  const teamWise = useMemo(() => {
    const map = new Map<string, { teamLabel: string; total: number; count: number }>();
    for (const c of monthRows) {
      const emp = byUser.get(c.uid);
      const manager = emp?.managerId ? byUser.get(emp.managerId) : null;
      const key = manager?.uid ?? "none";
      const label = manager?.name ?? "No manager / unassigned";
      const row = map.get(key) ?? { teamLabel: label, total: 0, count: 0 };
      row.total += c.totalAmount;
      row.count += 1;
      map.set(key, row);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [monthRows, byUser]);

  return (
    <div className="space-y-4">
      <div className="card p-3">
        <Field label="Month"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" /></Field>
      </div>

      <Card title="Employee-wise" subtitle={`${formatINR(monthRows.reduce((s, c) => s + c.totalAmount, 0))} total for ${month}`}>
        {employeeWise.length === 0 ? <p className="py-4 text-center text-sm text-ink-500">No claims this month.</p> : (
          <table className="w-full">
            <thead className="border-b border-ink-200"><tr><th className="th">Employee</th><th className="th text-right">Claims</th><th className="th text-right">Total</th><th className="th text-right">Reimbursed</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {employeeWise.map(([uid, row]) => (
                <tr key={uid}>
                  <td className="td font-medium">{row.userName}</td>
                  <td className="td text-right tabular-nums">{row.count}</td>
                  <td className="td text-right tabular-nums">{formatINR(row.total)}</td>
                  <td className="td text-right tabular-nums text-emerald-600">{formatINR(row.approved)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Team-wise" subtitle="Grouped by manager">
        {teamWise.length === 0 ? <p className="py-4 text-center text-sm text-ink-500">No claims this month.</p> : (
          <table className="w-full">
            <thead className="border-b border-ink-200"><tr><th className="th">Team (manager)</th><th className="th text-right">Claims</th><th className="th text-right">Total</th></tr></thead>
            <tbody className="divide-y divide-ink-100">
              {teamWise.map(([key, row]) => (
                <tr key={key}>
                  <td className="td font-medium">{row.teamLabel}</td>
                  <td className="td text-right tabular-nums">{row.count}</td>
                  <td className="td text-right tabular-nums">{formatINR(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function SettingsTab() {
  const { actor } = useAuth();
  const { settings, loading } = useSettings();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();
  const [bikeRate, setBikeRate] = useState("");
  const [carRate, setCarRate] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (loading || seeded) return;
    setBikeRate(String(settings.expense.bikeRatePerKm));
    setCarRate(String(settings.expense.carRatePerKm));
    setDailyRate(String(settings.expense.dailyAllowanceRate));
    setSeeded(true);
  }, [loading, seeded, settings]);

  async function save() {
    if (!actor) return;
    await run(() => saveSettings({
      ...settings,
      expense: {
        bikeRatePerKm: Number(bikeRate) || 0,
        carRatePerKm: Number(carRate) || 0,
        dailyAllowanceRate: Number(dailyRate) || 0,
      },
    }, actor), "Expense rates updated.");
  }

  if (loading) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;

  return (
    <Card title="Reimbursement rates" subtitle="Applied automatically when an employee adds a Travel or Daily Allowance item — already-submitted claims keep the rate they were created with.">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Bike (₹ per km)"><Input type="number" value={bikeRate} onChange={(e) => setBikeRate(e.target.value)} /></Field>
        <Field label="Car (₹ per km)"><Input type="number" value={carRate} onChange={(e) => setCarRate(e.target.value)} /></Field>
        <Field label="Daily allowance (₹ per day)"><Input type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} /></Field>
      </div>
      <Button variant="primary" className="mt-4" loading={busy} onClick={() => void save()}>Save rates</Button>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function ClaimsTable({ rows, showEmployee }: { rows: ExpenseClaim[]; showEmployee: boolean }) {
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full">
        <thead className="border-b border-ink-200">
          <tr>
            {showEmployee && <th className="th">Employee</th>}
            <th className="th">Claim</th>
            <th className="th">Month</th>
            <th className="th text-right">Amount</th>
            <th className="th">Status</th>
            <th className="th" />
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((c) => (
            <tr key={c.id}>
              {showEmployee && <td className="td font-medium">{c.userName}</td>}
              <td className="td text-ink-600">{c.claimNo} — {c.title}</td>
              <td className="td text-ink-600">{c.month}</td>
              <td className="td text-right tabular-nums">{formatINR(c.totalAmount)}</td>
              <td className="td"><Badge className={EXPENSE_STATUS_META[c.status].className}>{EXPENSE_STATUS_META[c.status].label}</Badge></td>
              <td className="td text-right"><Link href={`/expenses/${c.id}`} className="text-xs font-medium text-brand-700 hover:underline">Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
