"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Boxes, Plus, Printer, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select,
  Spinner, Textarea, useAsyncAction, useToast,
} from "@/components/ui";
import { SimpleDocumentFooter, SimpleDocumentHeader } from "@/components/simple-document";
import { GstTypeField, ShipToFields, ShipToPrintBlock } from "@/components/gst-ship-to";
import { BankDetailsPrintBlock } from "@/components/bank-details";
import { EntityActivityLog } from "@/components/entity-activity-log";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useSettings } from "@/hooks/use-settings";
import {
  GST_SLABS, PAYMENT_MODES, PO_STATUS_COLOR, PO_STATUS_LABEL, PO_STATUSES,
  type GstType, type PaymentMode,
} from "@/lib/constants";
import { createAsset } from "@/lib/db/assets";
import {
  addVendorPayment, deletePurchaseOrder, subscribePurchaseOrder, subscribeVendorPayments,
  updatePurchaseOrder, updatePurchaseOrderStatus, DEFAULT_PO_GST_PCT,
} from "@/lib/db/purchase-orders";
import { subscribeVendor, subscribeVendors } from "@/lib/db/vendors";
import { gstBreakdown } from "@/lib/gst";
import { canManageAssets, canManageVendors } from "@/lib/permissions";
import type { PoItem, PurchaseOrder, ShipToInfo, Vendor, VendorPayment } from "@/lib/types";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

let editItemSeq = 0;
const blankPoItem = (): PoItem => ({ id: `eit${editItemSeq++}`, description: "", qty: 1, unitPrice: 0, gstPct: DEFAULT_PO_GST_PCT });

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
  const router = useRouter();
  const { actor } = useAuth();
  const viewer = useViewer();
  const { settings } = useSettings();
  const [po, setPo] = useState<PurchaseOrder | null | undefined>(undefined);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [draft, setDraft] = useState<PaymentDraft | null>(null);
  const [registeredItemIds, setRegisteredItemIds] = useState<Set<string>>(new Set());
  const [printMode, setPrintMode] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { busy, run } = useAsyncAction();
  const { push } = useToast();
  const canEdit = canManageVendors(viewer);

  // Edit modal draft — only meaningfully usable while status is DRAFT.
  const [editOpen, setEditOpen] = useState(false);
  const [editVendorId, setEditVendorId] = useState("");
  const [editItems, setEditItems] = useState<PoItem[]>([]);
  const [editExpectedDeliveryAt, setEditExpectedDeliveryAt] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editTerms, setEditTerms] = useState("");
  const [editGstType, setEditGstType] = useState<GstType>("IGST");
  const [editShipToEnabled, setEditShipToEnabled] = useState(false);
  const [editShipTo, setEditShipTo] = useState<ShipToInfo>({});

  useEffect(() => subscribePurchaseOrder(params.id, setPo), [params.id]);
  useEffect(() => subscribeVendorPayments(params.id, setPayments), [params.id]);
  useEffect(() => subscribeVendors(setVendors), []);
  useEffect(() => {
    if (!po?.vendorId) return;
    return subscribeVendor(po.vendorId, setVendor);
  }, [po?.vendorId]);
  useDocumentTitle(po ? `Purchase Order · ${po.poNumber}` : undefined);

  function startEdit() {
    if (!po) return;
    setEditVendorId(po.vendorId);
    setEditItems(po.items.length ? po.items : [blankPoItem()]);
    setEditExpectedDeliveryAt(po.expectedDeliveryAt ? new Date((po.expectedDeliveryAt as unknown as { toDate(): Date }).toDate()).toISOString().slice(0, 10) : "");
    setEditNotes(po.notes ?? "");
    setEditTerms(po.terms ?? "");
    setEditGstType(po.gstType ?? "IGST");
    setEditShipToEnabled(po.shipToEnabled ?? false);
    setEditShipTo(po.shipTo ?? {});
    setEditOpen(true);
  }

  function patchEditItem(id: string, patch: Partial<PoItem>) {
    setEditItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function saveEdit() {
    if (!po || !actor) return;
    const editVendor = vendors.find((v) => v.id === editVendorId);
    if (!editVendor) throw new Error("Pick a vendor first.");
    const cleanItems = editItems.filter((it) => it.description.trim() && it.qty > 0);
    if (cleanItems.length === 0) throw new Error("Add at least one line item.");

    await updatePurchaseOrder(po, {
      vendorId: editVendor.id,
      vendorName: editVendor.name,
      items: cleanItems,
      linkedProjectId: po.linkedProjectId,
      linkedProjectCode: po.linkedProjectCode,
      expectedDeliveryAt: editExpectedDeliveryAt ? new Date(`${editExpectedDeliveryAt}T00:00:00`) : null,
      notes: editNotes.trim(),
      terms: editTerms.trim(),
      gstType: editGstType,
      shipToEnabled: editShipToEnabled,
      shipTo: editShipToEnabled ? editShipTo : null,
    }, actor);
    setEditOpen(false);
  }

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
            {canEdit && po.status === "DRAFT" && (
              <Button onClick={startEdit}>Edit</Button>
            )}
            {canEdit && (
              <Button onClick={() => setDeleteOpen(true)} className="text-rose-700 hover:bg-rose-50">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
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
        <div className="space-y-4 lg:col-span-2">
        <Card title="Line items">
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
                {gstBreakdown(po.gstType, po.gst, po.subtotal > 0 ? (po.gst / po.subtotal) * 100 : 0).map((row) => (
                  <tr key={row.label}>
                    <td className="td font-semibold" colSpan={4}>{row.label}</td>
                    <td className="td text-right tabular-nums">{formatINR(row.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="td font-bold" colSpan={4}>Total</td>
                  <td className="td text-right text-base font-bold tabular-nums text-brand-700">{formatINR(po.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {po.notes && <p className="mt-3 text-sm text-ink-600">{po.notes}</p>}
        </Card>

        {po.shipToEnabled && po.shipTo && (
          <Card title="Ship to">
            <ShipToPrintBlock shipTo={po.shipTo} />
          </Card>
        )}

        {po.terms && (
          <Card title="Terms & conditions">
            <p className="whitespace-pre-wrap text-sm text-ink-600">{po.terms}</p>
          </Card>
        )}
        </div>

        <div className="space-y-4">
        <Card title="Payment summary">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-600">Total</dt><dd className="tabular-nums font-medium">{formatINR(po.total)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-600">Paid</dt><dd className="tabular-nums text-emerald-600">{formatINR(po.paidAmount)}</dd></div>
            <div className="flex justify-between border-t border-ink-200 pt-2 font-semibold"><dt>Due</dt><dd className="tabular-nums text-amber-600">{formatINR(po.dueAmount)}</dd></div>
          </dl>
          {po.expectedDeliveryAt && (
            <p className="mt-3 text-xs text-ink-500">Expected delivery: {formatDate(po.expectedDeliveryAt)}</p>
          )}
          {vendor && (
            <div className="mt-4 border-t border-ink-100 pt-4">
              <BankDetailsPrintBlock title="Vendor bank details" bank={vendor} />
            </div>
          )}
          <p className="mt-4 border-t border-ink-100 pt-4 text-xs text-ink-500">
            Created by {po.createdBy?.name ?? "—"} · {formatDateTime(po.createdAt)}
          </p>
        </Card>

        <EntityActivityLog entityType="PURCHASE_ORDER" entityId={po.id} />
        </div>
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

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit purchase order"
        footer={
          <>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void run(saveEdit, "Purchase order updated.")}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vendor" required>
              <Select
                value={editVendorId}
                onChange={(e) => setEditVendorId(e.target.value)}
                options={[{ value: "", label: "Select a vendor…" }, ...vendors.map((v) => ({ value: v.id, label: `${v.name} (${v.code})` }))]}
              />
            </Field>
            <Field label="Expected delivery">
              <Input type="date" value={editExpectedDeliveryAt} onChange={(e) => setEditExpectedDeliveryAt(e.target.value)} />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="label mb-0">Line items</label>
              <Button size="sm" onClick={() => setEditItems((r) => [...r, blankPoItem()])}><Plus className="h-3.5 w-3.5" /> Add line</Button>
            </div>
            <div className="space-y-2">
              {editItems.map((it) => (
                <div key={it.id} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-ink-200 p-2.5">
                  <div className="col-span-12 sm:col-span-5">
                    <label className="label">Description</label>
                    <Input value={it.description} onChange={(e) => patchEditItem(it.id, { description: e.target.value })} />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="label">Qty</label>
                    <Input type="number" min={1} value={it.qty} onChange={(e) => patchEditItem(it.id, { qty: Math.max(0, Number(e.target.value) || 0) })} />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="label">Unit price</label>
                    <Input type="number" min={0} step={1} value={it.unitPrice} onChange={(e) => patchEditItem(it.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <label className="label">GST %</label>
                    <Select
                      value={String(it.gstPct)}
                      onChange={(e) => patchEditItem(it.id, { gstPct: Number(e.target.value) })}
                      options={GST_SLABS.map((g) => ({ value: String(g), label: `${g}%` }))}
                    />
                  </div>
                  <div className="col-span-1 flex justify-end pb-1.5">
                    {editItems.length > 1 && (
                      <button type="button" onClick={() => setEditItems((r) => r.filter((x) => x.id !== it.id))} className="rounded p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Field label="Terms & conditions">
            <Textarea rows={4} value={editTerms} onChange={(e) => setEditTerms(e.target.value)} />
          </Field>

          <GstTypeField value={editGstType} onChange={setEditGstType} />
          <ShipToFields enabled={editShipToEnabled} onEnabledChange={setEditShipToEnabled} value={editShipTo} onChange={setEditShipTo} />
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this purchase order?"
        description="This permanently removes the purchase order and reverses its amount from the vendor's totals. It cannot be recovered."
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!actor) return;
                  await deletePurchaseOrder(po, actor);
                  router.push("/purchase-orders");
                }, "Purchase order deleted.")
              }
            >
              <Trash2 className="h-4 w-4" /> Delete purchase order
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">{po.poNumber} — {po.vendorName}, {formatINR(po.total)}</p>
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

      <article className="loi-sheet receipt-sheet mx-auto max-w-2xl rounded-xl border border-ink-200 bg-white p-8 shadow-card">
        <SimpleDocumentHeader
          company={company}
          docLabel="Purchase Order"
          docNumber={po.poNumber}
          meta={<p className="mt-1 text-[11px] text-ink-400">{formatDate(po.createdAt)}</p>}
        />

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

        {po.shipToEnabled && po.shipTo && (
          <div className="mt-4 text-sm">
            <ShipToPrintBlock shipTo={po.shipTo} />
          </div>
        )}

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
            {gstBreakdown(po.gstType, po.gst, po.subtotal > 0 ? (po.gst / po.subtotal) * 100 : 0).map((row) => (
              <div key={row.label} className="flex justify-between">
                <dt className="text-ink-600">{row.label}</dt>
                <dd className="tabular-nums">{formatINR(row.amount)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(po.total)}</dd></div>
          </dl>
        </div>

        {vendor && (
          <div className="mt-6">
            <BankDetailsPrintBlock title="Vendor bank details" bank={vendor} />
          </div>
        )}

        {po.notes && (
          <div className="mt-6 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{po.notes}</div>
        )}

        {po.terms && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Terms & conditions</p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-ink-600">{po.terms}</p>
          </div>
        )}

        <SimpleDocumentFooter company={company} />
      </article>
    </div>
  );
}
