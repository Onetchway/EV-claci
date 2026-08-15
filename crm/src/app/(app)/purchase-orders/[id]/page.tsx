"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select,
  Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import {
  PAYMENT_MODES, PO_STATUS_COLOR, PO_STATUS_LABEL, PO_STATUSES, type PaymentMode,
} from "@/lib/constants";
import {
  addVendorPayment, subscribePurchaseOrder, subscribeVendorPayments,
  updatePurchaseOrderStatus,
} from "@/lib/db/purchase-orders";
import { canManageVendors } from "@/lib/permissions";
import type { PurchaseOrder, VendorPayment } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

interface PaymentDraft {
  amount: string;
  mode: PaymentMode;
  reference: string;
  paidAt: string;
  note: string;
}

const blankPayment = (): PaymentDraft => ({
  amount: "", mode: "NEFT", reference: "", paidAt: new Date().toISOString().slice(0, 10), note: "",
});

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { actor } = useAuth();
  const viewer = useViewer();
  const [po, setPo] = useState<PurchaseOrder | null | undefined>(undefined);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [draft, setDraft] = useState<PaymentDraft | null>(null);
  const { busy, run } = useAsyncAction();
  const canEdit = canManageVendors(viewer);

  useEffect(() => subscribePurchaseOrder(params.id, setPo), [params.id]);
  useEffect(() => subscribeVendorPayments(params.id, setPayments), [params.id]);

  if (po === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (!po) {
    return <EmptyState title="Purchase order not found" action={<Link href="/purchase-orders"><Button>Back to purchase orders</Button></Link>} />;
  }

  async function save() {
    if (!draft || !actor || !po) return;
    const amount = Math.round(Number(draft.amount) || 0);
    if (amount <= 0) throw new Error("Enter an amount greater than zero.");
    await addVendorPayment(po, {
      amount,
      mode: draft.mode,
      reference: draft.reference.trim(),
      paidAt: draft.paidAt ? new Date(`${draft.paidAt}T00:00:00`) : null,
      note: draft.note.trim(),
    }, actor);
    setDraft(null);
  }

  return (
    <>
      <PageHeader
        title={po.poNumber}
        description={`${po.vendorName}${po.linkedProjectCode ? ` · ${po.linkedProjectCode}` : ""}`}
        actions={
          <>
            {canEdit ? (
              <Select
                value={po.status}
                onChange={(e) => void run(() => updatePurchaseOrderStatus(po, e.target.value as typeof po.status, actor!), "Status updated.")}
                className="w-auto"
                options={PO_STATUSES.map((s) => ({ value: s, label: PO_STATUS_LABEL[s] }))}
              />
            ) : (
              <Badge className={PO_STATUS_COLOR[po.status]}>{PO_STATUS_LABEL[po.status]}</Badge>
            )}
            {canEdit && (
              <Button variant="primary" onClick={() => setDraft(blankPayment())}>
                <Plus className="h-4 w-4" /> Record payment
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Line items" className="lg:col-span-2">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th">Description</th>
                  <th className="th text-right">Qty</th>
                  <th className="th text-right">Unit price</th>
                  <th className="th text-right">GST</th>
                  <th className="th text-right">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {po.items.map((it) => {
                  const base = it.qty * it.unitPrice;
                  const gst = Math.round(base * (it.gstPct / 100));
                  return (
                    <tr key={it.id}>
                      <td className="td">{it.description}</td>
                      <td className="td text-right tabular-nums">{it.qty}</td>
                      <td className="td text-right tabular-nums">{formatINR(it.unitPrice)}</td>
                      <td className="td text-right tabular-nums text-ink-500">{it.gstPct}%</td>
                      <td className="td text-right font-medium tabular-nums">{formatINR(base + gst)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-ink-200">
                <tr>
                  <td className="td font-semibold" colSpan={4}>Subtotal</td>
                  <td className="td text-right tabular-nums">{formatINR(po.subtotal)}</td>
                </tr>
                <tr>
                  <td className="td font-semibold" colSpan={4}>GST</td>
                  <td className="td text-right tabular-nums">{formatINR(po.gst)}</td>
                </tr>
                <tr>
                  <td className="td font-bold" colSpan={4}>Total</td>
                  <td className="td text-right text-base font-bold tabular-nums text-brand-700">{formatINR(po.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {po.notes && <p className="mt-3 text-sm text-ink-600">{po.notes}</p>}
        </Card>

        <Card title="Payment summary">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-600">Total</dt><dd className="tabular-nums font-medium">{formatINR(po.total)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-600">Paid</dt><dd className="tabular-nums text-emerald-600">{formatINR(po.paidAmount)}</dd></div>
            <div className="flex justify-between border-t border-ink-200 pt-2 font-semibold"><dt>Due</dt><dd className="tabular-nums text-amber-600">{formatINR(po.dueAmount)}</dd></div>
          </dl>
          {po.expectedDeliveryAt && (
            <p className="mt-3 text-xs text-ink-500">Expected delivery: {formatDate(po.expectedDeliveryAt)}</p>
          )}
        </Card>
      </div>

      <Card title="Payment ledger" subtitle={`${payments.length} entr${payments.length === 1 ? "y" : "ies"}`} className="mt-4">
        {payments.length === 0 ? (
          <EmptyState title="No payments recorded" action={canEdit ? <Button variant="primary" onClick={() => setDraft(blankPayment())}><Plus className="h-4 w-4" /> Record payment</Button> : undefined} />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr>
                  <th className="th text-right">Amount</th>
                  <th className="th">Mode / Ref</th>
                  <th className="th">Date</th>
                  <th className="th">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="td text-right font-medium tabular-nums">{formatINR(p.amount)}</td>
                    <td className="td">{p.mode}{p.reference && <span className="mt-0.5 block text-xs text-ink-500">{p.reference}</span>}</td>
                    <td className="td text-ink-600">{formatDate(p.paidAt)}</td>
                    <td className="td text-ink-500">{p.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title="Record vendor payment"
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void run(save, "Payment recorded.")}>
              Record payment
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" required>
              <Input type="number" min={0} step={1000} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
            </Field>
            <Field label="Payment mode">
              <Select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as PaymentMode })} options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))} />
            </Field>
            <Field label="Reference / UTR">
              <Input value={draft.reference} onChange={(e) => setDraft({ ...draft, reference: e.target.value })} />
            </Field>
            <Field label="Payment date">
              <Input type="date" value={draft.paidAt} onChange={(e) => setDraft({ ...draft, paidAt: e.target.value })} />
            </Field>
            <Field label="Note" className="sm:col-span-2">
              <Textarea rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}
