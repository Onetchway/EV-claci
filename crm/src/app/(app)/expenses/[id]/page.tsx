"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Send, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Spinner, Textarea, useAsyncAction, useToast,
} from "@/components/ui";
import { ExpenseItemsEditor } from "@/components/expense-items-editor";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useSettings } from "@/hooks/use-settings";
import {
  decideFinance, decideManager, deleteClaim, subscribeClaim, submitClaim, updateClaimItems,
  uploadReceipt, type ExpenseItemDraft,
} from "@/lib/db/expenses";
import { canApproveExpenseAsFinance, canApproveExpenseAsManager, canSeeAllHrms } from "@/lib/permissions";
import { EXPENSE_CATEGORY_LABEL, EXPENSE_STATUS_META } from "@/lib/constants";
import type { ExpenseClaim } from "@/lib/types";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

function toDraft(claim: ExpenseClaim): ExpenseItemDraft[] {
  return claim.items.map((it) => ({
    category: it.category,
    date: it.date?.toDate?.() ?? new Date(),
    description: it.description,
    km: it.km,
    rate: it.rate,
    amount: it.amount,
    receiptUrl: it.receiptUrl,
    receiptName: it.receiptName,
  }));
}

export default function ExpenseClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { actor, profile } = useAuth();
  const viewer = useViewer();
  const { settings } = useSettings();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [claim, setClaim] = useState<ExpenseClaim | null | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<ExpenseItemDraft[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [managerNote, setManagerNote] = useState("");
  const [financeNote, setFinanceNote] = useState("");

  useEffect(() => subscribeClaim(id, (row) => {
    setClaim(row);
    if (row) { setTitle(row.title); setItems(toDraft(row)); }
  }), [id]);
  useDocumentTitle(claim ? `Expense · ${claim.claimNo}` : undefined);

  if (claim === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (claim === null) return <EmptyState title="Expense claim not found" />;

  const isOwner = profile?.uid === claim.uid;
  const isDraft = claim.status === "DRAFT";
  const canEditNow = isOwner && isDraft;
  const isManagerTurn = claim.status === "SUBMITTED" && canApproveExpenseAsManager(viewer)
    && (canSeeAllHrms(viewer) || claim.managerId === viewer.uid);
  const isFinanceTurn = claim.status === "MANAGER_APPROVED" && canApproveExpenseAsFinance(viewer);
  const total = items.reduce((s, it) => s + it.amount, 0);

  async function onUpload(i: number, file: File) {
    if (!actor) return;
    setUploadingIdx(i);
    try {
      const { url, name } = await uploadReceipt(id, file, actor);
      setItems((rows) => rows.map((row, idx) => (idx === i ? { ...row, receiptUrl: url, receiptName: name } : row)));
      push("Receipt uploaded.", "success");
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setUploadingIdx(null);
    }
  }

  async function saveChanges() {
    if (!claim || !actor) return;
    await run(() => updateClaimItems(claim, title, items, actor), "Claim updated.");
  }

  async function onSubmit() {
    if (!claim || !actor || !profile) return;
    if (items.length === 0) { push("Add at least one item before submitting.", "error"); return; }
    await run(async () => {
      await updateClaimItems(claim, title, items, actor);
      await submitClaim(claim, profile.managerId ?? null, actor);
    }, "Submitted to your manager.");
  }

  async function onManagerDecision(approve: boolean) {
    if (!claim || !actor) return;
    await run(() => decideManager(claim, approve, actor, managerNote), approve ? "Approved — sent to finance." : "Rejected.");
    setManagerNote("");
  }

  async function onFinanceDecision(approve: boolean) {
    if (!claim || !actor) return;
    await run(() => decideFinance(claim, approve, actor, financeNote), approve ? "Approved for reimbursement." : "Rejected.");
    setFinanceNote("");
  }

  return (
    <>
      <PageHeader
        title={claim.title}
        description={`${claim.claimNo} · ${claim.userName}`}
        actions={(
          <>
            <Badge className={EXPENSE_STATUS_META[claim.status].className}>{EXPENSE_STATUS_META[claim.status].label}</Badge>
            {canEditNow && (
              <Button onClick={() => setDeleteOpen(true)} className="text-rose-700 hover:bg-rose-50">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </>
        )}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {canEditNow && (
            <Card title="Title">
              <Field label="Title" required>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
              </Field>
            </Card>
          )}

          <Card
            title="Items"
            subtitle={!canEditNow ? "Locked — this claim is no longer a draft." : undefined}
            actions={canEditNow && (
              <Button size="sm" onClick={() => setItems((rows) => [...rows, { category: "OTHER", date: new Date(), description: "", amount: 0 }])}>
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            )}
          >
            {canEditNow ? (
              <ExpenseItemsEditor items={items} onChange={setItems} rates={settings.expense} uploadingIdx={uploadingIdx} onUpload={onUpload} />
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full">
                  <thead className="border-b border-ink-200">
                    <tr>
                      <th className="th">Category</th>
                      <th className="th">Date</th>
                      <th className="th">Description</th>
                      <th className="th text-right">Amount</th>
                      <th className="th">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {claim.items.map((it) => (
                      <tr key={it.id}>
                        <td className="td">{EXPENSE_CATEGORY_LABEL[it.category]}</td>
                        <td className="td text-ink-600">{formatDate(it.date)}</td>
                        <td className="td text-ink-600">{it.description || "—"}{it.km ? ` (${it.km} km)` : ""}</td>
                        <td className="td text-right tabular-nums">{formatINR(it.amount)}</td>
                        <td className="td">
                          {it.receiptUrl ? <a href={it.receiptUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">View</a> : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {canEditNow && (
            <div className="flex gap-2">
              <Button variant="primary" loading={busy} onClick={() => void saveChanges()}>Save changes</Button>
              <Button variant="primary" loading={busy} onClick={() => void onSubmit()}><Send className="h-4 w-4" /> Submit to manager</Button>
            </div>
          )}

          {isManagerTurn && (
            <Card title="Manager decision">
              <Field label="Note (optional)"><Textarea rows={2} value={managerNote} onChange={(e) => setManagerNote(e.target.value)} /></Field>
              <div className="mt-3 flex gap-2">
                <Button variant="primary" loading={busy} onClick={() => void onManagerDecision(true)}>Approve</Button>
                <Button variant="danger" loading={busy} onClick={() => void onManagerDecision(false)}>Reject</Button>
              </div>
            </Card>
          )}

          {isFinanceTurn && (
            <Card title="Finance decision">
              <Field label="Note (optional)"><Textarea rows={2} value={financeNote} onChange={(e) => setFinanceNote(e.target.value)} /></Field>
              <div className="mt-3 flex gap-2">
                <Button variant="primary" loading={busy} onClick={() => void onFinanceDecision(true)}>Approve</Button>
                <Button variant="danger" loading={busy} onClick={() => void onFinanceDecision(false)}>Reject</Button>
              </div>
            </Card>
          )}

          {(claim.managerDecision?.by || claim.financeDecision?.by) && (
            <Card title="Approval history">
              <dl className="space-y-3 text-sm">
                {claim.managerDecision?.by && (
                  <div>
                    <dt className="text-xs text-ink-500">Manager — {claim.managerDecision.status}</dt>
                    <dd className="text-ink-900">{claim.managerDecision.by.name} · {claim.managerDecision.at ? formatDateTime(claim.managerDecision.at) : ""}{claim.managerDecision.note ? ` — "${claim.managerDecision.note}"` : ""}</dd>
                  </div>
                )}
                {claim.financeDecision?.by && (
                  <div>
                    <dt className="text-xs text-ink-500">Finance — {claim.financeDecision.status}</dt>
                    <dd className="text-ink-900">{claim.financeDecision.by.name} · {claim.financeDecision.at ? formatDateTime(claim.financeDecision.at) : ""}{claim.financeDecision.note ? ` — "${claim.financeDecision.note}"` : ""}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}
        </div>

        <div>
          <Card title="Summary" className="sticky top-16">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(canEditNow ? total : claim.totalAmount)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-600">Month</dt><dd>{claim.month}</dd></div>
              {claim.submittedAt && <div className="flex justify-between"><dt className="text-ink-600">Submitted</dt><dd>{formatDate(claim.submittedAt)}</dd></div>}
            </dl>
          </Card>
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this claim?"
        description="This permanently removes the draft claim. It cannot be recovered."
        footer={(
          <>
            <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  await deleteClaim(claim);
                  router.push("/expenses");
                }, "Claim deleted.")
              }
            >
              <Trash2 className="h-4 w-4" /> Delete claim
            </Button>
          </>
        )}
      >
        <p className="text-sm text-ink-700">{claim.claimNo} — {claim.title}</p>
      </Modal>
    </>
  );
}
