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
  QUOTATION_STATUS_COLOR, QUOTATION_STATUS_LABEL, QUOTATION_STATUSES, type QuotationStatus,
} from "@/lib/constants";
import { subscribeQuotation, updateQuotation, updateQuotationStatus } from "@/lib/db/quotations";
import { buildQuote, type ConfigItem, type ExtraItem } from "@/lib/pricing";
import { canApplyDiscount, canManageQuotations, canOverridePrice } from "@/lib/permissions";
import type { Quotation } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { actor } = useAuth();
  const viewer = useViewer();
  const { settings } = useSettings();
  const { busy, run } = useAsyncAction();

  const [q, setQ] = useState<Quotation | null | undefined>(undefined);
  const [printMode, setPrintMode] = useState(false);

  // Editable draft — only meaningfully diverges from `q` while status is DRAFT.
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => subscribeQuotation(id, (row) => {
    setQ(row);
    if (row) { setItems(row.items); setExtras(row.extras); setDiscount(row.discount); setNotes(row.notes ?? ""); }
  }), [id]);

  const canEdit = canManageQuotations(viewer);
  const isDraft = q?.status === "DRAFT";
  const quote = useMemo(() => buildQuote(items, { discount, extras }), [items, discount, extras]);

  async function saveDraft() {
    if (!q || !actor) return;
    await run(() => updateQuotation(q.id, {
      leadId: q.leadId, leadCode: q.leadCode, client: q.client, items, extras, discount,
      validUntil: q.validUntil?.toDate?.() ?? null, notes,
    }, actor), "Quotation updated.");
  }

  async function changeStatus(status: QuotationStatus) {
    if (!q || !actor) return;
    await run(() => updateQuotationStatus(q.id, status, actor), `Marked ${QUOTATION_STATUS_LABEL[status]}.`);
  }

  if (q === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (q === null) return <EmptyState title="Quotation not found" />;

  if (printMode) {
    return <QuotationDocument q={q} company={settings.company} onClose={() => setPrintMode(false)} />;
  }

  return (
    <>
      <PageHeader
        title={q.quoteNumber}
        description={`${q.client.name}${q.client.company ? ` · ${q.client.company}` : ""}`}
        actions={(
          <>
            <Button onClick={() => setPrintMode(true)}><Printer className="h-4 w-4" /> Print / PDF</Button>
            {canEdit ? (
              <Select
                value={q.status}
                onChange={(e) => void changeStatus(e.target.value as QuotationStatus)}
                options={QUOTATION_STATUSES.map((s) => ({ value: s, label: QUOTATION_STATUS_LABEL[s] }))}
              />
            ) : (
              <Badge className={QUOTATION_STATUS_COLOR[q.status]}>{QUOTATION_STATUS_LABEL[q.status]}</Badge>
            )}
          </>
        )}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Client" subtitle={q.leadCode ? `Linked to lead ${q.leadCode}` : "Not linked to a lead"}>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-500">Name</dt><dd className="text-ink-900">{q.client.name}</dd></div>
              <div><dt className="text-xs text-ink-500">Phone</dt><dd className="text-ink-900">{q.client.phone}</dd></div>
              {q.client.company && <div><dt className="text-xs text-ink-500">Company</dt><dd className="text-ink-900">{q.client.company}</dd></div>}
              {q.client.email && <div><dt className="text-xs text-ink-500">Email</dt><dd className="text-ink-900">{q.client.email}</dd></div>}
              {q.client.gstin && <div><dt className="text-xs text-ink-500">GSTIN</dt><dd className="text-ink-900">{q.client.gstin}</dd></div>}
              {q.validUntil && <div><dt className="text-xs text-ink-500">Valid until</dt><dd className="text-ink-900">{formatDate(q.validUntil)}</dd></div>}
            </dl>
          </Card>

          <Card title="Chargers & services" subtitle={isDraft ? "Editable while the quotation is a draft." : "Locked — this is a record of what was quoted."}>
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

function QuotationDocument({
  q, company, onClose,
}: {
  q: Quotation;
  company: { legalName: string; shortName: string; registeredAddress: string; officeAddress: string; gstin: string; cin: string; email: string; website: string; logoUrl: string };
  onClose: () => void;
}) {
  const quote = buildQuote(q.items, { discount: q.discount, extras: q.extras });

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
            <p className="text-xs text-ink-500">Quotation &middot; {q.quoteNumber}</p>
            <p className="mt-1 text-[11px] text-ink-400">{formatDate(q.createdAt)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-500">Quoted to</p>
            <p className="font-medium text-ink-900">{q.client.name}</p>
            {q.client.company && <p className="text-ink-600">{q.client.company}</p>}
            <p className="text-ink-600">{q.client.phone}</p>
            {q.client.gstin && <p className="text-ink-600">GSTIN: {q.client.gstin}</p>}
          </div>
          <div className="text-right">
            {q.validUntil && (<><p className="text-xs text-ink-500">Valid until</p><p className="text-ink-900">{formatDate(q.validUntil)}</p></>)}
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
            {quote.lines.map((line) => (
              <tr key={line.key} className="border-b border-ink-100">
                <td className="py-2">{line.label}</td>
                <td className="py-2 text-right tabular-nums">{line.qty}</td>
                <td className="py-2 text-right tabular-nums">{formatINR(line.unitBase)}</td>
                <td className="py-2 text-right tabular-nums text-ink-600">{line.gstPct}%</td>
                <td className="py-2 text-right tabular-nums">{formatINR(line.base)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="mt-4 flex justify-end">
          <dl className="w-56 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd className="tabular-nums">{formatINR(q.totals.subtotal)}</dd></div>
            {q.totals.discount > 0 && (
              <div className="flex justify-between"><dt className="text-ink-600">Discount</dt><dd className="tabular-nums text-rose-600">−{formatINR(q.totals.discount)}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-ink-600">GST</dt><dd className="tabular-nums">{formatINR(q.totals.gst)}</dd></div>
            <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(q.totals.grandTotal)}</dd></div>
          </dl>
        </div>

        {q.notes && (
          <div className="mt-6 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{q.notes}</div>
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
