"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, FileText, Paperclip, Plus, RotateCcw, Send, Trash2, Wallet,
} from "lucide-react";

import { useActor, useAuth } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Select, Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import {
  EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, EXPENSE_CLAIM_STATUS_COLOR, EXPENSE_CLAIM_STATUS_LABEL,
  MONTH_LABEL, type ExpenseCategory,
} from "@/lib/constants";
import { ymd } from "@/lib/dates";
import {
  createExpenseClaim, deleteExpenseClaim, isTravelCategory, newExpenseLineItem,
  recomputeTravelAmount, reviseExpenseClaim, saveExpenseClaimItems, submitExpenseClaim,
  subscribeMyExpenseClaims,
} from "@/lib/db/expense-claims";
import { deleteExpenseReceipt, uploadExpenseReceipt, validateFile } from "@/lib/db/expense-receipts";
import { useSettings } from "@/hooks/use-settings";
import type { ExpenseClaim, ExpenseLineItem } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

/**
 * Every employee's own expense claims — file, edit and delete drafts,
 * submit for approval, and track status through the manager/Finance
 * lifecycle. Open to every signed-in employee (no canManage* gate) — see
 * lib/page-access.ts's /expenses entry. Manager/Finance decisions happen on
 * a separate page, (app)/expenses/approvals.
 */
export default function ExpensesPage() {
  const actor = useActor();
  const { profile } = useAuth();
  const { settings } = useSettings();
  const { busy, run } = useAsyncAction();

  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [items, setItems] = useState<ExpenseLineItem[]>([]);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  useEffect(() => {
    if (!actor.uid) return;
    return subscribeMyExpenseClaims(
      actor.uid,
      (rows) => { setClaims(rows); setLoading(false); setError(null); },
      (e) => { setLoading(false); setError(e.message); },
    );
  }, [actor.uid]);

  const editing = claims.find((c) => c.id === editingId) ?? null;
  useEffect(() => { setItems(editing ? editing.items : []); }, [editing?.id, editing?.items]);

  const today = ymd(new Date());
  const now = new Date();

  const total = useMemo(() => items.reduce((s, i) => s + (i.amount || 0), 0), [items]);

  async function startNewClaim() {
    await run(async () => {
      const id = await createExpenseClaim(actor.uid, actor.name, now.getMonth() + 1, now.getFullYear(), actor);
      setEditingId(id);
    });
  }

  function addItem(category: ExpenseCategory) {
    setItems((prev) => [...prev, newExpenseLineItem(category, settings.expense, today)]);
  }

  function updateItem(id: string, patch: Partial<ExpenseLineItem>) {
    setItems((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      const next = { ...i, ...patch };
      return isTravelCategory(next.category) && "km" in patch ? recomputeTravelAmount(next, settings.expense) : next;
    }));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function saveDraft() {
    if (!editing) return;
    await run(() => saveExpenseClaimItems(editing, items, actor), "Draft saved.");
  }

  async function submitDraft() {
    if (!editing) return;
    await run(async () => {
      await saveExpenseClaimItems(editing, items, actor);
      await submitExpenseClaim({ ...editing, items }, profile?.managerId, actor);
      setEditingId(null);
    }, "Claim submitted.");
  }

  async function onFileChosen(itemId: string, file: File | undefined) {
    if (!file || !editing) return;
    const problem = validateFile(file);
    if (problem) { alert(problem); return; }
    setUploadingItemId(itemId);
    setUploadPct(0);
    try {
      const uploaded = await uploadExpenseReceipt(actor.uid, editing.id, file, actor, setUploadPct);
      updateItem(itemId, { receiptUrl: uploaded.url, receiptFileName: uploaded.fileName, receiptStoragePath: uploaded.storagePath });
    } catch (e) {
      alert((e as Error).message || "Upload failed.");
    } finally {
      setUploadingItemId(null);
      setUploadPct(null);
    }
  }

  async function removeReceipt(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (item?.receiptStoragePath) await deleteExpenseReceipt(item.receiptStoragePath);
    updateItem(itemId, { receiptUrl: undefined, receiptFileName: undefined, receiptStoragePath: undefined });
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">My Expenses</h1>
          <p className="mt-1 text-sm text-ink-500">
            File travel, hotel, daily allowance and other reimbursement claims. A claim goes to your
            manager once submitted, then Finance, before it's reimbursed.
          </p>
        </div>
        <Button variant="primary" loading={busy && !editing} onClick={() => void startNewClaim()}>
          <Plus className="h-4 w-4" /> New claim
        </Button>
      </div>

      {editing && (
        <Card
          className="mb-4"
          title={`${editing.number} — ${MONTH_LABEL[editing.month - 1]} ${editing.year}`}
          subtitle="Add line items below. Travel amounts are calculated automatically from km × the configured rate."
          actions={<Button size="sm" onClick={() => setEditingId(null)}>Close</Button>}
        >
          {editing.status !== "DRAFT" ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-900 ring-1 ring-inset ring-amber-200">
              This claim is {EXPENSE_CLAIM_STATUS_LABEL[editing.status].toLowerCase()} and can no longer be edited.
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {EXPENSE_CATEGORIES.map((c) => (
                  <Button key={c} size="sm" type="button" onClick={() => addItem(c)}>
                    <Plus className="h-3.5 w-3.5" /> {EXPENSE_CATEGORY_LABEL[c]}
                  </Button>
                ))}
              </div>

              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-ink-200 p-3">
                    <div className="grid gap-2 sm:grid-cols-[160px_140px_1fr_110px_130px_auto] sm:items-end">
                      <Field label="Category">
                        <Select
                          value={item.category}
                          onChange={(e) => updateItem(item.id, { category: e.target.value as ExpenseCategory, km: undefined, rateApplied: undefined })}
                          options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABEL[c] }))}
                        />
                      </Field>
                      <Field label="Date">
                        <Input type="date" max={today} value={item.date} onChange={(e) => updateItem(item.id, { date: e.target.value })} />
                      </Field>
                      <Field label="Description">
                        <Input
                          value={item.description ?? ""}
                          onChange={(e) => updateItem(item.id, { description: e.target.value })}
                          placeholder={isTravelCategory(item.category) ? "e.g. Client site visit" : "What was this for?"}
                        />
                      </Field>
                      {isTravelCategory(item.category) ? (
                        <Field label="Km">
                          <Input
                            type="number" min={0} step={0.1}
                            value={item.km ?? 0}
                            onChange={(e) => updateItem(item.id, { km: Number(e.target.value) || 0 })}
                          />
                        </Field>
                      ) : (
                        <div />
                      )}
                      <Field label="Amount (₹)">
                        <Input
                          type="number" min={0}
                          disabled={isTravelCategory(item.category)}
                          value={item.amount}
                          onChange={(e) => updateItem(item.id, { amount: Number(e.target.value) || 0 })}
                        />
                      </Field>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="mb-0.5 rounded p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Remove line item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {isTravelCategory(item.category) && (
                      <p className="mt-1 text-xs text-ink-500">
                        {item.km ?? 0} km × {formatINR(item.rateApplied ?? 0)}/km = <strong>{formatINR(item.amount)}</strong>
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-2">
                      {item.receiptUrl ? (
                        <>
                          <a href={item.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                            <FileText className="h-3.5 w-3.5" /> {item.receiptFileName}
                          </a>
                          <button type="button" onClick={() => void removeReceipt(item.id)} className="text-xs text-ink-400 hover:text-rose-600">Remove</button>
                        </>
                      ) : (
                        <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-ink-600 hover:text-brand-700">
                          <Paperclip className="h-3.5 w-3.5" />
                          {uploadingItemId === item.id ? `Uploading… ${uploadPct ?? 0}%` : "Attach receipt"}
                          <input
                            type="file"
                            accept="application/pdf,image/png,image/jpeg,image/webp,image/heic"
                            className="hidden"
                            disabled={uploadingItemId !== null}
                            onChange={(e) => void onFileChosen(item.id, e.target.files?.[0])}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ))}

                {items.length === 0 && (
                  <p className="py-6 text-center text-sm text-ink-500">No line items yet — add one above.</p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
                <p className="text-sm font-semibold text-ink-900">Total: {formatINR(total)}</p>
                <div className="flex gap-2">
                  <Button loading={busy} onClick={() => void saveDraft()}>Save draft</Button>
                  <Button variant="primary" loading={busy} disabled={items.length === 0} onClick={() => void submitDraft()}>
                    <Send className="h-3.5 w-3.5" /> Submit for approval
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : error ? (
        <EmptyState title="Couldn't load your expenses" description={error} />
      ) : claims.length === 0 ? (
        <EmptyState icon={<Wallet className="h-8 w-8" />} title="No expense claims yet" description="Click “New claim” to file your first one." />
      ) : (
        <Card>
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Claim</th>
                  <th className="th">Month</th>
                  <th className="th text-right">Total</th>
                  <th className="th">Status</th>
                  <th className="th">Note</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {claims.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50">
                    <td className="td font-medium text-ink-900">{c.number}</td>
                    <td className="td">{MONTH_LABEL[c.month - 1]} {c.year}</td>
                    <td className="td text-right tabular-nums">{formatINR(c.totalAmount)}</td>
                    <td className="td">
                      <Badge className={EXPENSE_CLAIM_STATUS_COLOR[c.status]}>{EXPENSE_CLAIM_STATUS_LABEL[c.status]}</Badge>
                      {c.routedDirectToFinance && c.status !== "DRAFT" && (
                        <span className="ml-1.5 text-[11px] text-ink-400">no manager on file — sent directly to Finance</span>
                      )}
                    </td>
                    <td className="td max-w-[220px] whitespace-normal break-words text-xs text-ink-500">
                      {c.status === "REJECTED" ? (c.financeNote || c.managerNote || "—") : "—"}
                    </td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-2">
                        {(c.status === "DRAFT") && (
                          <button type="button" onClick={() => setEditingId(c.id)} className="text-xs font-medium text-brand-700 hover:underline">Edit</button>
                        )}
                        {c.status === "REJECTED" && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                            onClick={() => void run(async () => { await reviseExpenseClaim(c, actor); setEditingId(c.id); }, "Reopened as a draft.")}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Revise
                          </button>
                        )}
                        {c.status === "DRAFT" && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline"
                            onClick={() => void run(async () => {
                              if (!window.confirm(`Delete draft ${c.number}?`)) return;
                              await deleteExpenseClaim(c, actor);
                              if (editingId === c.id) setEditingId(null);
                            }, "Draft deleted.")}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        )}
                        {c.status === "APPROVED" && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Reimbursed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
