"use client";

import { BadgeCheck, Plus, Printer, Receipt as ReceiptIcon, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, ProgressBar, Select,
  Textarea, useAsyncAction,
} from "@/components/ui";
import { GST_RATE } from "@/lib/catalog";
import { useSettings } from "@/hooks/use-settings";
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

// Presets cover every slab Livanto actually invoices at; "Custom" unlocks a
// free-typed rate for the odd one-off that doesn't fit those.
const GST_PRESETS = [0.05, 0.089, 0.12, 0.18] as const;

interface DraftState {
  milestone: PaymentMilestone;
  baseAmount: string;
  gstPct: string;
  gstCustom: boolean;
  mode: PaymentMode;
  reference: string;
  status: PaymentStatus;
  paidAt: string;
  note: string;
}

const blankDraft = (milestone: PaymentMilestone, amount = ""): DraftState => ({
  milestone,
  baseAmount: amount,
  gstPct: String(GST_RATE * 100),
  gstCustom: false,
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
  const [receiptFor, setReceiptFor] = useState<Payment | null>(null);
  const { busy, run } = useAsyncAction();
  const { settings } = useSettings();

  useEffect(
    () => subscribePayments(lead.id, (rows) => { setPayments(rows); setLoading(false); }, () => setLoading(false)),
    [lead.id],
  );

  const summary = useMemo(() => summarisePayments(lead, payments), [lead, payments]);

  useEffect(() => onSummary?.(summary.collectedPct), [summary.collectedPct, onSummary]);

  const draftGstPct = draft ? Math.max(0, Number(draft.gstPct) || 0) / 100 : 0;
  const draftGst = draft ? Math.round((Number(draft.baseAmount) || 0) * draftGstPct) : 0;
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
    const pct = (p.gstPct ?? GST_RATE) * 100;
    setDraft({
      milestone: p.milestone,
      baseAmount: String(p.baseAmount),
      gstPct: String(pct),
      gstCustom: !GST_PRESETS.some((g) => Math.abs(g * 100 - pct) < 0.001),
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
    const gstPct = Math.max(0, Number(draft.gstPct) || 0) / 100;

    const payload = {
      milestone: draft.milestone,
      baseAmount: base,
      gstPct,
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
      <div className={receiptFor ? "hidden print:hidden" : "space-y-4"}>
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
                    <td className="td text-right tabular-nums text-ink-500">
                      {formatINR(p.gstAmount)}
                      <span className="ml-1 text-[10px] text-ink-400">@{((p.gstPct ?? GST_RATE) * 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%</span>
                    </td>
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
                        <button
                          type="button"
                          onClick={() => setReceiptFor(p)}
                          className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                          aria-label="View receipt"
                          title="Receipt"
                        >
                          <ReceiptIcon className="h-3.5 w-3.5" />
                        </button>
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
      </div>

      {receiptFor && (
        <PaymentReceipt
          lead={lead}
          payment={receiptFor}
          company={settings.company}
          onClose={() => setReceiptFor(null)}
        />
      )}

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

            <Field label="GST rate" required>
              <div className="flex gap-2">
                <Select
                  className="flex-1"
                  value={draft.gstCustom ? "custom" : draft.gstPct}
                  onChange={(e) => {
                    if (e.target.value === "custom") setDraft({ ...draft, gstCustom: true });
                    else setDraft({ ...draft, gstCustom: false, gstPct: e.target.value });
                  }}
                  options={[
                    ...GST_PRESETS.map((g) => ({ value: String(g * 100), label: `${g * 100}%` })),
                    { value: "custom", label: "Custom…" },
                  ]}
                />
                {draft.gstCustom && (
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    className="w-24"
                    value={draft.gstPct}
                    onChange={(e) => setDraft({ ...draft, gstPct: e.target.value })}
                    aria-label="Custom GST percentage"
                  />
                )}
              </div>
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
              <div className="flex justify-between"><span className="text-ink-600">GST @ {(draftGstPct * 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%</span><span className="tabular-nums">{formatINR(draftGst)}</span></div>
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

function PaymentReceipt({
  lead, payment, company, onClose,
}: {
  lead: Lead;
  payment: Payment;
  company: { legalName: string; shortName: string; address: string; gstin: string; cin: string; email: string; website: string; logoUrl: string };
  onClose: () => void;
}) {
  const receiptNo = `RCPT-${lead.code}-${payment.id.slice(0, 6).toUpperCase()}`;
  const gstPct = payment.gstPct ?? GST_RATE;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button onClick={onClose}>&larr; Back to payments</Button>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </Button>
      </div>

      <article className="loi-sheet receipt-sheet mx-auto max-w-2xl rounded-xl border border-ink-200 bg-white p-8 shadow-card">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-ink-200 pb-4">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={company.shortName}
              width={197}
              height={40}
              className="h-10 w-auto shrink-0"
            />
          ) : (
            <p className="text-lg font-bold tracking-tight text-ink-900">{company.legalName}</p>
          )}
          <div className="text-right">
            <p className="text-xs text-ink-500">Payment Receipt &middot; {receiptNo}</p>
            {(company.email || company.website) && (
              <p className="mt-1 text-[11px] text-ink-400">
                {company.email}
                {company.email && company.website && <> &nbsp;|&nbsp; </>}
                {company.website}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-500">Received from</p>
            <p className="font-medium text-ink-900">{lead.client?.name}</p>
            {lead.client?.company && <p className="text-ink-600">{lead.client.company}</p>}
            <p className="text-ink-600">{lead.client?.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-500">Lead / Client code</p>
            <p className="font-medium text-ink-900">{lead.code}</p>
            <p className="mt-2 text-xs text-ink-500">Date</p>
            <p className="text-ink-900">{formatDate(payment.paidAt)}</p>
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
              <th className="pb-2">Particulars</th>
              <th className="pb-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-ink-100">
              <td className="py-2">{MILESTONE_LABEL[payment.milestone]}</td>
              <td className="py-2 text-right tabular-nums">{formatINR(payment.baseAmount)}</td>
            </tr>
            <tr className="border-b border-ink-100">
              <td className="py-2 text-ink-600">
                GST @ {(gstPct * 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%
              </td>
              <td className="py-2 text-right tabular-nums text-ink-600">{formatINR(payment.gstAmount)}</td>
            </tr>
            <tr>
              <td className="py-2 font-semibold">Total received</td>
              <td className="py-2 text-right font-semibold tabular-nums">{formatINR(payment.totalAmount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-500">Payment mode</p>
            <p className="text-ink-900">{payment.mode}</p>
          </div>
          {payment.reference && (
            <div className="text-right">
              <p className="text-xs text-ink-500">Reference / UTR</p>
              <p className="text-ink-900">{payment.reference}</p>
            </div>
          )}
        </div>

        {payment.note && (
          <div className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{payment.note}</div>
        )}

        <div className="mt-8 flex items-center justify-between text-xs text-ink-500">
          <span>Status: {payment.status}</span>
          <span>Received by: {payment.createdBy?.name}</span>
        </div>

        <footer className="mt-10 border-t border-ink-200 pt-3 text-center text-[10px] leading-relaxed text-ink-400">
          <p>{company.legalName}</p>
          <p>
            {[
              company.gstin && `GSTN. ${company.gstin}`,
              company.cin && `CIN. ${company.cin}`,
              company.address,
            ].filter(Boolean).join(" | ")}
          </p>
        </footer>
      </article>
    </div>
  );
}
