"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Pencil, Plus, Printer, ShieldCheck, Trash2 } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { EntityActivityLog } from "@/components/entity-activity-log";
import { EntityDocuments } from "@/components/entity-documents";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import { ItemsTable, PO_ITEM_FIELDS, type DraftItem } from "@/components/line-items-table";
import { PAYMENT_MODES, PO_STATUSES, type PaymentMode, type PoStatus } from "@/lib/constants";
import { recordVendorPayment, subscribeVendorPayments } from "@/lib/db/payments";
import { approvePurchaseOrder, deletePurchaseOrder, subscribePurchaseOrder, updatePoStatus, updatePurchaseOrder } from "@/lib/db/purchase-orders";
import { getVendor } from "@/lib/db/vendors";
import { canManageProcurement, canTrash } from "@/lib/permissions";
import type { PurchaseOrder, Vendor, VendorPayment } from "@/lib/types";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

const NON_ISSUED_STATUSES = PO_STATUSES.filter((s) => s !== "ISSUED");

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();

  const [po, setPo] = useState<PurchaseOrder | null | undefined>(undefined);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [payments, setPayments] = useState<VendorPayment[] | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [payForm, setPayForm] = useState({ amount: "", mode: "BANK_TRANSFER" as PaymentMode, referenceNo: "", notes: "" });
  const [editForm, setEditForm] = useState({ poNo: "", deliveryDate: "", terms: "", notes: "" });
  const [editItems, setEditItems] = useState<DraftItem[]>([]);

  useEffect(() => subscribePurchaseOrder(id, setPo), [id]);
  useEffect(() => { if (po?.vendorId) void getVendor(po.vendorId).then(setVendor); }, [po?.vendorId]);
  useEffect(() => subscribeVendorPayments({ projectId: po?.projectId }, setPayments), [po?.projectId]);

  if (po === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (po === null) return <EmptyState title="Purchase order not found" action={<Link href="/purchase-orders"><Button>Back to purchase orders</Button></Link>} />;

  const poPayments = (payments ?? []).filter((p) => p.poId === po.id);

  async function onStatusChange(status: PoStatus) {
    await run(() => updatePoStatus(po!, status, actor), `Marked ${status}.`);
  }

  async function onApprove() {
    await run(async () => {
      await approvePurchaseOrder(po!, signatureName, approvalNote, actor);
      setApproveOpen(false);
      setSignatureName("");
      setApprovalNote("");
    }, "PO approved and issued.");
  }

  function openEdit() {
    setEditForm({ poNo: po!.poNo, deliveryDate: po!.deliveryDate ? po!.deliveryDate.toDate().toISOString().slice(0, 10) : "", terms: po!.terms ?? "", notes: po!.notes ?? "" });
    setEditItems(po!.items.map((it) => ({ description: it.description, unit: it.unit, qty: it.qty, rate: it.rate, hsnCode: it.hsnCode, gstPercent: it.gstPercent })));
    setEditOpen(true);
  }

  async function onSaveEdit() {
    if (!editForm.poNo.trim()) return;
    await run(async () => {
      await updatePurchaseOrder(po!, {
        poNo: editForm.poNo, terms: editForm.terms, notes: editForm.notes, items: editItems,
        deliveryDate: editForm.deliveryDate ? new Date(editForm.deliveryDate) : null,
      }, actor);
      setEditOpen(false);
    }, "Purchase order updated.");
  }

  async function onRecordPayment() {
    if (!payForm.amount) return;
    await run(async () => {
      await recordVendorPayment({
        vendorId: po!.vendorId, vendorName: po!.vendorName, projectId: po!.projectId, projectName: po!.projectName,
        poId: po!.id, amount: Number(payForm.amount) || 0, mode: payForm.mode, referenceNo: payForm.referenceNo, notes: payForm.notes,
      }, actor);
      setPayOpen(false); setPayForm({ amount: "", mode: "BANK_TRANSFER", referenceNo: "", notes: "" });
    }, "Payment recorded.");
  }

  const due = Math.max(po.totalAmount - po.paidAmount, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={po.poNo}
        description={po.vendorName}
        actions={
          <>
            {canManageProcurement(viewer) ? (
              <Select
                value={po.status}
                options={(po.status === "DRAFT" ? NON_ISSUED_STATUSES : PO_STATUSES).map((s) => ({ value: s, label: s.replace(/_/g, " ") }))}
                onChange={(e) => void onStatusChange(e.target.value as PoStatus)}
              />
            ) : (
              <Badge>{po.status.replace(/_/g, " ")}</Badge>
            )}
            {canManageProcurement(viewer) && po.status === "DRAFT" && (
              <Button variant="primary" onClick={() => setApproveOpen(true)}><ShieldCheck className="h-4 w-4" /> Approve &amp; Issue</Button>
            )}
            {canManageProcurement(viewer) && po.status === "DRAFT" && (
              <Button onClick={openEdit}><Pencil className="h-4 w-4" /> Edit</Button>
            )}
            <Link href={`/projects/${po.projectId}/purchase-orders/${po.id}/print`}>
              <Button><Printer className="h-4 w-4" /> Print / PDF</Button>
            </Link>
            {canManageProcurement(viewer) && due > 0 && (
              <Button variant="primary" onClick={() => setPayOpen(true)}><Plus className="h-4 w-4" /> Record payment</Button>
            )}
            {canTrash(viewer) && (
              <Button className="text-rose-700 hover:bg-rose-50" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Line items">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                    <th className="pb-2">Description</th>
                    <th className="pb-2">HSN/SAC</th>
                    <th className="pb-2">Unit</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Unit price</th>
                    <th className="pb-2 text-right">GST %</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((line) => (
                    <tr key={line.srNo} className="border-b border-ink-100">
                      <td className="py-2">{line.description}</td>
                      <td className="py-2 text-ink-500">{line.hsnCode || "—"}</td>
                      <td className="py-2 text-ink-500">{line.unit || "—"}</td>
                      <td className="py-2 text-right tabular-nums">{line.qty}</td>
                      <td className="py-2 text-right tabular-nums">{formatINR(line.rate)}</td>
                      <td className="py-2 text-right tabular-nums">{line.gstPercent ?? 0}%</td>
                      <td className="py-2 text-right tabular-nums">{formatINR(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <dl className="w-56 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd className="tabular-nums">{formatINR(po.subtotal)}</dd></div>
                {po.gstType === "CGST_SGST" ? (
                  <>
                    <div className="flex justify-between"><dt className="text-ink-600">CGST</dt><dd className="tabular-nums">{formatINR(po.cgstAmount ?? 0)}</dd></div>
                    <div className="flex justify-between"><dt className="text-ink-600">SGST</dt><dd className="tabular-nums">{formatINR(po.sgstAmount ?? 0)}</dd></div>
                  </>
                ) : (
                  <div className="flex justify-between"><dt className="text-ink-600">IGST</dt><dd className="tabular-nums">{formatINR(po.igstAmount ?? po.taxAmount)}</dd></div>
                )}
                <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(po.totalAmount)}</dd></div>
              </dl>
            </div>
          </Card>

          {po.shipToDifferent && po.shipToAddress && (
            <Card title="Ship to">
              <p className="whitespace-pre-line text-sm text-ink-700">{po.shipToAddress}</p>
            </Card>
          )}

          <Card title="Terms &amp; conditions">
            {po.terms ? (
              <p className="whitespace-pre-line text-sm text-ink-700">{po.terms}</p>
            ) : (
              <p className="text-sm text-ink-400">No terms added yet.{canManageProcurement(viewer) && po.status === "DRAFT" ? " Click Edit to add." : ""}</p>
            )}
          </Card>

          {po.notes && (
            <Card title="Notes">
              <p className="whitespace-pre-line text-sm text-ink-700">{po.notes}</p>
            </Card>
          )}

          <Card title="Payment ledger" subtitle={`${poPayments.length} ${poPayments.length === 1 ? "entry" : "entries"}`}>
            {poPayments.length === 0 ? (
              <p className="text-sm text-ink-400">No payments recorded.</p>
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500"><th className="pb-2">Date</th><th className="pb-2">Mode</th><th className="pb-2">Reference</th><th className="pb-2 text-right">Amount</th></tr></thead>
                  <tbody>
                    {poPayments.map((p) => (
                      <tr key={p.id} className="border-b border-ink-100">
                        <td className="py-2">{formatDate(p.paymentDate)}</td>
                        <td className="py-2 capitalize text-ink-600">{p.mode.replace(/_/g, " ").toLowerCase()}</td>
                        <td className="py-2 text-ink-600">{p.referenceNo || "—"}</td>
                        <td className="py-2 text-right tabular-nums text-emerald-600">{formatINR(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Payment summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-600">Total</dt><dd className="font-medium tabular-nums">{formatINR(po.totalAmount)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-600">Paid</dt><dd className="tabular-nums text-emerald-600">{formatINR(po.paidAmount)}</dd></div>
              <div className="flex justify-between border-t border-ink-200 pt-2 font-semibold"><dt>Due</dt><dd className="tabular-nums text-rose-600">{formatINR(due)}</dd></div>
            </dl>
            {po.deliveryDate && <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-500">Expected delivery: {formatDate(po.deliveryDate)}</p>}
            <p className="mt-1 text-xs text-ink-500"><Link href={`/projects/${po.projectId}`} className="text-brand-700 hover:underline">{po.projectName}</Link></p>
          </Card>

          {vendor?.bankAccountNo && (
            <Card title="Vendor bank details">
              <dl className="space-y-1.5 text-sm">
                {vendor.bankName && <div className="flex justify-between"><dt className="text-ink-500">Bank</dt><dd>{vendor.bankName}</dd></div>}
                <div className="flex justify-between"><dt className="text-ink-500">Account number</dt><dd>{vendor.bankAccountNo}</dd></div>
                {vendor.bankIfsc && <div className="flex justify-between"><dt className="text-ink-500">IFSC</dt><dd>{vendor.bankIfsc}</dd></div>}
              </dl>
            </Card>
          )}

          {po.approval && (
            <Card title="Approval">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-ink-500">Approved by</dt><dd>{po.approval.approvedBy.name}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-500">Signed</dt><dd>{po.approval.signatureName}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-500">Date</dt><dd>{formatDateTime(po.approval.approvedAt)}</dd></div>
              </dl>
              {po.approval.note && <p className="mt-2 border-t border-ink-100 pt-2 text-sm text-ink-700">{po.approval.note}</p>}
            </Card>
          )}

          <EntityDocuments projectId={po.projectId} entityType="PURCHASE_ORDER" entityId={po.id} defaultDocType="WORK_ORDER" title="PO Documents" />

          <EntityActivityLog entityType="PURCHASE_ORDER" entityId={po.id} />
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit purchase order"
        wide
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={() => void onSaveEdit()} loading={busy}>Save</Button></>}
      >
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Field label="PO Number" required><Input value={editForm.poNo} onChange={(e) => setEditForm((f) => ({ ...f, poNo: e.target.value }))} /></Field>
          <Field label="Expected Delivery"><Input type="date" value={editForm.deliveryDate} onChange={(e) => setEditForm((f) => ({ ...f, deliveryDate: e.target.value }))} /></Field>
          <Field label="Terms &amp; Conditions" className="col-span-2"><Textarea value={editForm.terms} onChange={(e) => setEditForm((f) => ({ ...f, terms: e.target.value }))} /></Field>
          <Field label="Notes" className="col-span-2"><Textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
        </div>
        <ItemsTable items={editItems} setItems={setEditItems} fields={PO_ITEM_FIELDS} />
      </Modal>

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record payment"
        footer={<><Button variant="secondary" onClick={() => setPayOpen(false)}>Cancel</Button><Button onClick={() => void onRecordPayment()} loading={busy}>Save</Button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)" required><Input type="number" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
          <Field label="Mode"><Select value={payForm.mode} options={PAYMENT_MODES.map((m) => ({ value: m, label: m.replace(/_/g, " ") }))} onChange={(e) => setPayForm((f) => ({ ...f, mode: e.target.value as PaymentMode }))} /></Field>
          <Field label="Reference No." className="col-span-2"><Input value={payForm.referenceNo} onChange={(e) => setPayForm((f) => ({ ...f, referenceNo: e.target.value }))} /></Field>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this purchase order?"
        description="This cannot be undone."
        footer={<><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => void run(async () => { await deletePurchaseOrder(po!, actor); router.push("/purchase-orders"); }, "Purchase order deleted.")}><Trash2 className="h-4 w-4" /> Delete</Button></>}
      >
        <p className="text-sm text-ink-700">{po.poNo} — {po.vendorName}</p>
      </Modal>

      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Approve &amp; issue this PO"
        description={`Type your name exactly as shown ("${actor.name}") to confirm approval — this is recorded as your sign-off before the PO is issued to the vendor.`}
        footer={<><Button variant="secondary" onClick={() => setApproveOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={() => void onApprove()}><ShieldCheck className="h-4 w-4" /> Confirm Approval</Button></>}
      >
        <div className="space-y-3">
          <Field label="Your name" required hint={`Type: ${actor.name}`}>
            <Input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} />
          </Field>
          <Field label="Note (optional)"><Textarea value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
