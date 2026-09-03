"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Play, RefreshCw, Send, Trash2, Users, Wallet } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, Checkbox, EmptyState, Field, Modal, PageHeader, Select, Spinner, StatCard, useAsyncAction, useToast,
} from "@/components/ui";
import { MONTH_LABEL, PAYSLIP_STATUSES, PAYSLIP_STATUS_COLOR, PAYSLIP_STATUS_LABEL } from "@/lib/constants";
import { subscribeDepartments } from "@/lib/db/departments";
import {
  deletePayslip, generatePayrollForMonth, regeneratePayslip, subscribePayrollProfiles, subscribePayslips, updatePayslipStatus,
} from "@/lib/db/payroll";
import { subscribeUsers } from "@/lib/db/users";
import { canManagePayroll, isSuperAdmin } from "@/lib/permissions";
import type { AppUser, Department, PayrollProfile, Payslip } from "@/lib/types";
import { formatINR } from "@/lib/utils";

const YEARS = (() => {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1];
})();

export default function PayrollPage() {
  const viewer = useViewer();
  const { actor, role } = useAuth();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();
  const { busy: rowBusy, run: runRow } = useAsyncAction();
  const { busy: bulkBusy, run: runBulk } = useAsyncAction();
  const now = new Date();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Payslip | null>(null);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [profiles, setProfiles] = useState<PayrollProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Secondary, client-side filters over the already-fetched month's payslips
  // (Month/Year above stay the only Firestore-query-level filter — see the
  // module comment on why this stays in-memory rather than adding more
  // Firestore `where` clauses).
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // "Generate for selected employees" — a subset of the "Generate payroll"
  // action, reusing the same generatePayrollForMonth with an explicit uids
  // filter rather than a separate code path.
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());

  // Bulk publish (DRAFT -> FINALIZED) selection on the payslip table.
  const [selectedPayslipIds, setSelectedPayslipIds] = useState<Set<string>>(new Set());

  const canManage = canManagePayroll(viewer);
  const superAdmin = !!role && isSuperAdmin(role);

  useEffect(() => {
    if (!canManage) return;
    setLoading(true);
    return subscribePayslips(
      { month, year },
      (rows) => { setPayslips(rows); setLoading(false); setSelectedPayslipIds(new Set()); },
      (e) => { setLoading(false); push(e.message, "error"); },
    );
  }, [canManage, month, year]);

  useEffect(() => {
    if (!canManage) return;
    return subscribeUsers(setUsers);
  }, [canManage]);
  useEffect(() => {
    if (!canManage) return;
    return subscribePayrollProfiles(setProfiles);
  }, [canManage]);
  useEffect(() => {
    if (!canManage) return;
    return subscribeDepartments(setDepartments);
  }, [canManage]);

  if (!canManage) {
    return (
      <EmptyState
        title="Finance / management access only"
        description="Payroll and salary data are visible to Finance and Admins only."
        action={<Link href="/dashboard"><Button>Back to dashboard</Button></Link>}
      />
    );
  }

  // Active employees who have an active salary profile — what "Generate
  // payroll" (all-eligible) and the employee picker both draw from.
  const eligibleEmployees = users
    .filter((u) => u.active !== false && profiles.some((p) => p.uid === u.uid && p.active))
    .sort((a, b) => a.name.localeCompare(b.name));

  const departmentOptions = useMemo(() => {
    const names = new Set<string>();
    for (const p of payslips) if (p.departmentName) names.add(p.departmentName);
    for (const d of departments) names.add(d.name);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [payslips, departments]);

  const filteredPayslips = payslips.filter((p) => {
    if (departmentFilter && (p.departmentName || "") !== departmentFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  const totals = useMemo(
    () => filteredPayslips.reduce(
      (a, p) => ({ gross: a.gross + p.grossEarning, deductions: a.deductions + p.totalDeductions, net: a.net + p.netPay }),
      { gross: 0, deductions: 0, net: 0 },
    ),
    [filteredPayslips],
  );

  function summarizeGenerate(result: { created: number; skippedExisting: string[]; skippedNoProfile: number; skippedNotYetJoined: string[] }) {
    if (result.created === 0 && result.skippedExisting.length === 0 && result.skippedNotYetJoined.length === 0) {
      push("No eligible employees to generate for.", "info");
      return;
    }
    if (result.created === 0 && result.skippedExisting.length > 0 && result.skippedNotYetJoined.length === 0) {
      push(`Every eligible employee already has a payslip for ${MONTH_LABEL[month - 1]} ${year}.`, "info");
      return;
    }
    const bits = [`Generated ${result.created} payslip${result.created === 1 ? "" : "s"}.`];
    if (result.skippedExisting.length) bits.push(`${result.skippedExisting.length} already had one.`);
    if (result.skippedNotYetJoined.length) bits.push(`${result.skippedNotYetJoined.length} skipped — not yet joined this month.`);
    push(bits.join(" "), "success");
  }

  async function generate() {
    if (!actor) return;
    const result = await generatePayrollForMonth(month, year, actor);
    summarizeGenerate(result);
  }

  async function generateSelected() {
    if (!actor) return;
    if (selectedUids.size === 0) { push("Select at least one employee.", "error"); return; }
    const result = await generatePayrollForMonth(month, year, actor, { uids: [...selectedUids] });
    summarizeGenerate(result);
    setSelectOpen(false);
    setSelectedUids(new Set());
  }

  async function regenerate(p: Payslip) {
    if (!actor) return;
    await runRow(() => regeneratePayslip(p, actor), `${p.number} regenerated from current attendance & salary.`);
  }

  async function confirmDelete() {
    if (!actor || !deleting) return;
    await run(async () => {
      await deletePayslip(deleting, actor);
      setDeleting(null);
    }, "Payslip deleted.");
  }

  const publishablePayslips = filteredPayslips.filter((p) => p.status === "DRAFT");
  const allPublishableSelected = publishablePayslips.length > 0 && publishablePayslips.every((p) => selectedPayslipIds.has(p.id));

  function toggleSelectAllPublishable() {
    setSelectedPayslipIds((prev) => {
      if (allPublishableSelected) return new Set();
      return new Set(publishablePayslips.map((p) => p.id));
    });
  }

  function togglePayslipSelected(id: string) {
    setSelectedPayslipIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkPublish() {
    if (!actor) return;
    const targets = payslips.filter((p) => selectedPayslipIds.has(p.id) && p.status === "DRAFT");
    if (targets.length === 0) { push("Select at least one draft payslip to publish.", "error"); return; }

    await runBulk(async () => {
      let succeeded = 0;
      const failures: string[] = [];
      for (const p of targets) {
        try {
          await updatePayslipStatus(p, "FINALIZED", actor);
          succeeded++;
        } catch (e) {
          failures.push(`${p.number}: ${(e as Error).message || "failed"}`);
        }
      }
      setSelectedPayslipIds(new Set());
      if (failures.length === 0) {
        push(`${succeeded} payslip${succeeded === 1 ? "" : "s"} published.`, "success");
      } else {
        push(`${succeeded} published, ${failures.length} failed: ${failures.join("; ")}`, failures.length === targets.length ? "error" : "info");
      }
    });
  }

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Generate monthly payslips from each employee's salary profile — attendance-driven paid days, computed earnings/deductions, and a printable payslip. Set up an employee's salary from HRMS → Employees → Salary."
        actions={
          <>
            <Button onClick={() => setSelectOpen(true)}>
              <Users className="h-4 w-4" /> Generate for selected
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void run(generate)}>
              <Play className="h-4 w-4" /> Generate payroll
            </Button>
          </>
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
        <Field label="Department">
          <Select
            placeholder="All departments"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            options={departmentOptions.map((d) => ({ value: d, label: d }))}
          />
        </Field>
        <Field label="Status">
          <Select
            placeholder="All statuses"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={PAYSLIP_STATUSES.map((s) => ({ value: s, label: PAYSLIP_STATUS_LABEL[s] }))}
          />
        </Field>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Payslips" value={filteredPayslips.length} />
        <StatCard label="Gross earning" value={formatINR(totals.gross)} />
        <StatCard label="Deductions" value={formatINR(totals.deductions)} />
        <StatCard label="Net pay" value={formatINR(totals.net)} />
      </div>

      {selectedPayslipIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5">
          <p className="text-sm text-brand-800">{selectedPayslipIds.size} draft payslip{selectedPayslipIds.size === 1 ? "" : "s"} selected.</p>
          <Button variant="primary" size="sm" loading={bulkBusy} onClick={() => void bulkPublish()}>
            <Send className="h-3.5 w-3.5" /> Publish selected
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : (
        <Card title={`${MONTH_LABEL[month - 1]} ${year}`}>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">
                    <Checkbox
                      label=""
                      checked={allPublishableSelected}
                      disabled={publishablePayslips.length === 0}
                      onChange={() => toggleSelectAllPublishable()}
                    />
                  </th>
                  <th className="th">Payslip</th>
                  <th className="th">Employee</th>
                  <th className="th">Department</th>
                  <th className="th text-right">Paid days</th>
                  <th className="th text-right">Gross earning</th>
                  <th className="th text-right">Deductions</th>
                  <th className="th text-right">Net pay</th>
                  <th className="th">Status</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filteredPayslips.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50">
                    <td className="td">
                      <Checkbox
                        label=""
                        checked={selectedPayslipIds.has(p.id)}
                        disabled={p.status !== "DRAFT"}
                        onChange={() => togglePayslipSelected(p.id)}
                      />
                    </td>
                    <td className="td">
                      <Link href={`/payroll/${p.id}`} className="font-medium text-brand-700 hover:underline">{p.number}</Link>
                    </td>
                    <td className="td">
                      <span className="block font-medium text-ink-900">{p.employeeName}</span>
                      <span className="block text-xs text-ink-500">{p.designation || "—"}</span>
                    </td>
                    <td className="td text-ink-600">{p.departmentName || "—"}</td>
                    <td className="td text-right tabular-nums">{p.paidDays} / {p.monthDays}</td>
                    <td className="td text-right tabular-nums">{formatINR(p.grossEarning)}</td>
                    <td className="td text-right tabular-nums text-rose-600">−{formatINR(p.totalDeductions)}</td>
                    <td className="td text-right tabular-nums font-semibold">{formatINR(p.netPay)}</td>
                    <td className="td"><Badge className={PAYSLIP_STATUS_COLOR[p.status]}>{PAYSLIP_STATUS_LABEL[p.status]}</Badge></td>
                    <td className="td">
                      <div className="flex justify-end gap-1.5">
                        {p.status === "DRAFT" && (
                          <Button size="sm" loading={rowBusy} title="Recompute from current attendance & salary profile" onClick={() => void regenerate(p)}>
                            <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                          </Button>
                        )}
                        {(p.status === "DRAFT" || superAdmin) && (
                          <Button size="sm" variant="danger" onClick={() => setDeleting(p)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPayslips.length === 0 && (
                  <tr>
                    <td colSpan={10} className="td py-14 text-center text-ink-400">
                      <Wallet className="mx-auto mb-2 h-6 w-6 text-ink-300" />
                      {payslips.length === 0
                        ? `No payslips generated for ${MONTH_LABEL[month - 1]} ${year} yet.`
                        : "No payslips match the current filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this payslip?"
        description={
          deleting && deleting.status !== "DRAFT"
            ? "This payslip is already finalized/paid — deleting it removes an issued record permanently. It cannot be recovered."
            : "This permanently removes the draft payslip. It cannot be recovered."
        }
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" loading={busy} onClick={() => void confirmDelete()}>
              <Trash2 className="h-4 w-4" /> Delete payslip
            </Button>
          </>
        }
      >
        {deleting && <p className="text-sm text-ink-700">{deleting.number} — {deleting.employeeName}, {formatINR(deleting.netPay)}</p>}
      </Modal>

      <Modal
        open={selectOpen}
        onClose={() => setSelectOpen(false)}
        title="Generate for selected employees"
        description={`Only for ${MONTH_LABEL[month - 1]} ${year} — an employee already having a payslip that month, or who joined after it, is skipped automatically.`}
        footer={
          <>
            <Button onClick={() => setSelectOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void run(generateSelected)}>
              <Play className="h-4 w-4" /> Generate ({selectedUids.size})
            </Button>
          </>
        }
      >
        <div className="max-h-80 space-y-1.5 overflow-y-auto scroll-thin">
          {eligibleEmployees.map((u) => (
            <Checkbox
              key={u.uid}
              label={<span>{u.name} <span className="text-xs text-ink-500">— {u.designation || "no designation"}</span></span>}
              checked={selectedUids.has(u.uid)}
              onChange={() => setSelectedUids((prev) => {
                const next = new Set(prev);
                if (next.has(u.uid)) next.delete(u.uid); else next.add(u.uid);
                return next;
              })}
            />
          ))}
          {eligibleEmployees.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-400">No active employees with a salary profile yet.</p>
          )}
        </div>
      </Modal>
    </>
  );
}
