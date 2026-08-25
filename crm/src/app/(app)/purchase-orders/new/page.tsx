"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Button, Card, Field, Input, PageHeader, Select, Spinner, Textarea,
  useAsyncAction,
} from "@/components/ui";
import { GstTypeField, ShipToFields } from "@/components/gst-ship-to";
import { GST_SLABS, type GstType } from "@/lib/constants";
import { gstBreakdown } from "@/lib/gst";
import { createPurchaseOrder, DEFAULT_PO_GST_PCT } from "@/lib/db/purchase-orders";
import { subscribeProjects } from "@/lib/db/projects";
import { subscribeVendors } from "@/lib/db/vendors";
import { canManageVendors } from "@/lib/permissions";
import type { PoItem, Project, ShipToInfo, Vendor } from "@/lib/types";
import { formatINR } from "@/lib/utils";

let itemSeq = 0;
const blankItem = (): PoItem => ({ id: `it${itemSeq++}`, description: "", qty: 1, unitPrice: 0, gstPct: DEFAULT_PO_GST_PCT });

function NewPurchaseOrderInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { actor } = useAuth();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendorId, setVendorId] = useState(params.get("vendorId") ?? "");
  const [linkedProjectId, setLinkedProjectId] = useState("");
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [gstType, setGstType] = useState<GstType>("IGST");
  const [shipToEnabled, setShipToEnabled] = useState(false);
  const [shipTo, setShipTo] = useState<ShipToInfo>({});
  const [items, setItems] = useState<PoItem[]>([blankItem()]);

  useEffect(() => subscribeVendors(setVendors), []);
  useEffect(() => subscribeProjects({ max: 500 }, setProjects), []);

  const vendor = vendors.find((v) => v.id === vendorId);
  const project = projects.find((p) => p.id === linkedProjectId);

  const totals = useMemo(() => {
    let subtotal = 0;
    let gst = 0;
    for (const it of items) {
      const line = Math.max(0, it.qty) * Math.max(0, it.unitPrice);
      subtotal += line;
      gst += Math.round(line * (it.gstPct / 100));
    }
    return { subtotal: Math.round(subtotal), gst, total: Math.round(subtotal) + gst };
  }, [items]);

  function patchItem(id: string, patch: Partial<PoItem>) {
    setItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function submit() {
    if (!actor || !vendor) throw new Error("Pick a vendor first.");
    const cleanItems = items.filter((it) => it.description.trim() && it.qty > 0);
    if (cleanItems.length === 0) throw new Error("Add at least one line item.");

    const { id } = await createPurchaseOrder({
      vendorId: vendor.id,
      vendorName: vendor.name,
      items: cleanItems,
      linkedProjectId: project?.id ?? null,
      linkedProjectCode: project?.code ?? null,
      expectedDeliveryAt: expectedDeliveryAt ? new Date(`${expectedDeliveryAt}T00:00:00`) : null,
      notes: notes.trim(),
      terms: terms.trim(),
      gstType,
      shipToEnabled,
      shipTo: shipToEnabled ? shipTo : null,
    }, actor);
    router.push(`/purchase-orders/${id}`);
  }

  if (!canManageVendors(viewer)) {
    return (
      <div className="flex justify-center py-20 text-ink-400">
        <p className="text-sm">Purchase orders are available to Operations and Finance roles.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="New purchase order" description="Raise an order against a vendor for a station's chargers, civil work or EPC scope." />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Vendor & delivery">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Vendor" required className="sm:col-span-2">
                <Select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  options={[{ value: "", label: "Select a vendor…" }, ...vendors.map((v) => ({ value: v.id, label: `${v.name} (${v.code})` }))]}
                />
              </Field>
              <Field label="Link to project" hint="Optional — which station this procurement is for.">
                <Select
                  value={linkedProjectId}
                  onChange={(e) => setLinkedProjectId(e.target.value)}
                  options={[{ value: "", label: "None" }, ...projects.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))]}
                />
              </Field>
              <Field label="Expected delivery">
                <Input type="date" value={expectedDeliveryAt} onChange={(e) => setExpectedDeliveryAt(e.target.value)} />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              <GstTypeField value={gstType} onChange={setGstType} className="sm:col-span-2" />
              <ShipToFields
                enabled={shipToEnabled}
                onEnabledChange={setShipToEnabled}
                value={shipTo}
                onChange={setShipTo}
                className="sm:col-span-2"
              />
            </div>
          </Card>

          <Card
            title="Line items"
            actions={<Button size="sm" onClick={() => setItems((r) => [...r, blankItem()])}><Plus className="h-3.5 w-3.5" /> Add line</Button>}
          >
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-ink-200 p-2.5">
                  <div className="col-span-12 sm:col-span-5">
                    <label className="label">Description</label>
                    <Input value={it.description} onChange={(e) => patchItem(it.id, { description: e.target.value })} placeholder="90 kW DC charger unit" />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="label">Qty</label>
                    <Input type="number" min={1} value={it.qty} onChange={(e) => patchItem(it.id, { qty: Math.max(0, Number(e.target.value) || 0) })} />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <label className="label">Unit price</label>
                    <Input type="number" min={0} step={1} value={it.unitPrice} onChange={(e) => patchItem(it.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <label className="label">GST %</label>
                    <Select
                      value={String(it.gstPct)}
                      onChange={(e) => patchItem(it.id, { gstPct: Number(e.target.value) })}
                      options={GST_SLABS.map((g) => ({ value: String(g), label: `${g}%` }))}
                    />
                  </div>
                  <div className="col-span-1 flex justify-end pb-1.5">
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems((r) => r.filter((x) => x.id !== it.id))} className="rounded p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Terms & conditions">
            <Textarea
              rows={6}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Payment terms, warranty, delivery conditions, penalties, etc. Printed on the order below the line items."
            />
          </Card>
        </div>

        <Card title="Summary">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd className="tabular-nums">{formatINR(totals.subtotal)}</dd></div>
            {gstBreakdown(gstType, totals.gst, totals.subtotal > 0 ? (totals.gst / totals.subtotal) * 100 : 0).map((row) => (
              <div key={row.label} className="flex justify-between">
                <dt className="text-ink-600">{row.label}</dt>
                <dd className="tabular-nums">{formatINR(row.amount)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-ink-200 pt-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(totals.total)}</dd></div>
          </dl>
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="primary" loading={busy} onClick={() => void run(submit)}>Create purchase order</Button>
            <Link href="/purchase-orders"><Button className="w-full">Cancel</Button></Link>
          </div>
        </Card>
      </div>
    </>
  );
}

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>}>
      <NewPurchaseOrderInner />
    </Suspense>
  );
}
