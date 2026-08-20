/**
 * Quotation engine.
 *
 * A lead's "configuration" is a basket of charger units — e.g. 2 × 60 kW +
 * 2 × 120 kW — plus any non-charger material lines (civil work, LT panel,
 * DISCOM deposit…). Everything downstream is derived from that basket so the
 * numbers can never drift out of sync with what the agent actually configured.
 *
 * Three things are deliberately per-line rather than global, because the real
 * letters Livanto issues vary deal by deal:
 *
 *   • unit price   — negotiated prices differ from the catalogue
 *   • GST rate     — chargers are 18%, but civil/site work can be 5% or 12%,
 *                    and a DISCOM security deposit carries none at all
 *   • OEM          — which manufacturer's charger is being supplied
 */

import { CATALOG, FINANCING, GST_RATE, getSpec, type ChargerSpec } from "./catalog";

export interface ConfigItem {
  sku: string;
  qty: number;
  /** Negotiated per-unit price, excluding GST. Falls back to the catalogue. */
  unitPrice?: number | null;
  /** GST percentage for this line. Falls back to 18. */
  gstPct?: number | null;
  /** Charger manufacturer for this line. */
  oem?: string | null;
}

/** A non-charger line: civil work, canopy, LT panel, DISCOM deposit, etc. */
export interface ExtraItem {
  id: string;
  label: string;
  /** Total for the line, excluding GST. */
  amount: number;
  gstPct: number;
  note?: string;
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
    const key = [it.sku, it.unitPrice ?? "", it.gstPct ?? "", it.oem ?? ""].join("|");
    const existing = merged.get(key);
    if (existing) existing.qty += qty;
    else {
      merged.set(key, {
        sku: it.sku,
        qty,
        unitPrice: it.unitPrice ?? null,
        gstPct: it.gstPct ?? null,
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

  const chargerLines: QuoteLine[] = config.map((it, i) => {
    const s = getSpec(it.sku) as ChargerSpec;
    const unitBase = it.unitPrice != null && it.unitPrice >= 0 ? Math.round(it.unitPrice) : s.basePrice;
    const gstPct = it.gstPct != null ? clampGst(it.gstPct) : defaultGstPct;
    const base = unitBase * it.qty;
    return {
      kind: "CHARGER",
      key: `c${i}-${s.sku}`,
      label: `${s.label} DC Fast Charger`,
      sku: s.sku,
      kw: s.kw,
      oem: it.oem ?? null,
      qty: it.qty,
      unitBase,
      catalogueUnitBase: s.basePrice,
      overridden: unitBase !== s.basePrice,
      base,
      gstPct,
      gst: rupee(base * (gstPct / 100)),
      total: rupee(base + base * (gstPct / 100)),
    };
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
  }));

  const lines = [...chargerLines, ...extraLines];
  const subtotal = lines.reduce((a, l) => a + l.base, 0);
  const discount = Math.min(Math.max(0, Math.round(opts.discount ?? 0)), subtotal);
  const taxableValue = subtotal - discount;

  // A discount reduces every line's taxable base proportionally, so GST stays
  // correct when lines sit in different slabs.
  const keepRatio = subtotal > 0 ? taxableValue / subtotal : 0;
  const gst = rupee(lines.reduce((a, l) => a + l.base * keepRatio * (l.gstPct / 100), 0));
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
  return config.map((it) => `${it.qty} × ${CATALOG[it.sku as keyof typeof CATALOG].label}`).join(" + ");
}

/** "60 kW" / "60 kW + 120 kW" — used in the LOI subject line. */
export function describeCapacity(items: ConfigItem[] | undefined | null): string {
  const config = normaliseConfig(items);
  if (!config.length) return "";
  const labels = [...new Set(config.map((it) => CATALOG[it.sku as keyof typeof CATALOG].label))];
  return labels.join(" + ");
}
