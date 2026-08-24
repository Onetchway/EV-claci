"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import { ChargerConfigurator } from "@/components/charger-configurator";
import {
  Badge, Button, Card, EmptyState, Field, PageHeader, Select, Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import { useSettings } from "@/hooks/use-settings";
import {
  PROFORMA_INVOICE_STATUS_COLOR, PROFORMA_INVOICE_STATUS_LABEL, PROFORMA_INVOICE_STATUSES,
  type GstMode, type ProformaInvoiceStatus,
} from "@/lib/constants";
import { subscribeProformaInvoice, updateProformaInvoice, updateProformaInvoiceStatus } from "@/lib/db/proforma-invoices";
import { buildQuote, type ConfigItem, type ExtraItem } from "@/lib/pricing";
import { canApplyDiscount, canManageProformaInvoices, canOverridePrice } from "@/lib/permissions";
import type { ProformaInvoice } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function ProformaInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { actor } = useAuth();
  const viewer = useViewer();
  const { settings } = useSettings();
  const { busy, run } = useAsyncAction();

  const [pi, setPi] = useState<ProformaInvoice | null | undefined>(undefined);
  const [printMode, setPrintMode] = useState(false);

  // Editable draft — only meaningfully diverges from `pi` while status is DRAFT.
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [gstMode, setGstMode] = useState<GstMode>("BLENDED");
  const [notes, setNotes] = useState("");

  useEffect(() => subscribeProformaInvoice(id, (row) => {
    setPi(row);
    if (row) {
      setItems(row.items); setExtras(row.extras); setDiscount(row.discount);
      setGstMode(row.gstMode ?? "BLENDED"); setNotes(row.notes ?? "");
    }
  }), [id]);

  const canEdit = canManageProformaInvoices(viewer);
  const isDraft = pi?.status === "DRAFT";
  const quote = useMemo(() => buildQuote(items, { discount, extras }), [items, discount, extras]);

  async function saveDraft() {
    if (!pi || !actor) return;
    await run(() => updateProformaInvoice(pi.id, {
      leadId: pi.leadId, leadCode: pi.leadCode, quotationId: pi.quotationId, quoteNumber: pi.quoteNumber,
      client: pi.client, items, extras, discount, gstMode,
      validUntil: pi.validUntil?.toDate?.() ?? null, notes,
    }, actor), "Proforma invoice updated.");
  }

  async function changeStatus(status: ProformaInvoiceStatus) {
    if (!pi || !actor) return;
    await run(() => updateProformaInvoiceStatus(pi.id, status, actor), `Marked ${PROFORMA_INVOICE_STATUS_LABEL[status]}.`);
  }

  if (pi === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (pi === null) return <EmptyState title="Proforma invoice not found" />;

  if (printMode) {
    return <ProformaInvoiceDocument pi={pi} company={settings.company} onClose={() => setPrintMode(false)} />;
  }

  return (
    <>
      <PageHeader
        title={pi.piNumber}
        description={`${pi.client.name}${pi.client.company ? ` · ${pi.client.company}` : ""}`}
        actions={(
          <>
            <Button onClick={() => setPrintMode(true)}><Printer className="h-4 w-4" /> Print / PDF</Button>
            {canEdit ? (
              <Select
                value={pi.status}
                onChange={(e) => void changeStatus(e.target.value as ProformaInvoiceStatus)}
                options={PROFORMA_INVOICE_STATUSES.map((s) => ({ value: s, label: PROFORMA_INVOICE_STATUS_LABEL[s] }))}
              />
            ) : (
              <Badge className={PROFORMA_INVOICE_STATUS_COLOR[pi.status]}>{PROFORMA_INVOICE_STATUS_LABEL[pi.status]}</Badge>
            )}
          </>
        )}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Client" subtitle={pi.leadCode ? `Linked to lead ${pi.leadCode}` : "Not linked to a lead"}>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-500">Name</dt><dd className="text-ink-900">{pi.client.name}</dd></div>
              <div><dt className="text-xs text-ink-500">Phone</dt><dd className="text-ink-900">{pi.client.phone}</dd></div>
              {pi.client.company && <div><dt className="text-xs text-ink-500">Company</dt><dd className="text-ink-900">{pi.client.company}</dd></div>}
              {pi.client.email && <div><dt className="text-xs text-ink-500">Email</dt><dd className="text-ink-900">{pi.client.email}</dd></div>}
              {pi.client.gstin && <div><dt className="text-xs text-ink-500">GSTIN</dt><dd className="text-ink-900">{pi.client.gstin}</dd></div>}
              {pi.validUntil && <div><dt className="text-xs text-ink-500">Valid until</dt><dd className="text-ink-900">{formatDate(pi.validUntil)}</dd></div>}
            </dl>
          </Card>

          <Card title="Chargers & services" subtitle={isDraft ? "Editable while the proforma invoice is a draft." : "Locked — this is a record of what was billed."}>
            <ChargerConfigurator
              value={items}
              onChange={setItems}
              extras={extras}
              onExtrasChange={setExtras}
              discount={discount}
              onDiscountChange={setDiscount}
              allowDiscount={canApplyDiscount(viewer)}
              allowPriceOverride={canOverridePrice(viewer)}
              disabled={!canEdit || !isDraft}
              gstMode={gstMode}
              onGstModeChange={setGstMode}
            />
          </Card>

          <Card title="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit || !isDraft} />
          </Card>

          {canEdit && isDraft && (
            <Button variant="primary" loading={busy} onClick={() => void saveDraft()}>Save changes</Button>
          )}
        </div>

        <div>
          <Card title="Totals" className="sticky top-16">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd className="tabular-nums">{formatINR(quote.subtotal)}</dd></div>
              {quote.discount > 0 && (
                <div className="flex justify-between"><dt className="text-ink-600">Discount</dt><dd className="tabular-nums text-rose-600">−{formatINR(quote.discount)}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-ink-600">GST</dt><dd className="tabular-nums">{formatINR(quote.gst)}</dd></div>
              <div className="flex justify-between border-t border-ink-200 pt-1.5 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(quote.grandTotal)}</dd></div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

function ProformaInvoiceDocument({
  pi, company, onClose,
}: {
  pi: ProformaInvoice;
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

      <article className="loi-sheet mx-auto max-w-2xl rounded-xl border border-ink-200 bg-white p-8 shadow-card print:border-0 print:p-0 print:shadow-none">
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
            <p className="text-xs text-ink-500">Proforma Invoice &middot; {pi.piNumber}</p>
            <p className="mt-1 text-[11px] text-ink-400">{formatDate(pi.createdAt)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-500">Billed to</p>
            <p className="font-medium text-ink-900">{pi.client.name}</p>
            {pi.client.company && <p className="text-ink-600">{pi.client.company}</p>}
            <p className="text-ink-600">{pi.client.phone}</p>
            {pi.client.gstin && <p className="text-ink-600">GSTIN: {pi.client.gstin}</p>}
          </div>
          <div className="text-right">
            {pi.validUntil && (<><p className="text-xs text-ink-500">Valid until</p><p className="text-ink-900">{formatDate(pi.validUntil)}</p></>)}
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
            {[...pi.items.map((it, i) => ({
              key: `c${i}`, desc: it.sku, qty: it.qty, price: it.unitPrice ?? 0, gst: it.gstPct ?? 5,
            })), ...pi.extras.map((e, i) => ({
              key: `e${i}`, desc: e.label, qty: 1, price: e.amount, gst: e.gstPct,
            }))].map((line) => (
              <tr key={line.key} className="border-b border-ink-100">
                <td className="py-2">{line.desc}</td>
                <td className="py-2 text-right tabular-nums">{line.qty}</td>
                <td className="py-2 text-right tabular-nums">{formatINR(line.price)}</td>
                <td className="py-2 text-right tabular-nums text-ink-600">{line.gst}%</td>
                <td className="py-2 text-right tabular-nums">{formatINR(line.qty * line.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="mt-4 flex justify-end">
          <dl className="w-56 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd className="tabular-nums">{formatINR(pi.totals.subtotal)}</dd></div>
            {pi.totals.discount > 0 && (
              <div className="flex justify-between"><dt className="text-ink-600">Discount</dt><dd className="tabular-nums text-rose-600">−{formatINR(pi.totals.discount)}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-ink-600">GST</dt><dd className="tabular-nums">{formatINR(pi.totals.gst)}</dd></div>
            <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(pi.totals.grandTotal)}</dd></div>
          </dl>
        </div>

        {pi.notes && (
          <div className="mt-6 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{pi.notes}</div>
        )}

        <footer className="mt-10 border-t border-ink-200 pt-3 text-center text-[10px] leading-relaxed text-ink-400">
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
