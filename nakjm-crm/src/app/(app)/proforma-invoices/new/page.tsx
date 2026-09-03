"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Upload } from "lucide-react";

import { useActor } from "@/components/auth-provider";
import { Button, Card, Field, Input, Select, Spinner, Textarea, useAsyncAction, useToast } from "@/components/ui";
import { GstTypeField, ShipToField } from "@/components/gst-fields";
import { ItemsTable, QUOTATION_ITEM_FIELDS, type DraftItem } from "@/components/line-items-table";
import { useCompanyInfo } from "@/components/print-document";
import { gstTypeForCounterparty, type GstType } from "@/lib/constants";
import { createProformaInvoice } from "@/lib/db/proforma-invoices";
import { computeLineTotals, getQuotation } from "@/lib/db/quotations";
import { uploadDocument } from "@/lib/db/documents";
import { parseLineItemFile } from "@/lib/lineitem-parser";
import { subscribeProjects } from "@/lib/db/projects";
import type { Project } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function NewProformaInvoicePage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>}>
      <NewProformaInvoiceForm />
    </Suspense>
  );
}

function NewProformaInvoiceForm() {
  const router = useRouter();
  const params = useSearchParams();
  const actor = useActor();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();
  const company = useCompanyInfo();

  const [projects, setProjects] = useState<Project[]>([]);
  const [piNo, setPiNo] = useState("");
  const [projectId, setProjectId] = useState(params.get("projectId") ?? "");
  const [dueDate, setDueDate] = useState("");
  const [milestone, setMilestone] = useState("");
  const [taxAmount, setTaxAmount] = useState("0");
  const [gstType, setGstType] = useState<GstType>("IGST");
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [shipToDifferent, setShipToDifferent] = useState(false);
  const [shipToAddress, setShipToAddress] = useState("");
  const [clientPoNumber, setClientPoNumber] = useState("");
  const [poFile, setPoFile] = useState<File | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [sourceQuotationId, setSourceQuotationId] = useState<string | null>(null);
  const [sourceQuotationNo, setSourceQuotationNo] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [milestoneBasis, setMilestoneBasis] = useState<"PERCENT" | "AMOUNT">("PERCENT");
  const [milestoneValue, setMilestoneValue] = useState("");
  const [milestoneGst, setMilestoneGst] = useState<"WITH" | "WITHOUT">("WITH");
  const [milestoneTaxTreatment, setMilestoneTaxTreatment] = useState<"EXCLUSIVE" | "INCLUSIVE">("EXCLUSIVE");
  const [milestoneGstPercent, setMilestoneGstPercent] = useState("18");

  useEffect(() => subscribeProjects({ status: "ALL", max: 500 }, setProjects), []);

  async function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const parsed = await parseLineItemFile(file);
      if (!parsed.length) throw new Error("Could not detect a line-item table in this file.");
      setItems(parsed);
      setPiNo((n) => n || file.name.replace(/\.[^.]+$/, ""));
      push(`Imported ${parsed.length} line items — review before saving.`, "success");
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setImporting(false);
    }
  }

  useEffect(() => {
    const quotationId = params.get("sourceQuotationId");
    if (!quotationId) return;
    setSourceQuotationId(quotationId);
    void getQuotation(quotationId).then((q) => {
      if (!q) return;
      setSourceQuotationNo(q.quotationNo);
      setProjectId((id) => id || q.projectId);
      setItems(q.items.map((it) => ({ description: it.description, unit: it.unit, qty: it.qty, rate: it.rate, hsnCode: it.hsnCode })));
      setPiNo((n) => n || `${q.quotationNo}-PI`);
      setTaxAmount(String(q.taxAmount));
      setGstType(q.gstType ?? "IGST");
      setTerms((t) => t || q.terms || "");
      setNotes((n) => n || `Generated from Quotation ${q.quotationNo} (v${q.version})`);
      if (q.shipToDifferent) { setShipToDifferent(true); setShipToAddress(q.shipToAddress ?? ""); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount from the URL param
  }, []);

  function onClientPoNumberBlur() {
    if (clientPoNumber.trim()) setPiNo((n) => n || `${clientPoNumber.trim()}-PI`);
  }

  const { subtotal } = computeLineTotals(items);
  const tax = Number(taxAmount) || 0;
  const igst = gstType === "IGST" ? tax : 0;
  const cgst = gstType === "CGST_SGST" ? tax / 2 : 0;
  const sgst = gstType === "CGST_SGST" ? tax / 2 : 0;
  const project = projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (project?.billingGstin) setGstType(gstTypeForCounterparty(company.gstin, project.billingGstin));
  }, [project?.billingGstin, company.gstin]);

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

  async function onCreate() {
    if (!piNo.trim() || !projectId || !project) {
      push("PI number and project are required.", "error");
      return;
    }
    await run(async () => {
      let sourceDocumentId: string | null = null;
      if (poFile) {
        const doc = await uploadDocument({ file: poFile, projectId, docType: "CLIENT_PO", actor });
        sourceDocumentId = doc.id;
      }
      const pi = await createProformaInvoice({
        piNo, projectId, projectName: project.name, clientId: project.clientId, quotationId: sourceQuotationId,
        dueDate: dueDate ? new Date(dueDate) : null, milestone, items,
        taxAmount: tax, gstType, terms, notes, sourceDocumentId, clientPoNumber,
        shipToDifferent, shipToAddress: shipToDifferent ? shipToAddress : "",
      }, actor);
      router.push(`/proforma-invoices/${pi.id}`);
    }, "Proforma invoice created.");
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-navy-900">New Proforma Invoice</h1>
        <p className="text-sm text-ink-500">Raise a pre-sale bill against a project so the client can arrange payment, or import one from Excel/PDF below.</p>
        {sourceQuotationNo && (
          <p className="mt-2 rounded-lg bg-brand-50 px-3 py-1.5 text-xs text-brand-800">Prefilled from Quotation {sourceQuotationNo} — review before creating.</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="PI details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Client PO Number" hint="The client's own PO/order number — PI No. below is derived from it."><Input value={clientPoNumber} onChange={(e) => setClientPoNumber(e.target.value)} onBlur={onClientPoNumberBlur} /></Field>
              <Field label="PI No." required><Input value={piNo} onChange={(e) => setPiNo(e.target.value)} /></Field>
              <Field label="Project" required>
                <Select value={projectId} placeholder="Select project…" options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} onChange={(e) => setProjectId(e.target.value)} />
              </Field>
              <Field label="Due Date"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
              <Field label="Milestone"><Input value={milestone} onChange={(e) => setMilestone(e.target.value)} /></Field>
              <Field label="Tax Amount (₹)"><Input type="number" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} /></Field>
              <GstTypeField value={gstType} onChange={setGstType} />
              {project?.billingGstin && (
                <p className="col-span-2 -mt-2 text-xs text-ink-500">
                  Billing GSTIN: {project.billingGstin}{project.billingState ? ` (${project.billingState})` : ""} — GST type auto-set from this, override above if needed.
                </p>
              )}
              <ShipToField enabled={shipToDifferent} onEnabledChange={setShipToDifferent} address={shipToAddress} onAddressChange={setShipToAddress} className="col-span-2" />
              <Field label="Terms &amp; Conditions" className="col-span-2"><Textarea value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
              <Field label="Notes" className="col-span-2"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
              <Field label="Client PO / Work Order" className="col-span-2" hint="Optional — attaches the source document to this PI.">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink-300 px-3 py-2 text-sm text-ink-600 hover:bg-ink-50">
                  <Upload className="h-4 w-4" /> {poFile ? poFile.name : "Choose a file…"}
                  <input type="file" className="hidden" accept=".pdf,.xlsx,.xls,.doc,.docx,image/*" onChange={(e) => setPoFile(e.target.files?.[0] ?? null)} />
                </label>
              </Field>
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
                    : "Select a project above to compute this from its contract value."}
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

          <Card
            title="Line items"
            actions={
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-sm font-medium text-ink-800 hover:bg-ink-50">
                <Upload className="h-3.5 w-3.5" /> {importing ? "Importing…" : "Import from Excel/PDF"}
                <input type="file" accept=".xlsx,.xls,.pdf" className="hidden" disabled={importing} onChange={(e) => void onFileSelect(e)} />
              </label>
            }
          >
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
              <Button variant="primary" className="w-full justify-center" onClick={() => void onCreate()} loading={busy}>Create Proforma Invoice</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => router.push("/proforma-invoices")}>Cancel</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
