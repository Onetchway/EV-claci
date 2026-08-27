"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, KeyRound, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Avatar, Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader,
  Select, Spinner, StatCard, useAsyncAction, useToast,
} from "@/components/ui";
import { useLeads } from "@/hooks/use-leads";
import { agentPerformance } from "@/lib/analytics";
import {
  INDIAN_STATES, ROLES, ROLE_HINT, ROLE_LABEL, ROLE_RANK, type Role,
} from "@/lib/constants";
import { setPageRoles, subscribeRoleAccessPolicy } from "@/lib/db/access-policy";
import { subscribeOrganizations } from "@/lib/db/organizations";
import { subscribeUsers } from "@/lib/db/users";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { DEFAULT_PAGE_ACCESS, PAGE_ACCESS_PATHS, PAGE_LABEL } from "@/lib/page-access";
import { canAssignRole, isAdmin, isSuperAdmin } from "@/lib/permissions";
import type { AppUser, Organization } from "@/lib/types";
import { downloadCsv, formatCompactINR, formatDate } from "@/lib/utils";

const ROLE_STYLE: Record<Role, string> = {
  SUPER_ADMIN: "bg-violet-100 text-violet-800 ring-violet-200",
  ADMIN: "bg-sky-100 text-sky-800 ring-sky-200",
  PLATFORM_ADMIN: "bg-sky-100 text-sky-800 ring-sky-200",
  CPO_ADMIN: "bg-sky-100 text-sky-800 ring-sky-200",
  SALES_MANAGER: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  AGENT: "bg-ink-100 text-ink-700 ring-ink-200",
  FINANCE: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  OPERATIONS: "bg-amber-100 text-amber-800 ring-amber-200",
  NOC_OPERATOR: "bg-amber-100 text-amber-800 ring-amber-200",
  FLEET_MANAGER: "bg-teal-100 text-teal-800 ring-teal-200",
  CORPORATE_ADMIN: "bg-teal-100 text-teal-800 ring-teal-200",
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
  const { profile, role, actor } = useAuth();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [rolePolicy, setRolePolicy] = useState<Record<string, Role[]> | null>(null);
  const [overridesFor, setOverridesFor] = useState<AppUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", roles: ["AGENT"] as Role[], region: "", password: "",
    designation: "", managerId: "",
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
  useEffect(() => subscribeRoleAccessPolicy(setRolePolicy), []);

  const viewer = useViewer();
  const superAdmin = !!role && isSuperAdmin(role);

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
        designation: form.designation.trim(),
        managerId: form.managerId || null,
        password: form.password || undefined,
      }),
    });
    setCreateOpen(false);
    setForm({ name: "", email: "", phone: "", roles: ["AGENT"], region: "", password: "", designation: "", managerId: "" });
    if (body.temporaryPassword) setTempPassword(body.temporaryPassword);
  }

  async function patchUser(uid: string, patch: Record<string, unknown>) {
    await authedFetch(`/api/users/${uid}`, { method: "PATCH", body: JSON.stringify(patch) });
  }

  /** Deletes the Firebase Auth sign-in credential and deactivates the profile — the profile row itself is kept (not removed) so historical leads keep a readable owner name; see the API route's own comment. */
  async function deleteUser(uid: string) {
    await authedFetch(`/api/users/${uid}`, { method: "DELETE" });
  }

  const effectivePolicy = { ...DEFAULT_PAGE_ACCESS, ...(rolePolicy ?? {}) };

  /** A printable/shareable snapshot of the live matrix above — same data the toggle grid reads, not a separately-maintained document that can drift from what's actually enforced. */
  function exportRbacMatrixCsv() {
    const roleCols = ROLES.filter((r) => r !== "SUPER_ADMIN");
    const header = ["Page", "SUPER_ADMIN (always full access)", ...roleCols.map((r) => ROLE_LABEL[r])];
    const rows = PAGE_ACCESS_PATHS.map((path) => {
      const allowed = effectivePolicy[path] ?? [];
      return [PAGE_LABEL[path] ?? path, "Yes", ...roleCols.map((r) => (allowed.includes(r) ? "Yes" : ""))];
    });
    downloadCsv(`rbac-matrix-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  }

  async function toggleRoleForPage(path: string, r: Role) {
    if (!actor) return;
    const current = effectivePolicy[path] ?? [];
    const next = current.includes(r) ? current.filter((x) => x !== r) : [...current, r];
    await run(() => setPageRoles(path, next, actor), undefined);
  }

  async function setUserOverride(uid: string, path: string, value: boolean | null) {
    if (!overridesFor) return;
    const next = { ...(overridesFor.pageAccessOverrides ?? {}) };
    if (value === null) delete next[path];
    else next[path] = value;
    await run(async () => {
      await patchUser(uid, { pageAccessOverrides: next });
      setOverridesFor((u) => (u ? { ...u, pageAccessOverrides: next } : u));
    }, "Access override saved.");
  }

  // Deleted accounts (DELETE /api/users/[uid] — the sign-in is gone, but the
  // profile row is kept so historical leads/activity still show a name)
  // stay out of the directory and its counts by default; toggle to see them.
  const deletedCount = users.filter((u) => u.deletedAt).length;
  const visibleUsers = showDeleted ? users : users.filter((u) => !u.deletedAt);

  const counts = {
    total: visibleUsers.length,
    active: visibleUsers.filter((u) => u.active).length,
    admins: visibleUsers.filter((u) => ROLE_RANK[u.role] >= ROLE_RANK.ADMIN).length,
    agents: visibleUsers.filter((u) => rolesFor(u).includes("AGENT")).length,
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

      <Card
        title="Roles & access"
        subtitle={
          superAdmin
            ? "Which pages each role can view, across CRM and CMS. Click a cell to toggle it — changes apply to every user with that role immediately. SUPER_ADMIN always has full access. Need an exception for one person instead? Use \"Access\" on their row below."
            : "Which pages each role can view, across CRM and CMS. SUPER_ADMIN always has full access. Only a Super Admin can edit this matrix."
        }
        actions={(
          <Button size="sm" onClick={exportRbacMatrixCsv}>
            <Download className="h-3.5 w-3.5" /> Export matrix
          </Button>
        )}
        className="mb-4"
      >
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="th sticky left-0 bg-white">Page</th>
                {ROLES.filter((r) => r !== "SUPER_ADMIN").map((r) => (
                  <th key={r} className="th text-center">{ROLE_LABEL[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {PAGE_ACCESS_PATHS.map((path) => {
                const allowed = effectivePolicy[path] ?? [];
                return (
                  <tr key={path} className="hover:bg-ink-50">
                    <td className="td sticky left-0 bg-white font-medium">{PAGE_LABEL[path] ?? path}</td>
                    {ROLES.filter((r) => r !== "SUPER_ADMIN").map((r) => (
                      <td key={r} className="td text-center">
                        {superAdmin ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void toggleRoleForPage(path, r)}
                            className="mx-auto flex h-5 w-5 items-center justify-center rounded hover:bg-ink-100 disabled:opacity-50"
                            aria-label={`Toggle ${ROLE_LABEL[r]} access to ${PAGE_LABEL[path] ?? path}`}
                          >
                            {allowed.includes(r) && <Check className="h-4 w-4 text-brand-600" />}
                          </button>
                        ) : (
                          allowed.includes(r) && <Check className="mx-auto h-4 w-4 text-brand-600" />
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : (
        <Card
          title="Directory"
          actions={
            deletedCount > 0 && (
              <button
                type="button"
                onClick={() => setShowDeleted((s) => !s)}
                className="text-xs font-medium text-ink-600 hover:underline"
              >
                {showDeleted ? "Hide" : "Show"} {deletedCount} deleted
              </button>
            )
          }
        >
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">User</th>
                  <th className="th">Role</th>
                  <th className="th">Designation</th>
                  <th className="th">Reports to</th>
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
                {visibleUsers.map((u) => {
                  const stats = perf.find((p) => p.ownerId === u.uid);
                  const editable = !u.deletedAt && (canAssignRole(viewer, u.role) || u.uid === profile?.uid);
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
                      <td className="td text-ink-600">{u.designation || "—"}</td>
                      <td className="td text-ink-600">{manager?.name || "—"}</td>
                      <td className="td text-ink-600">{u.phone || "—"}</td>
                      <td className="td text-ink-600">{u.region || "—"}</td>
                      <td className="td text-right tabular-nums">{stats?.total ?? 0}</td>
                      <td className="td text-right tabular-nums">{formatCompactINR(stats?.wonValue ?? 0)}</td>
                      <td className="td text-ink-500">{formatDate(u.lastLoginAt)}</td>
                      <td className="td">
                        <Badge className={u.deletedAt ? "bg-ink-100 text-ink-500 ring-ink-200" : u.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-rose-100 text-rose-800 ring-rose-200"}>
                          {u.deletedAt ? "Deleted" : u.active ? "Active" : "Disabled"}
                        </Badge>
                      </td>
                      <td className="td text-right">
                        <div className="flex justify-end gap-1">
                          {u.deletedAt ? (
                            <span className="px-2 py-1 text-xs text-ink-400">Deleted</span>
                          ) : (
                            <>
                              {superAdmin && (
                                <button
                                  onClick={() => setOverridesFor(u)}
                                  className="rounded px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100"
                                  title="Per-user page access overrides"
                                >
                                  Access
                                </button>
                              )}
                              {editable && (
                                <button
                                  onClick={() => setEditing(u)}
                                  className="rounded px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100"
                                >
                                  Manage
                                </button>
                              )}
                              {superAdmin && u.uid !== profile?.uid && (
                                <button
                                  onClick={() => setDeleteTarget(u)}
                                  className="rounded px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                                  title="Delete this person's account"
                                >
                                  Delete
                                </button>
                              )}
                            </>
                          )}
                        </div>
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
          <Field label="Designation" hint="Job title, shown in the directory.">
            <Input
              placeholder="e.g. Sales Manager - North"
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
            />
          </Field>
          <Field label="Reports to" hint="Who approves this person's leave/attendance.">
            <Select
              placeholder="No manager"
              value={form.managerId}
              onChange={(e) => setForm({ ...form, managerId: e.target.value })}
              options={users.filter((u) => !u.deletedAt).map((u) => ({ value: u.uid, label: u.name }))}
            />
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

            <Field label="Designation" hint="Job title, shown in the directory.">
              <Input
                defaultValue={editing.designation ?? ""}
                onBlur={(e) => void run(() => patchUser(editing.uid, { designation: e.target.value }), "Saved.")}
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
                options={users
                  .filter((u) => !u.deletedAt && u.uid !== editing.uid)
                  .map((u) => ({ value: u.uid, label: u.name }))}
              />
            </Field>

            {(() => {
              const reports = users.filter((u) => !u.deletedAt && u.managerId === editing.uid);
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

            <Field label="Attendance" hint="Off for someone HRMS genuinely doesn't apply to — a channel partner contact, a board member with CRM access. Everyone else should stay on.">
              <Checkbox
                label="Needs to check in/out"
                checked={editing.attendanceRequired !== false}
                onChange={(checked) =>
                  void run(async () => {
                    await patchUser(editing.uid, { attendanceRequired: checked });
                    setEditing({ ...editing, attendanceRequired: checked });
                  }, "Saved.")
                }
              />
            </Field>

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
                  await deleteUser(deleteTarget.uid);
                  setDeleteTarget(null);
                  if (editing?.uid === deleteTarget.uid) setEditing(null);
                }, "Account deleted.")
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
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!overridesFor}
        onClose={() => setOverridesFor(null)}
        title={`Access overrides — ${overridesFor?.name ?? ""}`}
        description="Overrides the role-based default for this one person only. Most people should never need any of these — use the Roles & access matrix above to change a whole role instead."
        wide
        footer={<Button onClick={() => setOverridesFor(null)}>Done</Button>}
      >
        {overridesFor && (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr><th className="th">Page</th><th className="th">Access</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {PAGE_ACCESS_PATHS.map((path) => {
                  const roleDefault = (effectivePolicy[path] ?? []).some((r) => rolesFor(overridesFor).includes(r));
                  const override = overridesFor.pageAccessOverrides?.[path];
                  return (
                    <tr key={path}>
                      <td className="td">{PAGE_LABEL[path] ?? path}</td>
                      <td className="td">
                        <Select
                          value={override === undefined ? "default" : override ? "allow" : "deny"}
                          onChange={(e) => {
                            const v = e.target.value;
                            void setUserOverride(overridesFor.uid, path, v === "default" ? null : v === "allow");
                          }}
                          options={[
                            { value: "default", label: `Default (role: ${roleDefault ? "allowed" : "blocked"})` },
                            { value: "allow", label: "Always allow" },
                            { value: "deny", label: "Always deny" },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
