"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Boxes, Plus } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner,
  StatCard, Textarea, useAsyncAction,
} from "@/components/ui";
import {
  ASSET_CATEGORIES, ASSET_CATEGORY_LABEL, ASSET_STATUS_COLOR, ASSET_STATUS_LABEL,
  DEPRECIATION_METHODS, DEPRECIATION_METHOD_LABEL, type AssetCategory,
  type DepreciationMethod,
} from "@/lib/constants";
import { createAsset, subscribeAssets } from "@/lib/db/assets";
import { calcDepreciation } from "@/lib/depreciation";
import { canManageAssets } from "@/lib/permissions";
import type { Actor, Asset } from "@/lib/types";
import { formatCompactINR, formatINR } from "@/lib/utils";

const blankForm = {
  name: "", category: "CHARGER" as AssetCategory, serialNumber: "", cost: "",
  purchaseDate: new Date().toISOString().slice(0, 10),
  method: "WDV" as DepreciationMethod, usefulLifeYears: "5", wdvRatePct: "15",
  salvageValue: "0", notes: "",
};

export default function AssetsPage() {
  const viewer = useViewer();
  const { actor } = useAuth();
  const [rows, setRows] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<AssetCategory | "ALL">("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeAssets((r) => { setRows(r); setLoading(false); }, () => setLoading(false)), []);

  const filtered = useMemo(
    () => (category === "ALL" ? rows : rows.filter((a) => a.category === category)),
    [rows, category],
  );

  const snapshots = useMemo(() => filtered.map((a) => ({ asset: a, dep: calcDepreciation(a) })), [filtered]);

  const stats = useMemo(() => ({
    total: rows.length,
    cost: rows.reduce((a, r) => a + r.cost, 0),
    bookValue: snapshots.reduce((a, s) => a + s.dep.bookValue, 0),
    accumulated: rows.reduce((a, r) => a + r.cost, 0) - snapshots.reduce((a, s) => a + s.dep.bookValue, 0),
  }), [rows, snapshots]);

  async function create() {
    if (!actor || !form.name.trim() || !form.cost) throw new Error("Name and cost are required.");
    const { assetTag } = await createAsset({
      name: form.name,
      category: form.category,
      serialNumber: form.serialNumber,
      cost: Number(form.cost) || 0,
      purchaseDate: new Date(`${form.purchaseDate}T00:00:00`),
      method: form.method,
      usefulLifeYears: Number(form.usefulLifeYears) || 5,
      wdvRatePct: Number(form.wdvRatePct) || 15,
      salvageValue: Number(form.salvageValue) || 0,
      notes: form.notes,
    }, actor as Actor);
    setCreateOpen(false);
    setForm(blankForm);
    return assetTag;
  }

  return (
    <>
      <PageHeader
        title="Asset register"
        description="Chargers and equipment tracked from procurement through their depreciable life — an internal view, not a substitute for your statutory books."
        actions={
          canManageAssets(viewer) && (
            <>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory | "ALL")}
                className="w-auto"
                options={[{ value: "ALL", label: "All categories" }, ...ASSET_CATEGORIES.map((c) => ({ value: c, label: ASSET_CATEGORY_LABEL[c] }))]}
              />
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Add asset
              </Button>
            </>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Assets" value={stats.total} icon={<Boxes className="h-4 w-4" />} />
        <StatCard label="Original cost" value={formatCompactINR(stats.cost)} />
        <StatCard label="Accumulated depreciation" value={formatCompactINR(stats.accumulated)} />
        <StatCard label="Current book value" value={formatCompactINR(stats.bookValue)} tone="positive" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : snapshots.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-8 w-8" />}
          title="No assets yet"
          description="Chargers and equipment received against a purchase order, or added directly, show up here with a running depreciation schedule."
          action={canManageAssets(viewer) ? <Button variant="primary" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add asset</Button> : undefined}
        />
      ) : (
        <div className="card overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Asset</th>
                <th className="th">Category</th>
                <th className="th">Status</th>
                <th className="th text-right">Cost</th>
                <th className="th text-right">Book value</th>
                <th className="th">Project</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {snapshots.map(({ asset, dep }) => (
                <tr key={asset.id} className="hover:bg-ink-50">
                  <td className="td">
                    <Link href={`/assets/${asset.id}`} className="font-medium text-ink-900 hover:text-brand-700">{asset.name}</Link>
                    <span className="mt-0.5 block text-xs text-ink-500">{asset.assetTag}{asset.serialNumber ? ` · ${asset.serialNumber}` : ""}</span>
                  </td>
                  <td className="td text-ink-600">{ASSET_CATEGORY_LABEL[asset.category]}</td>
                  <td className="td"><Badge className={ASSET_STATUS_COLOR[asset.status]}>{ASSET_STATUS_LABEL[asset.status]}</Badge></td>
                  <td className="td text-right tabular-nums">{formatINR(asset.cost)}</td>
                  <td className="td text-right font-medium tabular-nums">{formatINR(dep.bookValue)}</td>
                  <td className="td text-ink-600">{asset.linkedProjectCode || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add asset"
        footer={
          <>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void run(async () => { await create(); }, "Asset added.")}>
              Add asset
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="90 kW DC charger — Site #14" />
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as AssetCategory }))} options={ASSET_CATEGORIES.map((c) => ({ value: c, label: ASSET_CATEGORY_LABEL[c] }))} />
          </Field>
          <Field label="Serial number">
            <Input value={form.serialNumber} onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} />
          </Field>
          <Field label="Cost (excl. GST)" required>
            <Input type="number" min={0} step={1} value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />
          </Field>
          <Field label="Purchase date">
            <Input type="date" value={form.purchaseDate} onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
          </Field>
          <Field label="Depreciation method">
            <Select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as DepreciationMethod }))} options={DEPRECIATION_METHODS.map((m) => ({ value: m, label: DEPRECIATION_METHOD_LABEL[m] }))} />
          </Field>
          {form.method === "WDV" ? (
            <Field label="WDV rate (%/year)" hint="Confirm the correct rate for this asset class with your CA.">
              <Input type="number" min={0} max={100} step={0.5} value={form.wdvRatePct} onChange={(e) => setForm((f) => ({ ...f, wdvRatePct: e.target.value }))} />
            </Field>
          ) : (
            <Field label="Useful life (years)">
              <Input type="number" min={1} step={1} value={form.usefulLifeYears} onChange={(e) => setForm((f) => ({ ...f, usefulLifeYears: e.target.value }))} />
            </Field>
          )}
          <Field label="Salvage value">
            <Input type="number" min={0} step={1} value={form.salvageValue} onChange={(e) => setForm((f) => ({ ...f, salvageValue: e.target.value }))} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
