"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, IndianRupee, MapPin, Plus, Settings2, Sparkles, Trash2, UserPlus } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Avatar, Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader,
  Select, Spinner, StatCard, useAsyncAction, useToast,
} from "@/components/ui";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/constants";
import { subscribeDepartments } from "@/lib/db/departments";
import { subscribeOfficeLocations } from "@/lib/db/office-locations";
import { getPayrollProfile, setPayrollProfile, splitCtcMonthly, type PayrollProfileDraft } from "@/lib/db/payroll";
import { subscribeUsers } from "@/lib/db/users";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { canAssignRole, canManageHrms, canManagePayroll, canSeeAllHrms, isAdmin, isSuperAdmin } from "@/lib/permissions";
import type { AppUser, Department, OfficeLocation } from "@/lib/types";
import { computeMonthlyTdsFromAnnualCtc } from "@/lib/payroll-tax";

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
  const body = (await res.json().catch(() => ({}))) as { error?: string; temporaryPassword?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
  return body;
}

export default function EmployeesPage() {
  const { profile, role, actor } = useAuth();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();
  const viewer = useViewer();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [offices, setOffices] = useState<OfficeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [deptManagerOpen, setDeptManagerOpen] = useState(false);
  const [newDept, setNewDept] = useState("");
  const [salaryEditing, setSalaryEditing] = useState<AppUser | null>(null);
  const [salaryForm, setSalaryForm] = useState<PayrollProfileDraft>(emptySalaryForm());
  const [salaryLoading, setSalaryLoading] = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", role: "AGENT" as Role, designation: "",
    departmentId: "", officeLocationId: "", managerId: "", password: "",
  });

  const canView = canManageHrms(viewer);
  const canEdit = !!role && isAdmin(role);
  const canDelete = !!role && isSuperAdmin(role);
  const canSalary = canManagePayroll(viewer);
  const seeAll = canSeeAllHrms(viewer);

  useEffect(() => {
    if (!canView) return;
    return subscribeUsers((rows) => { setUsers(rows); setLoading(false); }, () => setLoading(false));
  }, [canView]);
  useEffect(() => {
    if (!canView) return;
    return subscribeDepartments(setDepartments);
  }, [canView]);
  useEffect(() => {
    if (!canView) return;
    return subscribeOfficeLocations(setOffices);
  }, [canView]);

  if (!canView) {
    return (
      <EmptyState
        title="HR / management access only"
        description="Employee records are visible to Admins, HR and managers only."
        action={<Link href="/dashboard"><Button>Back to dashboard</Button></Link>}
      />
    );
  }

  async function patchUser(uid: string, patch: Record<string, unknown>) {
    await authedFetch(`/api/users/${uid}`, { method: "PATCH", body: JSON.stringify(patch) });
  }

  async function createEmployee() {
    if (!form.name.trim() || !form.email.trim()) throw new Error("Name and email are required.");
    const body = await authedFetch("/api/users", {
      method: "POST",
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        roles: [form.role],
        designation: form.designation.trim(),
        departmentId: form.departmentId || null,
        officeLocationId: form.officeLocationId || null,
        managerId: form.managerId || null,
        password: form.password || undefined,
      }),
    });
    setCreateOpen(false);
    setForm({ name: "", email: "", phone: "", role: "AGENT", designation: "", departmentId: "", officeLocationId: "", managerId: "", password: "" });
    if (body.temporaryPassword) setTempPassword(body.temporaryPassword);
  }

  async function deleteEmployee(uid: string) {
    await authedFetch(`/api/users/${uid}`, { method: "DELETE" });
  }

  async function openSalary(u: AppUser) {
    setSalaryEditing(u);
    setSalaryLoading(true);
    try {
      const profile = await getPayrollProfile(u.uid);
      setSalaryForm(
        profile
          ? {
              panNo: profile.panNo ?? "", uanNo: profile.uanNo ?? "", pfNo: profile.pfNo ?? "", esiNo: profile.esiNo ?? "",
              bankAccountName: profile.bankAccountName ?? "", bankName: profile.bankName ?? "",
              bankAccountNo: profile.bankAccountNo ?? "", bankIfsc: profile.bankIfsc ?? "",
              dateOfJoining: profile.dateOfJoining?.toDate?.() ?? null,
              ctc: profile.ctc, basic: profile.basic, hra: profile.hra, ta: profile.ta, others: profile.others, misc: profile.misc ?? 0,
              epfEmployeePct: profile.epfEmployeePct ?? 12, epfEmployerAmount: profile.epfEmployerAmount ?? undefined,
              esicEmployeePct: profile.esicEmployeePct ?? 0, esicEmployerAmount: profile.esicEmployerAmount ?? 0,
              tdsMonthly: profile.tdsMonthly ?? 0, gratuityMonthly: profile.gratuityMonthly ?? 0,
              bonusMonthly: profile.bonusMonthly ?? 0, healthMonthly: profile.healthMonthly ?? 0,
              active: profile.active,
            }
          : emptySalaryForm(),
      );
    } finally {
      setSalaryLoading(false);
    }
  }

  async function saveSalary() {
    if (!salaryEditing || !actor) return;
    await setPayrollProfile(salaryEditing.uid, salaryEditing.name, salaryForm, actor);
  }

  const activeUsers = users.filter((u) => !u.deletedAt);
  const visible = seeAll
    ? activeUsers
    : activeUsers.filter((u) => u.uid === profile?.uid || u.managerId === profile?.uid);

  const departmentName = (id?: string | null) => departments.find((d) => d.id === id)?.name || "—";
  const officeName = (id?: string | null) => offices.find((o) => o.id === id)?.name || "—";

  const counts = {
    total: visible.length,
    withManager: visible.filter((u) => u.managerId).length,
    withDesignation: visible.filter((u) => u.designation).length,
    departments: departments.length,
  };

  return (
    <>
      <PageHeader
        title="Employees"
        description="Job title, department, work location and reporting manager for every employee — this is what routes leave and attendance approvals."
        actions={
          canEdit && (
            <div className="flex gap-2">
              <Button onClick={() => setDeptManagerOpen(true)}>
                <Settings2 className="h-4 w-4" /> Departments
              </Button>
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <UserPlus className="h-4 w-4" /> Add employee
              </Button>
            </div>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={seeAll ? "Total employees" : "Your team"} value={counts.total} />
        <StatCard label="With a manager set" value={counts.withManager} />
        <StatCard label="With a designation" value={counts.withDesignation} />
        <StatCard label="Departments" value={counts.departments} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : (
        <Card title="Directory">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Employee</th>
                  <th className="th">Designation</th>
                  <th className="th">Department</th>
                  <th className="th">Location</th>
                  <th className="th">Reports to</th>
                  <th className="th text-right">Direct reports</th>
                  <th className="th">Phone</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {visible.map((u) => {
                  const manager = u.managerId ? users.find((m) => m.uid === u.managerId) : null;
                  const reportCount = activeUsers.filter((x) => x.managerId === u.uid).length;
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
                      <td className="td text-ink-600">{departmentName(u.departmentId)}</td>
                      <td className="td text-ink-600">{officeName(u.officeLocationId)}</td>
                      <td className="td text-ink-600">{manager?.name || "—"}</td>
                      <td className="td text-right tabular-nums">{reportCount || "—"}</td>
                      <td className="td text-ink-600">{u.phone || "—"}</td>
                      <td className="td text-right">
                        <div className="flex justify-end gap-1">
                          {canEdit && (
                            <button
                              onClick={() => setEditing(u)}
                              className="rounded px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100"
                            >
                              Manage
                            </button>
                          )}
                          {canSalary && (
                            <button
                              onClick={() => void openSalary(u)}
                              className="rounded px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100"
                              title="Salary structure, statutory numbers and bank details"
                            >
                              <span className="inline-flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Salary</span>
                            </button>
                          )}
                          {canDelete && u.uid !== profile?.uid && (
                            <button
                              onClick={() => setDeleteTarget(u)}
                              className="rounded px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                              title="Delete this person's account"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={8} className="td py-10 text-center text-ink-400">No employees to show.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add employee"
        description="Creates a sign-in account and their HR profile — designation, department, location and reporting manager."
        footer={
          <>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void run(createEmployee, "Employee created.")}>
              <Plus className="h-4 w-4" /> Create employee
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Work email" required>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Role" required hint="Fine-grained access is managed from Settings → Team & Roles.">
            <Select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              options={ROLES.filter((r) => canAssignRole(viewer, r)).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
            />
          </Field>
          <Field label="Designation" hint="Job title, e.g. Sales Manager - North.">
            <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
          </Field>
          <Field label="Department" hint={departments.length ? undefined : "None created yet — use the Departments button above."}>
            <Select
              placeholder="No department"
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
          </Field>
          <Field label="Location" hint="Office they're based at — also drives attendance geofencing.">
            <Select
              placeholder="No location"
              value={form.officeLocationId}
              onChange={(e) => setForm({ ...form, officeLocationId: e.target.value })}
              options={offices.map((o) => ({ value: o.id, label: o.name }))}
            />
          </Field>
          <Field label="Reports to">
            <Select
              placeholder="No manager"
              value={form.managerId}
              onChange={(e) => setForm({ ...form, managerId: e.target.value })}
              options={activeUsers.map((u) => ({ value: u.uid, label: u.name }))}
            />
          </Field>
          <Field label="Password" className="sm:col-span-2" hint="Leave blank to generate one automatically.">
            <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Manage ${editing.name}` : ""}
        footer={<Button onClick={() => setEditing(null)}>Done</Button>}
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Phone">
              <Input
                defaultValue={editing.phone ?? ""}
                onBlur={(e) => void run(() => patchUser(editing.uid, { phone: e.target.value }), "Saved.")}
              />
            </Field>

            <Field label="Designation" hint="Job title, shown in the directory.">
              <Input
                defaultValue={editing.designation ?? ""}
                onBlur={(e) => void run(() => patchUser(editing.uid, { designation: e.target.value }), "Saved.")}
              />
            </Field>

            <Field label="Employee ID" hint="Auto-assigned for new hires (LG-EMP-00001 style) — printed on their payslip. Edit by hand any time, or generate one now if this employee predates auto-assignment.">
              <div className="flex gap-2">
                <Input
                  defaultValue={editing.employeeCode ?? ""}
                  onBlur={(e) => void run(() => patchUser(editing.uid, { employeeCode: e.target.value.trim() || null }), "Saved.")}
                  className="flex-1"
                />
                {!editing.employeeCode && (
                  <Button type="button" onClick={() => void run(() => patchUser(editing.uid, { generateEmployeeCode: true }), "Employee ID generated.")}>
                    Generate
                  </Button>
                )}
              </div>
            </Field>

            <Field label="Department" hint={departments.length ? undefined : "None created yet — use the Departments button on the directory page."}>
              <Select
                placeholder="No department"
                value={editing.departmentId ?? ""}
                onChange={(e) =>
                  void run(async () => {
                    const departmentId = e.target.value || null;
                    await patchUser(editing.uid, { departmentId });
                    setEditing({ ...editing, departmentId });
                  }, "Saved.")
                }
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Field>

            <Field label="Location" hint="Office they're based at — also drives attendance geofencing.">
              <Select
                placeholder="No location"
                value={editing.officeLocationId ?? ""}
                onChange={(e) =>
                  void run(async () => {
                    const officeLocationId = e.target.value || null;
                    await patchUser(editing.uid, { officeLocationId });
                    setEditing({ ...editing, officeLocationId });
                  }, "Saved.")
                }
                options={offices.map((o) => ({ value: o.id, label: o.name }))}
              />
            </Field>

            <Field label="Reports to" hint="Who approves this person's leave/attendance requests.">
              <Select
                placeholder="No manager"
                value={editing.managerId ?? ""}
                onChange={(e) =>
                  void run(async () => {
                    const managerId = e.target.value || null;
                    await patchUser(editing.uid, { managerId });
                    setEditing({ ...editing, managerId });
                  }, "Saved.")
                }
                options={activeUsers.filter((u) => u.uid !== editing.uid).map((u) => ({ value: u.uid, label: u.name }))}
              />
            </Field>

            {(() => {
              const reports = activeUsers.filter((u) => u.managerId === editing.uid);
              return reports.length > 0 ? (
                <Field label={`Direct reports (${reports.length})`} hint="Who currently reports to this person.">
                  <div className="flex flex-wrap gap-1.5">
                    {reports.map((u) => (
                      <Badge key={u.uid} className="bg-ink-100 text-ink-700 ring-ink-200">{u.name}</Badge>
                    ))}
                  </div>
                </Field>
              ) : null;
            })()}

            <p className="flex items-center gap-1.5 text-xs text-ink-500">
              <Building2 className="h-3.5 w-3.5" /> Role and access are managed from Settings → Team & Roles.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={deptManagerOpen}
        onClose={() => setDeptManagerOpen(false)}
        title="Departments"
        description="A shared list every employee's Department field picks from — add or remove one below."
        footer={<Button onClick={() => setDeptManagerOpen(false)}>Done</Button>}
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Sales, Operations, Finance"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
            />
            <Button
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!newDept.trim()) return;
                  await authedFetch("/api/departments", { method: "POST", body: JSON.stringify({ name: newDept.trim() }) });
                  setNewDept("");
                }, "Department added.")
              }
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
          <ul className="divide-y divide-ink-100">
            {departments.map((d) => {
              const inUse = activeUsers.filter((u) => u.departmentId === d.id).length;
              return (
                <li key={d.id} className="flex items-center justify-between py-2">
                  <span className="text-sm text-ink-800">
                    {d.name}
                    {inUse > 0 && <span className="ml-2 text-xs text-ink-500">({inUse} employee{inUse === 1 ? "" : "s"})</span>}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        if (inUse > 0 && !window.confirm(`${inUse} employee${inUse === 1 ? " is" : "s are"} assigned to this department. Delete it anyway?`)) return;
                        await authedFetch(`/api/departments/${d.id}`, { method: "DELETE" });
                      }, "Department removed.")
                    }
                    className="rounded px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
            {departments.length === 0 && (
              <li className="py-6 text-center text-sm text-ink-400">No departments yet.</li>
            )}
          </ul>
          <p className="flex items-center gap-1.5 text-xs text-ink-500">
            <MapPin className="h-3.5 w-3.5" /> Office locations (for the Location field above) are managed from Attendance → Setup.
          </p>
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : ""}
        description="Removes their sign-in — they can no longer log in, and this can't be undone. Their profile row is kept (not erased) so leads, activity and reports they're attached to still show a real name instead of a blank owner."
        footer={
          <>
            <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!deleteTarget) return;
                  await deleteEmployee(deleteTarget.uid);
                  setDeleteTarget(null);
                  if (editing?.uid === deleteTarget.uid) setEditing(null);
                }, "Employee deleted.")
              }
            >
              <Trash2 className="h-4 w-4" /> Delete account
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <p className="text-sm text-ink-700">
            {deleteTarget.name} ({deleteTarget.email}) will no longer be able to sign in.
          </p>
        )}
      </Modal>

      <Modal
        open={tempPassword !== null}
        onClose={() => setTempPassword(null)}
        title="Temporary password"
        description="This is shown only once. Share it securely and ask the user to change it after signing in."
        footer={<Button variant="primary" onClick={() => setTempPassword(null)}>Done</Button>}
      >
        <div className="flex items-center gap-2 rounded-lg bg-ink-100 px-3 py-2.5">
          <code className="flex-1 select-all font-mono text-sm">{tempPassword}</code>
          <Button
            size="sm"
            onClick={() => {
              if (tempPassword) void navigator.clipboard.writeText(tempPassword);
              push("Copied.", "success");
            }}
          >
            Copy
          </Button>
        </div>
      </Modal>

      <Modal
        open={salaryEditing !== null}
        onClose={() => setSalaryEditing(null)}
        title={salaryEditing ? `Salary — ${salaryEditing.name}` : ""}
        description="Salary structure, statutory numbers, bank details and payroll settings. Visible to Finance/Admin only — this feeds monthly payslip generation."
        footer={
          <>
            <Button onClick={() => setSalaryEditing(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={salaryLoading}
              onClick={() => void run(async () => { await saveSalary(); setSalaryEditing(null); }, "Salary profile saved.")}
            >
              Save
            </Button>
          </>
        }
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
                    <Input type="number" min={0} value={salaryForm.ctc} onChange={(e) => setSalaryForm({ ...salaryForm, ctc: Number(e.target.value) })} className="flex-1" />
                    <Button type="button" onClick={() => setSalaryForm({ ...salaryForm, ...splitCtcMonthly(salaryForm.ctc), tdsMonthly: computeMonthlyTdsFromAnnualCtc(salaryForm.ctc) })}>
                      <Sparkles className="h-3.5 w-3.5" /> Auto-fill from CTC
                    </Button>
                  </div>
                </Field>
                <Field label="Basic"><Input type="number" min={0} value={salaryForm.basic} onChange={(e) => setSalaryForm({ ...salaryForm, basic: Number(e.target.value) })} /></Field>
                <Field label="HRA"><Input type="number" min={0} value={salaryForm.hra} onChange={(e) => setSalaryForm({ ...salaryForm, hra: Number(e.target.value) })} /></Field>
                <Field label="TA"><Input type="number" min={0} value={salaryForm.ta} onChange={(e) => setSalaryForm({ ...salaryForm, ta: Number(e.target.value) })} /></Field>
                <Field label="Others / allowances"><Input type="number" min={0} value={salaryForm.others} onChange={(e) => setSalaryForm({ ...salaryForm, others: Number(e.target.value) })} /></Field>
                <Field label="Misc"><Input type="number" min={0} value={salaryForm.misc ?? 0} onChange={(e) => setSalaryForm({ ...salaryForm, misc: Number(e.target.value) })} /></Field>
              </div>
              <p className="mt-2 text-xs text-ink-500">
                Auto-fill splits CTC as Basic 50% / HRA 25% / TA 10% / Others 10% / Misc 5%, and estimates TDS below from the New Tax Regime slabs — a one-time convenience fill. Every field stays freely editable afterward; re-click to re-apply it.
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Statutory numbers</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="PAN No."><Input value={salaryForm.panNo} onChange={(e) => setSalaryForm({ ...salaryForm, panNo: e.target.value.toUpperCase() })} /></Field>
                <Field label="UAN No."><Input value={salaryForm.uanNo} onChange={(e) => setSalaryForm({ ...salaryForm, uanNo: e.target.value })} /></Field>
                <Field label="PF No."><Input value={salaryForm.pfNo} onChange={(e) => setSalaryForm({ ...salaryForm, pfNo: e.target.value })} /></Field>
                <Field label="E.S.I No."><Input value={salaryForm.esiNo} onChange={(e) => setSalaryForm({ ...salaryForm, esiNo: e.target.value })} /></Field>
                <Field label="Date of joining">
                  <Input
                    type="date"
                    value={salaryForm.dateOfJoining ? salaryForm.dateOfJoining.toISOString().slice(0, 10) : ""}
                    onChange={(e) => setSalaryForm({ ...salaryForm, dateOfJoining: e.target.value ? new Date(e.target.value) : null })}
                  />
                </Field>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Bank details (salary account)</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Account holder name"><Input value={salaryForm.bankAccountName} onChange={(e) => setSalaryForm({ ...salaryForm, bankAccountName: e.target.value })} /></Field>
                <Field label="Bank name"><Input value={salaryForm.bankName} onChange={(e) => setSalaryForm({ ...salaryForm, bankName: e.target.value })} /></Field>
                <Field label="Account No."><Input value={salaryForm.bankAccountNo} onChange={(e) => setSalaryForm({ ...salaryForm, bankAccountNo: e.target.value })} /></Field>
                <Field label="IFSC"><Input value={salaryForm.bankIfsc} onChange={(e) => setSalaryForm({ ...salaryForm, bankIfsc: e.target.value.toUpperCase() })} /></Field>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Deductions &amp; employer contributions</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="EPF — employee %" hint="Applied to Basic, capped at the ₹15,000 PF wage ceiling. Defaults to 12%.">
                  <Input type="number" min={0} max={100} value={salaryForm.epfEmployeePct ?? 12} onChange={(e) => setSalaryForm({ ...salaryForm, epfEmployeePct: Number(e.target.value) })} />
                </Field>
                <Field label="EPF — employer amount (₹)" hint="Leave blank to mirror the employee's EPF deduction.">
                  <Input type="number" min={0} value={salaryForm.epfEmployerAmount ?? ""} onChange={(e) => setSalaryForm({ ...salaryForm, epfEmployerAmount: e.target.value === "" ? undefined : Number(e.target.value) })} />
                </Field>
                <Field label="ESIC — employee %" hint="0 = not ESIC-applicable.">
                  <Input type="number" min={0} max={100} value={salaryForm.esicEmployeePct ?? 0} onChange={(e) => setSalaryForm({ ...salaryForm, esicEmployeePct: Number(e.target.value) })} />
                </Field>
                <Field label="ESIC — employer amount (₹)"><Input type="number" min={0} value={salaryForm.esicEmployerAmount ?? 0} onChange={(e) => setSalaryForm({ ...salaryForm, esicEmployerAmount: Number(e.target.value) })} /></Field>
                <Field label="TDS (₹/month)" hint="Auto-filled from CTC using New Tax Regime slabs — always editable per payslip before finalizing.">
                  <Input type="number" min={0} value={salaryForm.tdsMonthly ?? 0} onChange={(e) => setSalaryForm({ ...salaryForm, tdsMonthly: Number(e.target.value) })} />
                </Field>
                <Field label="Gratuity (₹/month)"><Input type="number" min={0} value={salaryForm.gratuityMonthly ?? 0} onChange={(e) => setSalaryForm({ ...salaryForm, gratuityMonthly: Number(e.target.value) })} /></Field>
                <Field label="Bonus (₹/month)"><Input type="number" min={0} value={salaryForm.bonusMonthly ?? 0} onChange={(e) => setSalaryForm({ ...salaryForm, bonusMonthly: Number(e.target.value) })} /></Field>
                <Field label="Health (₹/month)"><Input type="number" min={0} value={salaryForm.healthMonthly ?? 0} onChange={(e) => setSalaryForm({ ...salaryForm, healthMonthly: Number(e.target.value) })} /></Field>
              </div>
            </div>

            <Checkbox
              checked={salaryForm.active}
              onChange={(v) => setSalaryForm({ ...salaryForm, active: v })}
              label="Active — included in payroll generation"
            />
          </div>
        )}
      </Modal>
    </>
  );
}
