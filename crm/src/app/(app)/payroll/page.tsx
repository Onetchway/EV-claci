"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IndianRupee, Sparkles } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Checkbox, EmptyState, Field, Input, Modal, PageHeader, StatCard, useAsyncAction, useToast,
} from "@/components/ui";
import { getFirebaseAuth } from "@/lib/firebase/client";
import {
  generatePayslip, nextEmployeeId, publishPayslip, subscribePayslipsForMonth, subscribeSalaryProfiles,
  upsertSalaryProfile,
} from "@/lib/db/payroll";
import { subscribeUsers } from "@/lib/db/users";
import { canManagePayroll } from "@/lib/permissions";
import { splitAnnualCtc, estimateMonthlyTds } from "@/lib/tax";
import type { AppUser, Payslip, SalaryProfile } from "@/lib/types";
import { formatINR } from "@/lib/utils";

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function patchUser(uid: string, patch: Record<string, unknown>) {
  const current = getFirebaseAuth().currentUser;
  if (!current) throw new Error("Your session expired. Sign in again.");
  const token = await current.getIdToken();
  const res = await fetch(`/api/users/${uid}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(patch),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
}

const blankProfile = (u: AppUser): Omit<SalaryProfile, "id" | "createdAt" | "updatedAt" | "updatedBy"> => ({
  uid: u.uid, userName: u.name, basic: 0, hra: 0, ta: 0, others: 0, misc: 0,
});

export default function PayrollPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [month, setMonth] = useState(thisMonth());
  const [users, setUsers] = useState<AppUser[]>([]);
  const [profiles, setProfiles] = useState<SalaryProfile[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [draft, setDraft] = useState<Omit<SalaryProfile, "id" | "createdAt" | "updatedAt" | "updatedBy"> | null>(null);
  const [ctcInput, setCtcInput] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => subscribeUsers(setUsers), []);
  useEffect(() => subscribeSalaryProfiles(setProfiles), []);
  useEffect(() => subscribePayslipsForMonth(month, setPayslips), [month]);

  if (!canManagePayroll(viewer)) {
    return <EmptyState title="Restricted" description="Payroll is limited to Admins and Finance." />;
  }

  const employees = users.filter((u) => u.active !== false);
  const profileByUid = new Map(profiles.map((p) => [p.uid, p]));
  const payslipByUid = new Map(payslips.map((p) => [p.uid, p]));

  const stats = useMemo(() => {
    const withProfile = employees.filter((u) => profileByUid.has(u.uid)).length;
    const generated = payslips.length;
    const published = payslips.filter((p) => p.status === "PUBLISHED").length;
    const totalNet = payslips.reduce((a, p) => a + p.netPay, 0);
    return { withProfile, generated, published, totalNet };
  }, [employees, profileByUid, payslips]);

  function openEdit(u: AppUser) {
    setEditingUser(u);
    setDraft(profileByUid.get(u.uid) ?? blankProfile(u));
    setCtcInput(profileByUid.get(u.uid)?.annualCtc ? String(profileByUid.get(u.uid)!.annualCtc) : "");
  }

  function applyCtc() {
    const ctc = Number(ctcInput);
    if (!ctc || !draft) return;
    const split = splitAnnualCtc(ctc);
    setDraft({ ...draft, annualCtc: ctc, ...split });
  }

  async function saveProfile() {
    if (!draft || !actor) return;
    await upsertSalaryProfile(draft, actor);
    setEditingUser(null);
  }

  async function generateFor(u: AppUser) {
    const profile = profileByUid.get(u.uid);
    if (!profile || !actor) { push("Add a salary profile first.", "error"); return; }
    await generatePayslip(profile, month, actor);
  }

  async function generateSelected() {
    if (!actor) return;
    for (const uid of selected) {
      const u = employees.find((e) => e.uid === uid);
      const profile = profileByUid.get(uid);
      if (u && profile) await generatePayslip(profile, month, actor);
    }
    setSelected(new Set());
  }

  async function publishSelected() {
    if (!actor) return;
    for (const uid of selected) {
      const p = payslipByUid.get(uid);
      if (p && p.status === "DRAFT") await publishPayslip(p.id, actor);
    }
    setSelected(new Set());
  }

  async function backfillEmployeeId(u: AppUser) {
    const id = await nextEmployeeId();
    await patchUser(u.uid, { employeeId: id });
  }

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Salary profiles and monthly payslip generation."
        actions={<Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" />}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Employees" value={employees.length} />
        <StatCard label="With salary profile" value={stats.withProfile} />
        <StatCard label="Payslips this month" value={`${stats.generated} (${stats.published} published)`} />
        <StatCard label="Total net pay" value={formatINR(stats.totalNet)} icon={<IndianRupee className="h-4 w-4" />} />
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm ring-1 ring-inset ring-brand-200">
          <span>{selected.size} selected</span>
          <Button size="sm" loading={busy} onClick={() => void run(generateSelected, "Generated.")}>Generate for selected</Button>
          <Button size="sm" loading={busy} onClick={() => void run(publishSelected, "Published.")}>Publish selected</Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th" />
              <th className="th">Employee</th>
              <th className="th">Employee ID</th>
              <th className="th">Salary profile</th>
              <th className="th">Payslip ({month})</th>
              <th className="th text-right">Net pay</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {employees.map((u) => {
              const profile = profileByUid.get(u.uid);
              const payslip = payslipByUid.get(u.uid);
              return (
                <tr key={u.uid} className="border-t border-ink-100">
                  <td className="td">
                    <input
                      type="checkbox"
                      checked={selected.has(u.uid)}
                      onChange={(e) => setSelected((s) => {
                        const next = new Set(s);
                        if (e.target.checked) next.add(u.uid); else next.delete(u.uid);
                        return next;
                      })}
                    />
                  </td>
                  <td className="td font-medium text-ink-900">{u.name}</td>
                  <td className="td text-ink-600">
                    {u.employeeId ?? (
                      <button type="button" onClick={() => void backfillEmployeeId(u)} className="text-xs font-medium text-brand-700 hover:underline">
                        Assign
                      </button>
                    )}
                  </td>
                  <td className="td">
                    <button type="button" onClick={() => openEdit(u)} className="text-xs font-medium text-brand-700 hover:underline">
                      {profile ? "Edit" : "Set up"}
                    </button>
                  </td>
                  <td className="td">
                    {payslip ? (
                      <Link href={`/payslip/${payslip.id}`}>
                        <Badge className={payslip.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-ink-100 text-ink-600 ring-ink-200"}>
                          {payslip.status === "PUBLISHED" ? "Published" : "Draft"}
                        </Badge>
                      </Link>
                    ) : (
                      <span className="text-xs text-ink-400">Not generated</span>
                    )}
                  </td>
                  <td className="td text-right tabular-nums">{payslip ? formatINR(payslip.netPay) : "—"}</td>
                  <td className="td text-right">
                    <Button size="sm" disabled={!profile} onClick={() => void generateFor(u)}>
                      {payslip ? "Regenerate" : "Generate"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={`Salary profile — ${editingUser?.name ?? ""}`}
        footer={(
          <>
            <Button onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void run(saveProfile, "Salary profile saved.")}>Save</Button>
          </>
        )}
      >
        {draft && (
          <div className="space-y-4">
            <div className="flex items-end gap-2 rounded-lg border border-dashed border-ink-300 p-3">
              <Field label="Annual CTC" className="flex-1">
                <Input type="number" value={ctcInput} onChange={(e) => setCtcInput(e.target.value)} placeholder="e.g. 600000" />
              </Field>
              <Button onClick={applyCtc}><Sparkles className="h-3.5 w-3.5" /> Auto-split</Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Basic"><Input type="number" value={draft.basic} onChange={(e) => setDraft({ ...draft, basic: Number(e.target.value) || 0 })} /></Field>
              <Field label="HRA"><Input type="number" value={draft.hra} onChange={(e) => setDraft({ ...draft, hra: Number(e.target.value) || 0 })} /></Field>
              <Field label="TA"><Input type="number" value={draft.ta} onChange={(e) => setDraft({ ...draft, ta: Number(e.target.value) || 0 })} /></Field>
              <Field label="Others"><Input type="number" value={draft.others} onChange={(e) => setDraft({ ...draft, others: Number(e.target.value) || 0 })} /></Field>
              <Field label="Misc"><Input type="number" value={draft.misc} onChange={(e) => setDraft({ ...draft, misc: Number(e.target.value) || 0 })} /></Field>
            </div>
            <p className="text-xs text-ink-500">
              Gross: {formatINR(draft.basic + draft.hra + draft.ta + draft.others + draft.misc)}/mo
              {draft.annualCtc ? ` · Estimated TDS: ${formatINR(estimateMonthlyTds(draft.annualCtc))}/mo (auto, overridable below)` : ""}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="PAN"><Input value={draft.pan ?? ""} onChange={(e) => setDraft({ ...draft, pan: e.target.value.toUpperCase() })} /></Field>
              <Field label="UAN"><Input value={draft.uan ?? ""} onChange={(e) => setDraft({ ...draft, uan: e.target.value })} /></Field>
              <Field label="PF Number"><Input value={draft.pfNumber ?? ""} onChange={(e) => setDraft({ ...draft, pfNumber: e.target.value })} /></Field>
              <Field label="ESI Number"><Input value={draft.esiNumber ?? ""} onChange={(e) => setDraft({ ...draft, esiNumber: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank account holder"><Input value={draft.bankAccountName ?? ""} onChange={(e) => setDraft({ ...draft, bankAccountName: e.target.value })} /></Field>
              <Field label="Bank name"><Input value={draft.bankName ?? ""} onChange={(e) => setDraft({ ...draft, bankName: e.target.value })} /></Field>
              <Field label="Account number"><Input value={draft.accountNumber ?? ""} onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })} /></Field>
              <Field label="IFSC"><Input value={draft.ifsc ?? ""} onChange={(e) => setDraft({ ...draft, ifsc: e.target.value.toUpperCase() })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Checkbox label="EPF" checked={draft.epfEnabled ?? false} onChange={(v) => setDraft({ ...draft, epfEnabled: v })} />
              <Checkbox label="ESIC" checked={draft.esicEnabled ?? false} onChange={(v) => setDraft({ ...draft, esicEnabled: v })} />
              <Checkbox label="Gratuity" checked={draft.gratuityEnabled ?? false} onChange={(v) => setDraft({ ...draft, gratuityEnabled: v })} />
              <Checkbox label="Bonus" checked={draft.bonusEnabled ?? false} onChange={(v) => setDraft({ ...draft, bonusEnabled: v })} />
              <Checkbox label="Health insurance" checked={draft.healthInsuranceEnabled ?? false} onChange={(v) => setDraft({ ...draft, healthInsuranceEnabled: v })} />
            </div>
            <Field label="Manual TDS override (optional, per month)">
              <Input
                type="number"
                value={draft.monthlyTdsOverride ?? ""}
                onChange={(e) => setDraft({ ...draft, monthlyTdsOverride: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
