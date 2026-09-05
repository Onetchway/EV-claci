"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IndianRupee, MapPin, Plus, Settings2, Trash2, UserPlus } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader,
  Select, Spinner, StatCard, useAsyncAction, useToast,
} from "@/components/ui";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/constants";
import { subscribeDepartments } from "@/lib/db/departments";
import { subscribeOfficeLocations } from "@/lib/db/office-locations";
import { subscribeUsers } from "@/lib/db/users";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { canAssignRole, canManageHrms, canManagePayroll, canSeeAllHrms, isAdmin, isSuperAdmin } from "@/lib/permissions";
import type { AppUser, Department, OfficeLocation } from "@/lib/types";

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
  const { profile, role } = useAuth();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();
  const viewer = useViewer();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [offices, setOffices] = useState<OfficeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [deptManagerOpen, setDeptManagerOpen] = useState(false);
  const [newDept, setNewDept] = useState("");

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
                          <Link
                            href={`/employees/${u.uid}`}
                            className="rounded px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100"
                          >
                            {canEdit ? "Manage" : "View"}
                          </Link>
                          {canSalary && (
                            <Link
                              href={`/employees/${u.uid}`}
                              className="rounded px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100"
                              title="Salary structure, statutory numbers, bank details and KYC documents"
                            >
                              <span className="inline-flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Salary</span>
                            </Link>
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
    </>
  );
}
