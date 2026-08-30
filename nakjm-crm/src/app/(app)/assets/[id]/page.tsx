"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select,
  Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import {
  ASSET_CATEGORIES, ASSET_CATEGORY_LABEL, ASSET_STATUS_COLOR, ASSET_STATUS_LABEL,
  ASSET_STATUSES, DEPRECIATION_METHODS, DEPRECIATION_METHOD_LABEL,
  type AssetCategory, type AssetStatus, type DepreciationMethod,
} from "@/lib/constants";
import { subscribeAsset, trashAsset, updateAsset } from "@/lib/db/assets";
import { calcDepreciation, depreciationSchedule } from "@/lib/depreciation";
import { canManageAssets, canTrash } from "@/lib/permissions";
import type { Asset } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const viewer = useViewer();
  const [asset, setAsset] = useState<Asset | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [form, setForm] = useState<Partial<Asset>>({});
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeAsset(params.id, setAsset), [params.id]);

  if (asset === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (!asset) {
    return <EmptyState title="Asset not found" action={<Link href="/assets"><Button>Back to assets</Button></Link>} />;
  }

  const dep = calcDepreciation(asset);
  const schedule = depreciationSchedule(asset);

  function startEdit() {
    setForm({
      name: asset!.name, category: asset!.category, serialNumber: asset!.serialNumber,
      status: asset!.status, method: asset!.method, usefulLifeYears: asset!.usefulLifeYears,
      wdvRatePct: asset!.wdvRatePct, salvageValue: asset!.salvageValue, notes: asset!.notes,
    });
    setEditing(true);
  }

  return (
    <>
      <PageHeader
        title={asset.name}
        description={`${asset.assetTag}${asset.serialNumber ? ` · ${asset.serialNumber}` : ""}`}
        actions={
          <>
            <Badge className={ASSET_STATUS_COLOR[asset.status]}>{ASSET_STATUS_LABEL[asset.status]}</Badge>
            {canManageAssets(viewer) && <Button onClick={startEdit}>Edit</Button>}
            {canTrash(viewer) && (
              <Button variant="danger" onClick={() => setTrashOpen(true)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </>
        }
      />

      <Modal
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        title="Delete this asset"
        description="Moves it to Trash — it disappears from every list, but an admin can restore it from Trash at any time. Nothing is permanently deleted."
        footer={
          <>
            <Button onClick={() => setTrashOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  await trashAsset(asset, actor);
                  setTrashOpen(false);
                  router.push("/assets");
                }, "Asset moved to Trash.")
              }
            >
              <Trash2 className="h-4 w-4" /> Move to Trash
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">{asset.name} ({asset.assetTag})</p>
      </Modal>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-2">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Category</dt><dd className="mt-0.5 text-sm">{ASSET_CATEGORY_LABEL[asset.category]}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Purchase date</dt><dd className="mt-0.5 text-sm">{formatDate(asset.purchaseDate)}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Vendor</dt><dd className="mt-0.5 text-sm">{asset.vendorName || "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Purchase order</dt><dd className="mt-0.5 text-sm">{asset.poNumber || "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Project</dt><dd className="mt-0.5 text-sm">{asset.linkedProjectId ? <Link href={`/projects/${asset.linkedProjectId}`} className="text-brand-700 hover:underline">{asset.linkedProjectCode}</Link> : "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Warranty until</dt><dd className="mt-0.5 text-sm">{asset.warrantyUntil ? formatDate(asset.warrantyUntil) : "—"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-ink-500">Depreciation method</dt><dd className="mt-0.5 text-sm">{DEPRECIATION_METHOD_LABEL[asset.method]}{asset.method === "WDV" ? ` @ ${asset.wdvRatePct}%/yr` : ` over ${asset.usefulLifeYears} yrs`}</dd></div>
            {asset.notes && <div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wide text-ink-500">Notes</dt><dd className="mt-0.5 text-sm">{asset.notes}</dd></div>}
          </dl>
        </Card>

        <Card title="Current valuation">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-600">Original cost</dt><dd className="tabular-nums font-medium">{formatINR(asset.cost)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-600">Age</dt><dd className="tabular-nums">{dep.ageYears.toFixed(1)} yrs</dd></div>
            <div className="flex justify-between"><dt className="text-ink-600">Accumulated depreciation</dt><dd className="tabular-nums text-amber-600">{formatINR(dep.accumulatedDepreciation)}</dd></div>
            <div className="flex justify-between border-t border-ink-200 pt-2 font-semibold"><dt>Book value today</dt><dd className="tabular-nums text-emerald-600">{formatINR(dep.bookValue)}</dd></div>
          </dl>
        </Card>
      </div>

      <Card title="Depreciation schedule" subtitle="Internal projection — confirm the method/rate with your CA before using it for statutory filing." className="mt-4">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="th">Year</th>
                <th className="th text-right">Opening value</th>
                <th className="th text-right">Depreciation</th>
                <th className="th text-right">Closing value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {schedule.map((row) => (
                <tr key={row.year}>
                  <td className="td">Year {row.year}</td>
                  <td className="td text-right tabular-nums">{formatINR(row.openingValue)}</td>
                  <td className="td text-right tabular-nums text-amber-600">{formatINR(row.depreciation)}</td>
                  <td className="td text-right font-medium tabular-nums">{formatINR(row.closingValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit asset"
        footer={
          <>
            <Button onClick={() => setEditing(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  const { purchaseDate: _purchaseDate, warrantyUntil: _warrantyUntil, createdAt: _createdAt, updatedAt: _updatedAt, ...patch } = form;
                  await updateAsset(asset.id, patch, actor);
                  setEditing(false);
                }, "Asset updated.")
              }
            >
              Save changes
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Category">
            <Select value={form.category ?? "OTHER"} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as AssetCategory }))} options={ASSET_CATEGORIES.map((c) => ({ value: c, label: ASSET_CATEGORY_LABEL[c] }))} />
          </Field>
          <Field label="Status">
            <Select value={form.status ?? "IN_SERVICE"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AssetStatus }))} options={ASSET_STATUSES.map((s) => ({ value: s, label: ASSET_STATUS_LABEL[s] }))} />
          </Field>
          <Field label="Serial number">
            <Input value={form.serialNumber ?? ""} onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} />
          </Field>
          <Field label="Depreciation method">
            <Select value={form.method ?? "WDV"} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as DepreciationMethod }))} options={DEPRECIATION_METHODS.map((m) => ({ value: m, label: DEPRECIATION_METHOD_LABEL[m] }))} />
          </Field>
          {form.method === "WDV" ? (
            <Field label="WDV rate (%/year)">
              <Input type="number" min={0} max={100} step={0.5} value={form.wdvRatePct ?? 15} onChange={(e) => setForm((f) => ({ ...f, wdvRatePct: Number(e.target.value) || 0 }))} />
            </Field>
          ) : (
            <Field label="Useful life (years)">
              <Input type="number" min={1} step={1} value={form.usefulLifeYears ?? 5} onChange={(e) => setForm((f) => ({ ...f, usefulLifeYears: Number(e.target.value) || 1 }))} />
            </Field>
          )}
          <Field label="Salvage value">
            <Input type="number" min={0} step={1} value={form.salvageValue ?? 0} onChange={(e) => setForm((f) => ({ ...f, salvageValue: Number(e.target.value) || 0 }))} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
