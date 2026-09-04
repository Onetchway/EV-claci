/**
 * A rough, always-overridable TDS estimate under India's New Tax Regime —
 * not a substitute for an actual payroll/compliance tool, just enough to
 * seed a payslip's TDS line so nobody starts from zero. Every payslip lets
 * this be overridden per employee (SalaryProfile.monthlyTdsOverride).
 */

const STANDARD_DEDUCTION = 75000;
/** Section 87A rebate threshold — net tax is nil at or below this taxable income. */
const REBATE_THRESHOLD = 1200000;

/** New Regime slabs (FY 2024-25 onward): [incomeAbove, rate]. */
const SLABS: { above: number; rate: number }[] = [
  { above: 0, rate: 0 },
  { above: 300000, rate: 0.05 },
  { above: 700000, rate: 0.10 },
  { above: 1000000, rate: 0.15 },
  { above: 1200000, rate: 0.20 },
  { above: 1500000, rate: 0.30 },
];

function slabTax(taxableAnnual: number): number {
  let tax = 0;
  for (let i = 0; i < SLABS.length; i++) {
    const { above, rate } = SLABS[i]!;
    if (taxableAnnual <= above) break;
    const next = SLABS[i + 1]?.above ?? Infinity;
    const slice = Math.min(taxableAnnual, next) - above;
    tax += slice * rate;
  }
  return tax;
}

/** Annual CTC in, annual TDS (tax + 4% cess) out — 0 whenever the rebate zeroes it out. */
export function estimateAnnualTds(annualCtc: number): number {
  const taxable = Math.max(0, annualCtc - STANDARD_DEDUCTION);
  if (taxable <= REBATE_THRESHOLD) return 0;
  const tax = slabTax(taxable);
  return Math.round(tax * 1.04);
}

export function estimateMonthlyTds(annualCtc: number): number {
  return Math.round(estimateAnnualTds(annualCtc) / 12);
}

export interface CtcSplit {
  basic: number;
  hra: number;
  ta: number;
  others: number;
  misc: number;
}

/** Basic 50% / HRA 25% / TA 10% / Others 10% / Misc 5% of the monthly CTC — a starting point, every field stays independently editable after. */
export function splitAnnualCtc(annualCtc: number): CtcSplit {
  const monthly = annualCtc / 12;
  return {
    basic: Math.round(monthly * 0.50),
    hra: Math.round(monthly * 0.25),
    ta: Math.round(monthly * 0.10),
    others: Math.round(monthly * 0.10),
    misc: Math.round(monthly * 0.05),
  };
}
