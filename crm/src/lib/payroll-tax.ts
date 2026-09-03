/**
 * India — New Tax Regime TDS estimate (FY 2025-26 slabs).
 *
 * This is a payroll-estimate helper, not a full ITR/tax-return calculator:
 * it assumes the employee's annual taxable income is simply their monthly
 * CTC × 12 minus the New Regime's flat ₹75,000 standard deduction, with no
 * other exemptions, deductions or income sources modeled. It exists purely
 * to prefill a payslip's TDS figure — the Salary form wires it in as a
 * one-way convenience fill (see the "Auto-fill from CTC" button in
 * employees/page.tsx), and the figure stays manually overridable per
 * employee/payslip afterward, same as every other payroll number in this
 * module (PayrollProfile.tdsMonthly's doc comment).
 */

/** New Regime standard deduction, ₹/year (FY 2025-26). */
const STANDARD_DEDUCTION = 75000;

/** Health & Education Cess, applied on top of tax-after-rebate. */
const CESS_PCT = 4;

/**
 * Progressive slabs on annual taxable income (after the standard
 * deduction). Each entry's `upto` is that band's ceiling; a band's rate
 * applies only to the income falling between the previous band's ceiling
 * and this one — not to the whole income (slab-wise, not flat).
 */
const SLABS: ReadonlyArray<{ upto: number; ratePct: number }> = [
  { upto: 400000, ratePct: 0 },
  { upto: 800000, ratePct: 5 },
  { upto: 1200000, ratePct: 10 },
  { upto: 1600000, ratePct: 15 },
  { upto: 2000000, ratePct: 20 },
  { upto: 2400000, ratePct: 25 },
  { upto: Infinity, ratePct: 30 },
];

/** Section 87A rebate threshold — full rebate (₹0 tax) at/below this taxable income. No marginal-relief tapering above it, by design (kept simple, see module doc comment). */
const REBATE_THRESHOLD = 1200000;

/**
 * Annual tax payable (slab-wise, New Regime) on `taxableIncome` — already
 * net of the ₹75,000 standard deduction — including the 87A rebate and 4%
 * Health & Education Cess. Returns a whole-rupee amount.
 */
export function computeAnnualNewRegimeTax(taxableIncome: number): number {
  const income = Math.max(0, taxableIncome);
  if (income <= REBATE_THRESHOLD) return 0;

  let tax = 0;
  let lower = 0;
  for (const slab of SLABS) {
    if (income <= lower) break;
    const upper = Math.min(income, slab.upto);
    tax += Math.max(0, upper - lower) * (slab.ratePct / 100);
    lower = slab.upto;
  }

  const cess = tax * (CESS_PCT / 100);
  return Math.round(tax + cess);
}

/**
 * Monthly TDS to prefill on a salary profile, from a monthly CTC figure —
 * annualizes it (× 12), applies the standard deduction, runs the New
 * Regime slabs above, and divides by 12 (rounded to the nearest rupee).
 * Always a starting point: the profile/payslip's tdsMonthly stays a plain,
 * manually editable number after this fill.
 */
export function computeMonthlyTdsFromCtc(monthlyCtc: number): number {
  const annualIncome = Math.max(0, monthlyCtc) * 12;
  const taxableIncome = Math.max(0, annualIncome - STANDARD_DEDUCTION);
  const annualTax = computeAnnualNewRegimeTax(taxableIncome);
  return Math.round(annualTax / 12);
}
