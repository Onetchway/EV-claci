"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Play, Wallet } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, PageHeader, Select, Spinner, StatCard, useAsyncAction, useToast,
} from "@/components/ui";
import { MONTH_LABEL, PAYSLIP_STATUS_COLOR, PAYSLIP_STATUS_LABEL } from "@/lib/constants";
import { generatePayrollForMonth, subscribePayslips } from "@/lib/db/payroll";
import { canManagePayroll } from "@/lib/permissions";
import type { Payslip } from "@/lib/types";
import { formatINR } from "@/lib/utils";

const YEARS = (() => {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1];
})();

export default function PayrollPage() {
  const viewer = useViewer();
  const { actor } = useAuth();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);

  const canManage = canManagePayroll(viewer);

  useEffect(() => {
    if (!canManage) return;
    setLoading(true);
    return subscribePayslips(
      { month, year },
      (rows) => { setPayslips(rows); setLoading(false); },
      (e) => { setLoading(false); push(e.message, "error"); },
    );
  }, [canManage, month, year]);

  if (!canManage) {
    return (
      <EmptyState
        title="Finance / management access only"
        description="Payroll and salary data are visible to Finance and Admins only."
        action={<Link href="/dashboard"><Button>Back to dashboard</Button></Link>}
      />
    );
  }

  const totals = useMemo(
    () => payslips.reduce(
      (a, p) => ({ gross: a.gross + p.grossEarning, deductions: a.deductions + p.totalDeductions, net: a.net + p.netPay }),
      { gross: 0, deductions: 0, net: 0 },
    ),
    [payslips],
  );

  async function generate() {
    if (!actor) return;
    const result = await generatePayrollForMonth(month, year, actor);
    if (result.created === 0 && result.skippedExisting.length > 0) {
      push(`Every eligible employee already has a payslip for ${MONTH_LABEL[month - 1]} ${year}.`, "info");
    } else {
      push(
        `Generated ${result.created} payslip${result.created === 1 ? "" : "s"}.`
        + (result.skippedExisting.length ? ` ${result.skippedExisting.length} already existed.` : ""),
        "success",
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Generate monthly payslips from each employee's salary profile — attendance-driven paid days, computed earnings/deductions, and a printable payslip. Set up an employee's salary from HRMS → Employees → Salary."
        actions={
          <Button variant="primary" loading={busy} onClick={() => void run(generate)}>
            <Play className="h-4 w-4" /> Generate payroll
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Month">
          <Select
            value={String(month)}
            onChange={(e) => setMonth(Number(e.target.value))}
            options={MONTH_LABEL.map((m, i) => ({ value: String(i + 1), label: m }))}
          />
        </Field>
        <Field label="Year">
          <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} options={YEARS.map((y) => ({ value: String(y), label: String(y) }))} />
        </Field>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Payslips" value={payslips.length} />
        <StatCard label="Gross earning" value={formatINR(totals.gross)} />
        <StatCard label="Deductions" value={formatINR(totals.deductions)} />
        <StatCard label="Net pay" value={formatINR(totals.net)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : (
        <Card title={`${MONTH_LABEL[month - 1]} ${year}`}>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Payslip</th>
                  <th className="th">Employee</th>
                  <th className="th text-right">Paid days</th>
                  <th className="th text-right">Gross earning</th>
                  <th className="th text-right">Deductions</th>
                  <th className="th text-right">Net pay</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {payslips.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50">
                    <td className="td">
                      <Link href={`/payroll/${p.id}`} className="font-medium text-brand-700 hover:underline">{p.number}</Link>
                    </td>
                    <td className="td">
                      <span className="block font-medium text-ink-900">{p.employeeName}</span>
                      <span className="block text-xs text-ink-500">{p.designation || "—"}</span>
                    </td>
                    <td className="td text-right tabular-nums">{p.paidDays} / {p.monthDays}</td>
                    <td className="td text-right tabular-nums">{formatINR(p.grossEarning)}</td>
                    <td className="td text-right tabular-nums text-rose-600">−{formatINR(p.totalDeductions)}</td>
                    <td className="td text-right tabular-nums font-semibold">{formatINR(p.netPay)}</td>
                    <td className="td"><Badge className={PAYSLIP_STATUS_COLOR[p.status]}>{PAYSLIP_STATUS_LABEL[p.status]}</Badge></td>
                  </tr>
                ))}
                {payslips.length === 0 && (
                  <tr>
                    <td colSpan={7} className="td py-14 text-center text-ink-400">
                      <Wallet className="mx-auto mb-2 h-6 w-6 text-ink-300" />
                      No payslips generated for {MONTH_LABEL[month - 1]} {year} yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
