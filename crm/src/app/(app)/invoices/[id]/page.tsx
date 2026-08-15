"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import { Badge, Button, Card, EmptyState, PageHeader, Select, Spinner } from "@/components/ui";
import { useSettings } from "@/hooks/use-settings";
import { INVOICE_STATUS_COLOR, INVOICE_STATUS_LABEL, INVOICE_STATUSES, type InvoiceStatus } from "@/lib/constants";
import { subscribeInvoice, updateInvoiceStatus } from "@/lib/db/invoices";
import { canManageInvoices } from "@/lib/permissions";
import type { Invoice } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { actor } = useAuth();
  const viewer = useViewer();
  const { settings } = useSettings();
  const canManage = canManageInvoices(viewer);

  const [inv, setInv] = useState<Invoice | null | undefined>(undefined);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => subscribeInvoice(id, setInv), [id]);

  if (inv === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (inv === null) return <EmptyState title="Invoice not found" />;

  if (printMode) return <InvoiceDocument inv={inv} company={settings.company} onClose={() => setPrintMode(false)} />;

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
                onChange={(e) => void updateInvoiceStatus(inv.id, e.target.value as InvoiceStatus, actor!)}
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
        </dl>
      </Card>
    </>
  );
}

function InvoiceDocument({
  inv, company, onClose,
}: {
  inv: Invoice;
  company: { legalName: string; shortName: string; address: string; gstin: string; cin: string; logoUrl: string };
  onClose: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button onClick={onClose}>&larr; Back</Button>
        <Button variant="primary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / Save as PDF</Button>
      </div>

      <article className="loi-sheet mx-auto max-w-2xl rounded-xl border border-ink-200 bg-white p-8 shadow-card print:border-0 print:p-0 print:shadow-none">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-ink-200 pb-4">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt={company.shortName} className="h-10 w-auto shrink-0 object-contain" />
          ) : (
            <p className="text-lg font-bold tracking-tight text-ink-900">{company.legalName}</p>
          )}
          <div className="text-right">
            <p className="text-xs text-ink-500">Tax Invoice &middot; {inv.invoiceNumber}</p>
            <p className="mt-1 text-[11px] text-ink-400">{formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</p>
          </div>
        </div>

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
          </dl>
        </div>

        {inv.notes && <div className="mt-6 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{inv.notes}</div>}

        <footer className="mt-10 border-t border-ink-200 pt-3 text-center text-[10px] leading-relaxed text-ink-400">
          <p>{company.legalName}</p>
          <p>{[company.gstin && `GSTN. ${company.gstin}`, company.cin && `CIN. ${company.cin}`, company.address].filter(Boolean).join(" | ")}</p>
        </footer>
      </article>
    </div>
  );
}
