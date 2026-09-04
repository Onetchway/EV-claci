"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button, Card, Field, Input, Spinner, useAsyncAction, useToast } from "@/components/ui";
import { ExpenseItemsEditor } from "@/components/expense-items-editor";
import { useSettings } from "@/hooks/use-settings";
import { createClaim, uploadReceipt, type ExpenseItemDraft } from "@/lib/db/expenses";
import { formatINR } from "@/lib/utils";

function blankItem(): ExpenseItemDraft {
  return { category: "OTHER", date: new Date(), description: "", amount: 0 };
}

export default function NewExpenseClaimPage() {
  const router = useRouter();
  const { actor, profile } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [title, setTitle] = useState("");
  const [items, setItems] = useState<ExpenseItemDraft[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [claimKey] = useState(() => crypto.randomUUID());

  async function onUpload(i: number, file: File) {
    if (!actor) return;
    setUploadingIdx(i);
    try {
      const { url, name } = await uploadReceipt(claimKey, file, actor);
      setItems((rows) => rows.map((row, idx) => (idx === i ? { ...row, receiptUrl: url, receiptName: name } : row)));
      push("Receipt uploaded.", "success");
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setUploadingIdx(null);
    }
  }

  const total = items.reduce((s, it) => s + it.amount, 0);

  async function onSave() {
    if (!actor || !profile) return;
    if (!title.trim()) { push("Give this claim a title.", "error"); return; }
    if (items.length === 0) { push("Add at least one expense item.", "error"); return; }
    await run(async () => {
      const { id } = await createClaim(profile.uid, profile.name, title, items, actor);
      router.push(`/expenses/${id}`);
    }, "Claim saved as draft.");
  }

  if (settingsLoading) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;

  return (
    <>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-navy-900">New expense claim</h1>
        <p className="text-sm text-ink-500">
          Saved as a draft first — add, edit or remove items freely, then submit it to your manager when ready.
          Travel and Daily Allowance auto-calculate (₹{settings.expense.bikeRatePerKm}/km bike, ₹{settings.expense.carRatePerKm}/km car, ₹{settings.expense.dailyAllowanceRate}/day).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Claim details">
            <Field label="Title" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Site visit — Pune, 12–14 Sep" />
            </Field>
          </Card>

          <Card title="Items" actions={<Button size="sm" onClick={() => setItems((rows) => [...rows, blankItem()])}><Plus className="h-3.5 w-3.5" /> Add item</Button>}>
            <ExpenseItemsEditor items={items} onChange={setItems} rates={settings.expense} uploadingIdx={uploadingIdx} onUpload={onUpload} />
          </Card>
        </div>

        <div>
          <Card title="Summary" className="sticky top-16">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(total)}</dd></div>
            </dl>
            <div className="mt-4 space-y-2">
              <Button variant="primary" className="w-full justify-center" loading={busy} onClick={() => void onSave()}>Save as draft</Button>
              <Button className="w-full justify-center" onClick={() => router.push("/expenses")}>Cancel</Button>
            </div>
            <p className="mt-3 text-xs text-ink-500">Submit to your manager from the claim page after saving.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
