"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";

import { useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, Checkbox, EmptyState, Field, Input, Select, Spinner, useAsyncAction,
} from "@/components/ui";
import {
  DEPARTMENTS, DEPARTMENT_LABEL, EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABEL, ROLE_LABEL,
  ROLL_STATUSES, ROLL_STATUS_LABEL, type Department, type EmploymentType, type RollStatus,
} from "@/lib/constants";
import { getUser, subscribeUsers } from "@/lib/db/users";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { canManageHrms } from "@/lib/permissions";
import type { AppUser, Payroll } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

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

export default function EmployeeDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();

  const [employee, setEmployee] = useState<AppUser | null | undefined>(undefined);
  const [colleagues, setColleagues] = useState<AppUser[]>([]);
  const [payrollForm, setPayrollForm] = useState<Payroll>(BLANK_PAYROLL);

  const canEdit = canManageHrms(viewer);

  useEffect(() => { void getUser(uid).then(setEmployee); }, [uid]);
  useEffect(() => subscribeUsers(setColleagues), []);

  if (employee === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (employee === null) return <EmptyState title="Employee not found" action={<Link href="/employees"><Button>Back to employees</Button></Link>} />;
  if (!canEdit) {
    return (
      <EmptyState
        title="HR / management access only"
        description="Employee records are visible to Admins only."
        action={<Link href="/dashboard"><Button>Back to dashboard</Button></Link>}
      />
    );
  }

  async function patch(body: Record<string, unknown>) {
    await authedFetch(`/api/users/${uid}`, { method: "PATCH", body: JSON.stringify(body) });
  }

  async function onSavePayroll() {
    await run(async () => {
      await patch({ payroll: payrollForm });
      setEmployee((e) => (e ? { ...e, payroll: payrollForm } : e));
    }, "Payroll saved.");
  }

  const manager = employee.managerId ? colleagues.find((c) => c.uid === employee.managerId) : null;

  return (
    <div className="space-y-5">
      <div className="card card-pad">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">{employee.name}</h1>
            <p className="text-sm text-ink-500">{employee.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{ROLE_LABEL[employee.role]}</Badge>
            {employee.rollStatus && (
              <Badge className={employee.rollStatus === "ON_ROLL" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
                {ROLL_STATUS_LABEL[employee.rollStatus]}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Role & details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Designation" hint="Job title, shown in the directory.">
                <Input
                  defaultValue={employee.designation ?? ""}
                  onBlur={(e) => void run(async () => { await patch({ designation: e.target.value }); setEmployee((v) => (v ? { ...v, designation: e.target.value } : v)); }, "Saved.")}
                />
              </Field>
              <Field label="Department">
                <Select
                  placeholder="No department"
                  value={employee.department ?? ""}
                  onChange={(e) => {
                    const department = (e.target.value || null) as Department | null;
                    void run(async () => { await patch({ department }); setEmployee((v) => (v ? { ...v, department } : v)); }, "Saved.");
                  }}
                  options={DEPARTMENTS.map((d) => ({ value: d, label: DEPARTMENT_LABEL[d] }))}
                />
              </Field>
              <Field label="Location" hint="Office or site they're based at." className="col-span-2">
                <Input
                  defaultValue={employee.officeLocation ?? ""}
                  onBlur={(e) => void run(async () => { await patch({ officeLocation: e.target.value }); setEmployee((v) => (v ? { ...v, officeLocation: e.target.value } : v)); }, "Saved.")}
                />
              </Field>
              <Field label="Reports to" hint="Who approves this person's attendance corrections.">
                <Select
                  placeholder="No manager"
                  value={employee.managerId ?? ""}
                  onChange={(e) => {
                    const mgr = colleagues.find((c) => c.uid === e.target.value);
                    void run(async () => {
                      await patch({ managerId: mgr?.uid ?? null, managerName: mgr?.name ?? null });
                      setEmployee((v) => (v ? { ...v, managerId: mgr?.uid ?? null, managerName: mgr?.name ?? null } : v));
                    }, "Saved.");
                  }}
                  options={colleagues.filter((c) => c.uid !== employee.uid).map((c) => ({ value: c.uid, label: c.name }))}
                />
              </Field>
              <Field label="Employment type">
                <Select
                  placeholder="Not set"
                  value={employee.employmentType ?? ""}
                  onChange={(e) => {
                    const employmentType = (e.target.value || null) as EmploymentType | null;
                    void run(async () => { await patch({ employmentType }); setEmployee((v) => (v ? { ...v, employmentType } : v)); }, "Saved.");
                  }}
                  options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: EMPLOYMENT_TYPE_LABEL[t] }))}
                />
              </Field>
              <Field label="Roll status">
                <Select
                  placeholder="Not set"
                  value={employee.rollStatus ?? ""}
                  onChange={(e) => {
                    const rollStatus = (e.target.value || null) as RollStatus | null;
                    void run(async () => { await patch({ rollStatus }); setEmployee((v) => (v ? { ...v, rollStatus } : v)); }, "Saved.");
                  }}
                  options={ROLL_STATUSES.map((s) => ({ value: s, label: ROLL_STATUS_LABEL[s] }))}
                />
              </Field>
            </div>
          </Card>

          <Card title="Payroll">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monthly salary (₹)">
                <Input type="number" min={0} value={payrollForm.monthlySalary ?? employee.payroll?.monthlySalary ?? 0} onChange={(e) => setPayrollForm((f) => ({ ...f, ...employee.payroll, monthlySalary: Number(e.target.value) || 0 }))} />
              </Field>
              <Field label="TDS (%)">
                <Input type="number" min={0} max={100} step={0.1} value={payrollForm.tdsPercent ?? employee.payroll?.tdsPercent ?? 0} onChange={(e) => setPayrollForm((f) => ({ ...f, ...employee.payroll, tdsPercent: Number(e.target.value) || 0 }))} />
              </Field>
              <Field label="PAN"><Input defaultValue={employee.payroll?.panNumber ?? ""} onChange={(e) => setPayrollForm((f) => ({ ...f, ...employee.payroll, panNumber: e.target.value }))} /></Field>
              <Field label="Bank account no."><Input defaultValue={employee.payroll?.bankAccountNo ?? ""} onChange={(e) => setPayrollForm((f) => ({ ...f, ...employee.payroll, bankAccountNo: e.target.value }))} /></Field>
              <Field label="Bank name"><Input defaultValue={employee.payroll?.bankName ?? ""} onChange={(e) => setPayrollForm((f) => ({ ...f, ...employee.payroll, bankName: e.target.value }))} /></Field>
              <Field label="IFSC"><Input defaultValue={employee.payroll?.bankIfsc ?? ""} onChange={(e) => setPayrollForm((f) => ({ ...f, ...employee.payroll, bankIfsc: e.target.value }))} /></Field>
              <Field label="PF" className="col-span-2">
                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox label="PF applicable" checked={!!(payrollForm.pfApplicable ?? employee.payroll?.pfApplicable)} onChange={(v) => setPayrollForm((f) => ({ ...f, ...employee.payroll, pfApplicable: v }))} />
                  <Input placeholder="PF number" className="flex-1" defaultValue={employee.payroll?.pfNumber ?? ""} onChange={(e) => setPayrollForm((f) => ({ ...f, ...employee.payroll, pfNumber: e.target.value }))} />
                  <Input placeholder="UAN number" className="flex-1" defaultValue={employee.payroll?.uanNumber ?? ""} onChange={(e) => setPayrollForm((f) => ({ ...f, ...employee.payroll, uanNumber: e.target.value }))} />
                </div>
              </Field>
              <Field label="ESI" className="col-span-2">
                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox label="ESI applicable" checked={!!(payrollForm.esiApplicable ?? employee.payroll?.esiApplicable)} onChange={(v) => setPayrollForm((f) => ({ ...f, ...employee.payroll, esiApplicable: v }))} />
                  <Input placeholder="ESI number" className="flex-1" defaultValue={employee.payroll?.esiNumber ?? ""} onChange={(e) => setPayrollForm((f) => ({ ...f, ...employee.payroll, esiNumber: e.target.value }))} />
                </div>
              </Field>
            </div>
            <Button className="mt-3" loading={busy} onClick={() => void onSavePayroll()}><Landmark className="h-4 w-4" /> Save payroll</Button>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Manager</dt><dd>{manager?.name || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Monthly salary</dt><dd className="tabular-nums">{employee.payroll?.monthlySalary ? formatINR(employee.payroll.monthlySalary) : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Joined</dt><dd>{formatDate(employee.createdAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Status</dt><dd>{employee.active ? "Active" : "Deactivated"}</dd></div>
            </dl>
            <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-500">
              Sign-in role and activation are managed from <Link href="/users" className="text-brand-700 hover:underline">Settings → Team &amp; Roles</Link>.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
