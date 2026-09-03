"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, Pencil, Plus, Printer, Trash2 } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { EntityActivityLog } from "@/components/entity-activity-log";
import { EntityDocuments } from "@/components/entity-documents";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, useAsyncAction,
} from "@/components/ui";
import { PAYMENT_MODES, PI_STATUSES, type PaymentMode, type PiStatus } from "@/lib/constants";
import { getClient } from "@/lib/db/clients";
import { recordClientPayment, subscribeClientPayments } from "@/lib/db/payments";
import { deleteProformaInvoice, subscribeProformaInvoice, updateProformaInvoice } from "@/lib/db/proforma-invoices";
import { defaultSettings, subscribeSettings, type AppSettings } from "@/lib/db/settings";
import { canManageProcurement, canTrash } from "@/lib/permissions";
import { buildProformaInvoiceTallyXml, downloadTallyXml } from "@/lib/tally-export";
import type { Client, ClientPayment, ProformaInvoice } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function ProformaInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();

  const [pi, setPi] = useState<ProformaInvoice | null | undefined>(undefined);
  const [client, setClient] = useState<Client | null>(null);
  const [payments, setPayments] = useState<ClientPayment[] | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings());
  const [payOpen, setPayOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", mode: "BANK_TRANSFER" as PaymentMode, referenceNo: "", milestone: "" });

  useEffect(() => subscribeProformaInvoice(id, setPi), [id]);
  useEffect(() => { if (pi?.clientId) void getClient(pi.clientId).then(setClient); }, [pi?.clientId]);
  useEffect(() => subscribeClientPayments({ projectId: pi?.projectId }, setPayments), [pi?.projectId]);
  useEffect(() => subscribeSettings(setSettings), []);

  if (pi === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (pi === null) return <EmptyState title="Proforma invoice not found" action={<Link href="/proforma-invoices"><Button>Back to proforma invoices</Button></Link>} />;

  const piPayments = (payments ?? []).filter((p) => p.piId === pi.id);
  const due = Math.max(pi.totalAmount - pi.paidAmount, 0);

  async function onStatusChange(status: PiStatus) {
    await run(() => updateProformaInvoice(pi!, { status }, actor), `Marked ${status}.`);
  }

  async function onRecordPayment() {
    if (!payForm.amount) return;
    await run(async () => {
      await recordClientPayment({
        projectId: pi!.projectId, projectName: pi!.projectName, clientId: pi!.clientId, clientName: client?.name ?? "",
        piId: pi!.id, amount: Number(payForm.amount) || 0, mode: payForm.mode, referenceNo: payForm.referenceNo, milestone: payForm.milestone,
      }, actor);
      setPayOpen(false); setPayForm({ amount: "", mode: "BANK_TRANSFER", referenceNo: "", milestone: "" });
    }, "Payment recorded.");
  }

  function onExportTally() {
    const xml = buildProformaInvoiceTallyXml({ ...pi!, clientName: client?.name ?? pi!.projectName }, settings.tally, settings.company.name);
    downloadTallyXml(`${pi!.piNo}-tally`, xml);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={pi.piNo}
        description={client?.name ?? "—"}
        actions={
          <>
            {canManageProcurement(viewer) ? (
              <Select value={pi.status} options={PI_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))} onChange={(e) => void onStatusChange(e.target.value as PiStatus)} />
            ) : (
              <Badge>{pi.status.replace(/_/g, " ")}</Badge>
            )}
            <Link href={`/projects/${pi.projectId}/proforma-invoices/${pi.id}/print`}>
              <Button><Printer className="h-4 w-4" /> Print / PDF</Button>
            </Link>
            {canManageProcurement(viewer) && (
              <Button onClick={onExportTally}><Download className="h-4 w-4" /> Export to Tally</Button>
            )}
            {canManageProcurement(viewer) && pi.status === "DRAFT" && (
              <Link href={`/proforma-invoices/${pi.id}/edit`}><Button><Pencil className="h-4 w-4" /> Edit</Button></Link>
            )}
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
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                    <th className="py-2 pr-3">Description</th>
                    <th className="px-3 py-2">HSN/SAC</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right">Qty</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right">Rate</th>
                    <th className="whitespace-nowrap py-2 pl-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {pi.items.map((line) => (
                    <tr key={line.srNo} className="border-b border-ink-100">
                      <td className="py-2.5 pr-3 align-top">{line.description}</td>
                      <td className="px-3 py-2.5 align-top text-ink-500">{line.hsnCode || "—"}</td>
                      <td className="px-3 py-2.5 align-top text-ink-500">{line.unit || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums">{pi.taxAmount ? line.qty : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums">{pi.taxAmount ? formatINR(line.rate) : "—"}</td>
                      <td className="whitespace-nowrap py-2.5 pl-3 text-right align-top tabular-nums">{formatINR(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <dl className="w-56 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd className="tabular-nums">{formatINR(pi.subtotal)}</dd></div>
                {pi.gstType === "CGST_SGST" ? (
                  <>
                    <div className="flex justify-between"><dt className="text-ink-600">CGST</dt><dd className="tabular-nums">{formatINR(pi.cgstAmount ?? 0)}</dd></div>
                    <div className="flex justify-between"><dt className="text-ink-600">SGST</dt><dd className="tabular-nums">{formatINR(pi.sgstAmount ?? 0)}</dd></div>
                  </>
                ) : (
                  <div className="flex justify-between"><dt className="text-ink-600">IGST</dt><dd className="tabular-nums">{formatINR(pi.igstAmount ?? pi.taxAmount)}</dd></div>
                )}
                <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(pi.totalAmount)}</dd></div>
              </dl>
            </div>
          </Card>

          {pi.shipToDifferent && pi.shipToAddress && (
            <Card title="Ship to"><p className="whitespace-pre-line text-sm text-ink-700">{pi.shipToAddress}</p></Card>
          )}
          <Card title="Terms &amp; conditions">
            {pi.terms ? (
              <p className="whitespace-pre-line text-sm text-ink-700">{pi.terms}</p>
            ) : (
              <p className="text-sm text-ink-400">No terms added yet.{canManageProcurement(viewer) && pi.status === "DRAFT" ? " Click Edit to add." : ""}</p>
            )}
          </Card>
          {pi.notes && <Card title="Notes"><p className="whitespace-pre-line text-sm text-ink-700">{pi.notes}</p></Card>}

          <Card title="Payment ledger" subtitle={`${piPayments.length} ${piPayments.length === 1 ? "entry" : "entries"}`}>
            {piPayments.length === 0 ? (
              <p className="text-sm text-ink-400">No payments recorded.</p>
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500"><th className="pb-2">Date</th><th className="pb-2">Mode</th><th className="pb-2">Reference</th><th className="pb-2 text-right">Amount</th></tr></thead>
                  <tbody>
                    {piPayments.map((p) => (
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
              <div className="flex justify-between"><dt className="text-ink-600">Total</dt><dd className="font-medium tabular-nums">{formatINR(pi.totalAmount)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-600">Paid</dt><dd className="tabular-nums text-emerald-600">{formatINR(pi.paidAmount)}</dd></div>
              <div className="flex justify-between border-t border-ink-200 pt-2 font-semibold"><dt>Due</dt><dd className="tabular-nums text-rose-600">{formatINR(due)}</dd></div>
            </dl>
            {pi.dueDate && <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-500">Due date: {formatDate(pi.dueDate)}</p>}
            {pi.milestone && <p className="mt-1 text-xs text-ink-500">Milestone: {pi.milestone}</p>}
            {pi.clientPoNumber && <p className="mt-1 text-xs text-ink-500">Client PO: {pi.clientPoNumber}</p>}
            <p className="mt-1 text-xs text-ink-500"><Link href={`/projects/${pi.projectId}`} className="text-brand-700 hover:underline">{pi.projectName}</Link></p>
          </Card>

          <EntityDocuments projectId={pi.projectId} entityType="PROFORMA_INVOICE" entityId={pi.id} defaultDocType="OTHER" title="PI Documents" />

          <EntityActivityLog entityType="PROFORMA_INVOICE" entityId={pi.id} />
        </div>
      </div>

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record payment"
        footer={<><Button variant="secondary" onClick={() => setPayOpen(false)}>Cancel</Button><Button onClick={() => void onRecordPayment()} loading={busy}>Save</Button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)" required><Input type="number" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
          <Field label="Mode"><Select value={payForm.mode} options={PAYMENT_MODES.map((m) => ({ value: m, label: m.replace(/_/g, " ") }))} onChange={(e) => setPayForm((f) => ({ ...f, mode: e.target.value as PaymentMode }))} /></Field>
          <Field label="Reference No."><Input value={payForm.referenceNo} onChange={(e) => setPayForm((f) => ({ ...f, referenceNo: e.target.value }))} /></Field>
          <Field label="Milestone"><Input value={payForm.milestone} onChange={(e) => setPayForm((f) => ({ ...f, milestone: e.target.value }))} /></Field>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this proforma invoice?"
        description="This cannot be undone."
        footer={<><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => void run(async () => { await deleteProformaInvoice(pi!, actor); router.push("/proforma-invoices"); }, "Proforma invoice deleted.")}><Trash2 className="h-4 w-4" /> Delete</Button></>}
      >
        <p className="text-sm text-ink-700">{pi.piNo} — {client?.name}</p>
      </Modal>
    </div>
  );
}
