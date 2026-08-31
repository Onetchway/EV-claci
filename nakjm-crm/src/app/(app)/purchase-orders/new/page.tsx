"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Upload } from "lucide-react";

import { useActor } from "@/components/auth-provider";
import { Button, Card, Field, Input, Select, Textarea, useAsyncAction, useToast } from "@/components/ui";
import { ItemsTable, PO_ITEM_FIELDS, type DraftItem } from "@/components/line-items-table";
import { COMPANY_INFO, gstTypeForCounterparty } from "@/lib/constants";
import { getBoq } from "@/lib/db/boq";
import { uploadDocument } from "@/lib/db/documents";
import { computePoTotals, createPurchaseOrder } from "@/lib/db/purchase-orders";
import { parseLineItemFile } from "@/lib/lineitem-parser";
import { subscribeProjects } from "@/lib/db/projects";
import { listActiveVendors } from "@/lib/db/vendors";
import type { Project, Vendor } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-400">Loading…</p>}>
      <NewPurchaseOrderForm />
    </Suspense>
  );
}

function NewPurchaseOrderForm() {
  const router = useRouter();
  const params = useSearchParams();
  const actor = useActor();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [poNo, setPoNo] = useState("");
  const [projectId, setProjectId] = useState(params.get("projectId") ?? "");
  const [vendorId, setVendorId] = useState(params.get("vendorId") ?? "");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [gstType, setGstType] = useState<"IGST" | "CGST_SGST">("IGST");
  const [shipToDifferent, setShipToDifferent] = useState(false);
  const [shipToAddress, setShipToAddress] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [sourceBoqId, setSourceBoqId] = useState<string | null>(null);
  const [sourceBoqNo, setSourceBoqNo] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [sourceFile, setSourceFile] = useState<File | null>(null);

  useEffect(() => subscribeProjects({ status: "ALL", max: 500 }, setProjects), []);
  useEffect(() => { void listActiveVendors().then(setVendors); }, []);

  async function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const parsed = await parseLineItemFile(file);
      if (!parsed.length) throw new Error("Could not detect a line-item table in this file.");
      setItems(parsed);
      setSourceFile(file);
      setPoNo((n) => n || file.name.replace(/\.[^.]+$/, ""));
      push(`Imported ${parsed.length} line items — review before saving.`, "success");
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setImporting(false);
    }
  }

  useEffect(() => {
    const boqId = params.get("sourceBoqId");
    if (!boqId) return;
    setSourceBoqId(boqId);
    void getBoq(boqId).then((boq) => {
      if (!boq) return;
      setSourceBoqNo(boq.boqNo);
      setItems(boq.items.map((it) => ({ description: [it.section, it.description].filter(Boolean).join(" — "), unit: it.unit, qty: it.qty, rate: it.rate })));
      setPoNo((n) => n || `${boq.boqNo}-PO`);
      setNotes((n) => n || `Generated from BOQ ${boq.boqNo} (v${boq.version})`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount from the URL param
  }, []);

  const totals = computePoTotals(items, gstType);
  const vendor = vendors.find((v) => v.id === vendorId);

  useEffect(() => {
    if (vendor?.gstin) setGstType(gstTypeForCounterparty(COMPANY_INFO.gstin, vendor.gstin));
  }, [vendor?.gstin]);

  async function onCreate() {
    if (!poNo.trim() || !projectId || !vendorId) {
      push("PO number, project and vendor are required.", "error");
      return;
    }
    await run(async () => {
      const project = projects.find((p) => p.id === projectId);
      const po = await createPurchaseOrder({
        poNo, projectId, projectName: project?.name ?? "", vendorId, vendorName: vendor?.name ?? "",
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null, items, gstType, sourceBoqId,
        shipToDifferent, shipToAddress: shipToDifferent ? shipToAddress : "", notes,
      }, actor);
      if (sourceFile) {
        await uploadDocument({ file: sourceFile, projectId, linkedEntityType: "PURCHASE_ORDER", linkedEntityId: po.id, docType: "PO_UPLOAD", notes: "Original uploaded PO file", actor });
      }
      router.push(`/purchase-orders/${po.id}`);
    }, "Purchase order created.");
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-navy-900">New Purchase Order</h1>
        <p className="text-sm text-ink-500">Raise an order against a vendor for a project's equipment, civil work or EPC scope, or import one from Excel below.</p>
        {sourceBoqNo && (
          <p className="mt-2 rounded-lg bg-brand-50 px-3 py-1.5 text-xs text-brand-800">Prefilled from BOQ {sourceBoqNo} — review before creating.</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Vendor & delivery">
            <div className="grid grid-cols-2 gap-3">
              <Field label="PO Number" required><Input value={poNo} onChange={(e) => setPoNo(e.target.value)} /></Field>
              <Field label="Vendor" required><Select value={vendorId} placeholder="Select a vendor…" options={vendors.map((v) => ({ value: v.id, label: v.name }))} onChange={(e) => setVendorId(e.target.value)} /></Field>
              <Field label="Link to Project" required><Select value={projectId} placeholder="Select project…" options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} onChange={(e) => setProjectId(e.target.value)} /></Field>
              <Field label="Expected Delivery"><Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></Field>
              <Field label="Notes" className="col-span-2"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            </div>

            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">GST Type <span className="text-rose-500">*</span></p>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5"><input type="radio" checked={gstType === "IGST"} onChange={() => setGstType("IGST")} /> IGST</label>
                <label className="flex items-center gap-1.5"><input type="radio" checked={gstType === "CGST_SGST"} onChange={() => setGstType("CGST_SGST")} /> CGST &amp; SGST</label>
              </div>
              {vendor?.gstin && (
                <p className="mt-1 text-xs text-ink-500">Vendor GSTIN: {vendor.gstin} — GST type auto-set from this, override above if needed.</p>
              )}
              <label className="mt-3 flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={shipToDifferent} onChange={(e) => setShipToDifferent(e.target.checked)} /> Ship to a different address
              </label>
              {shipToDifferent && (
                <div className="mt-2"><Textarea value={shipToAddress} onChange={(e) => setShipToAddress(e.target.value)} placeholder="Delivery address" /></div>
              )}
            </div>
          </Card>

          <Card
            title="Line items"
            actions={
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-sm font-medium text-ink-800 hover:bg-ink-50">
                <Upload className="h-3.5 w-3.5" /> {importing ? "Importing…" : "Import from Excel"}
                <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importing} onChange={(e) => void onFileSelect(e)} />
              </label>
            }
          >
            <ItemsTable items={items} setItems={setItems} fields={PO_ITEM_FIELDS} />
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
              <Button variant="primary" className="w-full justify-center" onClick={() => void onCreate()} loading={busy}>Create Purchase Order</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => router.push("/purchase-orders")}>Cancel</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
