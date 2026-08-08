/**
 * Quotation engine.
 *
 * A lead's "configuration" is a basket of charger units, e.g. 2 × 60 kW +
 * 2 × 120 kW. Everything downstream — total cost, GST, the three payment
 * milestones, projected income, payback — is derived from that basket so the
 * numbers can never drift out of sync with what the agent dragged in.
 */

import { CATALOG, FINANCING, GST_RATE, getSpec, type ChargerSpec } from "./catalog";

export interface ConfigItem {
  sku: string;
  qty: number;
}

export interface QuoteLine {
  sku: string;
  label: string;
  kw: number;
  qty: number;
  unitBase: number;
  base: number;
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
  totalKw: number;
  unitCount: number;
  /** Sum of base prices, GST-exclusive. */
  subtotal: number;
  /** Discount applied on the pre-GST subtotal. */
  discount: number;
  taxableValue: number;
  gstRate: number;
  gst: number;
  /** Grand total payable, GST-inclusive. */
  grandTotal: number;
  milestones: MilestoneAmount[];
  projected: {
    monthlyIncome: number;
    assuredMinMonthly: number;
    annualIncome: number;
    /**
     * Payback across the whole basket, in months, measured against the
     * pre-GST investment — GST is recoverable as input tax credit, so the
     * workbook excludes it from both payback and ROI. Keep it that way or the
     * CRM will quote worse returns than the investment deck.
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

const round = (n: number) => Math.round(n * 100) / 100;
const rupee = (n: number) => Math.round(n);

export function normaliseConfig(items: ConfigItem[] | undefined | null): ConfigItem[] {
  if (!Array.isArray(items)) return [];
  const merged = new Map<string, number>();
  for (const it of items) {
    if (!it || !getSpec(it.sku)) continue;
    const qty = Math.max(0, Math.floor(Number(it.qty) || 0));
    if (qty === 0) continue;
    merged.set(it.sku, (merged.get(it.sku) ?? 0) + qty);
  }
  return [...merged.entries()]
    .map(([sku, qty]) => ({ sku, qty }))
    .sort((a, b) => (getSpec(a.sku)!.kw - getSpec(b.sku)!.kw));
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
  gstRate?: number;
}

export function buildQuote(items: ConfigItem[], opts: QuoteOptions = {}): Quote {
  const config = normaliseConfig(items);
  const gstRate = opts.gstRate ?? GST_RATE;

  const lines: QuoteLine[] = config.map((it) => {
    const s = getSpec(it.sku) as ChargerSpec;
    const base = s.basePrice * it.qty;
    const gst = base * gstRate;
    return {
      sku: s.sku,
      label: s.label,
      kw: s.kw,
      qty: it.qty,
      unitBase: s.basePrice,
      base,
      gst: rupee(gst),
      total: rupee(base + gst),
    };
  });

  const subtotal = lines.reduce((a, l) => a + l.base, 0);
  const discount = Math.min(Math.max(0, Math.round(opts.discount ?? 0)), subtotal);
  const taxableValue = subtotal - discount;
  const gst = rupee(taxableValue * gstRate);
  const grandTotal = rupee(taxableValue + gst);

  // Milestones follow the workbook's split, pro-rated when a discount applies
  // so the three stages always add back up to the grand total.
  const rawMilestones = config.reduce(
    (acc, it) => {
      const s = getSpec(it.sku) as ChargerSpec;
      acc.EOI += s.stage1EOI * it.qty;
      acc.INFRA += s.stage2Infra * it.qty;
      acc.COMMISSIONING += s.stage3Commissioning * it.qty;
      return acc;
    },
    { EOI: 0, INFRA: 0, COMMISSIONING: 0 },
  );

  const ratio = subtotal > 0 ? taxableValue / subtotal : 0;
  const milestoneDefs: { key: MilestoneAmount["key"]; label: string; raw: number }[] = [
    { key: "EOI", label: "Stage 1 — Expression of Interest (EOI)", raw: rawMilestones.EOI },
    { key: "INFRA", label: "Stage 2 — Infrastructure Initiation", raw: rawMilestones.INFRA },
    { key: "COMMISSIONING", label: "Stage 3 — Charger Installation & Commissioning", raw: rawMilestones.COMMISSIONING },
  ];

  const milestones: MilestoneAmount[] = milestoneDefs.map((m, i) => {
    // Last stage absorbs rounding so the schedule reconciles to the penny.
    const isLast = i === milestoneDefs.length - 1;
    const base = isLast
      ? taxableValue - milestoneDefs.slice(0, i).reduce((a, x) => a + rupee(x.raw * ratio), 0)
      : rupee(m.raw * ratio);
    const mGst = isLast
      ? gst - milestoneDefs.slice(0, i).reduce((a, x) => a + rupee(rupee(x.raw * ratio) * gstRate), 0)
      : rupee(base * gstRate);
    return { key: m.key, label: m.label, base: rupee(base), gst: rupee(mGst), total: rupee(base + mGst) };
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

  const paybackMonths =
    projectedAgg.monthlyIncome > 0 ? round(taxableValue / projectedAgg.monthlyIncome) : 0;
  const roiPct = taxableValue > 0 ? round((projectedAgg.annualIncome / taxableValue) * 100) : 0;

  const downPayment = rupee(grandTotal * (1 - FINANCING.loanToValue));
  const loanAmount = rupee(grandTotal - downPayment);

  return {
    lines,
    totalKw: config.reduce((a, it) => a + (getSpec(it.sku) as ChargerSpec).kw * it.qty, 0),
    unitCount: config.reduce((a, it) => a + it.qty, 0),
    subtotal: rupee(subtotal),
    discount,
    taxableValue: rupee(taxableValue),
    gstRate,
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
