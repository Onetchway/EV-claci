"use client";

import { BadgeCheck, Paperclip, Plus, Printer, Receipt as ReceiptIcon, Trash2 } from "lucide-react";
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
  addPayment, deletePayment, deletePaymentAttachment, PAYMENT_ATTACHMENT_TYPES,
  subscribePayments, summarisePayments, updatePayment, uploadPaymentAttachment,
} from "@/lib/db/payments";
import { canDeletePayment, canVerifyPayment, type Viewer } from "@/lib/permissions";
import type { Actor, Lead, Payment, PaymentAttachment } from "@/lib/types";
import { cn, formatDate, formatINR } from "@/lib/utils";

// Presets cover every slab Livanto actually invoices at; "Custom" unlocks a
// free-typed rate for the odd one-off that doesn't fit those.
const GST_PRESETS = [0.05, 0.089, 0.12, 0.18] as const;

interface DraftState {
  milestone: PaymentMilestone;
  /** Whatever the staff member actually typed — its meaning (excl. or incl. GST) is given by amountMode, not fixed. */
  baseAmount: string;
  /** Which way to read baseAmount: the amount received before GST, or the full amount actually received. Storage is always excl.-GST (Payment.baseAmount) regardless — this only controls what number is typed in. */
  amountMode: "EXCL" | "INCL";
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
  amountMode: "EXCL",
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
  const [attachmentsForId, setAttachmentsForId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const { busy, run } = useAsyncAction();
  const { settings } = useSettings();

  const mergedFromIds = (lead.mergedFrom ?? []).map((m) => m.id);
  useEffect(
    () => subscribePayments([lead.id, ...mergedFromIds], (rows) => { setPayments(rows); setLoading(false); }, () => setLoading(false)),
    [lead.id, mergedFromIds.join(",")],
  );

  const summary = useMemo(() => summarisePayments(lead, payments), [lead, payments]);
  const attachmentsFor = attachmentsForId ? payments.find((p) => p.id === attachmentsForId) ?? null : null;

  useEffect(() => onSummary?.(summary.collectedPct), [summary.collectedPct, onSummary]);

  const draftGstPct = draft ? Math.max(0, Number(draft.gstPct) || 0) / 100 : 0;
  const draftEntered = draft ? Math.max(0, Number(draft.baseAmount) || 0) : 0;
  // draft.baseAmount is excl.-GST already, or needs backing out of the incl.-GST total the staff typed.
  const draftBase = draft
    ? (draft.amountMode === "INCL" ? Math.round(draftEntered / (1 + draftGstPct)) : Math.round(draftEntered))
    : 0;
  const draftGst = draft ? Math.round(draftBase * draftGstPct) : 0;
  const draftTotal = draftBase + draftGst;

  /** Switching modes converts the typed number to keep the same real amount, instead of silently reinterpreting whatever's already there. */
  function setAmountMode(mode: "EXCL" | "INCL") {
    if (!draft || draft.amountMode === mode) return;
    const entered = Math.max(0, Number(draft.baseAmount) || 0);
    const pct = Math.max(0, Number(draft.gstPct) || 0) / 100;
    const converted = mode === "INCL" ? Math.round(entered * (1 + pct)) : Math.round(entered / (1 + pct));
    setDraft({ ...draft, amountMode: mode, baseAmount: entered ? String(converted) : draft.baseAmount });
  }

  function openNew(milestone: PaymentMilestone) {
    const m = summary.milestones.find((x) => x.key === milestone);
    // Pre-fill with what is still owed on that milestone, pre-GST.
    const suggested = m && m.balance > 0 ? Math.round(m.balance / (1 + GST_RATE)) : 0;
    setEditing(null);
    setPendingFiles([]);
    setDraft(blankDraft(milestone, suggested ? String(suggested) : ""));
  }

  function openEdit(p: Payment) {
    setEditing(p);
    setPendingFiles([]);
    const pct = (p.gstPct ?? GST_RATE) * 100;
    setDraft({
      milestone: p.milestone,
      baseAmount: String(p.baseAmount),
      amountMode: "EXCL",
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
    const entered = Math.max(0, Number(draft.baseAmount) || 0);
    const gstPct = Math.max(0, Number(draft.gstPct) || 0) / 100;
    // Storage is always the excl.-GST base — back it out of the incl.-GST total when that's what was typed.
    const base = draft.amountMode === "INCL" ? Math.round(entered / (1 + gstPct)) : Math.round(entered);
    if (base <= 0) throw new Error("Enter an amount greater than zero.");

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

    let saved: Payment;
    if (editing) {
      await updatePayment(lead, editing, payload, actor);
      saved = editing;
    } else {
      saved = await addPayment(lead, payload, actor);
    }

    for (const file of pendingFiles) {
      await uploadPaymentAttachment(lead, saved, file, actor);
    }

    setDraft(null);
    setEditing(null);
    setPendingFiles([]);
  }

  // A straight charger sale or EPC scope isn't a three-stage franchise
  // quotation — there's no milestone schedule to reconcile against, just
  // whatever payments actually get recorded against the deal as agreed.
  const showCollectionSummary = lead.type !== "EPC" && lead.type !== "CHARGER_SALE";

  return (
    <div className="space-y-4">
      <div className={receiptFor ? "hidden print:hidden" : "space-y-4"}>
      {showCollectionSummary && (
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
      )}

      <Card
        title="Payment ledger"
        subtitle={showCollectionSummary
          ? `${payments.length} entr${payments.length === 1 ? "y" : "ies"}`
          : "Recorded as per the amount agreed when this lead was added — add further records as payments come in."}
        actions={
          !showCollectionSummary && canEdit && payments.length > 0 && (
            <Button size="sm" variant="primary" onClick={() => openNew("OTHER")}>
              <Plus className="h-3.5 w-3.5" /> Add record
            </Button>
          )
        }
      >
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
                        <button
                          type="button"
                          onClick={() => setAttachmentsForId(p.id)}
                          className={cn(
                            "flex items-center gap-0.5 rounded p-1 hover:bg-ink-100",
                            p.attachments?.length ? "text-brand-600" : "text-ink-400 hover:text-ink-700",
                          )}
                          aria-label="Payment attachments"
                          title="Documents / images"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {p.attachments && p.attachments.length > 0 && (
                            <span className="text-[10px] font-semibold tabular-nums">{p.attachments.length}</span>
                          )}
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
        onClose={() => { setDraft(null); setEditing(null); setPendingFiles([]); }}
        title={editing ? "Edit payment" : "Record payment"}
        description="Enter the amount excluding GST — tax is calculated automatically."
        footer={
          <>
            <Button onClick={() => { setDraft(null); setEditing(null); setPendingFiles([]); }}>Cancel</Button>
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

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="label mb-0">Amount received <span className="text-rose-500">*</span></label>
                <div className="flex overflow-hidden rounded-md border border-ink-200 text-[11px] font-medium">
                  <button
                    type="button"
                    onClick={() => setAmountMode("EXCL")}
                    className={cn("px-2 py-0.5", draft.amountMode === "EXCL" ? "bg-brand-600 text-white" : "bg-white text-ink-500 hover:bg-ink-50")}
                  >
                    Excl. GST
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmountMode("INCL")}
                    className={cn("border-l border-ink-200 px-2 py-0.5", draft.amountMode === "INCL" ? "bg-brand-600 text-white" : "bg-white text-ink-500 hover:bg-ink-50")}
                  >
                    Incl. GST
                  </button>
                </div>
              </div>
              <Input
                type="number"
                min={0}
                step={1}
                value={draft.baseAmount}
                onChange={(e) => setDraft({ ...draft, baseAmount: e.target.value })}
              />
            </div>

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

            <Field label="Documents / images" className="sm:col-span-2" hint="Receipt, UTR screenshot, cheque photo — PDF, JPG, PNG, WEBP or HEIC, up to 15 MB each.">
              <input
                type="file"
                accept={PAYMENT_ATTACHMENT_TYPES.join(",")}
                multiple
                onChange={(e) => { setPendingFiles([...pendingFiles, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }}
                className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
              />
              {pendingFiles.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {pendingFiles.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-ink-50 px-2 py-1 text-xs text-ink-600">
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setPendingFiles(pendingFiles.filter((_, idx) => idx !== i))}
                        className="shrink-0 text-ink-400 hover:text-rose-600"
                        aria-label={`Remove ${f.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {editing?.attachments && editing.attachments.length > 0 && (
                <p className="mt-2 text-xs text-ink-500">
                  {editing.attachments.length} already attached — manage via the <Paperclip className="inline h-3 w-3" /> icon on the ledger row.
                </p>
              )}
            </Field>

            <div className="sm:col-span-2 rounded-lg bg-ink-50 px-3 py-2.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-600">Amount excl. GST</span><span className="tabular-nums">{formatINR(draftBase)}</span></div>
              <div className="flex justify-between"><span className="text-ink-600">GST @ {(draftGstPct * 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%</span><span className="tabular-nums">{formatINR(draftGst)}</span></div>
              <div className="mt-1 flex justify-between border-t border-ink-200 pt-1 font-semibold"><span>Total received</span><span className="tabular-nums">{formatINR(draftTotal)}</span></div>
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

      {attachmentsFor && (
        <PaymentAttachmentsModal
          lead={lead}
          payment={attachmentsFor}
          actor={actor}
          canEdit={canEdit}
          onClose={() => setAttachmentsForId(null)}
        />
      )}
    </div>
  );
}

function PaymentAttachmentsModal({
  lead, payment, actor, canEdit, onClose,
}: {
  lead: Lead;
  payment: Payment;
  actor: Actor;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        setProgress(0);
        await uploadPaymentAttachment(lead, payment, file, actor, setProgress);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  const attachments = payment.attachments ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title="Payment attachments"
      description={`${MILESTONE_LABEL[payment.milestone]} — ${formatINR(payment.totalAmount)}`}
    >
      <div className="space-y-4">
        {attachments.length === 0 ? (
          <p className="text-sm text-ink-500">No documents or images attached yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {attachments.map((a) => (
              <li key={a.storagePath} className="flex items-center justify-between gap-3 py-2 text-sm">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-medium text-brand-700 hover:underline"
                  title={a.fileName}
                >
                  {a.fileName}
                </a>
                <div className="flex shrink-0 items-center gap-2 text-xs text-ink-500">
                  <span>{(a.size / 1024).toFixed(0)} KB</span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => void deletePaymentAttachment(lead, payment, a, actor)}
                      className="rounded p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`Remove ${a.fileName}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div>
            <label className="label">Upload document or image</label>
            <input
              type="file"
              accept={PAYMENT_ATTACHMENT_TYPES.join(",")}
              multiple
              disabled={uploading}
              onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }}
              className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
            {uploading && <p className="mt-1 text-xs text-ink-500">Uploading… {progress}%</p>}
            {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
            <p className="mt-1 text-xs text-ink-400">PDF, JPG, PNG, WEBP or HEIC, up to 15 MB each — e.g. a payment receipt, UTR screenshot or cheque photo.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PaymentReceipt({
  lead, payment, company, onClose,
}: {
  lead: Lead;
  payment: Payment;
  company: { legalName: string; shortName: string; registeredAddress: string; officeAddress: string; gstin: string; cin: string; email: string; website: string; logoUrl: string };
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
            {lead.client?.gstin && <p className="text-ink-600">GSTIN: {lead.client.gstin}</p>}
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
            {[company.gstin && `GSTN. ${company.gstin}`, company.cin && `CIN. ${company.cin}`]
              .filter(Boolean)
              .join(" | ")}
          </p>
          <p>Registered address: {company.registeredAddress}</p>
          <p>Office address: {company.officeAddress}</p>
        </footer>
      </article>
    </div>
  );
}
