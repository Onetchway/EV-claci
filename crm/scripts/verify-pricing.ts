/**
 * Guards the quotation engine against the source workbook.
 *
 *   npm run verify
 *
 * Every expected figure below is transcribed from
 * "Livanto_Franchise_Investment_Model_New.xlsx" → sheet "Franchise Model".
 * If this fails, either the catalogue drifted or the workbook was revised —
 * do not "fix" it by loosening the tolerance.
 */

import { CATALOG_LIST } from "../src/lib/catalog";
import { buildQuote } from "../src/lib/pricing";

interface Expectation {
  /** Row 2.1.2 — overall cost of investment, incl. GST. */
  allIn: number;
  /** Rows 2.2.2 / 2.3.2 / 2.4.2 — overall payment per stage, incl. GST. */
  stage1: number;
  stage2: number;
  stage3: number;
  /** Rows 3.5 and 3.8 — EMI at 3-year and 7-year tenure. */
  emi3yr: number;
  emi7yr: number;
}

const EXPECTED: Record<number, Expectation> = {
  60: { allIn: 1_829_000, stage1: 59_000, stage2: 885_000, stage3: 885_000, emi3yr: 40_713, emi7yr: 20_599 },
  90: { allIn: 2_419_000, stage1: 59_000, stage2: 1_180_000, stage3: 1_180_000, emi3yr: 53_846, emi7yr: 27_244 },
  120: { allIn: 3_009_000, stage1: 59_000, stage2: 1_475_000, stage3: 1_475_000, emi3yr: 66_980, emi7yr: 33_888 },
  180: { allIn: 3_540_000, stage1: 59_000, stage2: 1_740_500, stage3: 1_740_500, emi3yr: 78_800, emi7yr: 39_869 },
  240: { allIn: 4_484_000, stage1: 118_000, stage2: 2_183_000, stage3: 2_183_000, emi3yr: 99_813, emi7yr: 50_500 },
  360: { allIn: 5_900_000, stage1: 236_000, stage2: 2_832_000, stage3: 2_832_000, emi3yr: 131_333, emi7yr: 66_448 },
};

let failures = 0;

function check(label: string, got: number, want: number, tolerance = 1) {
  if (Math.abs(got - want) > tolerance) {
    failures += 1;
    console.error(`  ✗ ${label}: got ${got.toLocaleString("en-IN")}, expected ${want.toLocaleString("en-IN")}`);
  }
}

console.log("\nVerifying quotation engine against the investment model\n");

for (const spec of CATALOG_LIST) {
  const want = EXPECTED[spec.kw];
  if (!want) {
    failures += 1;
    console.error(`  ✗ ${spec.label}: no expectation recorded for this option`);
    continue;
  }

  const q = buildQuote([{ sku: spec.sku, qty: 1 }]);
  check(`${spec.label} all-in cost`, q.grandTotal, want.allIn);
  check(`${spec.label} stage 1 (EOI)`, q.milestones[0]!.total, want.stage1);
  check(`${spec.label} stage 2 (infrastructure)`, q.milestones[1]!.total, want.stage2);
  check(`${spec.label} stage 3 (commissioning)`, q.milestones[2]!.total, want.stage3);
  check(
    `${spec.label} payment schedule reconciles to the total`,
    q.milestones.reduce((a, m) => a + m.total, 0),
    want.allIn,
  );
  check(`${spec.label} EMI @ 3 years`, q.financing.emis[0]!.emi, want.emi3yr, 2);
  check(`${spec.label} EMI @ 7 years`, q.financing.emis[3]!.emi, want.emi7yr, 2);
  // Payback and ROI are measured on the pre-GST investment, as the workbook does.
  check(`${spec.label} payback (months)`, q.projected.paybackMonths, spec.returns.paybackMonths, 0.02);
  check(`${spec.label} annual ROI (%)`, q.projected.roiPct, spec.returns.roiPct, 0.02);
  console.log(`  ✓ ${spec.label}`);
}

// A mixed basket — the "2 × 60 kW + 2 × 120 kW" case from the brief.
const mixed = buildQuote([
  { sku: "DC-60", qty: 2 },
  { sku: "DC-120", qty: 2 },
]);
check("mixed basket subtotal", mixed.subtotal, (1_550_000 + 2_550_000) * 2);
check("mixed basket GST", mixed.gst, (1_550_000 + 2_550_000) * 2 * 0.18);
check("mixed basket total", mixed.grandTotal, (1_829_000 + 3_009_000) * 2);
check("mixed basket capacity", mixed.totalKw, 360);
check("mixed basket unit count", mixed.unitCount, 4);
check(
  "mixed basket schedule reconciles",
  mixed.milestones.reduce((a, m) => a + m.total, 0),
  mixed.grandTotal,
);
console.log("  ✓ mixed basket (2 × 60 kW + 2 × 120 kW)");

// A discount must be applied pre-GST and the schedule must still reconcile.
const discounted = buildQuote([{ sku: "DC-180", qty: 1 }], { discount: 250_000 });
check("discounted taxable value", discounted.taxableValue, 3_000_000 - 250_000);
check("discounted total", discounted.grandTotal, Math.round((3_000_000 - 250_000) * 1.18));
check(
  "discounted schedule reconciles",
  discounted.milestones.reduce((a, m) => a + m.total, 0),
  discounted.grandTotal,
);
console.log("  ✓ discounted quotation");

// --- per-line overrides, mixed GST slabs and material lines -----------------

// A negotiated price must replace the catalogue price, not sit alongside it.
const negotiated = buildQuote([{ sku: "DC-60", qty: 1, unitPrice: 1_400_000 }]);
check("negotiated unit price", negotiated.subtotal, 1_400_000);
check("negotiated total", negotiated.grandTotal, Math.round(1_400_000 * 1.18));
check("negotiated schedule reconciles",
  negotiated.milestones.reduce((a, m) => a + m.total, 0), negotiated.grandTotal);
// The advance stays the catalogue token; the discount lands in the later stages.
check("negotiated advance unchanged", negotiated.milestones[0]!.base, 50_000);
console.log("  ✓ negotiated unit price");

// Lines in different GST slabs must each be taxed at their own rate.
const mixedGst = buildQuote([{ sku: "DC-60", qty: 1 }], {
  extras: [
    { id: "a", label: "Site development", amount: 200_000, gstPct: 5 },
    { id: "b", label: "DISCOM security deposit", amount: 300_000, gstPct: 0 },
  ],
});
check("mixed-slab subtotal", mixedGst.subtotal, 1_550_000 + 200_000 + 300_000);
check("mixed-slab GST", mixedGst.gst, Math.round(1_550_000 * 0.18 + 200_000 * 0.05 + 300_000 * 0));
check("mixed-slab total", mixedGst.grandTotal, mixedGst.taxableValue + mixedGst.gst);
check("mixed-slab schedule reconciles",
  mixedGst.milestones.reduce((a, m) => a + m.total, 0), mixedGst.grandTotal);
console.log("  ✓ mixed GST slabs with material lines");

// A discount must reduce each line proportionally so blended GST stays right.
const discountedMixed = buildQuote([{ sku: "DC-60", qty: 1 }], {
  discount: 155_000,
  extras: [{ id: "a", label: "Civil work", amount: 345_000, gstPct: 18 }],
});
check("proportional discount taxable", discountedMixed.taxableValue, 1_895_000 - 155_000);
check("proportional discount GST", discountedMixed.gst, Math.round((1_895_000 - 155_000) * 0.18));
check("proportional discount reconciles",
  discountedMixed.milestones.reduce((a, m) => a + m.total, 0), discountedMixed.grandTotal);
console.log("  ✓ discount across mixed slabs");

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.\n`);
  process.exit(1);
}

console.log("\nAll checks passed.\n");
