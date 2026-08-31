import * as XLSX from "xlsx";

import type { BoqCategory } from "./constants";
import { extractPdfRows } from "./pdf-table-extract";
import type { BoqLineItem } from "./types";

const HEADER_PATTERNS: Record<string, RegExp> = {
  srNo: /^(sr\.?\s*no\.?|s\.?\s*no\.?|#)$/i,
  description: /description|particular|item.*work|scope|name of (product|item)|product\s*name|item\s*name/i,
  makeOem: /make|oem|brand/i,
  unit: /^unit$/i,
  qty: /qty|quantity/i,
  supplyRate: /supply.*(rate|charge)/i,
  installationRate: /install.*(rate|charge)/i,
  unitRate: /^(unit\s*)?rate/i,
  amount: /amount|total|value/i,
  category: /category/i,
  remarks: /remark/i,
};

const CATEGORY_VALUES: BoqCategory[] = ["HT", "LT", "CIVIL", "MEP", "CHARGER", "OTHER"];

/** A repeated column-header row, or a "Subtotal"/"Total" rollup row -- never a real line item. */
const SKIP_ROW_PATTERN = /^(sub\s*)?total\b|^grand\s*total\b|^description$/i;
/** A bare "Total"/"Grand Total" specifically -- unlike a per-section "Subtotal" or a repeated
 * "Description" header, this marks the actual end of the item table. */
const STOP_ROW_PATTERN = /^total\b|^grand\s*total\b/i;

const normalize = (v: unknown): string => (v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim());
const toNumber = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
/** A cell that's just a number/currency/percent, not real item text -- e.g. a Sr No that landed in the description column because a multi-line wrapped description sits on separate rows above it (common in PDF invoices). */
const looksNumericOnly = (s: string): boolean => s !== "" && /^[\d.,%₹\s-]+$/.test(s);

function detectHeaderRow(rows: unknown[][]): number {
  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const cells = (rows[r] ?? []).map(normalize);
    const hasDescription = cells.some((c) => HEADER_PATTERNS.description!.test(c));
    const hasQtyOrAmount = cells.some((c) => HEADER_PATTERNS.qty!.test(c) || HEADER_PATTERNS.amount!.test(c));
    if (hasDescription && hasQtyOrAmount) return r;
  }
  return -1;
}

function mapColumns(headerRow: unknown[]): Partial<Record<keyof typeof HEADER_PATTERNS, number>> {
  const map: Partial<Record<string, number>> = {};
  headerRow.forEach((cell, idx) => {
    const text = normalize(cell);
    if (!text) return;
    for (const [key, pattern] of Object.entries(HEADER_PATTERNS)) {
      if (map[key] === undefined && pattern.test(text)) { map[key] = idx; break; }
    }
  });
  return map;
}

export interface BoqSheetGroup {
  sheetName: string;
  items: BoqLineItem[];
}

/** Shared by the Excel and PDF import paths -- both reduce to the same unknown[][] row shape. */
function extractBoqItemsFromRows(rows: unknown[][]): BoqLineItem[] {
    const headerIdx = detectHeaderRow(rows);
    if (headerIdx === -1) return [];

    const cols = mapColumns(rows[headerIdx]!);
    if (cols.description === undefined) return [];

    const items: BoqLineItem[] = [];
    let currentSection: string | undefined;
    let autoSr = 1;
    // A PDF invoice often wraps a product's description across several lines that carry no
    // numbers at all, with the quantity/rate figures on one line in the middle of that wrap --
    // buffer those no-data lines and use them as the description once a real data row arrives.
    let pendingDescription: string[] = [];

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const rawDescription = normalize(row[cols.description]);
      if (!rawDescription) {
        // A section label sometimes sits outside the mapped Description column (merged cells
        // commonly land in column A while items start in column B) -- capture the row's first
        // non-blank cell as the section name instead of silently dropping it.
        const firstCell = row.find((v) => normalize(v));
        if (firstCell !== undefined) {
          const label = normalize(firstCell);
          if (!SKIP_ROW_PATTERN.test(label)) { currentSection = label; pendingDescription.push(label); }
        }
        continue;
      }

      // A repeated header row (same sheet, later section) or a "Subtotal"/"Total" rollup row is
      // neither a real item nor a section label -- skip it outright so it doesn't double-count a
      // section's total or overwrite the current section name with the word "Description". A
      // bare "Total"/"Grand Total" (not a per-section "Subtotal") also marks the end of the whole
      // item table once at least one item is captured -- stop rather than continuing into
      // unrelated boilerplate further down the page. A "Subtotal" is only a per-section rollup,
      // so more sections/items can still follow it.
      if (SKIP_ROW_PATTERN.test(rawDescription)) {
        if (items.length && STOP_ROW_PATTERN.test(rawDescription)) break;
        pendingDescription = [];
        continue;
      }

      const srNoCell = cols.srNo !== undefined ? row[cols.srNo] : undefined;
      const hasSrNo = srNoCell !== null && srNoCell !== undefined && srNoCell !== "" && toNumber(srNoCell) > 0;

      const qty = cols.qty !== undefined ? toNumber(row[cols.qty]) : 0;
      const amount = cols.amount !== undefined ? toNumber(row[cols.amount]) : 0;
      const supplyRate = cols.supplyRate !== undefined ? toNumber(row[cols.supplyRate]) : 0;
      const installationRate = cols.installationRate !== undefined ? toNumber(row[cols.installationRate]) : 0;
      const unitRate = cols.unitRate !== undefined ? toNumber(row[cols.unitRate]) : 0;

      // A numbered row is a real line item even with blank qty/rate (rates not finalized yet) --
      // only an un-numbered, all-blank row is actually a section label.
      const hasNumbers = qty || amount || supplyRate || installationRate || unitRate;
      if (!hasNumbers && !hasSrNo) { currentSection = rawDescription; pendingDescription.push(rawDescription); continue; }

      const description = !looksNumericOnly(rawDescription) ? rawDescription : pendingDescription.join(" ");
      pendingDescription = [];
      if (!description) continue;

      const rawCategory = cols.category !== undefined ? normalize(row[cols.category]).toUpperCase() : "";
      const category = (CATEGORY_VALUES as string[]).includes(rawCategory) ? (rawCategory as BoqCategory) : "OTHER";

      items.push({
        section: currentSection,
        srNo: cols.srNo !== undefined && row[cols.srNo] ? toNumber(row[cols.srNo]) : autoSr++,
        description,
        makeOem: cols.makeOem !== undefined ? normalize(row[cols.makeOem]) || undefined : undefined,
        unit: cols.unit !== undefined ? normalize(row[cols.unit]) || undefined : undefined,
        qty,
        rate: unitRate || supplyRate + installationRate || (qty ? amount / qty : 0),
        amount,
        supplyRate,
        installationRate,
        category,
        remarks: cols.remarks !== undefined ? normalize(row[cols.remarks]) || undefined : undefined,
      });
    }

  return items;
}

/**
 * Parses a BOQ-style spreadsheet or text-based PDF (NAKJM's standard formats) into line items,
 * in the browser. Returns one group per sheet that actually contains a BOQ table -- a workbook
 * with multiple sheets commonly represents multiple sites/stations sharing one file (e.g.
 * "Station 1", "Station 2"), so the caller decides whether to import them as one combined BOQ or
 * one per site. A PDF has only one "sheet" (there's no sheet concept in a PDF).
 */
export async function parseBoqFile(file: File): Promise<BoqSheetGroup[]> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    const rows = await extractPdfRows(file);
    const items = extractBoqItemsFromRows(rows);
    return items.length ? [{ sheetName: file.name.replace(/\.[^.]+$/, ""), items }] : [];
  }

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const groups: BoqSheetGroup[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]!;
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
    const items = extractBoqItemsFromRows(rows);
    if (items.length) groups.push({ sheetName, items });
  }

  return groups;
}
