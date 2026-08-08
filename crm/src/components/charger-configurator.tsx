"use client";

import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { GripVertical, Minus, Plus, Trash2, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { CATALOG_LIST, type ChargerSpec } from "@/lib/catalog";
import { buildQuote, normaliseConfig, type ConfigItem } from "@/lib/pricing";
import { cn, formatCompactINR, formatINR } from "@/lib/utils";

/**
 * Drag a charger from the catalogue into the basket to configure a franchise,
 * e.g. 2 × 60 kW + 2 × 120 kW. Dragging is the headline interaction, but every
 * action is also reachable by click/keyboard — a sales agent on a phone in the
 * field should never be blocked by a drag target.
 */

interface Props {
  value: ConfigItem[];
  onChange: (next: ConfigItem[]) => void;
  discount?: number;
  onDiscountChange?: (v: number) => void;
  allowDiscount?: boolean;
  disabled?: boolean;
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
          <p className="text-[11px] text-ink-400">+ GST · {formatCompactINR(spec.basePrice * 1.18)} all-in</p>
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

function BasketRow({
  spec, qty, disabled, onQty, onRemove,
}: {
  spec: ChargerSpec; qty: number; disabled?: boolean;
  onQty: (q: number) => void; onRemove: () => void;
}) {
  const lineBase = spec.basePrice * qty;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-ink-200 bg-white px-3 py-2.5">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700">
        {spec.kw}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{spec.label} DC Fast Charger</p>
        <p className="truncate text-[11px] text-ink-500">
          {formatINR(spec.basePrice)} each · {spec.minSpaceSqft}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-ink-200">
        <button
          type="button"
          onClick={() => onQty(qty - 1)}
          disabled={disabled}
          className="p-1.5 text-ink-500 hover:text-ink-900 disabled:opacity-40"
          aria-label={`Reduce ${spec.label} quantity`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-7 text-center text-sm font-semibold tabular-nums">{qty}</span>
        <button
          type="button"
          onClick={() => onQty(qty + 1)}
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
    </li>
  );
}

export function ChargerConfigurator({
  value, onChange, discount = 0, onDiscountChange, allowDiscount, disabled,
}: Props) {
  const [dragging, setDragging] = useState<ChargerSpec | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { setNodeRef, isOver } = useDroppable({ id: DROP_ID, disabled });

  const config = useMemo(() => normaliseConfig(value), [value]);
  const quote = useMemo(() => buildQuote(config, { discount }), [config, discount]);

  const add = (sku: string, by = 1) => {
    if (disabled) return;
    const existing = config.find((c) => c.sku === sku);
    const next = existing
      ? config.map((c) => (c.sku === sku ? { ...c, qty: c.qty + by } : c))
      : [...config, { sku, qty: by }];
    onChange(normaliseConfig(next));
  };

  const setQty = (sku: string, qty: number) => {
    if (disabled) return;
    onChange(normaliseConfig(config.map((c) => (c.sku === sku ? { ...c, qty } : c))));
  };

  const remove = (sku: string) => {
    if (disabled) return;
    onChange(config.filter((c) => c.sku !== sku));
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
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

        <div>
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
                {config.map((item) => {
                  const spec = CATALOG_LIST.find((s) => s.sku === item.sku);
                  if (!spec) return null;
                  return (
                    <BasketRow
                      key={item.sku}
                      spec={spec}
                      qty={item.qty}
                      disabled={disabled}
                      onQty={(q) => (q <= 0 ? remove(item.sku) : setQty(item.sku, q))}
                      onRemove={() => remove(item.sku)}
                    />
                  );
                })}
              </ul>
            )}
          </div>

          {config.length > 0 && (
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
                        step={1000}
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
                  <dt className="text-ink-600">GST @ {(quote.gstRate * 100).toFixed(0)}%</dt>
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
