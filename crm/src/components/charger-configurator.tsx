"use client";

import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { GripVertical, Minus, Plus, RotateCcw, Trash2, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui";
import { catalogueAllIn, getSpec, type ChargerSpec } from "@/lib/catalog";
import { useChargerCatalog } from "@/hooks/use-catalog";
import { CHARGER_OEMS, GST_SLABS } from "@/lib/constants";
import {
  buildQuote, clampGst, defaultBlendedGstPct, normaliseConfig, type ConfigItem, type ExtraItem,
} from "@/lib/pricing";
import { cn, formatCompactINR, formatINR } from "@/lib/utils";

/**
 * Drag a charger from the catalogue into the basket to configure a franchise,
 * e.g. 2 × 60 kW + 2 × 120 kW. Dragging is the headline interaction, but every
 * action is also reachable by tap and keyboard — a sales agent on a phone in
 * the field should never be blocked by a drag target.
 *
 * A DC charger's catalogue price bundles the hardware with its electrical/
 * civil BOM build-out, so each basket entry shows two priced, taxed lines —
 * Equipment (5% GST) and Electrical & Civil Work (18% GST) — both editable,
 * because the letters Livanto actually issues are negotiated deal by deal. A
 * custom charger with no BOM split on record just shows the one line.
 */

interface Props {
  value: ConfigItem[];
  onChange: (next: ConfigItem[]) => void;
  extras?: ExtraItem[];
  onExtrasChange?: (next: ExtraItem[]) => void;
  discount?: number;
  onDiscountChange?: (v: number) => void;
  allowDiscount?: boolean;
  /** Editing unit prices is a commercial decision — gated separately. */
  allowPriceOverride?: boolean;
  defaultOem?: string | null;
  disabled?: boolean;
  /** Some lead types (software, corporate...) price purely off extras/line items, not the franchise DC-charger basket. */
  showChargers?: boolean;
  /** False when the "Other items" editor is rendered separately by the caller (e.g. its own Card above this one). */
  showExtras?: boolean;
}

const DROP_ID = "charger-basket";

function PaletteCard({ spec, disabled, onAdd }: { spec: ChargerSpec; disabled?: boolean; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${spec.sku}`,
    data: { sku: spec.sku },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative rounded-lg border border-ink-200 bg-white p-3 transition",
        isDragging && "opacity-40",
        !disabled && "hover:border-brand-400 hover:shadow-card",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={disabled}
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-ink-300 hover:text-ink-500 active:cursor-grabbing disabled:cursor-not-allowed"
          aria-label={`Drag ${spec.label} charger`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
            <Zap className="h-3.5 w-3.5 text-brand-500" />
            {spec.label}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-500">{spec.vehicleType} · {spec.guns} guns · {spec.portType}</p>
          <p className="mt-1.5 text-xs font-medium text-ink-700">{formatCompactINR(spec.basePrice)}</p>
          <p className="text-[11px] text-ink-400">+ GST · {formatCompactINR(catalogueAllIn(spec))} all-in</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="mt-2 w-full rounded-md bg-ink-100 py-1 text-xs font-medium text-ink-700 transition hover:bg-brand-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}

function PriceGstRow({
  title, unit, gstPct, catalogUnit, disabled, allowPriceOverride, onPriceChange, onResetPrice, onGstChange, ariaLabel,
  hsnCode, onHsnChange,
}: {
  title: string;
  unit: number;
  gstPct: number;
  catalogUnit: number;
  disabled?: boolean;
  allowPriceOverride?: boolean;
  onPriceChange: (v: number) => void;
  onResetPrice: () => void;
  onGstChange: (v: number) => void;
  ariaLabel: string;
  hsnCode?: string | null;
  onHsnChange?: (v: string) => void;
}) {
  const overridden = unit !== catalogUnit;

  return (
    <div className="rounded-lg bg-ink-50/60 p-2">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-0.5 block text-[10px] text-ink-400">Unit price (excl. GST)</span>
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              step={1}
              value={unit}
              disabled={disabled || !allowPriceOverride}
              onChange={(e) => onPriceChange(Math.max(0, Number(e.target.value) || 0))}
              className={cn("input py-1 text-sm tabular-nums", overridden && "border-amber-400 bg-amber-50")}
              aria-label={`${ariaLabel} unit price`}
            />
            {overridden && allowPriceOverride && (
              <button
                type="button"
                onClick={onResetPrice}
                disabled={disabled}
                title={`Reset to catalogue price ${formatINR(catalogUnit)}`}
                className="shrink-0 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
          {overridden && (
            <span className="mt-0.5 block text-[10px] text-amber-700">Catalogue: {formatINR(catalogUnit)}</span>
          )}
        </label>

        <label className="block">
          <span className="mb-0.5 block text-[10px] text-ink-400">GST</span>
          <select
            value={gstPct}
            disabled={disabled}
            onChange={(e) => onGstChange(clampGst(e.target.value))}
            className="input py-1 text-sm"
            aria-label={`${ariaLabel} GST rate`}
          >
            {GST_SLABS.map((g) => <option key={g} value={g}>{g}%</option>)}
          </select>
        </label>

        {onHsnChange && (
          <label className="block sm:col-span-2">
            <span className="mb-0.5 block text-[10px] text-ink-400">HSN/SAC code (optional)</span>
            <input
              value={hsnCode ?? ""}
              disabled={disabled}
              onChange={(e) => onHsnChange(e.target.value)}
              placeholder="e.g. 8504"
              className="input py-1 text-sm"
              aria-label={`${ariaLabel} HSN/SAC code`}
            />
          </label>
        )}
      </div>
    </div>
  );
}

function BasketRow({
  item, index, spec, disabled, allowPriceOverride, onPatch, onRemove,
}: {
  item: ConfigItem;
  index: number;
  spec: ChargerSpec;
  disabled?: boolean;
  allowPriceOverride?: boolean;
  onPatch: (patch: Partial<ConfigItem>) => void;
  onRemove: () => void;
}) {
  const hasSplit = spec.equipmentPrice != null;
  const equipDefault = spec.equipmentPrice ?? spec.basePrice;
  const civilDefault = hasSplit ? Math.max(0, spec.basePrice - equipDefault) : 0;

  const blended = Boolean(item.blended);

  const equipUnit = item.unitPrice ?? equipDefault;
  const equipGstPct = item.gstPct ?? 5;
  const civilUnit = item.civilPrice ?? civilDefault;
  const civilGstPct = item.civilGstPct ?? 18;

  const combinedDefault = equipDefault + civilDefault;
  const blendedUnit = item.unitPrice ?? combinedDefault;
  const blendedGstPct = item.gstPct ?? defaultBlendedGstPct(equipDefault, civilDefault);

  const lineBase = (blended ? blendedUnit : equipUnit + (hasSplit ? civilUnit : 0)) * item.qty;

  return (
    <li className="rounded-lg border border-ink-200 bg-white px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
          {spec.kw}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-900">{spec.label} DC Fast Charger</p>
          <p className="truncate text-[11px] text-ink-500">{spec.minSpaceSqft} · {spec.vehicleType}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-ink-200">
          <button
            type="button"
            onClick={() => onPatch({ qty: item.qty - 1 })}
            disabled={disabled}
            className="p-1.5 text-ink-500 hover:text-ink-900 disabled:opacity-40"
            aria-label={`Reduce ${spec.label} quantity`}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-7 text-center text-sm font-semibold tabular-nums">{item.qty}</span>
          <button
            type="button"
            onClick={() => onPatch({ qty: item.qty + 1 })}
            disabled={disabled}
            className="p-1.5 text-ink-500 hover:text-ink-900 disabled:opacity-40"
            aria-label={`Increase ${spec.label} quantity`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="hidden w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-ink-900 sm:block">
          {formatINR(lineBase)}
        </span>

        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="shrink-0 rounded p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
          aria-label={`Remove ${spec.label}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 space-y-2 border-t border-ink-100 pt-2">
        {hasSplit && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
              {blended ? "Blended — one combined line, one flat rate" : "Standard — equipment and civil work billed separately"}
            </p>
            <div className="flex shrink-0 overflow-hidden rounded-lg border border-ink-200 text-[11px] font-medium">
              {(["STANDARD", "BLENDED"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (m === "BLENDED") onPatch({ blended: true, unitPrice: null, gstPct: null });
                    else onPatch({ blended: false, unitPrice: null, gstPct: null, civilPrice: null, civilGstPct: null });
                  }}
                  className={cn(
                    "px-2.5 py-1 transition disabled:cursor-not-allowed disabled:opacity-50",
                    (blended ? "BLENDED" : "STANDARD") === m ? "bg-brand-600 text-white" : "bg-white text-ink-600 hover:bg-ink-100",
                  )}
                >
                  {m === "STANDARD" ? "Standard" : "Blended"}
                </button>
              ))}
            </div>
          </div>
        )}

        {blended ? (
          <PriceGstRow
            title="Charger (all-in)"
            unit={blendedUnit}
            gstPct={blendedGstPct}
            catalogUnit={combinedDefault}
            disabled={disabled}
            allowPriceOverride={allowPriceOverride}
            onPriceChange={(v) => onPatch({ unitPrice: v })}
            onResetPrice={() => onPatch({ unitPrice: null })}
            onGstChange={(v) => onPatch({ gstPct: v })}
            ariaLabel={`${spec.label} all-in`}
            hsnCode={item.hsnCode}
            onHsnChange={(v) => onPatch({ hsnCode: v || null })}
          />
        ) : (
          <>
            <PriceGstRow
              title="Equipment"
              unit={equipUnit}
              gstPct={equipGstPct}
              catalogUnit={equipDefault}
              disabled={disabled}
              allowPriceOverride={allowPriceOverride}
              onPriceChange={(v) => onPatch({ unitPrice: v })}
              onResetPrice={() => onPatch({ unitPrice: null })}
              onGstChange={(v) => onPatch({ gstPct: v })}
              ariaLabel={`Equipment for ${spec.label}`}
              hsnCode={item.hsnCode}
              onHsnChange={(v) => onPatch({ hsnCode: v || null })}
            />

            {hasSplit && (
              <PriceGstRow
                title="Electrical & Civil Work"
                unit={civilUnit}
                gstPct={civilGstPct}
                catalogUnit={civilDefault}
                disabled={disabled}
                allowPriceOverride={allowPriceOverride}
                onPriceChange={(v) => onPatch({ civilPrice: v })}
                onResetPrice={() => onPatch({ civilPrice: null })}
                onGstChange={(v) => onPatch({ civilGstPct: v })}
                ariaLabel={`Electrical & civil work for ${spec.label}`}
                hsnCode={item.civilHsnCode}
                onHsnChange={(v) => onPatch({ civilHsnCode: v || null })}
              />
            )}
          </>
        )}

        <label className="block max-w-xs">
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-ink-400">OEM</span>
          <input
            list={`oem-list-${index}`}
            value={item.oem ?? ""}
            disabled={disabled}
            onChange={(e) => onPatch({ oem: e.target.value || null })}
            placeholder="Manufacturer"
            className="input py-1 text-sm"
            aria-label={`OEM for ${spec.label}`}
          />
          <datalist id={`oem-list-${index}`}>
            {CHARGER_OEMS.map((o) => <option key={o} value={o} />)}
          </datalist>
        </label>
      </div>
    </li>
  );
}

/** Blank row: qty 1, unit price 0, 18% GST — the same defaults a Purchase Order line starts from. */
const blankExtra = (): ExtraItem => ({
  id: `x${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
  label: "", qty: 1, unitPrice: 0, amount: 0, gstPct: 18,
});

export function ExtrasEditor({
  extras, disabled, onChange,
}: {
  extras: ExtraItem[];
  disabled?: boolean;
  onChange: (next: ExtraItem[]) => void;
}) {
  const add = () => {
    if (disabled) return;
    onChange([...extras, blankExtra()]);
  };

  const patch = (id: string, p: Partial<ExtraItem>) =>
    onChange(extras.map((e) => {
      if (e.id !== id) return e;
      const next = { ...e, ...p };
      // Keep amount in sync whenever qty/unitPrice are the fields driving this line.
      if ((next.qty ?? e.qty) != null && (next.unitPrice ?? e.unitPrice) != null) {
        next.amount = Math.max(0, Math.round((next.qty ?? 1) * (next.unitPrice ?? 0)));
      }
      return next;
    }));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] text-ink-500">
          Anything beyond the charger's own BOM — signage, O&amp;M, a DISCOM deposit.
        </p>
        <Button size="sm" onClick={add} disabled={disabled}><Plus className="h-3.5 w-3.5" /> Add line</Button>
      </div>

      {extras.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-xs text-ink-500">
          No additional items. Add signage, O&amp;M, DISCOM deposit and so on here.
        </p>
      ) : (
        <div className="space-y-2">
          {extras.map((e) => (
            <div key={e.id} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-ink-200 p-2.5">
              <div className="col-span-12 sm:col-span-5">
                <label className="label">Description</label>
                <input
                  value={e.label}
                  disabled={disabled}
                  onChange={(ev) => patch(e.id, { label: ev.target.value })}
                  className="input"
                  placeholder="Signage & branding"
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <label className="label">Qty</label>
                <input
                  type="number"
                  min={1}
                  value={e.qty ?? 1}
                  disabled={disabled}
                  onChange={(ev) => patch(e.id, { qty: Math.max(1, Number(ev.target.value) || 1) })}
                  className="input tabular-nums"
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <label className="label">Unit price</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={e.unitPrice ?? e.amount}
                  disabled={disabled}
                  onChange={(ev) => patch(e.id, { unitPrice: Math.max(0, Number(ev.target.value) || 0) })}
                  className="input tabular-nums"
                />
              </div>
              <div className="col-span-3 sm:col-span-2">
                <label className="label">GST %</label>
                <select
                  value={e.gstPct}
                  disabled={disabled}
                  onChange={(ev) => patch(e.id, { gstPct: clampGst(ev.target.value) })}
                  className="input"
                >
                  {GST_SLABS.map((g) => <option key={g} value={g}>{g}%</option>)}
                </select>
              </div>
              <div className="col-span-6 sm:col-span-3">
                <label className="label">HSN/SAC (optional)</label>
                <input
                  value={e.hsnCode ?? ""}
                  disabled={disabled}
                  onChange={(ev) => patch(e.id, { hsnCode: ev.target.value || null })}
                  className="input"
                  placeholder="e.g. 9987"
                />
              </div>
              <div className="col-span-1 flex justify-end pb-1.5">
                <button
                  type="button"
                  onClick={() => onChange(extras.filter((x) => x.id !== e.id))}
                  disabled={disabled}
                  className="rounded p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                  aria-label={`Remove ${e.label || "line"}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChargerConfigurator({
  value, onChange, extras = [], onExtrasChange, discount = 0, onDiscountChange,
  allowDiscount, allowPriceOverride, defaultOem, disabled, showChargers = true, showExtras = true,
}: Props) {
  const [dragging, setDragging] = useState<ChargerSpec | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { setNodeRef, isOver } = useDroppable({ id: DROP_ID, disabled });
  const { all: CATALOG_LIST } = useChargerCatalog();

  const config = useMemo(() => normaliseConfig(value), [value]);
  const quote = useMemo(() => buildQuote(config, { discount, extras }), [config, discount, extras]);

  const add = (sku: string) => {
    if (disabled) return;
    const idx = config.findIndex((c) =>
      c.sku === sku && c.unitPrice == null && c.gstPct == null && c.civilPrice == null && c.civilGstPct == null && !c.blended);
    const next =
      idx >= 0
        ? config.map((c, i) => (i === idx ? { ...c, qty: c.qty + 1 } : c))
        : [...config, {
          sku, qty: 1, unitPrice: null, gstPct: null, civilPrice: null, civilGstPct: null, blended: null, oem: defaultOem ?? null,
        }];
    onChange(next);
  };

  const patchAt = (index: number, patch: Partial<ConfigItem>) => {
    if (disabled) return;
    const next = config.map((c, i) => (i === index ? { ...c, ...patch } : c));
    onChange(next.filter((c) => c.qty > 0));
  };

  const removeAt = (index: number) => {
    if (disabled) return;
    onChange(config.filter((_, i) => i !== index));
  };

  function onDragStart(e: DragStartEvent) {
    const sku = e.active.data.current?.sku as string | undefined;
    setDragging(CATALOG_LIST.find((s) => s.sku === sku) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    const sku = e.active.data.current?.sku as string | undefined;
    setDragging(null);
    if (e.over?.id === DROP_ID && sku) add(sku);
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className={cn("grid gap-4", showChargers && "lg:grid-cols-[minmax(0,290px)_minmax(0,1fr)]")}>
        {showChargers && (
          <div>
            <p className="label">Charger catalogue</p>
            <div className="grid grid-cols-2 gap-2">
              {CATALOG_LIST.map((spec) => (
                <PaletteCard key={spec.sku} spec={spec} disabled={disabled} onAdd={() => add(spec.sku)} />
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-500">
              Drag a charger into the configuration, or tap <strong>Add</strong>.
            </p>
          </div>
        )}

        <div>
          {showChargers && (
            <>
              <p className="label">Franchise configuration</p>
              <div
                ref={setNodeRef}
                className={cn(
                  "rounded-xl border-2 border-dashed p-3 transition",
                  isOver ? "border-brand-500 bg-brand-50" : "border-ink-300 bg-ink-50/60",
                )}
              >
                {config.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Zap className="h-7 w-7 text-ink-300" />
                    <p className="mt-2 text-sm font-medium text-ink-700">Drop chargers here</p>
                    <p className="mt-0.5 max-w-xs text-xs text-ink-500">
                      Build the exact package the client wants — for example 2 × 60 kW plus 2 × 120 kW.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {config.map((item, i) => {
                      // CATALOG_LIST (from useChargerCatalog) only carries
                      // active chargers — a lead configured with a custom
                      // charger that's since been archived on the Catalogue
                      // page needs getSpec()'s registry (which keeps
                      // archived ones too) to still show up here and stay
                      // editable, not silently vanish from the basket.
                      const spec = CATALOG_LIST.find((s) => s.sku === item.sku) ?? getSpec(item.sku);
                      if (!spec) return null;
                      return (
                        <BasketRow
                          key={`${item.sku}-${i}`}
                          item={item}
                          index={i}
                          spec={spec}
                          disabled={disabled}
                          allowPriceOverride={allowPriceOverride}
                          onPatch={(p) => patchAt(i, p)}
                          onRemove={() => removeAt(i)}
                        />
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}

          {showExtras && onExtrasChange && (
            <ExtrasEditor extras={extras} disabled={disabled} onChange={onExtrasChange} />
          )}

          {(config.length > 0 || extras.length > 0) && (
            <div className="mt-3 rounded-xl border border-ink-200 bg-white">
              <div className="grid grid-cols-3 divide-x divide-ink-200 border-b border-ink-200 text-center">
                <div className="px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-ink-500">Units</p>
                  <p className="text-sm font-semibold">{quote.unitCount}</p>
                </div>
                <div className="px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-ink-500">Total capacity</p>
                  <p className="text-sm font-semibold">{quote.totalKw} kW</p>
                </div>
                <div className="px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-ink-500">Payback</p>
                  <p className="text-sm font-semibold">
                    {quote.projected.paybackMonths ? `${quote.projected.paybackMonths.toFixed(1)} mo` : "—"}
                  </p>
                </div>
              </div>

              <dl className="space-y-1.5 px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-600">Subtotal (excl. GST)</dt>
                  <dd className="font-medium tabular-nums">{formatINR(quote.subtotal)}</dd>
                </div>

                {allowDiscount && onDiscountChange && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-ink-600">Discount</dt>
                    <dd>
                      <input
                        type="number"
                        min={0}
                        max={quote.subtotal}
                        step={1}
                        value={discount || ""}
                        disabled={disabled}
                        onChange={(e) => onDiscountChange(Math.max(0, Number(e.target.value) || 0))}
                        placeholder="0"
                        className="input w-36 py-1 text-right text-sm tabular-nums"
                      />
                    </dd>
                  </div>
                )}

                {quote.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <dt>Less discount</dt>
                    <dd className="font-medium tabular-nums">− {formatINR(quote.discount)}</dd>
                  </div>
                )}

                <div className="flex justify-between">
                  <dt className="text-ink-600">Taxable value</dt>
                  <dd className="font-medium tabular-nums">{formatINR(quote.taxableValue)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-600">
                    GST
                    <span className="ml-1 text-xs text-ink-400">
                      (blended {quote.effectiveGstPct.toFixed(1)}%)
                    </span>
                  </dt>
                  <dd className="font-medium tabular-nums">{formatINR(quote.gst)}</dd>
                </div>
                <div className="flex justify-between border-t border-ink-200 pt-2 text-base">
                  <dt className="font-semibold text-ink-900">Total investment</dt>
                  <dd className="font-bold tabular-nums text-brand-700">{formatINR(quote.grandTotal)}</dd>
                </div>
              </dl>

              <div className="border-t border-ink-200 px-4 py-3">
                <p className="label">Payment schedule</p>
                <ul className="space-y-1.5">
                  {quote.milestones.map((m) => (
                    <li key={m.key} className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate text-ink-600">{m.label}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-ink-900">
                        {formatINR(m.total)}
                        <span className="ml-1 font-normal text-ink-400">(incl. GST)</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-ink-400">
                  Every line is editable again when you draft the Letter of Intent.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-ink-200 px-4 py-3 text-xs sm:grid-cols-4">
                <div>
                  <p className="text-ink-500">Projected monthly</p>
                  <p className="font-semibold">{formatCompactINR(quote.projected.monthlyIncome)}</p>
                </div>
                <div>
                  <p className="text-ink-500">Assured minimum</p>
                  <p className="font-semibold">{formatCompactINR(quote.projected.assuredMinMonthly)}</p>
                </div>
                <div>
                  <p className="text-ink-500">Annual ROI</p>
                  <p className="font-semibold">{quote.projected.roiPct}%</p>
                </div>
                <div>
                  <p className="text-ink-500">Units / month</p>
                  <p className="font-semibold">{quote.projected.unitsPerMonth.toLocaleString("en-IN")} kWh</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="dnd-overlay rounded-lg border border-brand-400 bg-white px-3 py-2 shadow-lg">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
              <Zap className="h-3.5 w-3.5 text-brand-500" />
              {dragging.label}
            </p>
            <p className="text-[11px] text-ink-500">{formatCompactINR(dragging.basePrice)} + GST</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
