/**
 * Quotation engine.
 *
 * A lead's "configuration" is a basket of charger units — e.g. 2 × 60 kW +
 * 2 × 120 kW — plus any non-charger material lines (civil work, LT panel,
 * DISCOM deposit…). Everything downstream is derived from that basket so the
 * numbers can never drift out of sync with what the agent actually configured.
 *
 * A DC charger's catalogue price is itself a bundled BOM figure — hardware
 * (HSN 8504 EVSE, 5% GST) plus its electrical connection, panel, wiring and
 * civil work (18% GST). Standard (the default) renders one ConfigItem as two
 * QuoteLines — "Equipment" and "Electrical & Civil Work" — each independently
 * priced and taxed. Blended collapses the same line back into one combined
 * price at one editable rate, for a deal quoted as a single all-in number. A
 * custom charger with no equipmentPrice on record has nothing to split
 * either way, so it stays a single line at 5%.
 *
 * Three things are deliberately per-line rather than global, because the real
 * letters Livanto issues vary deal by deal:
 *
 *   • unit price   — negotiated prices differ from the catalogue, for either
 *                    the equipment slice or the electrical/civil slice
 *   • GST rate     — set independently per slice; non-charger extras (civil
 *                    work, LT panel, DISCOM deposit…) are simpler — 18% by
 *                    default, 0% for a deposit, one explicit rate per line
 *   • OEM          — which manufacturer's charger is being supplied
 */

import { CATALOG, FINANCING, GST_RATE, REST_GST_RATE, getSpec, type ChargerSpec } from "./catalog";

export interface ConfigItem {
  sku: string;
  qty: number;
  /** Negotiated per-unit equipment/hardware price, excluding GST. Falls back to the catalogue's equipment slice. */
  unitPrice?: number | null;
  /** GST for the equipment line. Falls back to 5%. */
  gstPct?: number | null;
  /** Negotiated per-unit electrical & civil work price, excluding GST. Falls back to the catalogue's (basePrice − equipmentPrice) slice. */
  civilPrice?: number | null;
  /** GST for the electrical & civil work line. Falls back to 18%. */
  civilGstPct?: number | null;
  /** Blended mode — one combined line (equipment + electrical/civil together) at one flat rate, instead of the two-line Standard split. `unitPrice`/`gstPct` then describe that single combined line; `civilPrice`/`civilGstPct` are unused. */
  blended?: boolean | null;
  /** Charger manufacturer for this line. */
  oem?: string | null;
  /** HSN code for the equipment (or blended combined) line — optional, free text. */
  hsnCode?: string | null;
  /** SAC code for the electrical & civil work line — optional, free text. Unused when blended. */
  civilHsnCode?: string | null;
}

/** A non-charger line: civil work, canopy, LT panel, DISCOM deposit, etc. */
export interface ExtraItem {
  id: string;
  label: string;
  /** Total for the line, excluding GST — always qty * unitPrice when both are set (kept in sync by the editor UI). */
  amount: number;
  gstPct: number;
  note?: string;
  /** Optional qty/unitPrice breakdown behind `amount`, matching how a Purchase Order line reads. Absent on older extras that only ever stored a flat amount. */
  qty?: number;
  unitPrice?: number;
  /** HSN/SAC code — optional, free text. */
  hsnCode?: string | null;
}

export interface QuoteLine {
  kind: "CHARGER" | "EXTRA";
  key: string;
  label: string;
  sku?: string;
  kw?: number;
  oem?: string | null;
  qty: number;
  unitBase: number;
  /** List price before any override — lets the UI show what changed. */
  catalogueUnitBase?: number;
  overridden: boolean;
  base: number;
  gstPct: number;
  gst: number;
  total: number;
  /** HSN/SAC code — optional, free text. */
  hsnCode?: string | null;
}

export interface MilestoneAmount {
  key: "EOI" | "INFRA" | "COMMISSIONING";
  label: string;
  base: number;
  gst: number;
  total: number;
}

export interface Quote {
  lines: QuoteLine[];
  chargerLines: QuoteLine[];
  extraLines: QuoteLine[];
  totalKw: number;
  unitCount: number;
  /** Sum of all line bases, GST-exclusive, before discount. */
  subtotal: number;
  discount: number;
  taxableValue: number;
  /** Blended rate across the basket — informational; GST is summed per line. */
  effectiveGstPct: number;
  gst: number;
  grandTotal: number;
  milestones: MilestoneAmount[];
  projected: {
    monthlyIncome: number;
    assuredMinMonthly: number;
    annualIncome: number;
    /**
     * Payback in months, measured against the pre-GST investment — GST is
     * recoverable as input tax credit, so the workbook excludes it from both
     * payback and ROI. Keep it that way or the CRM will quote worse returns
     * than the investment deck.
     */
    paybackMonths: number;
    roiPct: number;
    unitsPerMonth: number;
  };
  financing: {
    loanToValue: number;
    downPayment: number;
    loanAmount: number;
    interestRate: number;
    emis: { years: number; emi: number }[];
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const rupee = (n: number) => Math.round(n);

export function normaliseConfig(items: ConfigItem[] | undefined | null): ConfigItem[] {
  if (!Array.isArray(items)) return [];
  const merged = new Map<string, ConfigItem>();

  for (const it of items) {
    if (!it || !getSpec(it.sku)) continue;
    const qty = Math.max(0, Math.floor(Number(it.qty) || 0));
    if (qty === 0) continue;

    // Lines with different negotiated terms stay separate; identical ones merge.
    const key = [
      it.sku, it.unitPrice ?? "", it.gstPct ?? "", it.civilPrice ?? "", it.civilGstPct ?? "",
      it.blended ?? "", it.oem ?? "",
    ].join("|");
    const existing = merged.get(key);
    if (existing) existing.qty += qty;
    else {
      merged.set(key, {
        sku: it.sku,
        qty,
        unitPrice: it.unitPrice ?? null,
        gstPct: it.gstPct ?? null,
        civilPrice: it.civilPrice ?? null,
        civilGstPct: it.civilGstPct ?? null,
        blended: it.blended ?? null,
        oem: it.oem ?? null,
      });
    }
  }

  return [...merged.values()].sort((a, b) => getSpec(a.sku)!.kw - getSpec(b.sku)!.kw);
}

export function normaliseExtras(items: ExtraItem[] | undefined | null): ExtraItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((e) => e && e.label?.trim() && Number.isFinite(Number(e.amount)))
    .map((e, i) => ({
      id: e.id || `x${i}`,
      label: e.label.trim(),
      amount: Math.max(0, Math.round(Number(e.amount) || 0)),
      gstPct: clampGst(e.gstPct),
      note: e.note ?? "",
    }));
}

/** GST is a statutory slab, not free input — clamp to something billable. */
export function clampGst(pct: unknown): number {
  const n = Number(pct);
  if (!Number.isFinite(n)) return 18;
  return Math.min(28, Math.max(0, Math.round(n)));
}

const GST_SLAB_VALUES = [0, 5, 18, 28];

/** Snaps a computed blended % (e.g. 12.97) to the nearest real GST slab, so a Blended line's default always lands on a selectable option. */
export function nearestGstSlab(pct: number): number {
  return GST_SLAB_VALUES.reduce((closest, g) => (Math.abs(g - pct) < Math.abs(closest - pct) ? g : closest), GST_SLAB_VALUES[0]!);
}

/** The default flat rate for a Blended charger line — equipment and civil work's rates, weighted by their share of the bundled price, snapped to the nearest slab. */
export function defaultBlendedGstPct(equipmentPrice: number, civilPrice: number): number {
  const total = equipmentPrice + civilPrice;
  if (total <= 0) return 18;
  return nearestGstSlab((equipmentPrice * GST_RATE * 100 + civilPrice * REST_GST_RATE * 100) / total);
}

/** Flat EMI on a reducing-balance loan. */
export function emiFor(principal: number, annualRate: number, years: number): number {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return rupee(principal / n);
  const factor = Math.pow(1 + r, n);
  return rupee((principal * r * factor) / (factor - 1));
}

export interface QuoteOptions {
  /** Absolute discount in ₹, applied to the pre-GST subtotal. */
  discount?: number;
  extras?: ExtraItem[];
  /** Default GST for charger lines that do not set their own. */
  gstRate?: number;
}

export function buildQuote(items: ConfigItem[], opts: QuoteOptions = {}): Quote {
  const config = normaliseConfig(items);
  const extras = normaliseExtras(opts.extras);
  const defaultGstPct = clampGst((opts.gstRate ?? GST_RATE) * 100);

  const chargerLines: QuoteLine[] = config.flatMap((it, i) => {
    const s = getSpec(it.sku) as ChargerSpec;
    const equipDefault = s.equipmentPrice ?? s.basePrice;
    const civilDefault = Math.max(0, s.basePrice - equipDefault);

    if (it.blended) {
      // One combined line — equipment and electrical/civil work billed together at one flat rate,
      // defaulting to their weighted-average rate snapped to the nearest real slab.
      const unit = it.unitPrice != null && it.unitPrice >= 0 ? Math.round(it.unitPrice) : s.basePrice;
      const base = unit * it.qty;
      const gstPct = it.gstPct != null ? clampGst(it.gstPct) : defaultBlendedGstPct(equipDefault, civilDefault);
      const blendedLine: QuoteLine = {
        kind: "CHARGER",
        key: `c${i}-${s.sku}-blended`,
        label: `${s.label} DC Fast Charger`,
        sku: s.sku,
        kw: s.kw,
        oem: it.oem ?? null,
        qty: it.qty,
        unitBase: unit,
        catalogueUnitBase: s.basePrice,
        overridden: unit !== s.basePrice,
        base,
        gstPct,
        gst: rupee(base * (gstPct / 100)),
        total: rupee(base * (1 + gstPct / 100)),
        hsnCode: it.hsnCode ?? null,
      };
      return [blendedLine];
    }

    const equipUnit = it.unitPrice != null && it.unitPrice >= 0 ? Math.round(it.unitPrice) : equipDefault;
    const equipBase = equipUnit * it.qty;
    const equipGstPct = it.gstPct != null ? clampGst(it.gstPct) : clampGst(defaultGstPct);
    const equipLine: QuoteLine = {
      kind: "CHARGER",
      key: `c${i}-${s.sku}-equip`,
      label: `${s.label} DC Fast Charger`,
      sku: s.sku,
      kw: s.kw,
      oem: it.oem ?? null,
      qty: it.qty,
      unitBase: equipUnit,
      catalogueUnitBase: equipDefault,
      overridden: equipUnit !== equipDefault,
      base: equipBase,
      gstPct: equipGstPct,
      gst: rupee(equipBase * (equipGstPct / 100)),
      total: rupee(equipBase * (1 + equipGstPct / 100)),
      hsnCode: it.hsnCode ?? null,
    };

    // A charger with no BOM equipment/civil split (a custom, non-DC-investment-model entry)
    // has nothing to bill separately, so it stays a single equipment-only line.
    if (civilDefault <= 0 && it.civilPrice == null) return [equipLine];

    const civilUnit = it.civilPrice != null && it.civilPrice >= 0 ? Math.round(it.civilPrice) : civilDefault;
    const civilBase = civilUnit * it.qty;
    const civilGstPct = it.civilGstPct != null ? clampGst(it.civilGstPct) : clampGst(REST_GST_RATE * 100);
    const civilLine: QuoteLine = {
      kind: "CHARGER",
      key: `c${i}-${s.sku}-civil`,
      label: `${s.label} DC Fast Charger — Electrical & Civil Work`,
      sku: s.sku,
      kw: s.kw,
      oem: it.oem ?? null,
      qty: it.qty,
      unitBase: civilUnit,
      catalogueUnitBase: civilDefault,
      overridden: civilUnit !== civilDefault,
      base: civilBase,
      gstPct: civilGstPct,
      gst: rupee(civilBase * (civilGstPct / 100)),
      total: rupee(civilBase * (1 + civilGstPct / 100)),
      hsnCode: it.civilHsnCode ?? null,
    };

    return [equipLine, civilLine];
  });

  const extraLines: QuoteLine[] = extras.map((e) => ({
    kind: "EXTRA",
    key: `x-${e.id}`,
    label: e.label,
    oem: null,
    qty: 1,
    unitBase: e.amount,
    overridden: false,
    base: e.amount,
    gstPct: e.gstPct,
    gst: rupee(e.amount * (e.gstPct / 100)),
    total: rupee(e.amount + e.amount * (e.gstPct / 100)),
    hsnCode: e.hsnCode ?? null,
  }));

  const lines = [...chargerLines, ...extraLines];
  const subtotal = lines.reduce((a, l) => a + l.base, 0);
  const discount = Math.min(Math.max(0, Math.round(opts.discount ?? 0)), subtotal);
  const taxableValue = subtotal - discount;

  // A discount reduces every line's taxable base proportionally, so GST stays
  // correct when lines sit in different slabs. Scales each line's own exact
  // `gst` rather than re-deriving from the rounded display `gstPct` — a
  // charger's default rate is a blended (5% equipment / 18% rest) figure
  // with more precision than its 2-decimal display value carries.
  const keepRatio = subtotal > 0 ? taxableValue / subtotal : 0;
  const gst = rupee(lines.reduce((a, l) => a + l.gst * keepRatio, 0));
  const grandTotal = rupee(taxableValue + gst);
  const effectiveGstPct = taxableValue > 0 ? round2((gst / taxableValue) * 100) : 0;

  // Milestones: the advance is a fixed token from the catalogue; whatever
  // remains splits between infrastructure and commissioning in the catalogue's
  // own ratio. Extras and overrides therefore land in the later two stages,
  // which is how the real letters read.
  const advanceRaw = config.reduce((a, it) => a + (getSpec(it.sku) as ChargerSpec).stage1EOI * it.qty, 0);
  const stage2Raw = config.reduce((a, it) => a + (getSpec(it.sku) as ChargerSpec).stage2Infra * it.qty, 0);
  const stage3Raw = config.reduce((a, it) => a + (getSpec(it.sku) as ChargerSpec).stage3Commissioning * it.qty, 0);

  const advance = Math.min(advanceRaw, taxableValue);
  const remainder = Math.max(0, taxableValue - advance);
  const laterTotal = stage2Raw + stage3Raw;
  const stage2Share = laterTotal > 0 ? stage2Raw / laterTotal : 0.5;

  const defs: { key: MilestoneAmount["key"]; label: string; base: number }[] = [
    { key: "EOI", label: "Advance — payable on execution of this LOI", base: advance },
    { key: "INFRA", label: "1st Installment — towards civil work and installation of the charger", base: rupee(remainder * stage2Share) },
    { key: "COMMISSIONING", label: "2nd Installment — towards electrical connection, LT panel installation and final handover", base: 0 },
  ];
  // The last stage absorbs rounding so the schedule always reconciles.
  defs[2]!.base = taxableValue - defs[0]!.base - defs[1]!.base;

  const gstOnStage = (base: number) => (taxableValue > 0 ? rupee(base * (gst / taxableValue)) : 0);
  const milestones: MilestoneAmount[] = defs.map((m, i) => {
    const isLast = i === defs.length - 1;
    const mGst = isLast ? gst - gstOnStage(defs[0]!.base) - gstOnStage(defs[1]!.base) : gstOnStage(m.base);
    return { key: m.key, label: m.label, base: rupee(m.base), gst: rupee(mGst), total: rupee(m.base + mGst) };
  });

  const projectedAgg = config.reduce(
    (acc, it) => {
      const s = getSpec(it.sku) as ChargerSpec;
      acc.monthlyIncome += s.returns.monthlyIncome * it.qty;
      acc.assuredMinMonthly += s.returns.assuredMinMonthly * it.qty;
      acc.annualIncome += s.returns.annualIncome * it.qty;
      acc.unitsPerMonth += s.ops.unitsPerMonth * it.qty;
      return acc;
    },
    { monthlyIncome: 0, assuredMinMonthly: 0, annualIncome: 0, unitsPerMonth: 0 },
  );

  const paybackMonths = projectedAgg.monthlyIncome > 0 ? round2(taxableValue / projectedAgg.monthlyIncome) : 0;
  const roiPct = taxableValue > 0 ? round2((projectedAgg.annualIncome / taxableValue) * 100) : 0;

  const downPayment = rupee(grandTotal * (1 - FINANCING.loanToValue));
  const loanAmount = rupee(grandTotal - downPayment);

  return {
    lines,
    chargerLines,
    extraLines,
    totalKw: config.reduce((a, it) => a + (getSpec(it.sku) as ChargerSpec).kw * it.qty, 0),
    unitCount: config.reduce((a, it) => a + it.qty, 0),
    subtotal: rupee(subtotal),
    discount,
    taxableValue: rupee(taxableValue),
    effectiveGstPct,
    gst,
    grandTotal,
    milestones,
    projected: { ...projectedAgg, paybackMonths, roiPct },
    financing: {
      loanToValue: FINANCING.loanToValue,
      downPayment,
      loanAmount,
      interestRate: FINANCING.interestRate,
      emis: FINANCING.tenuresYears.map((years) => ({
        years,
        emi: emiFor(loanAmount, FINANCING.interestRate, years),
      })),
    },
  };
}

/** Human-readable basket, e.g. "2 × 60 kW + 2 × 120 kW". */
export function describeConfig(items: ConfigItem[] | undefined | null): string {
  const config = normaliseConfig(items);
  if (!config.length) return "—";
  // getSpec() (not a raw CATALOG lookup) because a basket can include a
  // charger added on the Catalogue page — a custom sku that only resolves
  // through the runtime registry set by useChargerCatalog(), never through
  // the compiled CATALOG object alone.
  return config.map((it) => `${it.qty} × ${getSpec(it.sku)?.label ?? it.sku}`).join(" + ");
}

/** "60 kW" / "4 × 7.4 kW + 120 kW" — used in the LOI/Agreement subject line and Schedule I, so the quantity of each charger has to be visible, not just the distinct capacities. */
export function describeCapacity(items: ConfigItem[] | undefined | null): string {
  const config = normaliseConfig(items);
  if (!config.length) return "";
  return config.map((it) => {
    const label = getSpec(it.sku)?.label ?? it.sku;
    return it.qty > 1 ? `${it.qty} × ${label}` : label;
  }).join(" + ");
}
