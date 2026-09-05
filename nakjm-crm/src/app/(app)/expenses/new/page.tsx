"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useActor, useAuth, useViewer } from "@/components/auth-provider";
import { Button, Card, Field, Select, Spinner, Textarea, useAsyncAction, useToast } from "@/components/ui";
import { ExpenseLineItemsField } from "@/components/expense-line-items";
import { createExpenseReport, submitExpenseReport, uploadExpenseReceipt, type ExpenseLineItemInput } from "@/lib/db/expenses";
import { defaultSettings, subscribeSettings, type AppSettings } from "@/lib/db/settings";
import { subscribeActiveUsers } from "@/lib/db/users";
import { canManageHrms } from "@/lib/permissions";
import type { AppUser } from "@/lib/types";
import { formatINR } from "@/lib/utils";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function NewExpenseReportPage() {
  const router = useRouter();
  const actor = useActor();
  const viewer = useViewer();
  const { profile } = useAuth();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings());
  const [uid, setUid] = useState(profile?.uid ?? "");
  const [month, setMonth] = useState(currentMonth());
  const [items, setItems] = useState<ExpenseLineItemInput[]>([{ category: "OTHER", date: new Date(), amount: 0 }]);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState<number | null>(null);

  useEffect(() => { if (canManageHrms(viewer)) return subscribeActiveUsers(setUsers); }, [viewer]);
  useEffect(() => subscribeSettings(setSettings), []);
  useEffect(() => { if (profile && !uid) setUid(profile.uid); }, [profile, uid]);

  const employee = canManageHrms(viewer) ? users.find((u) => u.uid === uid) : profile;
  const total = items.reduce((s, it) => s + (it.amount || 0), 0);

  async function onUpload(index: number, file: File) {
    if (!uid) return;
    setUploading(index);
    try {
      const { url, path } = await uploadExpenseReceipt(file, uid);
      setItems((rows) => rows.map((it, i) => (i === index ? { ...it, receiptUrl: url, receiptPath: path } : it)));
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setUploading(null);
    }
  }

  async function onSave(submit: boolean) {
    if (!employee) {
      push("Employee is required.", "error");
      return;
    }
    if (items.length === 0 || items.every((it) => !it.amount)) {
      push("Add at least one expense with an amount.", "error");
      return;
    }
    await run(async () => {
      const report = await createExpenseReport({
        uid: employee.uid, userName: employee.name, managerId: employee.managerId ?? null, managerName: employee.managerName ?? null,
        month, items, notes,
      }, actor);
      if (submit) await submitExpenseReport(report, actor);
      router.push(`/expenses/${report.id}`);
    }, submit ? "Expense report submitted." : "Expense report saved as draft.");
  }

  if (!profile) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-navy-900">New Expense Report</h1>
        <p className="text-sm text-ink-500">Add your travel, hotel, daily allowance and other expenses, then submit for your manager's approval.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Report details">
            <div className="grid grid-cols-2 gap-3">
              {canManageHrms(viewer) && (
                <Field label="Employee" className="col-span-2" hint="Filing on behalf of an employee — only HR/Admin can do this.">
                  <Select value={uid} options={users.map((u) => ({ value: u.uid, label: u.name }))} onChange={(e) => setUid(e.target.value)} />
                </Field>
              )}
              <Field label="Month"><input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
              <Field label="Manager" hint="Approves this report first."><p className="input flex items-center bg-ink-50">{employee?.managerName || "No manager set"}</p></Field>
            </div>
          </Card>

          <Card title="Expenses">
            <ExpenseLineItemsField value={items} onChange={setItems} policy={settings.expensePolicy} uploading={uploading} onUpload={onUpload} />
          </Card>

          <Card title="Notes">
            <Field label="Notes for your manager/finance"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Employee</dt><dd>{employee?.name ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Line items</dt><dd>{items.length}</dd></div>
              <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(total)}</dd></div>
            </dl>
            <div className="mt-4 space-y-2">
              <Button variant="primary" className="w-full justify-center" onClick={() => void onSave(true)} loading={busy}>Submit for Approval</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => void onSave(false)} loading={busy}>Save as Draft</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => router.push("/expenses")}>Cancel</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
