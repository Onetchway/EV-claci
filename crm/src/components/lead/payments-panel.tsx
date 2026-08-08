"use client";

import { BadgeCheck, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, ProgressBar, Select,
  Textarea, useAsyncAction,
} from "@/components/ui";
import { GST_RATE } from "@/lib/catalog";
import {
  MILESTONE_LABEL, PAYMENT_MILESTONES, PAYMENT_MODES, PAYMENT_STATUSES,
  PAYMENT_STATUS_COLOR,
  type PaymentMilestone, type PaymentMode, type PaymentStatus,
} from "@/lib/constants";
import {
  addPayment, deletePayment, subscribePayments, summarisePayments, updatePayment,
} from "@/lib/db/payments";
import { canDeletePayment, canVerifyPayment, type Viewer } from "@/lib/permissions";
import type { Actor, Lead, Payment } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

interface DraftState {
  milestone: PaymentMilestone;
  baseAmount: string;
  mode: PaymentMode;
  reference: string;
  status: PaymentStatus;
  paidAt: string;
  note: string;
}

const blankDraft = (milestone: PaymentMilestone, amount = ""): DraftState => ({
  milestone,
  baseAmount: amount,
  mode: "NEFT",
  reference: "",
  status: "RECEIVED",
  paidAt: new Date().toISOString().slice(0, 10),
  note: "",
});

export function PaymentsPanel({
  lead, actor, viewer, canEdit, onSummary,
}: {
  lead: Lead;
  actor: Actor;
  viewer: Viewer;
  canEdit: boolean;
  onSummary?: (collectedPct: number) => void;
}) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Payment | null>(null);
  const { busy, run } = useAsyncAction();

  useEffect(
    () => subscribePayments(lead.id, (rows) => { setPayments(rows); setLoading(false); }, () => setLoading(false)),
    [lead.id],
  );

  const summary = useMemo(() => summarisePayments(lead, payments), [lead, payments]);

  useEffect(() => onSummary?.(summary.collectedPct), [summary.collectedPct, onSummary]);

  const draftGst = draft ? Math.round((Number(draft.baseAmount) || 0) * GST_RATE) : 0;
  const draftTotal = draft ? (Math.round(Number(draft.baseAmount) || 0) + draftGst) : 0;

  function openNew(milestone: PaymentMilestone) {
    const m = summary.milestones.find((x) => x.key === milestone);
    // Pre-fill with what is still owed on that milestone, pre-GST.
    const suggested = m && m.balance > 0 ? Math.round(m.balance / (1 + GST_RATE)) : 0;
    setEditing(null);
    setDraft(blankDraft(milestone, suggested ? String(suggested) : ""));
  }

  function openEdit(p: Payment) {
    setEditing(p);
    setDraft({
      milestone: p.milestone,
      baseAmount: String(p.baseAmount),
      mode: p.mode,
      reference: p.reference ?? "",
      status: p.status,
      paidAt: p.paidAt ? new Date((p.paidAt as unknown as { toDate(): Date }).toDate()).toISOString().slice(0, 10) : "",
      note: p.note ?? "",
    });
  }

  async function save() {
    if (!draft) return;
    const base = Math.round(Number(draft.baseAmount) || 0);
    if (base <= 0) throw new Error("Enter an amount greater than zero.");

    const payload = {
      milestone: draft.milestone,
      baseAmount: base,
      mode: draft.mode,
      reference: draft.reference.trim(),
      status: draft.status,
      paidAt: draft.paidAt ? new Date(`${draft.paidAt}T00:00:00`) : null,
      note: draft.note.trim(),
    };

    if (editing) await updatePayment(lead, editing, payload, actor);
    else await addPayment(lead, payload, actor);

    setDraft(null);
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <Card
        title="Collection summary"
        subtitle="Reconciled against the quotation's three-stage schedule."
        actions={
          canEdit && (
            <Button size="sm" variant="primary" onClick={() => openNew("EOI")}>
              <Plus className="h-3.5 w-3.5" /> Record payment
            </Button>
          )
        }
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-500">Total payable</p>
            <p className="text-lg font-semibold">{formatINR(summary.planned)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-500">Collected</p>
            <p className="text-lg font-semibold text-emerald-600">{formatINR(summary.received)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-500">Balance</p>
            <p className="text-lg font-semibold text-amber-600">{formatINR(summary.balance)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-500">Awaiting clearance</p>
            <p className="text-lg font-semibold text-ink-700">{formatINR(summary.pending)}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-ink-500">
            <span>Overall collection</span>
            <span>{summary.collectedPct}%</span>
          </div>
          <ProgressBar pct={summary.collectedPct} />
        </div>

        <ul className="mt-4 space-y-3">
          {summary.milestones.map((m) => (
            <li key={m.key}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-ink-800">{m.label}</span>
                <span className="text-xs tabular-nums text-ink-600">
                  {formatINR(m.received)} of {formatINR(m.planned)}
                  {m.balance > 0 && <span className="ml-1 text-amber-600">· {formatINR(m.balance)} due</span>}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ProgressBar pct={m.pct} className="flex-1" />
                {canEdit && m.key !== "OTHER" && m.balance > 0 && (
                  <button
                    type="button"
                    onClick={() => openNew(m.key)}
                    className="shrink-0 text-xs font-medium text-brand-700 hover:underline"
                  >
                    Record
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Payment ledger" subtitle={`${payments.length} entr${payments.length === 1 ? "y" : "ies"}`}>
        {loading ? (
          <p className="py-6 text-center text-sm text-ink-500">Loading…</p>
        ) : payments.length === 0 ? (
          <EmptyState
            title="No payments recorded"
            description="Record the EOI token as soon as it lands so the pipeline value stays honest."
            action={canEdit ? <Button variant="primary" onClick={() => openNew("EOI")}><Plus className="h-4 w-4" /> Record payment</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Milestone</th>
                  <th className="th text-right">Base</th>
                  <th className="th text-right">GST</th>
                  <th className="th text-right">Total</th>
                  <th className="th">Mode / Ref</th>
                  <th className="th">Date</th>
                  <th className="th">Status</th>
                  <th className="th">Recorded by</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50">
                    <td className="td">
                      <span className="font-medium">{MILESTONE_LABEL[p.milestone]}</span>
                      {p.note && <span className="mt-0.5 block max-w-[220px] truncate text-xs text-ink-500">{p.note}</span>}
                    </td>
                    <td className="td text-right tabular-nums">{formatINR(p.baseAmount)}</td>
                    <td className="td text-right tabular-nums text-ink-500">{formatINR(p.gstAmount)}</td>
                    <td className="td text-right font-semibold tabular-nums">{formatINR(p.totalAmount)}</td>
                    <td className="td">
                      {p.mode}
                      {p.reference && <span className="mt-0.5 block text-xs text-ink-500">{p.reference}</span>}
                    </td>
                    <td className="td text-ink-600">{formatDate(p.paidAt)}</td>
                    <td className="td">
                      <Badge className={PAYMENT_STATUS_COLOR[p.status]}>{p.status}</Badge>
                    </td>
                    <td className="td text-xs text-ink-500">
                      {p.createdBy?.name}
                      {p.verifiedBy && (
                        <span className="mt-0.5 flex items-center gap-1 text-emerald-600">
                          <BadgeCheck className="h-3 w-3" /> {p.verifiedBy.name}
                        </span>
                      )}
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        {canVerifyPayment(viewer) && p.status !== "VERIFIED" && (
                          <button
                            type="button"
                            onClick={() => void run(() => updatePayment(lead, p, { status: "VERIFIED" }, actor), "Payment verified.")}
                            className="rounded px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            Verify
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="rounded px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-100"
                          >
                            Edit
                          </button>
                        )}
                        {canDeletePayment(viewer) && (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(p)}
                            className="rounded p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Delete payment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={draft !== null}
        onClose={() => { setDraft(null); setEditing(null); }}
        title={editing ? "Edit payment" : "Record payment"}
        description="Enter the amount excluding GST — tax is calculated automatically."
        footer={
          <>
            <Button onClick={() => { setDraft(null); setEditing(null); }}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void run(save, "Payment saved.")}>
              {editing ? "Save changes" : "Record payment"}
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Milestone" required className="sm:col-span-2">
              <Select
                value={draft.milestone}
                onChange={(e) => setDraft({ ...draft, milestone: e.target.value as PaymentMilestone })}
                options={PAYMENT_MILESTONES.map((m) => ({ value: m, label: MILESTONE_LABEL[m] }))}
              />
            </Field>

            <Field label="Amount (excl. GST)" required>
              <Input
                type="number"
                min={0}
                step={1000}
                value={draft.baseAmount}
                onChange={(e) => setDraft({ ...draft, baseAmount: e.target.value })}
              />
            </Field>

            <Field label="Payment mode">
              <Select
                value={draft.mode}
                onChange={(e) => setDraft({ ...draft, mode: e.target.value as PaymentMode })}
                options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))}
              />
            </Field>

            <Field label="Reference / UTR">
              <Input value={draft.reference} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} />
            </Field>

            <Field label="Payment date">
              <Input type="date" value={draft.paidAt} onChange={(e) => setDraft({ ...draft, paidAt: e.target.value })} />
            </Field>

            <Field label="Status" className="sm:col-span-2">
              <Select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as PaymentStatus })}
                options={PAYMENT_STATUSES
                  .filter((s) => s !== "VERIFIED" || canVerifyPayment(viewer))
                  .map((s) => ({ value: s, label: s }))}
              />
            </Field>

            <Field label="Note" className="sm:col-span-2">
              <Textarea rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </Field>

            <div className="sm:col-span-2 rounded-lg bg-ink-50 px-3 py-2.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-600">GST @ 18%</span><span className="tabular-nums">{formatINR(draftGst)}</span></div>
              <div className="mt-1 flex justify-between font-semibold"><span>Total received</span><span className="tabular-nums">{formatINR(draftTotal)}</span></div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete payment entry?"
        description="This removes the entry from the ledger and recalculates the collection totals."
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (confirmDelete) await deletePayment(lead, confirmDelete, actor);
                  setConfirmDelete(null);
                }, "Payment deleted.")
              }
            >
              Delete
            </Button>
          </>
        }
      >
        {confirmDelete && (
          <p className="text-sm text-ink-700">
            {MILESTONE_LABEL[confirmDelete.milestone]} — {formatINR(confirmDelete.totalAmount)}, recorded by{" "}
            {confirmDelete.createdBy?.name}. The deletion is written to the audit log.
          </p>
        )}
      </Modal>
    </div>
  );
}
