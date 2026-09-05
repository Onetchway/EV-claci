"use client";

/**
 * Individual employee detail page — the NAKJM-style consolidation of the
 * old Employees list's two popup modals ("Manage" and "Salary") into one
 * page, plus an all-new KYC Documents card. Follows NAKJM CRM's
 * (nakjm-crm/src/app/(app)/employees/[uid]/page.tsx) page SHAPE — a header
 * card, a 2-column body (main content left, a Summary sidebar right), and
 * every field inline-editable directly on the page (Field+Input/Select with
 * onBlur/onChange calling a patch() helper and optimistically updating
 * local state) rather than collected into a form behind one Save button —
 * NOT its field set, which is NAKJM's own smaller product.
 *
 * This is an HR/management lookup page (gated by canManageHrms, same as the
 * Employees list), not employee self-service — a plain employee keeps using
 * "My Payslips" for their own record.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, FileText, IndianRupee, Landmark, Printer, Sparkles, Trash2, Upload, UserX,
} from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, Checkbox, EmptyState, Field, Input, Select, Spinner, useAsyncAction, useToast,
} from "@/components/ui";
import {
  EMPLOYEE_DOC_KINDS, EMPLOYEE_DOC_KIND_LABEL, MONTH_LABEL, PAYSLIP_STATUS_COLOR, PAYSLIP_STATUS_LABEL,
  ROLE_LABEL, type EmployeeDocKind,
} from "@/lib/constants";
import { subscribeDepartments } from "@/lib/db/departments";
import {
  deleteEmployeeDocument, subscribeEmployeeDocuments, uploadEmployeeDocument, validateFile,
} from "@/lib/db/employee-documents";
import { subscribeOfficeLocations } from "@/lib/db/office-locations";
import { getPayrollProfile, setPayrollProfile, splitCtcMonthly, type PayrollProfileDraft } from "@/lib/db/payroll";
import { subscribePayslips } from "@/lib/db/payroll";
import { subscribeUsers } from "@/lib/db/users";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { computeMonthlyTdsFromAnnualCtc } from "@/lib/payroll-tax";
import { canManageHrms, canManagePayroll, isAdmin, isSuperAdmin } from "@/lib/permissions";
import type { AppUser, Department, EmployeeDocument, OfficeLocation, Payslip } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

function emptySalaryForm(): PayrollProfileDraft {
  return {
    panNo: "", uanNo: "", pfNo: "", esiNo: "",
    bankAccountName: "", bankName: "", bankAccountNo: "", bankIfsc: "",
    dateOfJoining: null,
    ctc: 0, basic: 0, hra: 0, ta: 0, others: 0, misc: 0,
    epfEmployeePct: 12, epfEmployerAmount: undefined, esicEmployeePct: 0, esicEmployerAmount: 0,
    tdsMonthly: 0, gratuityMonthly: 0, bonusMonthly: 0, healthMonthly: 0,
    active: true,
  };
}

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
  const { profile, role, actor } = useAuth();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();
  const { push } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [employee, setEmployee] = useState<AppUser | null | undefined>(undefined);
  const [colleagues, setColleagues] = useState<AppUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [offices, setOffices] = useState<OfficeLocation[]>([]);

  const [salaryForm, setSalaryForm] = useState<PayrollProfileDraft>(emptySalaryForm());
  const [salaryLoading, setSalaryLoading] = useState(true);

  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [docKind, setDocKind] = useState<EmployeeDocKind>("AADHAAR");
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [payslipsLoading, setPayslipsLoading] = useState(true);

  const canView = canManageHrms(viewer);
  const canEdit = !!role && isAdmin(role);
  const canDelete = !!role && isSuperAdmin(role);
  const canSalary = canManagePayroll(viewer);

  useEffect(() => {
    if (!canView) return;
    return subscribeUsers((rows) => {
      setColleagues(rows);
      setEmployee(rows.find((u) => u.uid === uid) ?? null);
    });
  }, [uid, canView]);
  useEffect(() => {
    if (!canView) return;
    return subscribeDepartments(setDepartments);
  }, [canView]);
  useEffect(() => {
    if (!canView) return;
    return subscribeOfficeLocations(setOffices);
  }, [canView]);

  useEffect(() => {
    if (!canView || !canSalary) { setSalaryLoading(false); return; }
    setSalaryLoading(true);
    void getPayrollProfile(uid).then((profileDoc) => {
      setSalaryForm(
        profileDoc
          ? {
              panNo: profileDoc.panNo ?? "", uanNo: profileDoc.uanNo ?? "", pfNo: profileDoc.pfNo ?? "", esiNo: profileDoc.esiNo ?? "",
              bankAccountName: profileDoc.bankAccountName ?? "", bankName: profileDoc.bankName ?? "",
              bankAccountNo: profileDoc.bankAccountNo ?? "", bankIfsc: profileDoc.bankIfsc ?? "",
              dateOfJoining: profileDoc.dateOfJoining?.toDate?.() ?? null,
              ctc: profileDoc.ctc, basic: profileDoc.basic, hra: profileDoc.hra, ta: profileDoc.ta, others: profileDoc.others, misc: profileDoc.misc ?? 0,
              epfEmployeePct: profileDoc.epfEmployeePct ?? 12, epfEmployerAmount: profileDoc.epfEmployerAmount ?? undefined,
              esicEmployeePct: profileDoc.esicEmployeePct ?? 0, esicEmployerAmount: profileDoc.esicEmployerAmount ?? 0,
              tdsMonthly: profileDoc.tdsMonthly ?? 0, gratuityMonthly: profileDoc.gratuityMonthly ?? 0,
              bonusMonthly: profileDoc.bonusMonthly ?? 0, healthMonthly: profileDoc.healthMonthly ?? 0,
              active: profileDoc.active,
            }
          : emptySalaryForm(),
      );
      setSalaryLoading(false);
    });
  }, [uid, canView, canSalary]);

  useEffect(() => {
    if (!canView || !canSalary) return;
    return subscribeEmployeeDocuments(uid, setDocs);
  }, [uid, canView, canSalary]);

  useEffect(() => {
    if (!canView) return;
    setPayslipsLoading(true);
    return subscribePayslips({ uid }, (rows) => { setPayslips(rows); setPayslipsLoading(false); }, () => setPayslipsLoading(false));
  }, [uid, canView]);

  if (!canView) {
    return (
      <EmptyState
        title="HR / management access only"
        description="Employee records are visible to Admins, HR and managers only."
        action={<Link href="/dashboard"><Button>Back to dashboard</Button></Link>}
      />
    );
  }

  if (employee === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (employee === null) return <EmptyState title="Employee not found" action={<Link href="/employees"><Button>Back to employees</Button></Link>} />;

  async function patch(body: Record<string, unknown>) {
    await authedFetch(`/api/users/${uid}`, { method: "PATCH", body: JSON.stringify(body) });
  }

  async function saveSalary(patchFields: Partial<PayrollProfileDraft>) {
    const next = { ...salaryForm, ...patchFields };
    setSalaryForm(next);
    if (!actor) return;
    await setPayrollProfile(uid, employee!.name, next, actor);
  }

  async function onFileChosen(file: File | undefined) {
    if (!file || !actor) return;
    const problem = validateFile(file);
    if (problem) { push(problem, "error"); if (fileInputRef.current) fileInputRef.current.value = ""; return; }
    await run(async () => {
      setUploadPct(0);
      try {
        await uploadEmployeeDocument(uid, file, { kind: docKind, onProgress: setUploadPct }, actor);
      } finally {
        setUploadPct(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }, "Document uploaded.");
  }

  const manager = employee.managerId ? colleagues.find((c) => c.uid === employee.managerId) : null;
  const reports = colleagues.filter((c) => c.managerId === employee!.uid && !c.deletedAt);
  const roles = employee.roles?.length ? employee.roles : [employee.role];

  return (
    <div className="space-y-5">
      <Link href="/employees" className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Employees
      </Link>

      <div className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">{employee.name}</h1>
            <p className="text-sm text-ink-500">{employee.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {roles.map((r) => <Badge key={r}>{ROLE_LABEL[r]}</Badge>)}
            <Badge className={employee.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}>
              {employee.active ? "Active" : "Deactivated"}
            </Badge>
            {employee.employeeCode && <Badge className="bg-ink-100 text-ink-700 ring-ink-200">{employee.employeeCode}</Badge>}
          </div>
        </div>

        {(canEdit || canDelete) && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-200 pt-3">
            {canEdit && (
              <Button
                size="sm"
                variant={employee.active ? "danger" : "primary"}
                loading={busy}
                disabled={employee.uid === profile?.uid}
                onClick={() =>
                  void run(async () => {
                    const active = !employee.active;
                    await patch({ active });
                    setEmployee((e) => (e ? { ...e, active } : e));
                  }, "Access updated.")
                }
              >
                <UserX className="h-3.5 w-3.5" /> {employee.active ? "Deactivate account" : "Reactivate account"}
              </Button>
            )}
            {canDelete && employee.uid !== profile?.uid && (
              <Button
                size="sm"
                variant="danger"
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    if (!window.confirm(`Delete ${employee.name}'s account? They will no longer be able to sign in.`)) return;
                    await authedFetch(`/api/users/${uid}`, { method: "DELETE" });
                  }, "Employee deleted.")
                }
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete account
              </Button>
            )}
            {employee.uid === profile?.uid && <p className="self-center text-xs text-ink-500">You cannot deactivate or delete your own account.</p>}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* --------------------------------------------------- Role & details */}
          <Card title="Role & details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <Input
                  disabled={!canEdit}
                  defaultValue={employee.phone ?? ""}
                  onBlur={(e) => void run(async () => { await patch({ phone: e.target.value }); setEmployee((v) => (v ? { ...v, phone: e.target.value } : v)); }, "Saved.")}
                />
              </Field>

              <Field label="Designation" hint="Job title, shown in the directory.">
                <Input
                  disabled={!canEdit}
                  defaultValue={employee.designation ?? ""}
                  onBlur={(e) => void run(async () => { await patch({ designation: e.target.value }); setEmployee((v) => (v ? { ...v, designation: e.target.value } : v)); }, "Saved.")}
                />
              </Field>

              <Field label="Employee ID" hint="Auto-assigned for new hires (LG-EMP-00001 style) — printed on their payslip." className="col-span-2">
                <div className="flex gap-2">
                  <Input
                    disabled={!canEdit}
                    defaultValue={employee.employeeCode ?? ""}
                    onBlur={(e) => void run(async () => { await patch({ employeeCode: e.target.value.trim() || null }); setEmployee((v) => (v ? { ...v, employeeCode: e.target.value.trim() || null } : v)); }, "Saved.")}
                    className="flex-1"
                  />
                  {canEdit && !employee.employeeCode && (
                    <Button
                      type="button"
                      onClick={() => void run(() => patch({ generateEmployeeCode: true }), "Employee ID generated.")}
                    >
                      Generate
                    </Button>
                  )}
                </div>
              </Field>

              <Field label="Department" hint={departments.length ? undefined : "None created yet — use the Departments button on the directory page."}>
                <Select
                  disabled={!canEdit}
                  placeholder="No department"
                  value={employee.departmentId ?? ""}
                  onChange={(e) =>
                    void run(async () => {
                      const departmentId = e.target.value || null;
                      await patch({ departmentId });
                      setEmployee((v) => (v ? { ...v, departmentId } : v));
                    }, "Saved.")
                  }
                  options={departments.map((d) => ({ value: d.id, label: d.name }))}
                />
              </Field>

              <Field label="Location" hint="Office they're based at — also drives attendance geofencing.">
                <Select
                  disabled={!canEdit}
                  placeholder="No location"
                  value={employee.officeLocationId ?? ""}
                  onChange={(e) =>
                    void run(async () => {
                      const officeLocationId = e.target.value || null;
                      await patch({ officeLocationId });
                      setEmployee((v) => (v ? { ...v, officeLocationId } : v));
                    }, "Saved.")
                  }
                  options={offices.map((o) => ({ value: o.id, label: o.name }))}
                />
              </Field>

              <Field label="Reports to" hint="Who approves this person's leave/attendance requests." className="col-span-2">
                <Select
                  disabled={!canEdit}
                  placeholder="No manager"
                  value={employee.managerId ?? ""}
                  onChange={(e) =>
                    void run(async () => {
                      const managerId = e.target.value || null;
                      await patch({ managerId });
                      setEmployee((v) => (v ? { ...v, managerId } : v));
                    }, "Saved.")
                  }
                  options={colleagues.filter((c) => c.uid !== employee.uid).map((c) => ({ value: c.uid, label: c.name }))}
                />
              </Field>

              {reports.length > 0 && (
                <Field label={`Direct reports (${reports.length})`} className="col-span-2">
                  <div className="flex flex-wrap gap-1.5">
                    {reports.map((r) => (
                      <Link key={r.uid} href={`/employees/${r.uid}`}>
                        <Badge className="bg-ink-100 text-ink-700 ring-ink-200 hover:bg-ink-200">{r.name}</Badge>
                      </Link>
                    ))}
                  </div>
                </Field>
              )}
            </div>

            <p className="mt-3 text-xs text-ink-500">
              Roles, activation and per-user access overrides are managed from <Link href="/users" className="text-brand-700 hover:underline">Settings → Team &amp; Roles</Link>.
            </p>
          </Card>

          {/* -------------------------------------------------------- Salary & TDS */}
          {canSalary && (
            <Card
              title="Salary & TDS"
              subtitle="Salary structure, statutory numbers, bank details and payroll settings. Visible to Finance/Admin only — this feeds monthly payslip generation."
            >
              {salaryLoading ? (
                <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Salary structure (₹) — CTC is annual, everything below it is monthly</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field
                        label="CTC (target, annual)"
                        hint="The usual yearly package figure — not printed as-is on a payslip, see the payslip's own computed CTC."
                        className="sm:col-span-3"
                      >
                        <div className="flex gap-2">
                          <Input
                            type="number" min={0} className="flex-1"
                            defaultValue={salaryForm.ctc}
                            onBlur={(e) => void run(() => saveSalary({ ctc: Number(e.target.value) || 0 }), "Saved.")}
                          />
                          <Button
                            type="button"
                            onClick={() =>
                              void run(() => saveSalary({ ...splitCtcMonthly(salaryForm.ctc), tdsMonthly: computeMonthlyTdsFromAnnualCtc(salaryForm.ctc) }), "Auto-filled from CTC.")
                            }
                          >
                            <Sparkles className="h-3.5 w-3.5" /> Auto-fill from CTC
                          </Button>
                        </div>
                      </Field>
                      <Field label="Basic"><Input type="number" min={0} defaultValue={salaryForm.basic} onBlur={(e) => void run(() => saveSalary({ basic: Number(e.target.value) || 0 }), "Saved.")} /></Field>
                      <Field label="HRA"><Input type="number" min={0} defaultValue={salaryForm.hra} onBlur={(e) => void run(() => saveSalary({ hra: Number(e.target.value) || 0 }), "Saved.")} /></Field>
                      <Field label="TA"><Input type="number" min={0} defaultValue={salaryForm.ta} onBlur={(e) => void run(() => saveSalary({ ta: Number(e.target.value) || 0 }), "Saved.")} /></Field>
                      <Field label="Others / allowances"><Input type="number" min={0} defaultValue={salaryForm.others} onBlur={(e) => void run(() => saveSalary({ others: Number(e.target.value) || 0 }), "Saved.")} /></Field>
                      <Field label="Misc"><Input type="number" min={0} defaultValue={salaryForm.misc ?? 0} onBlur={(e) => void run(() => saveSalary({ misc: Number(e.target.value) || 0 }), "Saved.")} /></Field>
                    </div>
                    <p className="mt-2 text-xs text-ink-500">
                      Auto-fill splits CTC as Basic 50% / HRA 25% / TA 10% / Others 10% / Misc 5%, and estimates TDS below from the New Tax Regime slabs — a one-time convenience fill. Every field stays freely editable afterward; re-click to re-apply it.
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Statutory numbers</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="PAN No."><Input defaultValue={salaryForm.panNo} onBlur={(e) => void run(() => saveSalary({ panNo: e.target.value.toUpperCase() }), "Saved.")} /></Field>
                      <Field label="UAN No."><Input defaultValue={salaryForm.uanNo} onBlur={(e) => void run(() => saveSalary({ uanNo: e.target.value }), "Saved.")} /></Field>
                      <Field label="PF No."><Input defaultValue={salaryForm.pfNo} onBlur={(e) => void run(() => saveSalary({ pfNo: e.target.value }), "Saved.")} /></Field>
                      <Field label="E.S.I No."><Input defaultValue={salaryForm.esiNo} onBlur={(e) => void run(() => saveSalary({ esiNo: e.target.value }), "Saved.")} /></Field>
                      <Field label="Date of joining">
                        <Input
                          type="date"
                          defaultValue={salaryForm.dateOfJoining ? salaryForm.dateOfJoining.toISOString().slice(0, 10) : ""}
                          onBlur={(e) => void run(() => saveSalary({ dateOfJoining: e.target.value ? new Date(e.target.value) : null }), "Saved.")}
                        />
                      </Field>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Bank details (salary account)</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Account holder name"><Input defaultValue={salaryForm.bankAccountName} onBlur={(e) => void run(() => saveSalary({ bankAccountName: e.target.value }), "Saved.")} /></Field>
                      <Field label="Bank name"><Input defaultValue={salaryForm.bankName} onBlur={(e) => void run(() => saveSalary({ bankName: e.target.value }), "Saved.")} /></Field>
                      <Field label="Account No."><Input defaultValue={salaryForm.bankAccountNo} onBlur={(e) => void run(() => saveSalary({ bankAccountNo: e.target.value }), "Saved.")} /></Field>
                      <Field label="IFSC"><Input defaultValue={salaryForm.bankIfsc} onBlur={(e) => void run(() => saveSalary({ bankIfsc: e.target.value.toUpperCase() }), "Saved.")} /></Field>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Deductions &amp; employer contributions</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="EPF — employee %" hint="Applied to Basic, capped at the ₹15,000 PF wage ceiling. Defaults to 12%.">
                        <Input type="number" min={0} max={100} defaultValue={salaryForm.epfEmployeePct ?? 12} onBlur={(e) => void run(() => saveSalary({ epfEmployeePct: Number(e.target.value) || 0 }), "Saved.")} />
                      </Field>
                      <Field label="EPF — employer amount (₹)" hint="Leave blank to mirror the employee's EPF deduction.">
                        <Input type="number" min={0} defaultValue={salaryForm.epfEmployerAmount ?? ""} onBlur={(e) => void run(() => saveSalary({ epfEmployerAmount: e.target.value === "" ? undefined : Number(e.target.value) }), "Saved.")} />
                      </Field>
                      <Field label="ESIC — employee %" hint="0 = not ESIC-applicable.">
                        <Input type="number" min={0} max={100} defaultValue={salaryForm.esicEmployeePct ?? 0} onBlur={(e) => void run(() => saveSalary({ esicEmployeePct: Number(e.target.value) || 0 }), "Saved.")} />
                      </Field>
                      <Field label="ESIC — employer amount (₹)"><Input type="number" min={0} defaultValue={salaryForm.esicEmployerAmount ?? 0} onBlur={(e) => void run(() => saveSalary({ esicEmployerAmount: Number(e.target.value) || 0 }), "Saved.")} /></Field>
                      <Field label="TDS (₹/month)" hint="Auto-filled from CTC using New Tax Regime slabs — always editable per payslip before finalizing.">
                        <Input type="number" min={0} defaultValue={salaryForm.tdsMonthly ?? 0} onBlur={(e) => void run(() => saveSalary({ tdsMonthly: Number(e.target.value) || 0 }), "Saved.")} />
                      </Field>
                      <Field label="Gratuity (₹/month)"><Input type="number" min={0} defaultValue={salaryForm.gratuityMonthly ?? 0} onBlur={(e) => void run(() => saveSalary({ gratuityMonthly: Number(e.target.value) || 0 }), "Saved.")} /></Field>
                      <Field label="Bonus (₹/month)"><Input type="number" min={0} defaultValue={salaryForm.bonusMonthly ?? 0} onBlur={(e) => void run(() => saveSalary({ bonusMonthly: Number(e.target.value) || 0 }), "Saved.")} /></Field>
                      <Field label="Health (₹/month)"><Input type="number" min={0} defaultValue={salaryForm.healthMonthly ?? 0} onBlur={(e) => void run(() => saveSalary({ healthMonthly: Number(e.target.value) || 0 }), "Saved.")} /></Field>
                    </div>
                  </div>

                  <Checkbox
                    checked={salaryForm.active}
                    onChange={(v) => void run(() => saveSalary({ active: v }), "Saved.")}
                    label="Active — included in payroll generation"
                  />
                </div>
              )}
            </Card>
          )}

          {/* --------------------------------------------------- KYC Documents */}
          {canSalary && (
            <Card
              title="KYC Documents"
              subtitle="On-file identity, address and employment paperwork. Visible to Finance/Admin only, and to this employee for their own record."
            >
              <div className="mb-4 flex flex-wrap items-end gap-2">
                <Field label="Document type" className="w-56">
                  <Select
                    value={docKind}
                    onChange={(e) => setDocKind(e.target.value as EmployeeDocKind)}
                    options={EMPLOYEE_DOC_KINDS.map((k) => ({ value: k, label: EMPLOYEE_DOC_KIND_LABEL[k] }))}
                  />
                </Field>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp,image/heic"
                  onChange={(e) => void onFileChosen(e.target.files?.[0])}
                  className="hidden"
                  id="employee-doc-upload"
                />
                <Button type="button" loading={busy && uploadPct !== null} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> Upload {uploadPct !== null ? `(${uploadPct}%)` : ""}
                </Button>
                <p className="text-xs text-ink-500">PDF, JPG, PNG, WEBP or HEIC — up to 15 MB.</p>
              </div>

              <ul className="divide-y divide-ink-100">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                    <a href={d.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 hover:underline">
                      <FileText className="h-4 w-4 shrink-0 text-ink-400" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink-900">{d.fileName}</span>
                        <span className="block text-xs text-ink-500">{EMPLOYEE_DOC_KIND_LABEL[d.kind]} · {formatDate(d.uploadedAt)}</span>
                      </span>
                    </a>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          if (!actor) return;
                          if (!window.confirm(`Delete "${d.fileName}"?`)) return;
                          await deleteEmployeeDocument(d, actor);
                        }, "Document deleted.")
                      }
                      className="shrink-0 rounded px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
                {docs.length === 0 && <li className="py-8 text-center text-sm text-ink-400">No documents uploaded yet.</li>}
              </ul>
            </Card>
          )}

          {/* ----------------------------------------------------------- Payslips */}
          <Card title="Payslips" subtitle="This employee's payslip history across every month generated so far.">
            {payslipsLoading ? (
              <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full">
                  <thead className="border-b border-ink-200">
                    <tr>
                      <th className="th">Payslip</th>
                      <th className="th">Month</th>
                      <th className="th text-right">Net pay</th>
                      <th className="th">Status</th>
                      <th className="th" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {payslips.map((p) => (
                      <tr key={p.id} className="hover:bg-ink-50">
                        <td className="td font-medium text-ink-900">{p.number}</td>
                        <td className="td">{MONTH_LABEL[p.month - 1]} {p.year}</td>
                        <td className="td text-right tabular-nums">{formatINR(p.netPay)}</td>
                        <td className="td"><Badge className={PAYSLIP_STATUS_COLOR[p.status]}>{PAYSLIP_STATUS_LABEL[p.status]}</Badge></td>
                        <td className="td text-right">
                          <Link href={`/payroll/${p.id}`}>
                            <Button size="sm"><Printer className="h-3.5 w-3.5" /> View</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {payslips.length === 0 && (
                      <tr>
                        <td colSpan={5} className="td py-10 text-center text-ink-400">No payslips generated for this employee yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Manager</dt><dd>{manager?.name || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Direct reports</dt><dd>{reports.length || "—"}</dd></div>
              {canSalary && (
                <div className="flex justify-between">
                  <dt className="flex items-center gap-1 text-ink-500"><IndianRupee className="h-3.5 w-3.5" /> CTC (annual)</dt>
                  <dd className="tabular-nums">{salaryForm.ctc ? formatINR(salaryForm.ctc) : "—"}</dd>
                </div>
              )}
              {canSalary && (
                <div className="flex justify-between">
                  <dt className="flex items-center gap-1 text-ink-500"><Landmark className="h-3.5 w-3.5" /> Date of joining</dt>
                  <dd>{salaryForm.dateOfJoining ? salaryForm.dateOfJoining.toLocaleDateString() : "—"}</dd>
                </div>
              )}
              <div className="flex justify-between"><dt className="text-ink-500">Joined CRM</dt><dd>{formatDate(employee.createdAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Status</dt><dd>{employee.active ? "Active" : "Deactivated"}</dd></div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
