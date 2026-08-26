"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Printer, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import { ChargerConfigurator, ExtrasEditor } from "@/components/charger-configurator";
import {
  Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Select, Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import { GstTypeField, ShipToFields, ShipToPrintBlock } from "@/components/gst-ship-to";
import { type BankDetails } from "@/components/bank-details";
import { EntityActivityLog } from "@/components/entity-activity-log";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useSettings } from "@/hooks/use-settings";
import {
  PROFORMA_INVOICE_STATUS_COLOR, PROFORMA_INVOICE_STATUS_LABEL, PROFORMA_INVOICE_STATUSES,
  type GstType, type ProformaInvoiceStatus,
} from "@/lib/constants";
import {
  deleteProformaInvoice, subscribeProformaInvoice, updateProformaInvoice, updateProformaInvoiceStatus,
} from "@/lib/db/proforma-invoices";
import { gstBreakdown } from "@/lib/gst";
import { amountInWords } from "@/lib/loi-template";
import { buildQuote, type ConfigItem, type ExtraItem, type QuoteLine } from "@/lib/pricing";
import { canApplyDiscount, canManageProformaInvoices, canOverridePrice } from "@/lib/permissions";
import type { ProformaInvoice, ShipToInfo } from "@/lib/types";
import { cn, formatDate, formatDateTime, formatINR } from "@/lib/utils";

export default function ProformaInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { actor } = useAuth();
  const viewer = useViewer();
  const { settings } = useSettings();
  const { busy, run } = useAsyncAction();

  const [pi, setPi] = useState<ProformaInvoice | null | undefined>(undefined);
  const [printMode, setPrintMode] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Editable draft — only meaningfully diverges from `pi` while status is DRAFT.
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [gstType, setGstType] = useState<GstType>("IGST");
  const [shipToEnabled, setShipToEnabled] = useState(false);
  const [shipTo, setShipTo] = useState<ShipToInfo>({});

  useEffect(() => subscribeProformaInvoice(id, (row) => {
    setPi(row);
    if (row) {
      setItems(row.items); setExtras(row.extras); setDiscount(row.discount); setNotes(row.notes ?? "");
      setGstType(row.gstType ?? "IGST");
      setShipToEnabled(row.shipToEnabled ?? false);
      setShipTo(row.shipTo ?? {});
    }
  }), [id]);
  useDocumentTitle(pi ? `Proforma Invoice · ${pi.piNumber}` : undefined);

  const canEdit = canManageProformaInvoices(viewer);
  const isDraft = pi?.status === "DRAFT";
  const quote = useMemo(() => buildQuote(items, { discount, extras }), [items, discount, extras]);

  async function saveDraft() {
    if (!pi || !actor) return;
    await run(() => updateProformaInvoice(pi.id, {
      leadId: pi.leadId, leadCode: pi.leadCode, quotationId: pi.quotationId, quoteNumber: pi.quoteNumber,
      client: pi.client, items, extras, discount,
      validUntil: pi.validUntil?.toDate?.() ?? null, notes,
      gstType, shipToEnabled, shipTo: shipToEnabled ? shipTo : null,
    }, actor), "Proforma invoice updated.");
  }

  async function changeStatus(status: ProformaInvoiceStatus) {
    if (!pi || !actor) return;
    await run(() => updateProformaInvoiceStatus(pi, status, actor), `Marked ${PROFORMA_INVOICE_STATUS_LABEL[status]}.`);
  }

  if (pi === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (pi === null) return <EmptyState title="Proforma invoice not found" />;

  if (printMode) {
    return <ProformaInvoiceDocument pi={pi} company={settings.company} bank={settings.bank} onClose={() => setPrintMode(false)} />;
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
            {canEdit && (
              <Button onClick={() => setDeleteOpen(true)} className="text-rose-700 hover:bg-rose-50">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
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
              <div><dt className="text-xs text-ink-500">Created by</dt><dd className="text-ink-900">{pi.createdBy?.name ?? "—"} · {formatDateTime(pi.createdAt)}</dd></div>
            </dl>
            {canEdit && isDraft ? (
              <div className="mt-4 space-y-4 border-t border-ink-100 pt-4">
                <GstTypeField value={gstType} onChange={setGstType} />
                <ShipToFields enabled={shipToEnabled} onEnabledChange={setShipToEnabled} value={shipTo} onChange={setShipTo} />
              </div>
            ) : (
              <dl className="mt-4 grid gap-3 border-t border-ink-100 pt-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-ink-500">GST type</dt><dd className="text-ink-900">{gstType === "CGST_SGST" ? "CGST & SGST" : "IGST"}</dd></div>
                {shipToEnabled && shipTo && <ShipToPrintBlock shipTo={shipTo} />}
              </dl>
            )}
          </Card>

          <Card title="Other items">
            <ExtrasEditor extras={extras} onChange={setExtras} disabled={!canEdit || !isDraft} />
          </Card>

          <Card title="Chargers & services" subtitle={isDraft ? "Editable while the proforma invoice is a draft." : "Locked — this is a record of what was billed."}>
            <ChargerConfigurator
              value={items}
              onChange={setItems}
              extras={extras}
              onExtrasChange={setExtras}
              showExtras={false}
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
              {gstBreakdown(gstType, quote.gst, quote.effectiveGstPct).map((row) => (
                <div key={row.label} className="flex justify-between">
                  <dt className="text-ink-600">{row.label}</dt>
                  <dd className="tabular-nums">{formatINR(row.amount)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-ink-200 pt-1.5 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(quote.grandTotal)}</dd></div>
            </dl>
          </Card>

          <EntityActivityLog entityType="PROFORMA_INVOICE" entityId={pi.id} />
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this proforma invoice?"
        description="This permanently removes the proforma invoice. It cannot be recovered."
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!actor) return;
                  await deleteProformaInvoice(pi, actor);
                  router.push("/proforma-invoices");
                }, "Proforma invoice deleted.")
              }
            >
              <Trash2 className="h-4 w-4" /> Delete proforma invoice
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">{pi.piNumber} — {pi.client.name}, {formatINR(pi.totals.grandTotal)}</p>
      </Modal>
    </>
  );
}

/** One row of the per-rate tax summary table (GST rate stands in for HSN/SAC — this pricing engine doesn't track HSN per line). */
interface RateGroup {
  gstPct: number;
  taxable: number;
  gst: number;
}

function groupLinesByGstRate(lines: QuoteLine[], keepRatio: number): RateGroup[] {
  const map = new Map<number, RateGroup>();
  for (const line of lines) {
    const g = map.get(line.gstPct) ?? { gstPct: line.gstPct, taxable: 0, gst: 0 };
    g.taxable += line.base * keepRatio;
    g.gst += line.gst * keepRatio;
    map.set(line.gstPct, g);
  }
  return [...map.values()].sort((a, b) => a.gstPct - b.gstPct);
}

const gridCell = "border border-ink-400 px-2 py-1.5";
const gridLabel = "text-[10px] text-ink-500";

function ProformaInvoiceDocument({
  pi, company, bank, onClose,
}: {
  pi: ProformaInvoice;
  company: { legalName: string; shortName: string; registeredAddress: string; officeAddress: string; gstin: string; cin: string; email: string; website: string; logoUrl: string };
  bank: BankDetails;
  onClose: () => void;
}) {
  const quote = buildQuote(pi.items, { discount: pi.discount, extras: pi.extras });
  const keepRatio = quote.subtotal > 0 ? quote.taxableValue / quote.subtotal : 0;
  const rateGroups = groupLinesByGstRate(quote.lines, keepRatio);
  const splitLabels = gstBreakdown(pi.gstType, 100, 100).map((r) => r.label); // ["IGST"] or ["CGST","SGST"]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Button onClick={onClose}>&larr; Back</Button>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </Button>
      </div>

      <article className="loi-sheet mx-auto max-w-3xl bg-white p-4 text-[11px] leading-snug text-ink-900 print:p-0">
        <p className="mb-1 text-center text-base font-semibold">Proforma Invoice</p>

        <div className="grid grid-cols-2 border border-ink-400">
          <div className={cn(gridCell, "border-r-0")}>
            <p className="font-semibold">{company.legalName}</p>
            <p>{company.officeAddress}</p>
            <p>GSTIN/UIN: {company.gstin}</p>
            {company.email && <p>E-Mail: {company.email}</p>}
          </div>
          <div className="grid grid-cols-2">
            <div className={gridCell}><p className={gridLabel}>Invoice No.</p><p className="font-medium">{pi.piNumber}</p></div>
            <div className={gridCell}><p className={gridLabel}>Dated</p><p className="font-medium">{formatDate(pi.createdAt)}</p></div>
            <div className={gridCell}><p className={gridLabel}>Reference No. & Date</p><p>{pi.quoteNumber || "—"}</p></div>
            <div className={gridCell}><p className={gridLabel}>Other References</p><p>{pi.leadCode || "—"}</p></div>
            <div className={cn(gridCell, "col-span-2")}><p className={gridLabel}>Mode/Terms of Payment</p><p>{pi.validUntil ? `Valid until ${formatDate(pi.validUntil)}` : "—"}</p></div>
          </div>
        </div>

        {pi.shipToEnabled && pi.shipTo && (
          <div className={cn(gridCell, "border-t-0")}>
            <p className={gridLabel}>Consignee (Ship to)</p>
            <p className="font-semibold">{pi.shipTo.name || pi.client.name}</p>
            {pi.shipTo.address && <p>{pi.shipTo.address}</p>}
            {pi.shipTo.gstin && <p>GSTIN/UIN: {pi.shipTo.gstin}</p>}
          </div>
        )}

        <div className={cn(gridCell, "border-t-0")}>
          <p className={gridLabel}>Buyer (Bill to)</p>
          <p className="font-semibold">{pi.client.name}{pi.client.company ? ` — ${pi.client.company}` : ""}</p>
          {pi.client.address && <p>{pi.client.address}</p>}
          {pi.client.city && <p>{pi.client.city}{pi.client.state ? `, ${pi.client.state}` : ""}</p>}
          {pi.client.gstin && <p>GSTIN/UIN: {pi.client.gstin}</p>}
        </div>

        <table className="w-full border-collapse border border-t-0 border-ink-400">
          <thead>
            <tr className="text-left">
              <th className={cn(gridCell, "w-8")}>SI No.</th>
              <th className={gridCell}>Particulars</th>
              <th className={cn(gridCell, "w-20")}>HSN/SAC</th>
              <th className={cn(gridCell, "w-16 text-right")}>Qty</th>
              <th className={cn(gridCell, "w-24 text-right")}>Rate</th>
              <th className={cn(gridCell, "w-28 text-right")}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line, i) => {
              const taxable = line.base * keepRatio;
              const gstAmt = line.gst * keepRatio;
              const splitAmounts = gstBreakdown(pi.gstType, gstAmt, line.gstPct);
              return (
                <tr key={line.key}>
                  <td className={cn(gridCell, "align-top")}>{i + 1}</td>
                  <td className={cn(gridCell, "align-top")}>
                    <p>{line.label}</p>
                    {splitAmounts.map((row) => (
                      <p key={row.label} className="text-ink-500">{row.label}</p>
                    ))}
                  </td>
                  <td className={cn(gridCell, "align-top text-ink-500")}>{line.hsnCode || "—"}</td>
                  <td className={cn(gridCell, "align-top text-right tabular-nums")}>{line.qty}</td>
                  <td className={cn(gridCell, "align-top text-right tabular-nums")}>{formatINR(line.unitBase)}</td>
                  <td className={cn(gridCell, "align-top text-right tabular-nums")}>
                    <p>{formatINR(taxable)}</p>
                    {splitAmounts.map((row) => (
                      <p key={row.label} className="text-ink-500">{formatINR(row.amount)}</p>
                    ))}
                  </td>
                </tr>
              );
            })}
            {quote.discount > 0 && (
              <tr>
                <td className={gridCell} />
                <td className={gridCell}>Discount</td>
                <td className={gridCell} />
                <td className={gridCell} />
                <td className={gridCell} />
                <td className={cn(gridCell, "text-right tabular-nums text-rose-600")}>−{formatINR(quote.discount)}</td>
              </tr>
            )}
            <tr>
              <td className={gridCell} colSpan={5}><p className="text-right font-semibold">Total</p></td>
              <td className={cn(gridCell, "text-right text-sm font-bold tabular-nums")}>{formatINR(quote.grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        <div className={cn(gridCell, "border-t-0")}>
          <p className={gridLabel}>Amount Chargeable (in words)</p>
          <p className="font-semibold">{amountInWords(quote.grandTotal)}</p>
        </div>

        <table className="w-full border-collapse border border-t-0 border-ink-400">
          <thead>
            <tr className="text-left">
              <th className={gridCell}>GST Rate</th>
              <th className={cn(gridCell, "text-right")}>Taxable Value</th>
              {splitLabels.map((label) => <th key={label} className={cn(gridCell, "text-right")}>{label}</th>)}
              <th className={cn(gridCell, "text-right")}>Total Tax Amount</th>
            </tr>
          </thead>
          <tbody>
            {rateGroups.map((g) => {
              const split = gstBreakdown(pi.gstType, g.gst, g.gstPct);
              return (
                <tr key={g.gstPct}>
                  <td className={gridCell}>{g.gstPct}%</td>
                  <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(g.taxable)}</td>
                  {split.map((row) => (
                    <td key={row.label} className={cn(gridCell, "text-right tabular-nums")}>{formatINR(row.amount)}</td>
                  ))}
                  <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(g.gst)}</td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <td className={gridCell}>Total</td>
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(quote.taxableValue)}</td>
              {splitLabels.map((label) => {
                const total = rateGroups.reduce((a, g) => {
                  const row = gstBreakdown(pi.gstType, g.gst, g.gstPct).find((r) => r.label === label);
                  return a + (row?.amount ?? 0);
                }, 0);
                return <td key={label} className={cn(gridCell, "text-right tabular-nums")}>{formatINR(total)}</td>;
              })}
              <td className={cn(gridCell, "text-right tabular-nums")}>{formatINR(quote.gst)}</td>
            </tr>
          </tbody>
        </table>

        <div className={cn(gridCell, "border-t-0")}>
          <p className={gridLabel}>Tax Amount (in words)</p>
          <p className="font-semibold">{amountInWords(quote.gst)}</p>
        </div>

        {pi.notes && (
          <div className={cn(gridCell, "border-t-0")}>
            <p className={gridLabel}>Notes</p>
            <p>{pi.notes}</p>
          </div>
        )}

        <div className={cn(gridCell, "border-t-0 text-right")}>
          <p>for {company.legalName}</p>
          <p className="mt-8">Authorised Signatory</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-[10px] text-ink-500">
          <div>
            <p className="font-semibold text-ink-700">Bank details for payment</p>
            {bank.accountName && <p>A/c holder: {bank.accountName}</p>}
            {bank.bankName && <p>Bank: {bank.bankName}</p>}
            {bank.accountNumber && <p>A/c No.: {bank.accountNumber}</p>}
            {bank.ifsc && <p>IFSC: {bank.ifsc}</p>}
          </div>
          <div className="text-right">
            <p>{company.registeredAddress}</p>
            {company.cin && <p>CIN: {company.cin}</p>}
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] text-ink-500">This is a Computer Generated Proforma Invoice</p>
      </article>
    </div>
  );
}
