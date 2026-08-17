"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Building2, IndianRupee, Pencil, Plus, Trash2, UserCircle,
} from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, useAsyncAction, useToast,
} from "@/components/ui";
import {
  createCorporateAccount, createEmspUser, deleteCorporateAccount, deleteEmspUser, setEmspUserActive,
  subscribeCorporateAccounts, subscribeEmspUsers, updateCorporateAccount, updateEmspUser,
} from "@/lib/db/emsp-users";
import { EMSP_USER_TYPE_LABEL, EMSP_USER_TYPES } from "@/lib/constants";
import { emailPaymentReceipt } from "@/lib/db/notifications";
import { canManageEmspUsers, hasRole } from "@/lib/permissions";
import { topUpWallet, type WalletTopupResult } from "@/lib/razorpay-client";
import type { CorporateAccount, EmspUser, WalletOwnerType } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import { manualWalletCredit } from "@/lib/wallet-client";

export default function EmspUsersPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const canManage = canManageEmspUsers(viewer);
  const { run, busy } = useAsyncAction();

  const [users, setUsers] = useState<EmspUser[] | null>(null);
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);

  const [userOpen, setUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<EmspUser | null>(null);
  const [uName, setUName] = useState("");
  const [uPhone, setUPhone] = useState("");
  const [uEmail, setUEmail] = useState("");
  const [uType, setUType] = useState<"RETAIL" | "CORPORATE">("RETAIL");
  const [uAccountId, setUAccountId] = useState("");
  const [uMonthlyCap, setUMonthlyCap] = useState("");
  const [uCity, setUCity] = useState("");
  const [uState, setUState] = useState("");

  const [acctOpen, setAcctOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CorporateAccount | null>(null);
  const [aName, setAName] = useState("");
  const [aGstin, setAGstin] = useState("");
  const [aEmail, setAEmail] = useState("");

  const [topupFor, setTopupFor] = useState<{ ownerType: WalletOwnerType; ownerId: string; name: string } | null>(null);
  const [topupAmount, setTopupAmount] = useState("500");
  const [topupCoupon, setTopupCoupon] = useState("");
  const [topupBusy, setTopupBusy] = useState(false);
  const [manualCredit, setManualCredit] = useState(false);
  const [manualReason, setManualReason] = useState("");
  const { push } = useToast();

  const canManualCredit = hasRole(viewer, "SUPER_ADMIN", "ADMIN");

  useEffect(() => subscribeEmspUsers(setUsers), []);
  useEffect(() => subscribeCorporateAccounts(setAccounts), []);

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  async function submitTopup() {
    if (!topupFor) return;
    const amount = Number(topupAmount);
    if (!amount || amount <= 0) return;
    if (manualCredit && !manualReason.trim()) {
      push("A reason is required for a manual credit.", "error");
      return;
    }
    setTopupBusy(true);
    try {
      const result = manualCredit
        ? await manualWalletCredit(topupFor.ownerType, topupFor.ownerId, amount, manualReason.trim())
        : await topUpWallet({
          ownerType: topupFor.ownerType, ownerId: topupFor.ownerId, ownerName: topupFor.name,
          amountInr: amount, couponCode: topupCoupon.trim() || undefined,
        });
      push(
        "bonusInr" in result && result.bonusInr
          ? `₹${amount} + ₹${result.bonusInr} coupon bonus added to ${topupFor.name}'s wallet.`
          : `₹${amount} added to ${topupFor.name}'s wallet.`,
        "success",
      );
      const email = topupFor.ownerType === "EMSP_USER"
        ? users?.find((u) => u.id === topupFor.ownerId)?.email
        : accounts.find((a) => a.id === topupFor.ownerId)?.billingEmail;
      if (!manualCredit && email && result.newBalanceInr != null) {
        const paidResult = result as WalletTopupResult;
        emailPaymentReceipt({
          to: email,
          amountInr: amount + (paidResult.bonusInr ?? 0),
          newBalanceInr: paidResult.newBalanceInr!,
          razorpayPaymentId: paidResult.razorpayPaymentId,
        });
      }
      setTopupFor(null);
      setTopupCoupon("");
      setManualCredit(false);
      setManualReason("");
    } catch (e) {
      push((e as Error).message, "error");
    } finally {
      setTopupBusy(false);
    }
  }

  function openNewUser() {
    setEditingUser(null);
    setUName(""); setUPhone(""); setUEmail(""); setUType("RETAIL"); setUAccountId(""); setUMonthlyCap("");
    setUCity(""); setUState("");
    setUserOpen(true);
  }

  function openEditUser(u: EmspUser) {
    setEditingUser(u);
    setUName(u.name); setUPhone(u.phone); setUEmail(u.email ?? ""); setUType(u.type);
    setUAccountId(u.corporateAccountId ?? ""); setUMonthlyCap(u.monthlyCapInr != null ? String(u.monthlyCapInr) : "");
    setUCity(u.city ?? ""); setUState(u.state ?? "");
    setUserOpen(true);
  }

  async function submitUser() {
    if (!actor || !uName.trim() || !uPhone.trim()) return;
    await run(async () => {
      if (editingUser) {
        await updateEmspUser(editingUser.id, {
          name: uName.trim(), phone: uPhone.trim(), email: uEmail.trim() || undefined,
          type: uType, corporateAccountId: uType === "CORPORATE" ? (uAccountId || null) : null,
          city: uCity.trim() || null, state: uState.trim() || null,
        });
      } else {
        await createEmspUser({
          name: uName.trim(), phone: uPhone.trim(), email: uEmail.trim() || undefined,
          type: uType, corporateAccountId: uType === "CORPORATE" ? (uAccountId || null) : null,
          monthlyCapInr: uType === "CORPORATE" && uMonthlyCap.trim() ? Number(uMonthlyCap) : undefined,
          city: uCity.trim() || undefined, state: uState.trim() || undefined,
        }, actor);
      }
      setUserOpen(false);
    }, editingUser ? "User updated." : "User added.");
  }

  function openNewAccount() {
    setEditingAccount(null);
    setAName(""); setAGstin(""); setAEmail("");
    setAcctOpen(true);
  }

  function openEditAccount(a: CorporateAccount) {
    setEditingAccount(a);
    setAName(a.name); setAGstin(a.gstin ?? ""); setAEmail(a.billingEmail ?? "");
    setAcctOpen(true);
  }

  async function submitAccount() {
    if (!actor || !aName.trim()) return;
    await run(async () => {
      const draft = { name: aName.trim(), gstin: aGstin.trim() || undefined, billingEmail: aEmail.trim() || undefined };
      if (editingAccount) await updateCorporateAccount(editingAccount.id, draft);
      else await createCorporateAccount(draft, actor);
      setAcctOpen(false);
    }, editingAccount ? "Corporate account updated." : "Corporate account added.");
  }

  async function removeUser(u: EmspUser) {
    if (!window.confirm(`Delete ${u.name}? This can't be undone.`)) return;
    await run(() => deleteEmspUser(u.id), "User deleted.");
  }

  async function removeAccount(a: CorporateAccount) {
    if (!window.confirm(`Delete ${a.name}? This can't be undone — any users still linked to it will lose their corporate wallet.`)) return;
    await run(() => deleteCorporateAccount(a.id), "Corporate account deleted.");
  }

  return (
    <>
      <PageHeader
        title="User Management"
        description="Driver-facing (EMSP) users — retail and corporate — separate from CRM team logins under Team & Roles."
        actions={canManage && (
          <>
            <Button onClick={openNewAccount}><Building2 className="h-4 w-4" /> New corporate account</Button>
            <Button variant="primary" onClick={openNewUser}><Plus className="h-4 w-4" /> New user</Button>
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
                <tr><th className="th">Name</th><th className="th">GSTIN</th><th className="th">Billing email</th><th className="th text-right">Wallet</th><th className="th text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {accounts.map((a) => (
                  <tr key={a.id} className="hover:bg-ink-50">
                    <td className="td font-medium">{a.name}</td>
                    <td className="td text-ink-600">{a.gstin || "—"}</td>
                    <td className="td text-ink-600">{a.billingEmail || "—"}</td>
                    <td className="td text-right tabular-nums">{formatINR(a.walletBalanceInr ?? 0)}</td>
                    <td className="td text-right">
                      {canManage && (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" onClick={() => setTopupFor({ ownerType: "CORPORATE_ACCOUNT", ownerId: a.id, name: a.name })}>
                            <IndianRupee className="h-3.5 w-3.5" /> Top up
                          </Button>
                          <Button size="sm" onClick={() => openEditAccount(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" onClick={() => void removeAccount(a)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      )}
                    </td>
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
                  <th className="th">Corporate account</th><th className="th text-right">Wallet</th><th className="th">Status</th>
                  {canManage && <th className="th text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-ink-50">
                    <td className="td font-medium"><Link href={`/emsp-users/${u.id}`} className="hover:underline">{u.name}</Link></td>
                    <td className="td text-ink-600">{u.phone}</td>
                    <td className="td text-ink-600">{EMSP_USER_TYPE_LABEL[u.type]}</td>
                    <td className="td text-ink-600">{u.corporateAccountId ? (accountName.get(u.corporateAccountId) ?? "—") : "—"}</td>
                    <td className="td text-right tabular-nums">{formatINR(u.walletBalanceInr ?? 0)}</td>
                    <td className="td">
                      <Badge className={u.active ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-500 ring-ink-200"}>
                        {u.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="td text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" onClick={() => setTopupFor({ ownerType: "EMSP_USER", ownerId: u.id, name: u.name })}>
                            <IndianRupee className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" onClick={() => openEditUser(u)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" onClick={() => void run(() => setEmspUserActive(u.id, !u.active))}>
                            {u.active ? "Deactivate" : "Reactivate"}
                          </Button>
                          <Button size="sm" onClick={() => void removeUser(u)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
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
        title={editingUser ? "Edit user" : "New user"}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setUserOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!uName.trim() || !uPhone.trim()} onClick={() => void submitUser()}>
              {editingUser ? "Save" : "Add"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Name" required><Input value={uName} onChange={(e) => setUName(e.target.value)} /></Field>
          <Field label="Phone" required><Input value={uPhone} onChange={(e) => setUPhone(e.target.value)} /></Field>
          <Field label="Email"><Input value={uEmail} onChange={(e) => setUEmail(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City"><Input value={uCity} onChange={(e) => setUCity(e.target.value)} placeholder="Optional — used for city/state-restricted coupons" /></Field>
            <Field label="State"><Input value={uState} onChange={(e) => setUState(e.target.value)} placeholder="Optional" /></Field>
          </div>
          <Field label="Type">
            <Select value={uType} onChange={(e) => setUType(e.target.value as "RETAIL" | "CORPORATE")} options={EMSP_USER_TYPES.map((t) => ({ value: t, label: EMSP_USER_TYPE_LABEL[t] }))} />
          </Field>
          {uType === "CORPORATE" && (
            <>
              <Field label="Corporate account">
                <Select value={uAccountId} onChange={(e) => setUAccountId(e.target.value)} options={accounts.map((a) => ({ value: a.id, label: a.name }))} placeholder="Choose an account" />
              </Field>
              {!editingUser && (
                <Field label="Monthly benefit cap (₹)">
                  <Input type="number" min={0} value={uMonthlyCap} onChange={(e) => setUMonthlyCap(e.target.value)} placeholder="Optional — no cap if blank" />
                </Field>
              )}
            </>
          )}
          {editingUser && uType === "CORPORATE" && (
            <p className="text-xs text-ink-500">Edit the monthly benefit cap from this user's profile page.</p>
          )}
        </div>
      </Modal>

      <Modal
        open={acctOpen}
        onClose={() => setAcctOpen(false)}
        title={editingAccount ? "Edit corporate account" : "New corporate account"}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setAcctOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!aName.trim()} onClick={() => void submitAccount()}>
              {editingAccount ? "Save" : "Add"}
            </Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Company name" required><Input value={aName} onChange={(e) => setAName(e.target.value)} /></Field>
          <Field label="GSTIN"><Input value={aGstin} onChange={(e) => setAGstin(e.target.value)} /></Field>
          <Field label="Billing email"><Input value={aEmail} onChange={(e) => setAEmail(e.target.value)} /></Field>
        </div>
      </Modal>

      <Modal
        open={!!topupFor}
        onClose={() => { setTopupFor(null); setTopupCoupon(""); setManualCredit(false); setManualReason(""); }}
        title={`Top up wallet — ${topupFor?.name ?? ""}`}
        description={manualCredit
          ? "Credits the wallet directly — no payment is taken. Restricted to Super Admin / Admin, and requires a reason for the audit trail."
          : "Opens Razorpay Checkout. Requires RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET set in this app's environment."}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setTopupFor(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={topupBusy}
              disabled={!Number(topupAmount) || (manualCredit && !manualReason.trim())}
              onClick={() => void submitTopup()}
            >
              {manualCredit ? `Credit ₹${topupAmount || 0}` : `Pay ₹${topupAmount || 0}`}
            </Button>
          </>
        )}
      >
        <div className="grid gap-4">
          <Field label="Amount (₹)">
            <Input type="number" min={1} value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} />
          </Field>
          {canManualCredit && (
            <Checkbox checked={manualCredit} onChange={setManualCredit} label="Manual credit — no real payment (Super Admin / Admin only)" />
          )}
          {manualCredit ? (
            <Field label="Reason" required hint="Shown in the wallet transaction audit trail.">
              <Input value={manualReason} onChange={(e) => setManualReason(e.target.value)} placeholder="e.g. Goodwill credit for outage on 12 Aug" />
            </Field>
          ) : (
            <Field label="Coupon code" hint="Optional — validated when payment completes.">
              <Input value={topupCoupon} onChange={(e) => setTopupCoupon(e.target.value.toUpperCase())} placeholder="e.g. WELCOME10" />
            </Field>
          )}
        </div>
      </Modal>
    </>
  );
}
