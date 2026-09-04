"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useActor } from "@/components/auth-provider";
import { Button, Card, EmptyState, Field, Spinner, Textarea, useAsyncAction, useToast } from "@/components/ui";
import { ExpenseLineItemsField } from "@/components/expense-line-items";
import {
  getExpenseReport, updateExpenseReport, uploadExpenseReceipt, type ExpenseLineItemInput,
} from "@/lib/db/expenses";
import { defaultSettings, subscribeSettings, type AppSettings } from "@/lib/db/settings";
import type { ExpenseReport } from "@/lib/types";
import { formatINR, toDate } from "@/lib/utils";

export default function EditExpenseReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [report, setReport] = useState<ExpenseReport | null | undefined>(undefined);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings());
  const [items, setItems] = useState<ExpenseLineItemInput[]>([]);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState<number | null>(null);

  useEffect(() => {
    void getExpenseReport(id).then((row) => {
      setReport(row);
      if (!row) return;
      setItems(row.items.map((it) => ({ ...it, date: toDate(it.date) })));
      setNotes(row.notes ?? "");
    });
  }, [id]);
  useEffect(() => subscribeSettings(setSettings), []);

  if (report === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (report === null) return <EmptyState title="Expense report not found" action={<Link href="/expenses"><Button>Back to expenses</Button></Link>} />;

  const total = items.reduce((s, it) => s + (it.amount || 0), 0);

  async function onUpload(index: number, file: File) {
    setUploading(index);
    try {
      const { url, path } = await uploadExpenseReceipt(file, report!.uid);
      setItems((rows) => rows.map((it, i) => (i === index ? { ...it, receiptUrl: url, receiptPath: path } : it)));
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setUploading(null);
    }
  }

  async function onSave() {
    if (items.length === 0 || items.every((it) => !it.amount)) {
      push("Add at least one expense with an amount.", "error");
      return;
    }
    await run(async () => {
      await updateExpenseReport(report!, { items, notes }, actor);
      router.push(`/expenses/${report!.id}`);
    }, "Expense report updated.");
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-navy-900">Edit Expense Report</h1>
        <p className="text-sm text-ink-500">{report.reportNo} — {report.userName} — {report.month}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
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
              <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(total)}</dd></div>
            </dl>
            <div className="mt-4 space-y-2">
              <Button variant="primary" className="w-full justify-center" onClick={() => void onSave()} loading={busy}>Save Changes</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => router.push(`/expenses/${report.id}`)}>Cancel</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
