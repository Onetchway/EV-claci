"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, Landmark } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Avatar, Button, Checkbox, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, useAsyncAction,
} from "@/components/ui";
import { DEPARTMENTS, DEPARTMENT_LABEL, type Department } from "@/lib/constants";
import { subscribeUsers } from "@/lib/db/users";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { canManageHrms, canSeeAllHrms } from "@/lib/permissions";
import type { AppUser, Payroll } from "@/lib/types";
import { formatINR } from "@/lib/utils";

const BLANK_PAYROLL: Payroll = {
  monthlySalary: 0, panNumber: "", pfApplicable: false, pfNumber: "", uanNumber: "",
  esiApplicable: false, esiNumber: "", tdsPercent: 0, bankAccountNo: "", bankIfsc: "", bankName: "",
};

async function authedFetch(path: string, init: RequestInit) {
  const current = getFirebaseAuth().currentUser;
  if (!current) throw new Error("Your session expired. Sign in again.");
  const token = await current.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
  return body;
}

export default function EmployeesPage() {
  const { profile } = useAuth();
  const { busy, run } = useAsyncAction();
  const viewer = useViewer();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [payrollForm, setPayrollForm] = useState<Payroll>(BLANK_PAYROLL);

  const canView = canManageHrms(viewer);
  const canEdit = canView;
  const seeAll = canSeeAllHrms(viewer);

  useEffect(() => {
    if (!canView) return;
    return subscribeUsers((rows) => { setUsers(rows); setLoading(false); }, () => setLoading(false));
  }, [canView]);

  if (!canView) {
    return (
      <EmptyState
        title="HR / management access only"
        description="Employee records are visible to Admins only."
        action={<Link href="/dashboard"><Button>Back to dashboard</Button></Link>}
      />
    );
  }

  async function patchUser(uid: string, patch: Record<string, unknown>) {
    await authedFetch(`/api/users/${uid}`, { method: "PATCH", body: JSON.stringify(patch) });
  }

  function openManage(u: AppUser) {
    setEditing(u);
    setPayrollForm({ ...BLANK_PAYROLL, ...u.payroll });
  }

  async function savePayroll() {
    if (!editing) return;
    await run(async () => {
      await patchUser(editing.uid, { payroll: payrollForm });
      setEditing({ ...editing, payroll: payrollForm });
    }, "Payroll saved.");
  }

  const activeUsers = users.filter((u) => u.active);
  const visible = seeAll ? activeUsers : activeUsers.filter((u) => u.uid === profile?.uid || u.managerId === profile?.uid);

  const counts = {
    total: visible.length,
    withManager: visible.filter((u) => u.managerId).length,
    withDesignation: visible.filter((u) => u.designation).length,
    departments: new Set(visible.map((u) => u.department).filter(Boolean)).size,
  };

  return (
    <>
      <PageHeader
        title="Employees"
        description="Job title, department, work location and reporting manager for every employee."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={seeAll ? "Total employees" : "Your team"} value={counts.total} />
        <StatCard label="With a manager set" value={counts.withManager} />
        <StatCard label="With a designation" value={counts.withDesignation} />
        <StatCard label="Departments in use" value={counts.departments} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="th">Employee</th>
                <th className="th">Designation</th>
                <th className="th">Department</th>
                <th className="th">Location</th>
                <th className="th">Reports to</th>
                <th className="th text-right">Monthly salary</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {visible.map((u) => {
                const manager = u.managerId ? users.find((m) => m.uid === u.managerId) : null;
                return (
                  <tr key={u.id} className="hover:bg-ink-50">
                    <td className="td">
                      <span className="flex items-center gap-2">
                        <Avatar name={u.name} size={30} />
                        <span>
                          <span className="block font-medium text-ink-900">{u.name}</span>
                          <span className="block text-xs text-ink-500">{u.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="td text-ink-600">{u.designation || "—"}</td>
                    <td className="td text-ink-600">{u.department ? DEPARTMENT_LABEL[u.department] : "—"}</td>
                    <td className="td text-ink-600">{u.officeLocation || "—"}</td>
                    <td className="td text-ink-600">{manager?.name || "—"}</td>
                    <td className="td text-right tabular-nums">{u.payroll?.monthlySalary ? formatINR(u.payroll.monthlySalary) : "—"}</td>
                    <td className="td text-right">
                      {canEdit && (
                        <button onClick={() => openManage(u)} className="rounded px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                          Manage
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr><td colSpan={7} className="td py-10 text-center text-ink-400">No employees to show.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Manage ${editing.name}` : ""}
        footer={<Button onClick={() => setEditing(null)}>Done</Button>}
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Designation" hint="Job title, shown in the directory.">
              <Input
                defaultValue={editing.designation ?? ""}
                onBlur={(e) => void run(() => patchUser(editing.uid, { designation: e.target.value }), "Saved.")}
              />
            </Field>

            <Field label="Department">
              <Select
                placeholder="No department"
                value={editing.department ?? ""}
                onChange={(e) => {
                  const department = (e.target.value || null) as Department | null;
                  void run(async () => { await patchUser(editing.uid, { department }); setEditing({ ...editing, department }); }, "Saved.");
                }}
                options={DEPARTMENTS.map((d) => ({ value: d, label: DEPARTMENT_LABEL[d] }))}
              />
            </Field>

            <Field label="Location" hint="Office or site they're based at.">
              <Input
                defaultValue={editing.officeLocation ?? ""}
                onBlur={(e) => void run(() => patchUser(editing.uid, { officeLocation: e.target.value }), "Saved.")}
              />
            </Field>

            <Field label="Reports to" hint="Who approves this person's attendance corrections.">
              <Select
                placeholder="No manager"
                value={editing.managerId ?? ""}
                onChange={(e) => {
                  const mgr = activeUsers.find((u) => u.uid === e.target.value);
                  void run(async () => {
                    await patchUser(editing.uid, { managerId: mgr?.uid ?? null, managerName: mgr?.name ?? null });
                    setEditing({ ...editing, managerId: mgr?.uid ?? null, managerName: mgr?.name ?? null });
                  }, "Saved.");
                }}
                options={activeUsers.filter((u) => u.uid !== editing.uid).map((u) => ({ value: u.uid, label: u.name }))}
              />
            </Field>

            <div className="border-t border-ink-200 pt-4">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                <Landmark className="h-4 w-4" /> Payroll
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Monthly salary (₹)">
                  <Input type="number" min={0} value={payrollForm.monthlySalary ?? 0} onChange={(e) => setPayrollForm((f) => ({ ...f, monthlySalary: Number(e.target.value) || 0 }))} />
                </Field>
                <Field label="TDS (%)">
                  <Input type="number" min={0} max={100} step={0.1} value={payrollForm.tdsPercent ?? 0} onChange={(e) => setPayrollForm((f) => ({ ...f, tdsPercent: Number(e.target.value) || 0 }))} />
                </Field>
                <Field label="PAN"><Input value={payrollForm.panNumber ?? ""} onChange={(e) => setPayrollForm((f) => ({ ...f, panNumber: e.target.value }))} /></Field>
                <Field label="Bank account no."><Input value={payrollForm.bankAccountNo ?? ""} onChange={(e) => setPayrollForm((f) => ({ ...f, bankAccountNo: e.target.value }))} /></Field>
                <Field label="Bank name"><Input value={payrollForm.bankName ?? ""} onChange={(e) => setPayrollForm((f) => ({ ...f, bankName: e.target.value }))} /></Field>
                <Field label="IFSC"><Input value={payrollForm.bankIfsc ?? ""} onChange={(e) => setPayrollForm((f) => ({ ...f, bankIfsc: e.target.value }))} /></Field>
                <Field label="PF" className="col-span-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <Checkbox label="PF applicable" checked={!!payrollForm.pfApplicable} onChange={(v) => setPayrollForm((f) => ({ ...f, pfApplicable: v }))} />
                    {payrollForm.pfApplicable && (
                      <>
                        <Input placeholder="PF number" className="flex-1" value={payrollForm.pfNumber ?? ""} onChange={(e) => setPayrollForm((f) => ({ ...f, pfNumber: e.target.value }))} />
                        <Input placeholder="UAN number" className="flex-1" value={payrollForm.uanNumber ?? ""} onChange={(e) => setPayrollForm((f) => ({ ...f, uanNumber: e.target.value }))} />
                      </>
                    )}
                  </div>
                </Field>
                <Field label="ESI" className="col-span-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <Checkbox label="ESI applicable" checked={!!payrollForm.esiApplicable} onChange={(v) => setPayrollForm((f) => ({ ...f, esiApplicable: v }))} />
                    {payrollForm.esiApplicable && (
                      <Input placeholder="ESI number" className="flex-1" value={payrollForm.esiNumber ?? ""} onChange={(e) => setPayrollForm((f) => ({ ...f, esiNumber: e.target.value }))} />
                    )}
                  </div>
                </Field>
              </div>
              <Button className="mt-3" loading={busy} onClick={() => void savePayroll()}>Save payroll</Button>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-ink-500">
              <Building2 className="h-3.5 w-3.5" /> Role and sign-in access are managed from Settings → Team &amp; Roles.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
