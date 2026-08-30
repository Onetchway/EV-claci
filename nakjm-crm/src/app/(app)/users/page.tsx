"use client";

import { useEffect, useState } from "react";
import { KeyRound, Plus, UserPlus } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import {
  Avatar, Badge, Button, Checkbox, EmptyState, Field, Input, Modal,
  PageHeader, useAsyncAction, useToast,
} from "@/components/ui";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/constants";
import { subscribeUsers } from "@/lib/db/users";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { canAssignRole } from "@/lib/permissions";
import type { AppUser } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const ROLE_STYLE: Record<Role, string> = {
  SUPER_ADMIN: "bg-violet-100 text-violet-800 ring-violet-200",
  ADMIN: "bg-sky-100 text-sky-800 ring-sky-200",
  PROJECT_MANAGER: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  OPERATIONS: "bg-amber-100 text-amber-800 ring-amber-200",
  FINANCE: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  SITE_ENGINEER: "bg-teal-100 text-teal-800 ring-teal-200",
  VIEWER: "bg-ink-100 text-ink-700 ring-ink-200",
};

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

export default function UsersPage() {
  const { viewer } = useAuth();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password?: string; resetLink?: string | null } | null>(null);
  const [form, setForm] = useState({ email: "", name: "", phone: "", roles: ["VIEWER"] as Role[] });

  useEffect(() => subscribeUsers(setUsers), []);

  function toggleFormRole(r: Role) {
    setForm((f) => ({ ...f, roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] }));
  }

  async function onCreate() {
    if (!form.email.trim() || !form.name.trim() || form.roles.length === 0) return;
    await run(async () => {
      const res = await authedFetch("/api/users", { method: "POST", body: JSON.stringify(form) });
      setCreateOpen(false);
      setCredentials({ email: form.email, password: res.temporaryPassword, resetLink: res.resetLink });
      setForm({ email: "", name: "", phone: "", roles: ["VIEWER"] });
    }, "User created.");
  }

  async function toggleActive(u: AppUser) {
    if (!viewer) return;
    await run(async () => {
      await authedFetch(`/api/users/${u.uid}`, { method: "PATCH", body: JSON.stringify({ active: !u.active }) });
    }, u.active ? "User deactivated." : "User activated.");
  }

  async function setRole(u: AppUser, role: Role) {
    if (!viewer || !canAssignRole(viewer, role)) { push("You can't grant that role.", "error"); return; }
    await run(async () => {
      await authedFetch(`/api/users/${u.uid}`, { method: "PATCH", body: JSON.stringify({ roles: [role] }) });
    }, "Role updated.");
  }

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Who can sign in to the CRM and what they can do."
        actions={<Button onClick={() => setCreateOpen(true)}><UserPlus className="h-4 w-4" /> Add User</Button>}
      />

      {!users ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : users.length === 0 ? (
        <EmptyState title="No users yet" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">User</th>
                <th className="th">Role</th>
                <th className="th">Last login</th>
                <th className="th">Status</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-ink-100">
                  <td className="td">
                    <span className="flex items-center gap-2">
                      <Avatar name={u.name} size={26} />
                      <span>
                        <span className="block font-medium text-ink-900">{u.name}</span>
                        <span className="block text-xs text-ink-500">{u.email}</span>
                      </span>
                    </span>
                  </td>
                  <td className="td">
                    <select
                      className="rounded-lg border border-ink-300 bg-white px-2 py-1 text-xs"
                      value={u.role}
                      onChange={(e) => void setRole(u, e.target.value as Role)}
                      disabled={busy}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </td>
                  <td className="td">{formatDate(u.lastLoginAt)}</td>
                  <td className="td">
                    <Badge className={u.active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
                      {u.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="td text-right">
                    <Button size="sm" variant="secondary" onClick={() => void toggleActive(u)} disabled={busy}>
                      {u.active ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add User"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => void onCreate()} loading={busy}><Plus className="h-4 w-4" /> Create</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Full Name" required><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Email" required hint="Must match a nakjminfra.com Workspace account, or they sign in with a password you set.">
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
          <Field label="Roles" required>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <Checkbox key={r} label={ROLE_LABEL[r]} checked={form.roles.includes(r)} onChange={() => toggleFormRole(r)} />
              ))}
            </div>
          </Field>
        </div>
      </Modal>

      <Modal open={!!credentials} onClose={() => setCredentials(null)} title="User created">
        {credentials && (
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 text-ink-700"><KeyRound className="h-4 w-4" /> {credentials.email}</p>
            {credentials.password && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 font-mono text-amber-900 ring-1 ring-inset ring-amber-200">
                Temporary password: {credentials.password}
              </p>
            )}
            {credentials.resetLink && (
              <p className="break-all rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
                Or send them this set-password link: {credentials.resetLink}
              </p>
            )}
            <p className="text-xs text-ink-500">Shown once — copy it before closing this dialog.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
