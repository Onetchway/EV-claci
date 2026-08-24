"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Boxes, Plus, Printer } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select,
  Spinner, Textarea, useAsyncAction, useToast,
} from "@/components/ui";
import { useSettings } from "@/hooks/use-settings";
import {
  PAYMENT_MODES, PO_STATUS_COLOR, PO_STATUS_LABEL, PO_STATUSES, type PaymentMode,
} from "@/lib/constants";
import { createAsset } from "@/lib/db/assets";
import {
  addVendorPayment, subscribePurchaseOrder, subscribeVendorPayments,
  updatePurchaseOrderStatus,
} from "@/lib/db/purchase-orders";
import { subscribeVendor } from "@/lib/db/vendors";
import { canManageAssets, canManageVendors } from "@/lib/permissions";
import type { PoItem, PurchaseOrder, Vendor, VendorPayment } from "@/lib/types";
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
  const { settings } = useSettings();
  const [po, setPo] = useState<PurchaseOrder | null | undefined>(undefined);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [draft, setDraft] = useState<PaymentDraft | null>(null);
  const [registeredItemIds, setRegisteredItemIds] = useState<Set<string>>(new Set());
  const [printMode, setPrintMode] = useState(false);
  const { busy, run } = useAsyncAction();
  const { push } = useToast();
  const canEdit = canManageVendors(viewer);

  useEffect(() => subscribePurchaseOrder(params.id, setPo), [params.id]);
  useEffect(() => subscribeVendorPayments(params.id, setPayments), [params.id]);
  useEffect(() => {
    if (!po?.vendorId) return;
    return subscribeVendor(po.vendorId, setVendor);
  }, [po?.vendorId]);

  async function registerAsset(item: PoItem) {
    if (!actor || !po) return;
    const { assetTag } = await createAsset({
      name: item.description,
      category: "CHARGER",
      cost: Math.round(item.qty * item.unitPrice),
      purchaseDate: new Date(),
      method: "WDV",
      wdvRatePct: 15,
      vendorId: po.vendorId,
      vendorName: po.vendorName,
      poId: po.id,
      poNumber: po.poNumber,
      linkedProjectId: po.linkedProjectId,
      linkedProjectCode: po.linkedProjectCode,
    }, actor);
    setRegisteredItemIds((s) => new Set(s).add(item.id));
    push(`Registered as ${assetTag}. Edit it on the Asset register to set serial number and confirm the depreciation rate.`, "success");
  }

  if (po === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (!po) {
    return <EmptyState title="Purchase order not found" action={<Link href="/purchase-orders"><Button>Back to purchase orders</Button></Link>} />;
  }

  if (printMode) {
    return (
      <PurchaseOrderDocument po={po} vendor={vendor} company={settings.company} onClose={() => setPrintMode(false)} />
    );
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
            <Button onClick={() => setPrintMode(true)}><Printer className="h-4 w-4" /> Print / PDF</Button>
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
                  {po.status === "RECEIVED" && canManageAssets(viewer) && <th className="th" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {po.items.map((it) => {
                  const base = it.qty * it.unitPrice;
                  const gst = Math.round(base * (it.gstPct / 100));
                  const registered = registeredItemIds.has(it.id);
                  return (
                    <tr key={it.id}>
                      <td className="td">{it.description}</td>
                      <td className="td text-right tabular-nums">{it.qty}</td>
                      <td className="td text-right tabular-nums">{formatINR(it.unitPrice)}</td>
                      <td className="td text-right tabular-nums text-ink-500">{it.gstPct}%</td>
                      <td className="td text-right font-medium tabular-nums">{formatINR(base + gst)}</td>
                      {po.status === "RECEIVED" && canManageAssets(viewer) && (
                        <td className="td text-right">
                          {registered ? (
                            <span className="text-xs text-emerald-600">Registered</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void run(() => registerAsset(it))}
                              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                            >
                              <Boxes className="h-3 w-3" /> Register as asset
                            </button>
                          )}
                        </td>
                      )}
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
              <Input type="number" min={0} step={1} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
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

function PurchaseOrderDocument({
  po, vendor, company, onClose,
}: {
  po: PurchaseOrder;
  vendor: Vendor | null;
  company: { legalName: string; shortName: string; registeredAddress: string; officeAddress: string; gstin: string; cin: string; email: string; website: string; logoUrl: string };
  onClose: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button onClick={onClose}>&larr; Back</Button>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </Button>
      </div>

      <article className="loi-sheet loi-letter mx-auto max-w-2xl rounded-xl border border-ink-200 bg-white p-8 shadow-card print:border-0 print:p-0 print:shadow-none">
        <div className="loi-print-header mb-6 flex items-start justify-between gap-4 border-b border-ink-200 pb-4">
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
            <p className="text-xs text-ink-500">Purchase Order &middot; {po.poNumber}</p>
            <p className="mt-1 text-[11px] text-ink-400">{formatDate(po.createdAt)}</p>
          </div>
        </div>

        <div className="loi-print-body">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-500">Vendor</p>
            <p className="font-medium text-ink-900">{po.vendorName}</p>
            {vendor?.contactName && <p className="text-ink-600">{vendor.contactName}</p>}
            {vendor?.phone && <p className="text-ink-600">{vendor.phone}</p>}
            {vendor?.address && <p className="text-ink-600">{vendor.address}</p>}
            {vendor?.gstin && <p className="text-ink-600">GSTIN: {vendor.gstin}</p>}
          </div>
          <div className="text-right">
            {po.linkedProjectCode && (<><p className="text-xs text-ink-500">Project / station</p><p className="text-ink-900">{po.linkedProjectCode}</p></>)}
            {po.expectedDeliveryAt && (<><p className="mt-2 text-xs text-ink-500">Expected delivery</p><p className="text-ink-900">{formatDate(po.expectedDeliveryAt)}</p></>)}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="pb-2">Description</th>
                <th className="pb-2 text-right">Qty</th>
                <th className="pb-2 text-right">Unit price</th>
                <th className="pb-2 text-right">GST</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((it) => {
                const base = it.qty * it.unitPrice;
                const gst = Math.round(base * (it.gstPct / 100));
                return (
                  <tr key={it.id} className="border-b border-ink-100">
                    <td className="py-2">{it.description}</td>
                    <td className="py-2 text-right tabular-nums">{it.qty}</td>
                    <td className="py-2 text-right tabular-nums">{formatINR(it.unitPrice)}</td>
                    <td className="py-2 text-right tabular-nums text-ink-600">{it.gstPct}%</td>
                    <td className="py-2 text-right tabular-nums">{formatINR(base + gst)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <dl className="w-56 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd className="tabular-nums">{formatINR(po.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-600">GST</dt><dd className="tabular-nums">{formatINR(po.gst)}</dd></div>
            <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(po.total)}</dd></div>
          </dl>
        </div>

        {po.notes && (
          <div className="mt-6 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{po.notes}</div>
        )}
        </div>

        <footer className="loi-print-footer mt-10 border-t border-ink-200 pt-3 text-center text-[10px] leading-relaxed text-ink-400">
          <p>{company.legalName}</p>
          <p>
            {[company.gstin && `GSTN. ${company.gstin}`, company.cin && `CIN. ${company.cin}`]
              .filter(Boolean).join(" | ")}
          </p>
          <p>Registered address: {company.registeredAddress}</p>
          <p>Office address: {company.officeAddress}</p>
        </footer>
      </article>
    </div>
  );
}
