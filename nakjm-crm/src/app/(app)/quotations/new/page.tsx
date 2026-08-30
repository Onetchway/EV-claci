"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { useActor } from "@/components/auth-provider";
import { Button, Card, Field, Input, Select, Spinner, Textarea, useAsyncAction, useToast } from "@/components/ui";
import { GstTypeField } from "@/components/gst-fields";
import { ItemsTable, QUOTATION_ITEM_FIELDS, type DraftItem } from "@/components/line-items-table";
import type { GstType } from "@/lib/constants";
import { getBoq } from "@/lib/db/boq";
import { createQuotation, computeLineTotals, nextQuotationVersion } from "@/lib/db/quotations";
import { subscribeProjects } from "@/lib/db/projects";
import type { Project } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function NewQuotationPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>}>
      <NewQuotationForm />
    </Suspense>
  );
}

function NewQuotationForm() {
  const router = useRouter();
  const params = useSearchParams();
  const actor = useActor();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [projects, setProjects] = useState<Project[]>([]);
  const [quotationNo, setQuotationNo] = useState("");
  const [projectId, setProjectId] = useState(params.get("projectId") ?? "");
  const [validUntil, setValidUntil] = useState("");
  const [taxPercent, setTaxPercent] = useState("18");
  const [gstType, setGstType] = useState<GstType>("IGST");
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [sourceBoqId, setSourceBoqId] = useState<string | null>(null);

  useEffect(() => subscribeProjects({ status: "ALL", max: 500 }, setProjects), []);

  useEffect(() => {
    const boqId = params.get("sourceBoqId");
    if (!boqId) return;
    setSourceBoqId(boqId);
    void getBoq(boqId).then((boq) => {
      if (!boq) return;
      setItems(boq.items.map((it) => ({ description: [it.section, it.description].filter(Boolean).join(" — "), unit: it.unit, qty: it.qty, rate: it.rate })));
      setQuotationNo((n) => n || `${boq.boqNo}-Q`);
      setNotes((n) => n || `Generated from BOQ ${boq.boqNo} (v${boq.version})`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount from the URL param
  }, []);

  const totals = computeLineTotals(items, Number(taxPercent) || 0, gstType);
  const project = projects.find((p) => p.id === projectId);

  async function onCreate() {
    if (!quotationNo.trim() || !projectId || !project) {
      push("Quotation number and project are required.", "error");
      return;
    }
    await run(async () => {
      const version = await nextQuotationVersion(projectId);
      const q = await createQuotation({
        quotationNo, projectId, projectName: project.name, clientId: project.clientId, version,
        quotationDate: new Date(), validUntil: validUntil ? new Date(validUntil) : null,
        items, taxPercent: Number(taxPercent) || 0, gstType, terms, notes, sourceBoqId,
      }, actor);
      router.push(`/quotations/${q.id}`);
    }, "Quotation created.");
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-navy-900">New Quotation</h1>
        <p className="text-sm text-ink-500">Prepare a priced quotation against a project's BOQ or scope.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Quotation details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quotation No." required><Input value={quotationNo} onChange={(e) => setQuotationNo(e.target.value)} /></Field>
              <Field label="Project" required>
                <Select value={projectId} placeholder="Select project…" options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} onChange={(e) => setProjectId(e.target.value)} />
              </Field>
              <Field label="Valid Until"><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
              <Field label="Tax %"><Input type="number" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} /></Field>
              <GstTypeField value={gstType} onChange={setGstType} className="col-span-2" />
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
              <Button variant="primary" className="w-full justify-center" onClick={() => void onCreate()} loading={busy}>Create Quotation</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => router.push("/quotations")}>Cancel</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
