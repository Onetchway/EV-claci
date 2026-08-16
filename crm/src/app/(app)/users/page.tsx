"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, Plus, ShieldCheck, UserPlus } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader,
  Select, Spinner, StatCard, useAsyncAction, useToast,
} from "@/components/ui";
import { useLeads } from "@/hooks/use-leads";
import { agentPerformance } from "@/lib/analytics";
import {
  INDIAN_STATES, ROLES, ROLE_HINT, ROLE_LABEL, ROLE_RANK, type Role,
} from "@/lib/constants";
import { subscribeOrganizations } from "@/lib/db/organizations";
import { subscribeUsers } from "@/lib/db/users";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { canAssignRole, isAdmin, isSuperAdmin } from "@/lib/permissions";
import type { AppUser, Organization } from "@/lib/types";
import { formatCompactINR, formatDate } from "@/lib/utils";

const ROLE_STYLE: Record<Role, string> = {
  SUPER_ADMIN: "bg-violet-100 text-violet-800 ring-violet-200",
  ADMIN: "bg-sky-100 text-sky-800 ring-sky-200",
  SALES_MANAGER: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  AGENT: "bg-ink-100 text-ink-700 ring-ink-200",
  FINANCE: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  OPERATIONS: "bg-amber-100 text-amber-800 ring-amber-200",
  FLEET_MANAGER: "bg-teal-100 text-teal-800 ring-teal-200",
  CUSTOMER_SUPPORT: "bg-pink-100 text-pink-800 ring-pink-200",
  SITE_OWNER: "bg-orange-100 text-orange-800 ring-orange-200",
  VIEWER: "bg-slate-100 text-slate-600 ring-slate-200",
};

/** Every role a user holds, primary first. */
function rolesFor(u: AppUser): Role[] {
  const list = u.roles?.length ? u.roles : [u.role];
  return [...new Set(list)].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a]);
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

export default function UsersPage() {
  const { profile, role } = useAuth();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", roles: ["AGENT"] as Role[], region: "", password: "",
  });

  const { leads } = useLeads(useMemo(() => ({ max: 8000 }), []));
  const perf = useMemo(() => agentPerformance(leads), [leads]);

  useEffect(() => {
    if (!role || !isAdmin(role)) return;
    return subscribeUsers((rows) => { setUsers(rows); setLoading(false); }, () => setLoading(false));
  }, [role]);
  useEffect(() => {
    if (!role || !isSuperAdmin(role)) return;
    return subscribeOrganizations(setOrgs);
  }, [role]);

  const viewer = useViewer();

  if (role && !isAdmin(role)) {
    return (
      <EmptyState
        title="Admins only"
        description="Team and role management is restricted to admins."
        action={<Link href="/dashboard"><Button>Back to dashboard</Button></Link>}
      />
    );
  }

  const assignableRoles = ROLES.filter((r) => canAssignRole(viewer, r));

  async function createUser() {
    if (!form.name.trim() || !form.email.trim()) throw new Error("Name and email are required.");
    const body = await authedFetch("/api/users", {
      method: "POST",
      body: JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        roles: form.roles,
        region: form.region || null,
        password: form.password || undefined,
      }),
    });
    setCreateOpen(false);
    setForm({ name: "", email: "", phone: "", roles: ["AGENT"], region: "", password: "" });
    if (body.temporaryPassword) setTempPassword(body.temporaryPassword);
  }

  async function patchUser(uid: string, patch: Record<string, unknown>) {
    await authedFetch(`/api/users/${uid}`, { method: "PATCH", body: JSON.stringify(patch) });
  }

  const counts = {
    total: users.length,
    active: users.filter((u) => u.active).length,
    admins: users.filter((u) => ROLE_RANK[u.role] >= ROLE_RANK.ADMIN).length,
    agents: users.filter((u) => rolesFor(u).includes("AGENT")).length,
  };

  return (
    <>
      <PageHeader
        title="Team & roles"
        description="Create accounts, set roles, and switch access on or off."
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" /> Add user
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total users" value={counts.total} />
        <StatCard label="Active" value={counts.active} tone="positive" />
        <StatCard label="Admins" value={counts.admins} />
        <StatCard label="Agents" value={counts.agents} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : (
        <Card title="Directory">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">User</th>
                  <th className="th">Role</th>
                  <th className="th">Phone</th>
                  <th className="th">Region</th>
                  <th className="th text-right">Leads</th>
                  <th className="th text-right">Closed</th>
                  <th className="th">Last sign-in</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {users.map((u) => {
                  const stats = perf.find((p) => p.ownerId === u.uid);
                  const editable = canAssignRole(viewer, u.role) || u.uid === profile?.uid;
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
                      <td className="td">
                        <span className="flex flex-wrap gap-1">
                          {rolesFor(u).map((r) => (
                            <Badge key={r} className={ROLE_STYLE[r]}>
                              {ROLE_RANK[r] >= ROLE_RANK.ADMIN && <ShieldCheck className="h-3 w-3" />}
                              {ROLE_LABEL[r]}
                            </Badge>
                          ))}
                        </span>
                      </td>
                      <td className="td text-ink-600">{u.phone || "—"}</td>
                      <td className="td text-ink-600">{u.region || "—"}</td>
                      <td className="td text-right tabular-nums">{stats?.total ?? 0}</td>
                      <td className="td text-right tabular-nums">{formatCompactINR(stats?.wonValue ?? 0)}</td>
                      <td className="td text-ink-500">{formatDate(u.lastLoginAt)}</td>
                      <td className="td">
                        <Badge className={u.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-rose-100 text-rose-800 ring-rose-200"}>
                          {u.active ? "Active" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="td text-right">
                        {editable && (
                          <button
                            onClick={() => setEditing(u)}
                            className="rounded px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100"
                          >
                            Manage
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add a user"
        description="An account is created in Firebase Auth and a CRM profile is written with the chosen role."
        footer={
          <>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void run(createUser, "User created.")}>
              <Plus className="h-4 w-4" /> Create user
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
          <Field
            label="Roles"
            required
            className="sm:col-span-2"
            hint="A user may hold several. Their abilities are the union of all of them."
          >
            <RolePicker
              value={form.roles}
              options={assignableRoles}
              onChange={(roles) => setForm({ ...form, roles })}
            />
          </Field>
          <Field label="Region">
            <Select
              placeholder="Not set"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
            />
          </Field>
          <Field label="Password" hint="Leave blank to generate one automatically.">
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
            <Field label="Roles" hint="Abilities are the union of every role selected.">
              <RolePicker
                value={rolesFor(editing)}
                options={ROLES.filter((r) => canAssignRole(viewer, r))}
                disabled={!canAssignRole(viewer, editing.role)}
                onChange={(roles) =>
                  void run(async () => {
                    if (!roles.length) throw new Error("A user needs at least one role.");
                    await patchUser(editing.uid, { roles });
                    const primary = [...roles].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0]!;
                    setEditing({ ...editing, roles, role: primary });
                  }, "Roles updated.")
                }
              />
            </Field>

            <Field label="Phone">
              <Input
                defaultValue={editing.phone ?? ""}
                onBlur={(e) => void run(() => patchUser(editing.uid, { phone: e.target.value }), "Saved.")}
              />
            </Field>

            <Field label="Region">
              <Select
                placeholder="Not set"
                value={editing.region ?? ""}
                onChange={(e) =>
                  void run(async () => {
                    await patchUser(editing.uid, { region: e.target.value || null });
                    setEditing({ ...editing, region: e.target.value || null });
                  }, "Saved.")
                }
                options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
              />
            </Field>

            {isSuperAdmin(viewer.role) && (
              <Field label="Organisation (white label)" hint="No organisation = Livanto's own default. Assigning one scopes this person's branding only — data isolation between organisations isn't built yet.">
                <Select
                  placeholder="Default (Livanto)"
                  value={editing.orgId ?? ""}
                  onChange={(e) =>
                    void run(async () => {
                      await patchUser(editing.uid, { orgId: e.target.value || null });
                      setEditing({ ...editing, orgId: e.target.value || null });
                    }, "Saved.")
                  }
                  options={orgs.map((o) => ({ value: o.id, label: o.name }))}
                />
              </Field>
            )}

            <div className="flex flex-wrap gap-2 border-t border-ink-200 pt-4">
              <Button
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    const next = !editing.active;
                    await patchUser(editing.uid, { active: next });
                    setEditing({ ...editing, active: next });
                  }, "Access updated.")
                }
                variant={editing.active ? "danger" : "primary"}
                disabled={editing.uid === profile?.uid}
              >
                {editing.active ? "Deactivate account" : "Reactivate account"}
              </Button>

              {isSuperAdmin(viewer.role) && (
                <Button
                  loading={busy}
                  onClick={() =>
                    void run(async () => {
                      const pwd = window.prompt("New password (minimum 8 characters):");
                      if (!pwd) return;
                      await patchUser(editing.uid, { password: pwd });
                      push("Password reset. Share it with the user securely.", "success");
                    })
                  }
                >
                  <KeyRound className="h-4 w-4" /> Set password
                </Button>
              )}
            </div>

            {editing.uid === profile?.uid && (
              <p className="text-xs text-ink-500">You cannot deactivate your own account.</p>
            )}
          </div>
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
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
        </div>
      </Modal>
    </>
  );
}

/** Multi-select role chips. Used for both creating and editing a user. */
function RolePicker({
  value, options, onChange, disabled,
}: {
  value: Role[];
  options: readonly Role[];
  onChange: (next: Role[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {options.map((r) => {
        const on = value.includes(r);
        return (
          <label
            key={r}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition ${
              on ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:bg-ink-50"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              checked={on}
              disabled={disabled}
              onChange={(e) =>
                onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))
              }
              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink-900">{ROLE_LABEL[r]}</span>
              <span className="block text-xs text-ink-500">{ROLE_HINT[r]}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
