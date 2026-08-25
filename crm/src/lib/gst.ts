import type { GstType } from "./constants";

export interface GstBreakdownRow {
  label: string;
  pct: number;
  amount: number;
}

/**
 * Splits a document's total GST for display, per its GST type. The total tax
 * amount never changes — IGST shows it as one line at the full rate;
 * CGST_SGST shows the same total split into two equal halves (rounding the
 * first and letting the second absorb the remainder so the two always add
 * back to the original total exactly).
 */
export function gstBreakdown(gstType: GstType | undefined, gstAmount: number, gstPct: number): GstBreakdownRow[] {
  if (gstType === "CGST_SGST") {
    const cgst = Math.round(gstAmount / 2);
    const sgst = gstAmount - cgst;
    return [
      { label: "CGST", pct: gstPct / 2, amount: cgst },
      { label: "SGST", pct: gstPct / 2, amount: sgst },
    ];
  }
  return [{ label: "IGST", pct: gstPct, amount: gstAmount }];
}
