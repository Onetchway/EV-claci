"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Pencil, Receipt, Send, Trash2, X } from "lucide-react";

import { useActor, useAuth, useViewer } from "@/components/auth-provider";
import { EntityActivityLog } from "@/components/entity-activity-log";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner, Textarea, useAsyncAction } from "@/components/ui";
import { EXPENSE_CATEGORY_LABEL, EXPENSE_REPORT_STATUS_META } from "@/lib/constants";
import {
  decideExpenseReportAsFinance, decideExpenseReportAsManager, deleteExpenseReport, markExpenseReportPaid,
  submitExpenseReport, subscribeExpenseReport,
} from "@/lib/db/expenses";
import { canManagePayments, canTrash, viewerIsAdmin } from "@/lib/permissions";
import type { ExpenseReport } from "@/lib/types";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

export default function ExpenseReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const viewer = useViewer();
  const { profile } = useAuth();
  const { busy, run } = useAsyncAction();

  const [report, setReport] = useState<ExpenseReport | null | undefined>(undefined);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [decideOpen, setDecideOpen] = useState<"MANAGER" | "FINANCE" | null>(null);
  const [decideApprove, setDecideApprove] = useState(true);
  const [decideNote, setDecideNote] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [referenceNo, setReferenceNo] = useState("");

  useEffect(() => subscribeExpenseReport(id, setReport), [id]);

  if (report === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (report === null) return <EmptyState title="Expense report not found" action={<Link href="/expenses"><Button>Back to expenses</Button></Link>} />;

  const isOwner = profile?.uid === report.uid;
  const isManager = profile?.uid === report.managerId || viewerIsAdmin(viewer);
  const isFinance = canManagePayments(viewer);
  const canEdit = isOwner && (report.status === "DRAFT" || report.status === "REJECTED");
  const canDelete = (isOwner && report.status === "DRAFT") || canTrash(viewer);

  async function onSubmit() {
    await run(() => submitExpenseReport(report!, actor), "Submitted for approval.");
  }

  function openDecide(stage: "MANAGER" | "FINANCE", approve: boolean) {
    setDecideOpen(stage);
    setDecideApprove(approve);
    setDecideNote("");
  }

  async function onDecide() {
    await run(async () => {
      if (decideOpen === "MANAGER") await decideExpenseReportAsManager(report!, decideApprove, actor, decideNote);
      else if (decideOpen === "FINANCE") await decideExpenseReportAsFinance(report!, decideApprove, actor, decideNote);
      setDecideOpen(null);
    }, decideApprove ? "Approved." : "Rejected.");
  }

  async function onMarkPaid() {
    await run(async () => {
      await markExpenseReportPaid(report!, referenceNo, actor);
      setPayOpen(false);
    }, "Marked paid.");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={report.reportNo}
        description={`${report.userName} — ${report.month}`}
        actions={
          <>
            <Badge className={EXPENSE_REPORT_STATUS_META[report.status].className}>{EXPENSE_REPORT_STATUS_META[report.status].label}</Badge>
            {canEdit && (
              <>
                <Link href={`/expenses/${report.id}/edit`}><Button><Pencil className="h-4 w-4" /> Edit</Button></Link>
                <Button variant="primary" loading={busy} onClick={() => void onSubmit()}><Send className="h-4 w-4" /> Submit for Approval</Button>
              </>
            )}
            {report.status === "SUBMITTED" && isManager && (
              <>
                <Button className="text-emerald-700 hover:bg-emerald-50" onClick={() => openDecide("MANAGER", true)}><Check className="h-4 w-4" /> Approve</Button>
                <Button className="text-rose-700 hover:bg-rose-50" onClick={() => openDecide("MANAGER", false)}><X className="h-4 w-4" /> Reject</Button>
              </>
            )}
            {report.status === "MANAGER_APPROVED" && isFinance && (
              <>
                <Button className="text-emerald-700 hover:bg-emerald-50" onClick={() => openDecide("FINANCE", true)}><Check className="h-4 w-4" /> Approve</Button>
                <Button className="text-rose-700 hover:bg-rose-50" onClick={() => openDecide("FINANCE", false)}><X className="h-4 w-4" /> Reject</Button>
              </>
            )}
            {report.status === "FINANCE_APPROVED" && isFinance && (
              <Button variant="primary" onClick={() => setPayOpen(true)}>Mark Paid</Button>
            )}
            {canDelete && (
              <Button className="text-rose-700 hover:bg-rose-50" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Expenses" subtitle={`${report.items.length} ${report.items.length === 1 ? "item" : "items"}`}>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                    <th className="py-2 pr-3">Category</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2 text-right">Km</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="py-2 pl-3">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {report.items.map((it, i) => (
                    <tr key={i} className="border-b border-ink-100">
                      <td className="py-2.5 pr-3 align-top">{EXPENSE_CATEGORY_LABEL[it.category]}</td>
                      <td className="px-3 py-2.5 align-top text-ink-500">{formatDate(it.date)}</td>
                      <td className="px-3 py-2.5 align-top text-ink-600">{it.description || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums">{it.distanceKm || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums">{formatINR(it.amount)}</td>
                      <td className="py-2.5 pl-3 align-top">
                        {it.receiptUrl ? (
                          <a href={it.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Receipt className="h-3.5 w-3.5" /> View</a>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-end border-t border-ink-100 pt-3 text-base font-semibold">
              Total&nbsp;<span className="tabular-nums">{formatINR(report.totalAmount)}</span>
            </div>
          </Card>

          {report.notes && <Card title="Notes"><p className="whitespace-pre-line text-sm text-ink-700">{report.notes}</p></Card>}

          {(report.managerDecisionBy || report.financeDecisionBy || report.paidBy) && (
            <Card title="Approval trail">
              <dl className="space-y-3 text-sm">
                {report.managerDecisionBy && (
                  <div>
                    <dt className="text-ink-500">Manager decision</dt>
                    <dd>{report.managerDecisionBy.name} · {formatDateTime(report.managerDecisionAt)}{report.managerNote ? ` — "${report.managerNote}"` : ""}</dd>
                  </div>
                )}
                {report.financeDecisionBy && (
                  <div>
                    <dt className="text-ink-500">Finance decision</dt>
                    <dd>{report.financeDecisionBy.name} · {formatDateTime(report.financeDecisionAt)}{report.financeNote ? ` — "${report.financeNote}"` : ""}</dd>
                  </div>
                )}
                {report.paidBy && (
                  <div>
                    <dt className="text-ink-500">Paid</dt>
                    <dd>{report.paidBy.name} · {formatDateTime(report.paidAt)}{report.paidReferenceNo ? ` — Ref: ${report.paidReferenceNo}` : ""}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Employee</dt><dd>{report.userName}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Manager</dt><dd>{report.managerName || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Month</dt><dd>{report.month}</dd></div>
              {report.submittedAt && <div className="flex justify-between"><dt className="text-ink-500">Submitted</dt><dd>{formatDate(report.submittedAt)}</dd></div>}
            </dl>
          </Card>

          <EntityActivityLog entityType="EXPENSE_REPORT" entityId={report.id} />
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this expense report?"
        description="This cannot be undone."
        footer={<><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => void run(async () => { await deleteExpenseReport(report!, actor); router.push("/expenses"); }, "Expense report deleted.")}><Trash2 className="h-4 w-4" /> Delete</Button></>}
      >
        <p className="text-sm text-ink-700">{report.reportNo} — {report.userName}</p>
      </Modal>

      <Modal
        open={decideOpen !== null}
        onClose={() => setDecideOpen(null)}
        title={`${decideApprove ? "Approve" : "Reject"} this expense report?`}
        footer={<><Button variant="secondary" onClick={() => setDecideOpen(null)}>Cancel</Button><Button variant={decideApprove ? "primary" : "danger"} loading={busy} onClick={() => void onDecide()}>{decideApprove ? "Approve" : "Reject"}</Button></>}
      >
        <Field label="Note (optional)"><Textarea value={decideNote} onChange={(e) => setDecideNote(e.target.value)} /></Field>
      </Modal>

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Mark this expense report as paid"
        footer={<><Button variant="secondary" onClick={() => setPayOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={() => void onMarkPaid()}>Mark Paid</Button></>}
      >
        <Field label="Payment reference (optional)"><Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Bank transfer ref, cheque no…" /></Field>
      </Modal>
    </div>
  );
}
