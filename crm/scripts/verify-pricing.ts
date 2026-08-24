/**
 * Guards the quotation engine against the source workbook.
 *
 *   npm run verify
 *
 * The pre-GST figures (basePrice, stage1EOI, stage2Infra) below are still
 * transcribed from "Livanto_Franchise_Investment_Model_New.xlsx" → sheet
 * "Franchise Model" and must not drift from it.
 *
 * The GST-inclusive figures (allIn, stage1/2/3, EMIs) are NOT transcribed
 * from that workbook. A DC charger's catalogue price bundles the hardware
 * (HSN 8504 EVSE, 5% GST) with its electrical/civil BOM build-out (18%
 * GST) — see "Livanto_Franchise_BOM_copy.xlsx" row "1.1 Equipment" for the
 * hardware-only slice of each option's price. These expectations were
 * computed with that split (ChargerSpec.equipmentPrice at 5%, the
 * remainder at 18%), not a flat rate on the whole line. If this fails,
 * either the catalogue's pre-GST figures drifted from the workbook, the
 * equipment/rest split drifted from the BOM, or the GST rate assumption
 * changed again — check which before "fixing" it by loosening the tolerance.
 */

import { CATALOG_LIST } from "../src/lib/catalog";
import { buildQuote } from "../src/lib/pricing";

interface Expectation {
  /** Row 2.1.2 in the workbook, but recomputed at 5% GST (see file header). */
  allIn: number;
  /** Rows 2.2.2 / 2.3.2 / 2.4.2, recomputed at 5% GST (see file header). */
  stage1: number;
  stage2: number;
  stage3: number;
  /** Rows 3.5 and 3.8 — EMI at 3-year and 7-year tenure, on the 5%-GST all-in loan amount. */
  emi3yr: number;
  emi7yr: number;
}

const EXPECTED: Record<number, Expectation> = {
  60: { allIn: 1_751_000, stage1: 56_484, stage2: 847_258, stage3: 847_258, emi3yr: 38_977, emi7yr: 19_720 },
  90: { allIn: 2_321_500, stage1: 56_622, stage2: 1_132_439, stage3: 1_132_439, emi3yr: 51_676, emi7yr: 26_146 },
  120: { allIn: 2_885_500, stage1: 56_578, stage2: 1_414_461, stage3: 1_414_461, emi3yr: 64_231, emi7yr: 32_498 },
  180: { allIn: 3_406_750, stage1: 56_779, stage2: 1_674_985, stage3: 1_674_986, emi3yr: 75_834, emi7yr: 38_368 },
  240: { allIn: 4_328_000, stage1: 113_895, stage2: 2_107_053, stage3: 2_107_052, emi3yr: 96_340, emi7yr: 48_743 },
  360: { allIn: 5_698_500, stage1: 227_940, stage2: 2_735_280, stage3: 2_735_280, emi3yr: 126_848, emi7yr: 64_179 },
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

// Every DC option renders as two lines — Equipment (5%) and Electrical & Civil Work (18%) —
// summing back to the catalogue's bundled price and its blended GST.
const split = buildQuote([{ sku: "DC-60", qty: 1 }]);
check("DC-60 renders as two lines", split.chargerLines.length, 2);
check("DC-60 equipment line base", split.chargerLines[0]!.base, 600_000);
check("DC-60 equipment line GST", split.chargerLines[0]!.gstPct, 5);
check("DC-60 civil line base", split.chargerLines[1]!.base, 950_000);
check("DC-60 civil line GST", split.chargerLines[1]!.gstPct, 18);
console.log("  ✓ charger line renders as Equipment + Electrical & Civil Work");

// Blended mode collapses the same charger to one combined line at one flat rate.
const blended = buildQuote([{ sku: "DC-60", qty: 1, blended: true }]);
check("DC-60 blended renders as one line", blended.chargerLines.length, 1);
check("DC-60 blended line base", blended.chargerLines[0]!.base, 1_550_000);
check("DC-60 blended default GST snaps to nearest slab", blended.chargerLines[0]!.gstPct, 18);
check("DC-60 blended total", blended.grandTotal, Math.round(1_550_000 * 1.18));
console.log("  ✓ blended charger line collapses to one combined rate");

// A mixed basket — the "2 × 60 kW + 2 × 120 kW" case from the brief.
const mixed = buildQuote([
  { sku: "DC-60", qty: 2 },
  { sku: "DC-120", qty: 2 },
]);
check("mixed basket subtotal", mixed.subtotal, (1_550_000 + 2_550_000) * 2);
// DC-60 and DC-120 are each taxed on the BOM's 5%-equipment / 18%-rest split, not a flat 5%.
check("mixed basket GST", mixed.gst, 1_073_000);
check("mixed basket total", mixed.grandTotal, (1_751_000 + 2_885_500) * 2);
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
// DC-180's default GST is the BOM's 5%-equipment / 18%-rest split, not a flat 5%.
check("discounted total", discounted.grandTotal, 3_122_854);
check(
  "discounted schedule reconciles",
  discounted.milestones.reduce((a, m) => a + m.total, 0),
  discounted.grandTotal,
);
console.log("  ✓ discounted quotation");

// --- per-line overrides, mixed GST slabs and material lines -----------------

// A negotiated price replaces only the equipment slice, not the whole line — the electrical &
// civil work line is a separate, independently priced line that keeps its own BOM default
// (₹9,50,000 for DC-60) unless it's overridden too.
const negotiated = buildQuote([{ sku: "DC-60", qty: 1, unitPrice: 1_400_000 }]);
check("negotiated subtotal", negotiated.subtotal, 1_400_000 + 950_000);
check("negotiated total", negotiated.grandTotal, 2_591_000);
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
// The DC-60 line carries no override, so it's taxed on the BOM's 5%/18% split (₹201,000),
// not a flat 5% — plus the site-development extra at 5% and the deposit at 0%.
check("mixed-slab GST", mixedGst.gst, 201_000 + 200_000 * 0.05 + 300_000 * 0);
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
// Mixed rate: the DC-60 line is itself a 5%/18% BOM split (not flat 5%), the
// civil-work extra is a flat 18% — this is not a flat percentage, it's the
// blended result of both lines carrying the discount proportionally. See
// buildQuote()'s keepRatio.
check("proportional discount GST", discountedMixed.gst, 241_580);
check("proportional discount reconciles",
  discountedMixed.milestones.reduce((a, m) => a + m.total, 0), discountedMixed.grandTotal);
console.log("  ✓ discount across mixed slabs");

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.\n`);
  process.exit(1);
}

console.log("\nAll checks passed.\n");
