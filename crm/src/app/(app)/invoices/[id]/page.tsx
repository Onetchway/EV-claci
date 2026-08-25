"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Printer } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, useAsyncAction,
} from "@/components/ui";
import { PrintDocument, PrintFooter, PrintHeader } from "@/components/print-letterhead";
import { useSettings } from "@/hooks/use-settings";
import { INVOICE_STATUS_COLOR, INVOICE_STATUS_LABEL, INVOICE_STATUSES, type InvoiceStatus } from "@/lib/constants";
import {
  createCreditDebitNote, setInvoiceTax, subscribeCreditDebitNotesForInvoice, subscribeInvoice, updateInvoiceStatus,
} from "@/lib/db/invoices";
import { getCorporateAccount, getEmspUser } from "@/lib/db/emsp-users";
import { emailInvoiceIssued } from "@/lib/db/notifications";
import { subscribeOrganization } from "@/lib/db/organizations";
import { canManageInvoices } from "@/lib/permissions";
import type { CreditDebitNote, CreditDebitNoteKind, Invoice, Organization } from "@/lib/types";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { actor } = useAuth();
  const viewer = useViewer();
  const { settings } = useSettings();
  const canManage = canManageInvoices(viewer);

  const { run, busy } = useAsyncAction();

  const [inv, setInv] = useState<Invoice | null | undefined>(undefined);
  const [org, setOrg] = useState<Organization | null>(null);
  const [printMode, setPrintMode] = useState(false);
  const [notes, setNotes] = useState<CreditDebitNote[]>([]);
  const [hsnSac, setHsnSac] = useState("");
  const [tdsPct, setTdsPct] = useState("");

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteKind, setNoteKind] = useState<CreditDebitNoteKind>("CREDIT");
  const [noteAmount, setNoteAmount] = useState("");
  const [noteGst, setNoteGst] = useState("");
  const [noteReason, setNoteReason] = useState("");

  useEffect(() => subscribeInvoice(id, setInv), [id]);
  useEffect(() => {
    if (!inv?.organizationId) { setOrg(null); return; }
    return subscribeOrganization(inv.organizationId, setOrg);
  }, [inv?.organizationId]);
  useEffect(() => subscribeCreditDebitNotesForInvoice(id, setNotes), [id]);
  useEffect(() => {
    setHsnSac(inv?.hsnSac ?? "");
    setTdsPct(inv?.tdsPct != null ? String(inv.tdsPct) : "");
  }, [inv?.id, inv?.hsnSac, inv?.tdsPct]);

  async function changeStatus(status: InvoiceStatus) {
    if (!actor || !inv) return;
    await updateInvoiceStatus(inv.id, status, actor);
    if (status !== "ISSUED" || !inv.billToId) return;
    const email = inv.billToType === "EMSP_USER"
      ? (await getEmspUser(inv.billToId))?.email
      : inv.billToType === "CORPORATE_ACCOUNT"
        ? (await getCorporateAccount(inv.billToId))?.billingEmail
        : undefined;
    if (!email) return;
    emailInvoiceIssued({
      to: email,
      invoiceNumber: inv.invoiceNumber,
      totalInr: inv.totalInr,
      invoiceUrl: `${window.location.origin}/invoices/${inv.id}`,
      companyName: brandedCompany.shortName,
    });
  }

  async function saveTax() {
    if (!actor || !inv) return;
    await run(
      () => setInvoiceTax(inv.id, { hsnSac: hsnSac.trim() || undefined, tdsPct: tdsPct ? Number(tdsPct) : undefined }, inv.totalInr, actor),
      "Saved.",
    );
  }

  async function submitNote() {
    if (!actor || !inv || !noteAmount.trim() || !noteReason.trim()) return;
    await run(async () => {
      await createCreditDebitNote({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        kind: noteKind,
        amountInr: Number(noteAmount) || 0,
        gstInr: Number(noteGst) || 0,
        reason: noteReason.trim(),
      }, actor);
      setNoteAmount(""); setNoteGst(""); setNoteReason(""); setNoteOpen(false);
    }, "Note issued.");
  }

  if (inv === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (inv === null) return <EmptyState title="Invoice not found" />;

  const brandedCompany = org
    ? { ...settings.company, shortName: org.name, legalName: org.name, logoUrl: org.logoUrl ?? settings.company.logoUrl }
    : settings.company;
  if (printMode) return <InvoiceDocument inv={inv} company={brandedCompany} onClose={() => setPrintMode(false)} />;

  return (
    <>
      <PageHeader
        title={inv.invoiceNumber}
        description={inv.billToName}
        actions={(
          <>
            <Button onClick={() => setPrintMode(true)}><Printer className="h-4 w-4" /> Print / PDF</Button>
            {canManage ? (
              <Select
                value={inv.status}
                onChange={(e) => void changeStatus(e.target.value as InvoiceStatus)}
                options={INVOICE_STATUSES.map((s) => ({ value: s, label: INVOICE_STATUS_LABEL[s] }))}
              />
            ) : (
              <Badge className={INVOICE_STATUS_COLOR[inv.status]}>{INVOICE_STATUS_LABEL[inv.status]}</Badge>
            )}
          </>
        )}
      />

      <Card title="Details">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-ink-500">Bill to</dt><dd className="text-ink-900">{inv.billToName}</dd></div>
          {inv.billToGstin && <div><dt className="text-xs text-ink-500">GSTIN</dt><dd className="text-ink-900">{inv.billToGstin}</dd></div>}
          <div><dt className="text-xs text-ink-500">Period</dt><dd className="text-ink-900">{formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</dd></div>
          <div><dt className="text-xs text-ink-500">Sessions</dt><dd className="text-ink-900">{inv.sessionIds.length}</dd></div>
        </dl>
        <dl className="mt-4 space-y-1.5 border-t border-ink-100 pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd className="tabular-nums">{formatINR(inv.subtotalInr)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-600">GST</dt><dd className="tabular-nums">{formatINR(inv.gstInr)}</dd></div>
          <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(inv.totalInr)}</dd></div>
          {!!inv.tdsInr && (
            <>
              <div className="flex justify-between text-rose-600"><dt>TDS ({inv.tdsPct}%)</dt><dd className="tabular-nums">−{formatINR(inv.tdsInr)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Net payable</dt><dd className="tabular-nums">{formatINR(inv.totalInr - inv.tdsInr)}</dd></div>
            </>
          )}
        </dl>
      </Card>

      {canManage && (
        <Card title="Tax details" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="HSN / SAC code" hint="As determined by your accountant for this invoice's line items.">
              <Input value={hsnSac} onChange={(e) => setHsnSac(e.target.value)} placeholder="e.g. 998714" />
            </Field>
            <Field label="TDS deducted by customer (%)">
              <Input type="number" value={tdsPct} onChange={(e) => setTdsPct(e.target.value)} placeholder="0" />
            </Field>
          </div>
          <Button className="mt-3" size="sm" loading={busy} onClick={() => void saveTax()}>Save</Button>
        </Card>
      )}

      <Card
        title="Credit / debit notes"
        subtitle="Corrections against this invoice, without editing its original figures."
        actions={canManage && <Button size="sm" onClick={() => setNoteOpen(true)}><Plus className="h-4 w-4" /> Issue note</Button>}
        className="mt-4"
      >
        {notes.length === 0 ? (
          <EmptyState title="No notes issued" />
        ) : (
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full">
              <thead className="border-b border-ink-200">
                <tr><th className="th">Note</th><th className="th">Kind</th><th className="th text-right">Amount</th><th className="th">Reason</th><th className="th">Issued</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {notes.map((n) => (
                  <tr key={n.id} className="hover:bg-ink-50">
                    <td className="td font-medium">{n.noteNumber}</td>
                    <td className="td">
                      <Badge className={n.kind === "CREDIT" ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-amber-100 text-amber-800 ring-amber-200"}>
                        {n.kind === "CREDIT" ? "Credit" : "Debit"}
                      </Badge>
                    </td>
                    <td className="td text-right tabular-nums">{formatINR(n.amountInr + n.gstInr)}</td>
                    <td className="td text-ink-600">{n.reason}</td>
                    <td className="td text-ink-600">{formatDateTime(n.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Issue credit / debit note"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!noteAmount.trim() || !noteReason.trim()}
              onClick={() => void submitNote()}
            >
              Issue
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <Field label="Kind" required>
            <Select
              value={noteKind}
              onChange={(e) => setNoteKind(e.target.value as CreditDebitNoteKind)}
              options={[{ value: "CREDIT", label: "Credit note (reduces amount owed)" }, { value: "DEBIT", label: "Debit note (increases amount owed)" }]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount (₹, excl. GST)" required>
              <Input type="number" value={noteAmount} onChange={(e) => setNoteAmount(e.target.value)} />
            </Field>
            <Field label="GST (₹)">
              <Input type="number" value={noteGst} onChange={(e) => setNoteGst(e.target.value)} placeholder="0" />
            </Field>
          </div>
          <Field label="Reason" required>
            <Input value={noteReason} onChange={(e) => setNoteReason(e.target.value)} placeholder="e.g. Billing dispute — energy meter discrepancy" />
          </Field>
        </div>
      </Modal>
    </>
  );
}

function InvoiceDocument({
  inv, company, onClose,
}: {
  inv: Invoice;
  company: { legalName: string; shortName: string; registeredAddress: string; officeAddress: string; gstin: string; cin: string; logoUrl: string };
  onClose: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button onClick={onClose}>&larr; Back</Button>
        <Button variant="primary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / Save as PDF</Button>
      </div>

      <article className="loi-sheet loi-letter mx-auto max-w-2xl rounded-xl border border-ink-200 bg-white p-8 shadow-card print:border-0 print:p-0 print:shadow-none">
        <PrintDocument
          header={(
            <PrintHeader
              docLabel="Tax Invoice"
              docNumber={inv.invoiceNumber}
              meta={(
                <>
                  <p className="mt-1 text-[11px] text-ink-400">{formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</p>
                  {inv.hsnSac && <p className="text-[11px] text-ink-400">HSN/SAC: {inv.hsnSac}</p>}
                </>
              )}
            />
          )}
          footer={<PrintFooter />}
        >
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-500">Billed to</p>
            <p className="font-medium text-ink-900">{inv.billToName}</p>
            {inv.billToGstin && <p className="text-ink-600">GSTIN: {inv.billToGstin}</p>}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <dl className="w-56 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-ink-600">Subtotal ({inv.sessionIds.length} sessions)</dt><dd className="tabular-nums">{formatINR(inv.subtotalInr)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-600">GST</dt><dd className="tabular-nums">{formatINR(inv.gstInr)}</dd></div>
            <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(inv.totalInr)}</dd></div>
            {!!inv.tdsInr && (
              <>
                <div className="flex justify-between text-rose-600"><dt>TDS ({inv.tdsPct}%)</dt><dd className="tabular-nums">−{formatINR(inv.tdsInr)}</dd></div>
                <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold"><dt>Net payable</dt><dd className="tabular-nums">{formatINR(inv.totalInr - inv.tdsInr)}</dd></div>
              </>
            )}
          </dl>
        </div>

        {inv.notes && <div className="mt-6 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{inv.notes}</div>}
        </PrintDocument>
      </article>
    </div>
  );
}
