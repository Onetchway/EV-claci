"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useActor } from "@/components/auth-provider";
import { Button, Card, EmptyState, Field, Input, Spinner, Textarea, useAsyncAction, useToast } from "@/components/ui";
import { GstTypeField, ShipToField } from "@/components/gst-fields";
import { ItemsTable, QUOTATION_ITEM_FIELDS, type DraftItem } from "@/components/line-items-table";
import type { GstType } from "@/lib/constants";
import { computeLineTotals, getQuotation, updateQuotation } from "@/lib/db/quotations";
import type { Quotation } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function EditQuotationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [q, setQ] = useState<Quotation | null | undefined>(undefined);
  const [quotationNo, setQuotationNo] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [taxPercent, setTaxPercent] = useState("18");
  const [gstType, setGstType] = useState<GstType>("IGST");
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [shipToDifferent, setShipToDifferent] = useState(false);
  const [shipToAddress, setShipToAddress] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);

  useEffect(() => {
    void getQuotation(id).then((row) => {
      setQ(row);
      if (!row) return;
      setQuotationNo(row.quotationNo);
      setValidUntil(row.validUntil ? row.validUntil.toDate().toISOString().slice(0, 10) : "");
      setTaxPercent(String(row.taxPercent ?? 18));
      setGstType(row.gstType ?? "IGST");
      setTerms(row.terms ?? "");
      setNotes(row.notes ?? "");
      setShipToDifferent(row.shipToDifferent ?? false);
      setShipToAddress(row.shipToAddress ?? "");
      setItems(row.items.map((it) => ({ description: it.description, unit: it.unit, qty: it.qty, rate: it.rate, hsnCode: it.hsnCode, gstPercent: it.gstPercent })));
    });
  }, [id]);

  if (q === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (q === null) return <EmptyState title="Quotation not found" action={<Link href="/quotations"><Button>Back to quotations</Button></Link>} />;

  const totals = computeLineTotals(items, Number(taxPercent) || 0, gstType);

  async function onSave() {
    if (!quotationNo.trim()) {
      push("Quotation number is required.", "error");
      return;
    }
    await run(async () => {
      await updateQuotation(q!, {
        quotationNo, validUntil: validUntil ? new Date(validUntil) : null,
        items, taxPercent: Number(taxPercent) || 0, gstType, terms, notes,
        shipToDifferent, shipToAddress: shipToDifferent ? shipToAddress : "",
      }, actor);
      router.push(`/quotations/${q!.id}`);
    }, "Quotation updated.");
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-navy-900">Edit Quotation</h1>
        <p className="text-sm text-ink-500">{q.quotationNo} — {q.projectName}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Quotation details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quotation No." required><Input value={quotationNo} onChange={(e) => setQuotationNo(e.target.value)} /></Field>
              <Field label="Valid Until"><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
              <Field label="Tax %"><Input type="number" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} /></Field>
              <GstTypeField value={gstType} onChange={setGstType} className="col-span-2" />
              <ShipToField enabled={shipToDifferent} onEnabledChange={setShipToDifferent} address={shipToAddress} onAddressChange={setShipToAddress} className="col-span-2" />
              <Field label="Terms &amp; Conditions" className="col-span-2"><Textarea value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
              <Field label="Notes" className="col-span-2"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            </div>
          </Card>

          <Card title="Line items">
            <ItemsTable items={items} setItems={setItems} fields={QUOTATION_ITEM_FIELDS} />
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Subtotal</dt><dd className="tabular-nums">{formatINR(totals.subtotal)}</dd></div>
              {gstType === "IGST" ? (
                <div className="flex justify-between"><dt className="text-ink-500">IGST</dt><dd className="tabular-nums">{formatINR(totals.igstAmount)}</dd></div>
              ) : (
                <>
                  <div className="flex justify-between"><dt className="text-ink-500">CGST</dt><dd className="tabular-nums">{formatINR(totals.cgstAmount)}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-500">SGST</dt><dd className="tabular-nums">{formatINR(totals.sgstAmount)}</dd></div>
                </>
              )}
              <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(totals.total)}</dd></div>
            </dl>
            <div className="mt-4 space-y-2">
              <Button variant="primary" className="w-full justify-center" onClick={() => void onSave()} loading={busy}>Save Changes</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => router.push(`/quotations/${q!.id}`)}>Cancel</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
