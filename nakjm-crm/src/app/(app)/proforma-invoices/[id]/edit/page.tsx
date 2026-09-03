"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useActor } from "@/components/auth-provider";
import { Button, Card, EmptyState, Field, Input, Spinner, Textarea, useAsyncAction, useToast } from "@/components/ui";
import { GstTypeField, ShipToField } from "@/components/gst-fields";
import { ItemsTable, QUOTATION_ITEM_FIELDS, type DraftItem } from "@/components/line-items-table";
import type { GstType } from "@/lib/constants";
import { getProformaInvoice, updateProformaInvoice } from "@/lib/db/proforma-invoices";
import { subscribeProject } from "@/lib/db/projects";
import { computeLineTotals } from "@/lib/db/quotations";
import type { ProformaInvoice, Project } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function EditProformaInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [pi, setPi] = useState<ProformaInvoice | null | undefined>(undefined);
  const [piNo, setPiNo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [milestone, setMilestone] = useState("");
  const [taxAmount, setTaxAmount] = useState("0");
  const [gstType, setGstType] = useState<GstType>("IGST");
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [shipToDifferent, setShipToDifferent] = useState(false);
  const [shipToAddress, setShipToAddress] = useState("");
  const [clientPoNumber, setClientPoNumber] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [milestoneBasis, setMilestoneBasis] = useState<"PERCENT" | "AMOUNT">("PERCENT");
  const [milestoneValue, setMilestoneValue] = useState("");
  const [milestoneGst, setMilestoneGst] = useState<"WITH" | "WITHOUT">("WITH");
  const [milestoneTaxTreatment, setMilestoneTaxTreatment] = useState<"EXCLUSIVE" | "INCLUSIVE">("EXCLUSIVE");
  const [milestoneGstPercent, setMilestoneGstPercent] = useState("18");

  useEffect(() => {
    void getProformaInvoice(id).then((row) => {
      setPi(row);
      if (!row) return;
      setPiNo(row.piNo);
      setDueDate(row.dueDate ? row.dueDate.toDate().toISOString().slice(0, 10) : "");
      setMilestone(row.milestone ?? "");
      setTaxAmount(String(row.taxAmount ?? 0));
      setGstType(row.gstType ?? "IGST");
      setTerms(row.terms ?? "");
      setNotes(row.notes ?? "");
      setShipToDifferent(row.shipToDifferent ?? false);
      setShipToAddress(row.shipToAddress ?? "");
      setClientPoNumber(row.clientPoNumber ?? "");
      setItems(row.items.map((it) => ({ description: it.description, unit: it.unit, qty: it.qty, rate: it.rate, hsnCode: it.hsnCode, gstPercent: it.gstPercent })));
    });
  }, [id]);

  useEffect(() => { if (pi?.projectId) return subscribeProject(pi.projectId, setProject); }, [pi?.projectId]);

  if (pi === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (pi === null) return <EmptyState title="Proforma invoice not found" action={<Link href="/proforma-invoices"><Button>Back to proforma invoices</Button></Link>} />;

  const { subtotal } = computeLineTotals(items);
  const tax = Number(taxAmount) || 0;
  const igst = gstType === "IGST" ? tax : 0;
  const cgst = gstType === "CGST_SGST" ? tax / 2 : 0;
  const sgst = gstType === "CGST_SGST" ? tax / 2 : 0;

  const milestoneBaseAmount = milestoneBasis === "PERCENT"
    ? ((project?.contractValue ?? 0) * (Number(milestoneValue) || 0)) / 100
    : Number(milestoneValue) || 0;

  function applyMilestone() {
    if (!milestoneBaseAmount) return;
    let rate = milestoneBaseAmount;
    let tax = 0;
    if (milestoneGst === "WITH") {
      const gstPct = Number(milestoneGstPercent) || 0;
      if (milestoneTaxTreatment === "INCLUSIVE") {
        rate = milestoneBaseAmount / (1 + gstPct / 100);
        tax = milestoneBaseAmount - rate;
      } else {
        tax = (milestoneBaseAmount * gstPct) / 100;
      }
    }
    setItems([{ description: milestone.trim() || "Milestone payment", unit: "LS", qty: 1, rate: Number(rate.toFixed(2)) }]);
    setTaxAmount(tax.toFixed(2));
    push("Line item and tax updated from the milestone.", "success");
  }

  async function onSave() {
    if (!piNo.trim()) {
      push("PI number is required.", "error");
      return;
    }
    await run(async () => {
      await updateProformaInvoice(pi!, {
        piNo, dueDate: dueDate ? new Date(dueDate) : null, milestone, items,
        taxAmount: tax, gstType, terms, notes, clientPoNumber,
        shipToDifferent, shipToAddress: shipToDifferent ? shipToAddress : "",
      }, actor);
      router.push(`/proforma-invoices/${pi!.id}`);
    }, "Proforma invoice updated.");
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-navy-900">Edit Proforma Invoice</h1>
        <p className="text-sm text-ink-500">{pi.piNo} — {pi.projectName}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="PI details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Client PO Number"><Input value={clientPoNumber} onChange={(e) => setClientPoNumber(e.target.value)} /></Field>
              <Field label="PI No." required><Input value={piNo} onChange={(e) => setPiNo(e.target.value)} /></Field>
              <Field label="Due Date"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
              <Field label="Milestone"><Input value={milestone} onChange={(e) => setMilestone(e.target.value)} /></Field>
              <Field label="Tax Amount (₹)"><Input type="number" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} /></Field>
              <GstTypeField value={gstType} onChange={setGstType} />
              <ShipToField enabled={shipToDifferent} onEnabledChange={setShipToDifferent} address={shipToAddress} onAddressChange={setShipToAddress} className="col-span-2" />
              <Field label="Terms &amp; Conditions" className="col-span-2"><Textarea value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
              <Field label="Notes" className="col-span-2"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            </div>
          </Card>

          <Card title="Bill by milestone" subtitle="Optional — compute this PI's amount from the client PO's payment schedule (e.g. 30% advance, balance at delivery, final with tax) instead of entering line items by hand.">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Basis">
                <div className="flex items-center gap-4 pt-2 text-sm">
                  <label className="flex cursor-pointer items-center gap-1.5"><input type="radio" checked={milestoneBasis === "PERCENT"} onChange={() => setMilestoneBasis("PERCENT")} /> % of contract value</label>
                  <label className="flex cursor-pointer items-center gap-1.5"><input type="radio" checked={milestoneBasis === "AMOUNT"} onChange={() => setMilestoneBasis("AMOUNT")} /> Fixed amount (₹)</label>
                </div>
              </Field>
              <Field label={milestoneBasis === "PERCENT" ? "Percentage (%)" : "Amount (₹)"}>
                <Input type="number" value={milestoneValue} onChange={(e) => setMilestoneValue(e.target.value)} />
              </Field>
              {milestoneBasis === "PERCENT" && (
                <p className="col-span-2 -mt-2 text-xs text-ink-500">
                  {project
                    ? `${milestoneValue || 0}% of contract value ${formatINR(project.contractValue)} = ${formatINR(milestoneBaseAmount)}`
                    : "Loading the project's contract value…"}
                </p>
              )}
              <Field label="GST">
                <div className="flex items-center gap-4 pt-2 text-sm">
                  <label className="flex cursor-pointer items-center gap-1.5"><input type="radio" checked={milestoneGst === "WITH"} onChange={() => setMilestoneGst("WITH")} /> With GST</label>
                  <label className="flex cursor-pointer items-center gap-1.5"><input type="radio" checked={milestoneGst === "WITHOUT"} onChange={() => setMilestoneGst("WITHOUT")} /> Without GST</label>
                </div>
              </Field>
              {milestoneGst === "WITH" && (
                <Field label="GST %"><Input type="number" value={milestoneGstPercent} onChange={(e) => setMilestoneGstPercent(e.target.value)} /></Field>
              )}
              {milestoneGst === "WITH" && (
                <Field label="Entered value is" className="col-span-2">
                  <div className="flex items-center gap-4 pt-2 text-sm">
                    <label className="flex cursor-pointer items-center gap-1.5"><input type="radio" checked={milestoneTaxTreatment === "EXCLUSIVE"} onChange={() => setMilestoneTaxTreatment("EXCLUSIVE")} /> Without tax (GST added on top)</label>
                    <label className="flex cursor-pointer items-center gap-1.5"><input type="radio" checked={milestoneTaxTreatment === "INCLUSIVE"} onChange={() => setMilestoneTaxTreatment("INCLUSIVE")} /> With tax (already includes GST)</label>
                  </div>
                </Field>
              )}
            </div>
            <Button className="mt-3" variant="secondary" disabled={!milestoneBaseAmount} onClick={applyMilestone}>Apply to line item &amp; tax below</Button>
          </Card>

          <Card title="Line items">
            <ItemsTable items={items} setItems={setItems} fields={QUOTATION_ITEM_FIELDS} />
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Subtotal</dt><dd className="tabular-nums">{formatINR(subtotal)}</dd></div>
              {gstType === "IGST" ? (
                <div className="flex justify-between"><dt className="text-ink-500">IGST</dt><dd className="tabular-nums">{formatINR(igst)}</dd></div>
              ) : (
                <>
                  <div className="flex justify-between"><dt className="text-ink-500">CGST</dt><dd className="tabular-nums">{formatINR(cgst)}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-500">SGST</dt><dd className="tabular-nums">{formatINR(sgst)}</dd></div>
                </>
              )}
              <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(subtotal + tax)}</dd></div>
            </dl>
            <div className="mt-4 space-y-2">
              <Button variant="primary" className="w-full justify-center" onClick={() => void onSave()} loading={busy}>Save Changes</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => router.push(`/proforma-invoices/${pi!.id}`)}>Cancel</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
