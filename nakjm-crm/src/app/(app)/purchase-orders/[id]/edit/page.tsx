"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useActor } from "@/components/auth-provider";
import { Button, Card, EmptyState, Field, Input, Select, Spinner, Textarea, useAsyncAction, useToast } from "@/components/ui";
import { ItemsTable, PO_ITEM_FIELDS, type DraftItem } from "@/components/line-items-table";
import { computePoTotals, getPurchaseOrder, updatePurchaseOrder } from "@/lib/db/purchase-orders";
import { listActiveVendors } from "@/lib/db/vendors";
import type { PurchaseOrder, Vendor } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function EditPurchaseOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [po, setPo] = useState<PurchaseOrder | null | undefined>(undefined);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [poNo, setPoNo] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [gstType, setGstType] = useState<"IGST" | "CGST_SGST">("IGST");
  const [shipToDifferent, setShipToDifferent] = useState(false);
  const [shipToAddress, setShipToAddress] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);

  useEffect(() => { void listActiveVendors().then(setVendors); }, []);
  useEffect(() => {
    void getPurchaseOrder(id).then((row) => {
      setPo(row);
      if (!row) return;
      setPoNo(row.poNo);
      setVendorId(row.vendorId);
      setDeliveryDate(row.deliveryDate ? row.deliveryDate.toDate().toISOString().slice(0, 10) : "");
      setTerms(row.terms ?? "");
      setNotes(row.notes ?? "");
      setGstType(row.gstType ?? "IGST");
      setShipToDifferent(row.shipToDifferent ?? false);
      setShipToAddress(row.shipToAddress ?? "");
      setItems(row.items.map((it) => ({ description: it.description, unit: it.unit, qty: it.qty, rate: it.rate, hsnCode: it.hsnCode, gstPercent: it.gstPercent })));
    });
  }, [id]);

  if (po === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (po === null) return <EmptyState title="Purchase order not found" action={<Link href="/purchase-orders"><Button>Back to purchase orders</Button></Link>} />;

  const totals = computePoTotals(items, gstType);
  const vendor = vendors.find((v) => v.id === vendorId);

  async function onSave() {
    if (!poNo.trim() || !vendorId) {
      push("PO number and vendor are required.", "error");
      return;
    }
    await run(async () => {
      await updatePurchaseOrder(po!, {
        poNo, vendorId, vendorName: vendor?.name ?? po!.vendorName,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null, items, gstType,
        shipToDifferent, shipToAddress: shipToDifferent ? shipToAddress : "", terms, notes,
      }, actor);
      router.push(`/purchase-orders/${po!.id}`);
    }, "Purchase order updated.");
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-navy-900">Edit Purchase Order</h1>
        <p className="text-sm text-ink-500">{po.poNo} — {po.projectName}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Vendor & delivery">
            <div className="grid grid-cols-2 gap-3">
              <Field label="PO Number" required><Input value={poNo} onChange={(e) => setPoNo(e.target.value)} /></Field>
              <Field label="Vendor" required><Select value={vendorId} placeholder="Select a vendor…" options={vendors.map((v) => ({ value: v.id, label: v.name }))} onChange={(e) => setVendorId(e.target.value)} /></Field>
              <Field label="Expected Delivery"><Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></Field>
              <Field label="Notes" className="col-span-2"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
              <Field label="Terms &amp; Conditions" className="col-span-2"><Textarea value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
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

          <Card title="Line items">
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
              <Button variant="primary" className="w-full justify-center" onClick={() => void onSave()} loading={busy}>Save Changes</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => router.push(`/purchase-orders/${po!.id}`)}>Cancel</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
