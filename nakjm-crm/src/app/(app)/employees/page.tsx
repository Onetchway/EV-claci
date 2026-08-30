"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Avatar, Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, StatCard, useAsyncAction,
} from "@/components/ui";
import { DEPARTMENT_LABEL, EMPLOYMENT_TYPE_LABEL, ROLES, ROLE_LABEL, ROLL_STATUS_LABEL, type Role } from "@/lib/constants";
import { subscribeUsers } from "@/lib/db/users";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { canManageHrms, canSeeAllHrms } from "@/lib/permissions";
import type { AppUser } from "@/lib/types";
import { formatINR } from "@/lib/utils";

async function authedFetch(path: string, init: RequestInit) {
  const current = getFirebaseAuth().currentUser;
  if (!current) throw new Error("Your session expired. Sign in again.");
  const token = await current.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; temporaryPassword?: string; resetLink?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
  return body;
}

const BLANK_FORM = { name: "", email: "", phone: "", role: "VIEWER" as Role };

export default function EmployeesPage() {
  const { profile } = useAuth();
  const { busy, run } = useAsyncAction();
  const viewer = useViewer();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [credentials, setCredentials] = useState<{ email: string; password?: string } | null>(null);

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

  async function onAddEmployee() {
    if (!form.name.trim() || !form.email.trim()) return;
    await run(async () => {
      const res = await authedFetch("/api/users", { method: "POST", body: JSON.stringify({ ...form, roles: [form.role] }) });
      setAddOpen(false);
      setCredentials({ email: form.email, password: res.temporaryPassword });
      setForm(BLANK_FORM);
    }, "Employee added.");
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
        description="Job title, department, employment type and payroll for every employee."
        actions={canEdit ? <Button onClick={() => setAddOpen(true)}><UserPlus className="h-4 w-4" /> Add Employee</Button> : undefined}
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
                <th className="th">Employment</th>
                <th className="th">Roll status</th>
                <th className="th text-right">Monthly salary</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {visible.map((u) => (
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
                  <td className="td text-ink-600">{u.employmentType ? EMPLOYMENT_TYPE_LABEL[u.employmentType] : "—"}</td>
                  <td className="td">
                    {u.rollStatus ? (
                      <Badge className={u.rollStatus === "ON_ROLL" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
                        {ROLL_STATUS_LABEL[u.rollStatus]}
                      </Badge>
                    ) : "—"}
                  </td>
                  <td className="td text-right tabular-nums">{u.payroll?.monthlySalary ? formatINR(u.payroll.monthlySalary) : "—"}</td>
                  <td className="td text-right">
                    <Link href={`/employees/${u.uid}`} className="rounded px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={7} className="td py-10 text-center text-ink-400">No employees to show.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Employee"
        footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={() => void onAddEmployee()} loading={busy}>Add</Button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name" required className="col-span-2"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Email" required className="col-span-2"><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
          <Field label="Sign-in role"><Select value={form.role} options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))} /></Field>
        </div>
        <p className="mt-3 text-xs text-ink-500">
          This creates a sign-in account for them too. Designation, department, employment type, and payroll are set from their employee page afterwards.
        </p>
      </Modal>

      <Modal
        open={credentials !== null}
        onClose={() => setCredentials(null)}
        title="Employee added"
        footer={<Button onClick={() => setCredentials(null)}>Done</Button>}
      >
        {credentials && (
          <div className="space-y-2 text-sm">
            <p>Share these sign-in details with <strong>{credentials.email}</strong>:</p>
            {credentials.password && <p className="rounded-lg bg-ink-50 px-3 py-2 font-mono text-xs">{credentials.password}</p>}
            <p className="text-xs text-ink-500">They'll be prompted to set their own password on first sign-in.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
