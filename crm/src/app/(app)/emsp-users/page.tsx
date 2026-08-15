"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Plus, UserCircle } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, useAsyncAction,
} from "@/components/ui";
import {
  createCorporateAccount, createEmspUser, setEmspUserActive, subscribeCorporateAccounts, subscribeEmspUsers,
} from "@/lib/db/emsp-users";
import { EMSP_USER_TYPE_LABEL, EMSP_USER_TYPES } from "@/lib/constants";
import { canManageEmspUsers } from "@/lib/permissions";
import type { CorporateAccount, EmspUser } from "@/lib/types";

export default function EmspUsersPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = canManageEmspUsers(viewer);
  const { run, busy } = useAsyncAction();

  const [users, setUsers] = useState<EmspUser[] | null>(null);
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);

  const [userOpen, setUserOpen] = useState(false);
  const [uName, setUName] = useState("");
  const [uPhone, setUPhone] = useState("");
  const [uEmail, setUEmail] = useState("");
  const [uType, setUType] = useState<"RETAIL" | "CORPORATE">("RETAIL");
  const [uAccountId, setUAccountId] = useState("");

  const [acctOpen, setAcctOpen] = useState(false);
  const [aName, setAName] = useState("");
  const [aGstin, setAGstin] = useState("");
  const [aEmail, setAEmail] = useState("");

  useEffect(() => subscribeEmspUsers(setUsers), []);
  useEffect(() => subscribeCorporateAccounts(setAccounts), []);

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  async function submitUser() {
    if (!actor || !uName.trim() || !uPhone.trim()) return;
    await run(async () => {
      await createEmspUser({
        name: uName.trim(), phone: uPhone.trim(), email: uEmail.trim() || undefined,
        type: uType, corporateAccountId: uType === "CORPORATE" ? (uAccountId || null) : null,
      }, actor);
      setUName(""); setUPhone(""); setUEmail(""); setUAccountId(""); setUserOpen(false);
    }, "User added.");
  }

  async function submitAccount() {
    if (!actor || !aName.trim()) return;
    await run(async () => {
      await createCorporateAccount({ name: aName.trim(), gstin: aGstin.trim() || undefined, billingEmail: aEmail.trim() || undefined }, actor);
      setAName(""); setAGstin(""); setAEmail(""); setAcctOpen(false);
    }, "Corporate account added.");
  }

  return (
    <>
      <PageHeader
        title="User Management"
        description="Driver-facing (EMSP) users — retail and corporate — separate from CRM team logins under Team & Roles."
        actions={canManage && (
          <>
            <Button onClick={() => setAcctOpen(true)}><Building2 className="h-4 w-4" /> New corporate account</Button>
            <Button variant="primary" onClick={() => setUserOpen(true)}><Plus className="h-4 w-4" /> New user</Button>
          </>
        )}
      />

      <Card title="Corporate accounts" className="mb-4">
        {accounts.length === 0 ? (
          <EmptyState icon={<Building2 className="h-8 w-8" />} title="No corporate accounts yet" />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr><th className="th">Name</th><th className="th">GSTIN</th><th className="th">Billing email</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {accounts.map((a) => (
                  <tr key={a.id} className="hover:bg-ink-50">
                    <td className="td font-medium">{a.name}</td>
                    <td className="td text-ink-600">{a.gstin || "—"}</td>
                    <td className="td text-ink-600">{a.billingEmail || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Users">
        {users === null ? (
          <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
        ) : users.length === 0 ? (
          <EmptyState icon={<UserCircle className="h-8 w-8" />} title="No users yet" />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Name</th><th className="th">Phone</th><th className="th">Type</th>
                  <th className="th">Corporate account</th><th className="th">Status</th>
                  {canManage && <th className="th text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-ink-50">
                    <td className="td font-medium">{u.name}</td>
                    <td className="td text-ink-600">{u.phone}</td>
                    <td className="td text-ink-600">{EMSP_USER_TYPE_LABEL[u.type]}</td>
                    <td className="td text-ink-600">{u.corporateAccountId ? (accountName.get(u.corporateAccountId) ?? "—") : "—"}</td>
                    <td className="td">
                      <Badge className={u.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-500 ring-ink-200"}>
                        {u.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="td text-right">
                        <Button size="sm" onClick={() => void run(() => setEmspUserActive(u.id, !u.active))}>
                          {u.active ? "Deactivate" : "Reactivate"}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={userOpen}
        onClose={() => setUserOpen(false)}
        title="New user"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setUserOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!uName.trim() || !uPhone.trim()} onClick={() => void submitUser()}>Add</Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Name" required><Input value={uName} onChange={(e) => setUName(e.target.value)} /></Field>
          <Field label="Phone" required><Input value={uPhone} onChange={(e) => setUPhone(e.target.value)} /></Field>
          <Field label="Email"><Input value={uEmail} onChange={(e) => setUEmail(e.target.value)} /></Field>
          <Field label="Type">
            <Select value={uType} onChange={(e) => setUType(e.target.value as "RETAIL" | "CORPORATE")} options={EMSP_USER_TYPES.map((t) => ({ value: t, label: EMSP_USER_TYPE_LABEL[t] }))} />
          </Field>
          {uType === "CORPORATE" && (
            <Field label="Corporate account">
              <Select value={uAccountId} onChange={(e) => setUAccountId(e.target.value)} options={accounts.map((a) => ({ value: a.id, label: a.name }))} placeholder="Choose an account" />
            </Field>
          )}
        </div>
      </Modal>

      <Modal
        open={acctOpen}
        onClose={() => setAcctOpen(false)}
        title="New corporate account"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setAcctOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!aName.trim()} onClick={() => void submitAccount()}>Add</Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Company name" required><Input value={aName} onChange={(e) => setAName(e.target.value)} /></Field>
          <Field label="GSTIN"><Input value={aGstin} onChange={(e) => setAGstin(e.target.value)} /></Field>
          <Field label="Billing email"><Input value={aEmail} onChange={(e) => setAEmail(e.target.value)} /></Field>
        </div>
      </Modal>
    </>
  );
}
